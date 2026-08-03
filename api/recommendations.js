import { queryRecipeIndex, indexRecipes } from "./_recipe-index.js";
import { callAI } from "./_ai-provider.js";

/**
 * "More Like This" — Firestore-indexed first (zero AI cost), with a
 * self-healing AI fallback so the section never silently disappears
 * during the period before the index is fully backfilled/populated.
 * Any AI-generated fallback gets indexed immediately, so the exact
 * same lookup is instant and free for every user after the first.
 */
const rateLimits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { rateLimits.set(ip, { count: 1, start: now }); return false; }
  if (e.count >= 15) return true;
  e.count++; rateLimits.set(ip, e);
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const { title, region, cuisine, category, isPro } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing recipe title" });

  let recs = [];

  // 1. Same region — most relevant, zero AI cost
  if (region) {
    recs = await queryRecipeIndex({ region, excludeTitle: title, limitCount: 4 });
  }

  // 2. Same category — broader fallback, still zero AI cost
  if (recs.length === 0 && category) {
    recs = await queryRecipeIndex({ category, excludeTitle: title, limitCount: 4 });
  }

  // 3. Same cuisine treated as a category-style match, still zero AI cost
  if (recs.length === 0 && cuisine) {
    recs = await queryRecipeIndex({ region: cuisine, excludeTitle: title, limitCount: 4 });
  }

  // 4. Self-healing fallback — the index genuinely has nothing yet for this
  //    corner of the dataset (early days, or a very novel dish). Generate
  //    once, index it immediately, so this exact lookup is a cache hit for
  //    every subsequent user, on the same region/category, forever after.
  let source = recs.length > 0 ? "index" : "none";
  if (recs.length === 0) {
    try {
      const contextLabel = region || cuisine || category || "similar";
      const prompt = `Culinary database. Return ONLY a valid JSON array of exactly 4 recipes similar in style/region to "${title}" (${contextLabel} cuisine). Do NOT include "${title}" itself. Each: {"title":string,"emoji":emoji,"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings]}. ONLY raw JSON array, no markdown.`;
      const text = await callAI(prompt, 1500);
      const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      let generated = JSON.parse(clean);

      if (Array.isArray(generated) && generated.length > 0) {
        generated = generated.filter(r => r.title && r.title !== title);

        // Attach real Pexels images so the fallback looks identical to an index hit
        const pexelsKey = process.env.PEXELS_API_KEY;
        generated = await Promise.all(generated.map(async r => {
          try {
            const q = encodeURIComponent(`${r.title} food dish plated`);
            const pRes = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`, { headers: { Authorization: pexelsKey } });
            const pData = await pRes.json();
            const photo = pData?.photos?.[0];
            return photo ? { ...r, imageSmall: photo.src.tiny, image: photo.src.medium, imageLarge: photo.src.large2x, photographer: photo.photographer } : r;
          } catch { return r; }
        }));

        recs = generated.slice(0, 4);
        source = "ai_fallback_now_indexed";

        // Index immediately (fire and forget) — next lookup for this
        // region/category is a free, instant cache hit, closing the loop.
        indexRecipes(generated, !!isPro);
      }
    } catch (err) {
      console.error("[recommendations] AI fallback failed:", err.message);
      // Still return gracefully — an empty section is acceptable only as
      // an absolute last resort, never as the default behaviour.
    }
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ recipes: recs, source });
}
