import { trackRecipeView } from "./recipe-index.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { title, isPro } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing title" });

  trackRecipeView(title, !!isPro); // fire and forget, never blocks the response
  return res.status(200).json({ ok: true });
}
