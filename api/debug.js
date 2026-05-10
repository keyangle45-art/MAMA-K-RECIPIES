export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  // Test Anthropic
  let anthropicStatus = "missing key";
  if (anthropicKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hi" }],
        }),
      });
      const d = await r.json();
      anthropicStatus = d.error ? `error: ${d.error.message}` : "OK";
    } catch (e) {
      anthropicStatus = `fetch error: ${e.message}`;
    }
  }

  // Test Pexels
  let pexelsStatus = "missing key";
  if (pexelsKey) {
    try {
      const r = await fetch("https://api.pexels.com/v1/search?query=food&per_page=1", {
        headers: { Authorization: pexelsKey },
      });
      pexelsStatus = r.ok ? "OK" : `error: ${r.status}`;
    } catch (e) {
      pexelsStatus = `fetch error: ${e.message}`;
    }
  }

  return res.status(200).json({
    anthropic: anthropicStatus,
    pexels: pexelsStatus,
    hasAnthropicKey: !!anthropicKey,
    hasPexelsKey: !!pexelsKey,
  });
}
