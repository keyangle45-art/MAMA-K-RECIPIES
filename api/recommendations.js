import { queryRecipeIndex } from "./recipe-index.js";

/**
 * "More Like This" — always Firestore-driven, never AI.
 * Tries region match first (most specific), falls back to category match.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, region, cuisine, category, isPro } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing recipe title" });

  let recs = [];

  // 1. Same region — most relevant
  if (region) {
    recs = await queryRecipeIndex({ region, excludeTitle: title, limitCount: 4 });
  }

  // 2. Same category — broader fallback
  if (recs.length === 0 && category) {
    recs = await queryRecipeIndex({ category, excludeTitle: title, limitCount: 4 });
  }

  // 3. Same cuisine treated as category-style match
  if (recs.length === 0 && cuisine) {
    recs = await queryRecipeIndex({ region: cuisine, excludeTitle: title, limitCount: 4 });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ recipes: recs, source: recs.length > 0 ? "index" : "none" });
}
