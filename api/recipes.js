import { callAI } from "./ai-provider.js";
import { getCachedRecipes, saveRecipesToDataset } from "./recipe-dataset.js";

// Hot memory cache (serverless warm instance, resets on cold start)
const hotCache = new Map();
const HOT_CACHE_TTL = 1000 * 60 * 30; // 30 mins

// Rate limiter
const rateLimits = new Map();
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = 15;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) { rateLimits.set(ip, { count: 1, start: now }); return false; }
  if (entry.count >= RATE_MAX) return true;
  entry.count++;
  rateLimits.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Rate limit
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests. Please wait." });

  // Validate input
  const { query, isPro } = req.body || {};
  if (!query || typeof query !== "string") return res.status(400).json({ error: "No query" });
  const cleanQuery = query.trim().slice(0, 100);
  if (cleanQuery.length < 2) return res.status(400).json({ error: "Query too short" });

  const count = isPro ? 6 : 2;
  const cacheKey = `${cleanQuery.toLowerCase()}__${isPro ? "pro" : "free"}`;

  // 1. Hot memory cache
  const hot = hotCache.get(cacheKey);
  if (hot && Date.now() - hot.time < HOT_CACHE_TTL) {
    res.setHeader("X-Cache", "HIT-MEMORY");
    return res.status(200).json({ recipes: hot.data, isPro, total: count, cached: true });
  }

  // 2. Firestore dataset cache
  const firestoreCached = await getCachedRecipes(cleanQuery, isPro);
  if (firestoreCached) {
    hotCache.set(cacheKey, { data: firestoreCached, time: Date.now() });
    res.setHeader("X-Cache", "HIT-FIRESTORE");
    return res.status(200).json({ recipes: firestoreCached, isPro, total: count, cached: true });
  }

  // 3. Generate fresh recipes
  const provider = process.env.AI_PROVIDER || "claude";
  const model = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

  const prompt = `Culinary database. JSON array of ${count} recipes for: "${cleanQuery}". Recipe 1 = most authentic original version. No hyphens. Each: {"title":string,"emoji":emoji,"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[8-12 strings],"steps":[5-7 strings]}. ONLY raw JSON array, no markdown.`;

  let recipes;
  try {
    const text = await callAI(prompt, isPro ? 3000 : 1200);
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    recipes = JSON.parse(clean);
    if (!Array.isArray(recipes)) throw new Error("Not an array");
  } catch (err) {
    return res.status(500).json({ error: "Recipe generation failed", detail: err.message });
  }

  // 4. Fetch Pexels images — 3 sizes for quality + speed
  const pexelsKey = process.env.PEXELS_API_KEY;
  const withImages = await Promise.all(
    recipes.map(async (recipe) => {
      try {
        const q = encodeURIComponent(`${recipe.title} food dish plated`);
        const pRes = await fetch(
          `https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`,
          { headers: { Authorization: pexelsKey } }
        );
        const pData = await pRes.json();
        const photo = pData?.photos?.[0];
        if (!photo) return { ...recipe, image: null };
        return {
          ...recipe,
          imageSmall: photo.src.tiny,       // ~3KB — blur placeholder
          image: photo.src.medium,           // ~30KB — card display
          imageLarge: photo.src.large2x,     // ~200KB — detail hero (full quality)
          photographer: photo.photographer,
          photographerUrl: photo.photographer_url,
        };
      } catch {
        return { ...recipe, image: null };
      }
    })
  );

  // 5. Save to dataset + hot cache (non-blocking)
  hotCache.set(cacheKey, { data: withImages, time: Date.now() });
  saveRecipesToDataset(cleanQuery, withImages, isPro, provider, model);

  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.setHeader("X-Cache", "MISS");
  res.setHeader("X-Provider", provider);

  return res.status(200).json({ recipes: withImages, isPro, total: count });
}
