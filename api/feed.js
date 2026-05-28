import { callAI } from "./ai-provider.js";

// Feed cache — keyed by preference fingerprint + batch number
const feedCache = new Map();
const CACHE_TTL = 1000 * 60 * 20; // 20 mins

// Rate limit per IP
const rateLimits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { rateLimits.set(ip, { count: 1, start: now }); return false; }
  if (e.count >= 20) return true;
  e.count++; rateLimits.set(ip, e);
  return false;
}

/**
 * Generate personalized feed queries based on user behavior
 * This is the intelligence layer — turns preferences into discovery
 */
function buildFeedQueries(preferences, recentSearches, batch, isPro) {
  const cuisines = preferences?.cuisines || {};
  const regions = preferences?.regions || {};
  const dietary = preferences?.dietary || {};
  const hour = new Date().getHours();
  const timeSlot = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 20 ? "dinner" : "late night snack";

  // Sort cuisines/regions by score
  const topCuisines = Object.entries(cuisines).sort((a, b) => b[1] - a[1]).map(([k]) => k.replace(/_/g, " "));
  const topRegions = Object.entries(regions).sort((a, b) => b[1] - a[1]).map(([k]) => k.replace(/_/g, " "));
  const isHealthy = (dietary.healthy || 0) > 2;
  const isAfricanFan = (regions.west_african || 0) + (regions.nigeria || 0) > 3;

  const batchQueries = {
    // Batch 0 — core interests
    0: topCuisines[0]
      ? `popular ${topCuisines[0]} dishes`
      : "popular world dishes",

    // Batch 1 — time-aware
    1: topCuisines[0]
      ? `${topCuisines[0]} ${timeSlot} recipes`
      : `quick ${timeSlot} recipes`,

    // Batch 2 — depth expansion (adjacent to top interest)
    2: isAfricanFan
      ? "West African street food and snacks"
      : topCuisines[0]
        ? `traditional ${topCuisines[0]} comfort food`
        : "comfort food from around the world",

    // Batch 3 — discovery (similar but new)
    3: topRegions[1]
      ? `popular ${topRegions[1]} dishes`
      : "trending global recipes 2025",

    // Batch 4 — dietary alignment
    4: isHealthy
      ? `healthy ${topCuisines[0] || "international"} meals under 400 calories`
      : `rich flavourful ${topCuisines[0] || "global"} dishes`,

    // Batch 5 — deep dive into top interest
    5: isAfricanFan
      ? "Nigerian party and celebration food"
      : topCuisines[0]
        ? `authentic home cooking ${topCuisines[0]}`
        : "authentic home cooking from top cuisines",

    // Batch 6 — surprise discovery
    6: ["Japanese street food", "Moroccan tagine variations", "Brazilian churrasco", "Lebanese mezze", "Korean BBQ sides"][Math.floor(Math.random() * 5)],

    // Batch 7+ — rotate through interests deeper
    7: topCuisines[1]
      ? `best ${topCuisines[1]} recipes`
      : "hidden gem recipes from lesser known cuisines",

    // Batch 8 — trending + personal mix
    8: `trending ${topCuisines[0] || "global"} recipes this week`,

    // Batch 9 — seasonal/occasion
    9: isAfricanFan
      ? "African fusion modern recipes"
      : `modern fusion recipes inspired by ${topCuisines[0] || "world cuisines"}`,
  };

  // For batches beyond defined ones, cycle through variations
  const batchKey = batch % 10;
  let baseQuery = batchQueries[batchKey] || `popular ${topCuisines[Math.floor(Math.random() * Math.max(1, topCuisines.length))] || "world"} dishes`;

  // Inject recent searches for relevance continuity
  if (recentSearches?.length > 0 && batch % 3 === 0) {
    const recent = recentSearches[Math.floor(Math.random() * Math.min(3, recentSearches.length))];
    if (recent?.query) {
      baseQuery = `dishes similar to ${recent.query}`;
    }
  }

  return baseQuery;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const { preferences, recentSearches, batch = 0, isPro = false, uid } = req.body || {};

  // Free users get 5 feed batches per session, Pro gets unlimited
  const batchLimit = isPro ? 999 : 5;
  if (batch >= batchLimit) {
    return res.status(200).json({
      recipes: [],
      query: "",
      batch,
      done: true,
      upgradePrompt: !isPro,
    });
  }

  // Build the personalized query
  const feedQuery = buildFeedQueries(preferences, recentSearches, batch, isPro);

  // Cache check
  const cacheKey = `feed__${feedQuery}__${isPro}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.status(200).json({ recipes: cached.data, query: feedQuery, batch, cached: true });
  }

  const count = isPro ? 6 : 4;

  try {
    const prompt = `Expert culinary database. Return ONLY a valid JSON array of exactly ${count} diverse recipes for: "${feedQuery}".
Each: {"title":string,"emoji":emoji,"tagline":max 10 words no hyphens,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings]}.
Make recipes feel authentic, varied in difficulty. ONLY raw JSON array.`;

    const text = await callAI(prompt, 1800);
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let recipes = JSON.parse(clean);
    if (!Array.isArray(recipes)) throw new Error("Not array");

    // Fetch images
    const pexelsKey = process.env.PEXELS_API_KEY;
    const withImages = await Promise.all(
      recipes.map(async (r) => {
        try {
          const q = encodeURIComponent(`${r.title} food dish plated`);
          const pRes = await fetch(
            `https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`,
            { headers: { Authorization: pexelsKey } }
          );
          const pData = await pRes.json();
          const photo = pData?.photos?.[0];
          if (!photo) return { ...r, image: null };
          return {
            ...r,
            imageSmall: photo.src.tiny,
            image: photo.src.medium,
            imageLarge: photo.src.large2x,
            photographer: photo.photographer,
          };
        } catch { return { ...r, image: null }; }
      })
    );

    feedCache.set(cacheKey, { data: withImages, time: Date.now() });
    return res.status(200).json({ recipes: withImages, query: feedQuery, batch, done: false });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
