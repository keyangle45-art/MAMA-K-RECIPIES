/**
 * Places Provider Abstraction
 * ───────────────────────────
 * Switch providers with ONE env var — no code changes anywhere else:
 *
 *   PLACES_PROVIDER=google      → needs GOOGLE_PLACES_API_KEY
 *   PLACES_PROVIDER=foursquare  → needs FOURSQUARE_API_KEY
 *   PLACES_PROVIDER=yelp        → not yet implemented, wired for later
 *
 * Both google and foursquare return the exact same shape from search(),
 * so every caller (ai-tools.js, RestaurantsView, Find Near Me) is
 * completely unaware of which provider is actually active.
 */

function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1==null||lng1==null||lat2==null||lng2==null) return null;
  const R=6371, dLat=((lat2-lat1)*Math.PI)/180, dLng=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

const PROVIDERS = {
  google: {
    envKey: "GOOGLE_PLACES_API_KEY",
    async search({ query, lat, lng, locationText }) {
      const key = process.env.GOOGLE_PLACES_API_KEY;
      if (!key) return { configured: false, restaurants: [] };
      const body = { textQuery: locationText?`${query} in ${locationText}`:`${query} restaurant`, maxResultCount: 5 };
      if (lat && lng && !locationText) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 8000 } };
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type":"application/json", "X-Goog-Api-Key":key, "X-Goog-FieldMask":"places.displayName,places.formattedAddress,places.id,places.location,places.rating,places.currentOpeningHours.openNow" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const t=await r.text().catch(()=>""); console.error("[places:google]",r.status,t.slice(0,300)); return { configured:true, restaurants:[], error:"Lookup failed" }; }
      const data = await r.json();
      const restaurants = (data.places||[]).slice(0,5).map(p => ({
        name: p.displayName?.text||"Restaurant", address: p.formattedAddress, rating: p.rating??null,
        openNow: p.currentOpeningHours?.openNow??null,
        distanceKm: lat&&lng&&p.location ? Math.round(distanceKm(lat,lng,p.location.latitude,p.location.longitude)*10)/10 : null,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.formattedAddress||p.displayName?.text||"")}`,
      }));
      return { configured: true, restaurants };
    },
  },

  // Real implementation against Foursquare's CURRENT Places API
  // (places-api.foursquare.com). Their legacy V3 endpoint was
  // deprecated May 15 2026 — deliberately not used here.
  foursquare: {
    envKey: "FOURSQUARE_API_KEY",
    async search({ query, lat, lng, locationText }) {
      const key = process.env.FOURSQUARE_API_KEY;
      if (!key) return { configured: false, restaurants: [] };

      const params = new URLSearchParams({ query: `${query} restaurant`, limit: "5" });
      if (lat && lng && !locationText) { params.set("ll", `${lat},${lng}`); params.set("radius", "8000"); }
      else if (locationText) { params.set("near", locationText); }

      const r = await fetch(`https://places-api.foursquare.com/places/search?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "X-Places-Api-Version": "2025-06-17",
          "Accept": "application/json",
        },
      });
      if (!r.ok) { const t=await r.text().catch(()=>""); console.error("[places:foursquare]",r.status,t.slice(0,300)); return { configured:true, restaurants:[], error:"Lookup failed" }; }
      const data = await r.json();
      const results = data.results || data.places || [];
      const restaurants = results.slice(0,5).map(p => {
        const placeLat = p.geocodes?.main?.latitude ?? p.latitude ?? null;
        const placeLng = p.geocodes?.main?.longitude ?? p.longitude ?? null;
        const address = p.location?.formatted_address || p.location?.address || null;
        const mapQuery = encodeURIComponent(`${p.name || "Restaurant"} ${address || ""}`.trim());
        return {
          name: p.name || "Restaurant",
          address,
          rating: typeof p.rating === "number" ? p.rating : null,
          openNow: p.hours?.open_now ?? null,
          distanceKm: lat && lng && placeLat && placeLng ? Math.round(distanceKm(lat,lng,placeLat,placeLng)*10)/10 : (typeof p.distance === "number" ? Math.round((p.distance/1000)*10)/10 : null),
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${mapQuery}`,
          directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`,
        };
      });
      return { configured: true, restaurants };
    },
  },

  yelp: {
    envKey: "YELP_API_KEY",
    async search() { return { configured:false, restaurants:[], error:"Yelp provider not implemented yet" }; },
  },
};

export async function searchNearbyRestaurants(params) {
  const name = (process.env.PLACES_PROVIDER||"google").toLowerCase();
  const p = PROVIDERS[name];
  if (!p) return { configured:false, restaurants:[], error:`Unknown places provider: ${name}` };
  try { return await p.search(params); } catch(err) { return { configured:false, restaurants:[], error:err.message }; }
}

/** Diagnostic info for /api/debug — which provider is active, which key it needs, whether that key is present. */
export function placesProviderStatus() {
  const name = (process.env.PLACES_PROVIDER||"google").toLowerCase();
  const p = PROVIDERS[name];
  if (!p) return { provider: name, recognized: false };
  return { provider: name, recognized: true, requiredEnvVar: p.envKey, keyPresent: !!process.env[p.envKey] };
}
