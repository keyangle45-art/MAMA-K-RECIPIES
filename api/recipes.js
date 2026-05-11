export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, isPro } = req.body || {};
  if (!query) return res.status(400).json({ error: "No query provided" });

  const count = isPro ? 12 : 3;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: isPro ? 4000 : 1500,
        messages: [{
          role: "user",
          content: `You are an expert culinary database. Return ONLY a valid JSON array of exactly ${count} recipes for: "${query}". RULES: Recipe 1 MUST be the most authentic original version. No hyphens in any text. Each object: { "title": string, "emoji": single emoji, "tagline": max 10 words, "time": string, "difficulty": "Easy" or "Medium" or "Advanced", "servings": number, "calories": number, "cuisine": string, "region": short country name, "tags": array of 2 strings, "ingredients": array of 8-12 strings, "steps": array of 5-7 strings }. Return ONLY raw JSON array, no markdown, no extra text.`
        }]
      }),
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) return res.status(500).json({ error: claudeData.error.message });

    const text = (claudeData.content || []).map(b => b.text || "").join("").trim();
    let recipes;
    try {
      recipes = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
    } catch {
      return res.status(500).json({ error: "Parse failed", raw: text.slice(0, 300) });
    }

    if (!Array.isArray(recipes)) return res.status(500).json({ error: "Not an array" });

    const pexelsKey = process.env.PEXELS_API_KEY;
    const withImages = await Promise.all(
      recipes.map(async (recipe) => {
        try {
          const q = encodeURIComponent(`${recipe.title} food dish plated meal`);
          const pRes = await fetch(
            `https://api.pexels.com/v1/search?query=${q}&per_page=3&orientation=landscape&size=medium`,
            { headers: { Authorization: pexelsKey } }
          );
          const pData = await pRes.json();
          const photo = pData?.photos?.[0];
          return { ...recipe, image: photo?.src?.medium || null, photographer: photo?.photographer || null };
        } catch {
          return { ...recipe, image: null };
        }
      })
    );

    return res.status(200).json({ recipes: withImages, isPro, total: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
