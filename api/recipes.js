export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    // 1. Generate recipes from Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Expert culinary database. Return ONLY a valid JSON array of exactly 12 unique recipes for: "${query}".
Each object: { title, emoji, tagline (max 12 words), time, difficulty ("Easy"|"Medium"|"Advanced"), servings (number), calories (approx number), cuisine, tags (array of 2 strings), ingredients (array of 8-12 strings), steps (array of 5-7 strings) }.
For African dishes include authentic regional recipes. For low-cal meals keep calories under 450. Vary difficulty. Return ONLY the JSON array. No markdown, no extra text.`
        }]
      }),
    });

    const claudeData = await claudeRes.json();
    const text = (claudeData.content || []).map(b => b.text || "").join("");

    let recipes;
    try {
      recipes = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return res.status(500).json({ error: "Parse error" });
    }

    // 2. Fetch Pexels images in parallel for each recipe
    const pexelsKey = process.env.PEXELS_API_KEY;

    const withImages = await Promise.all(
      recipes.map(async (recipe) => {
        try {
          const searchTerm = encodeURIComponent(`${recipe.title} food dish`);
          const pRes = await fetch(
            `https://api.pexels.com/v1/search?query=${searchTerm}&per_page=1&orientation=landscape`,
            { headers: { Authorization: pexelsKey } }
          );
          const pData = await pRes.json();
          const photo = pData?.photos?.[0];
          return {
            ...recipe,
            image: photo?.src?.medium || null,
            imageSmall: photo?.src?.small || null,
            photographer: photo?.photographer || null,
          };
        } catch {
          return { ...recipe, image: null, imageSmall: null };
        }
      })
    );

    return res.status(200).json({ recipes: withImages });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
