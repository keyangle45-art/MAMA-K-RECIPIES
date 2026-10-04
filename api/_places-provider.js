function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1==null||lng1==null||lat2==null||lng2==null) return null;
  const R=6371, dLat=((lat2-lat1)*Math.PI)/180, dLng=((lng2-lng1)*Math.PI)/180;
  const a=Math.sin(dLat/2)**2+Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}
const PROVIDERS = {
  google: {
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
  yelp: { async search(){ return { configured:false, restaurants:[], error:"Yelp provider not implemented yet" }; } },
  foursquare: { async search(){ return { configured:false, restaurants:[], error:"Foursquare provider not implemented yet" }; } },
};
export async function searchNearbyRestaurants(params) {
  const name = (process.env.PLACES_PROVIDER||"google").toLowerCase();
  const p = PROVIDERS[name];
  if (!p) return { configured:false, restaurants:[], error:`Unknown places provider: ${name}` };
  try { return await p.search(params); } catch(err) { return { configured:false, restaurants:[], error:err.message }; }
}
