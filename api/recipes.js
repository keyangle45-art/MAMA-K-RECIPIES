export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, uid } = req.body || {};
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
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

    const data = await response.json();
    const text = (data.content || []).map(b => b.text || "").join("");

    let recipes;
    try {
      recipes = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return res.status(500).json({ error: "Parse error", raw: text.slice(0, 200) });
    }

    return res.status(200).json({ recipes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
