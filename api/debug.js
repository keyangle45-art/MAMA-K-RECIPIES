import { callAI } from "./_ai-provider.js";

/**
 * System health check — reflects whichever AI provider is actually
 * configured via AI_PROVIDER (claude/deepseek/openai), not hardcoded to
 * one provider. Also verifies Pexels and Firestore connectivity, and
 * surfaces recipe_index health so a single GET gives a complete picture
 * of whether the app's core dependencies are working.
 *
 * Usage: GET /api/debug
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const providerName = (process.env.AI_PROVIDER || "claude").toLowerCase();
  const pexelsKey = process.env.PEXELS_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";

  const keyEnvVar = { claude: "ANTHROPIC_API_KEY", deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY" }[providerName];
  const hasProviderKey = !!process.env[keyEnvVar];

  // Test the ACTUAL configured AI provider, not a hardcoded one
  let aiStatus = hasProviderKey ? "untested" : `missing ${keyEnvVar}`;
  if (hasProviderKey) {
    try {
      const reply = await callAI("Say hi", 10);
      aiStatus = reply ? "OK" : "empty response";
    } catch (e) {
      aiStatus = `error: ${e.message}`;
    }
  }

  // Test Pexels
  let pexelsStatus = "missing key";
  if (pexelsKey) {
    try {
      const r = await fetch("https://api.pexels.com/v1/search?query=food&per_page=1", { headers: { Authorization: pexelsKey } });
      pexelsStatus = r.ok ? "OK" : `error: ${r.status}`;
    } catch (e) {
      pexelsStatus = `fetch error: ${e.message}`;
    }
  }

  // Test Firestore connectivity (read-only, hits a harmless nonexistent doc)
  let firestoreStatus = "untested";
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/_healthcheck/ping`;
    const r = await fetch(url);
    // 404 (not found) is EXPECTED and means Firestore is reachable and responding correctly
    firestoreStatus = (r.status === 404 || r.ok) ? "OK" : `unexpected status: ${r.status}`;
  } catch (e) {
    firestoreStatus = `fetch error: ${e.message}`;
  }

  return res.status(200).json({
    aiProvider: providerName,
    aiModel: process.env.AI_MODEL || "(provider default)",
    aiStatus,
    pexels: pexelsStatus,
    firestore: firestoreStatus,
    hasProviderKey,
    hasPexelsKey: !!pexelsKey,
    freeSearchLimit: 1,
    hint: "For recipe_index health specifically (More Like This / category filters), see GET /api/index-status",
  });
}
