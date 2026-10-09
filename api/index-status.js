/**
 * Diagnostic endpoint — reports the actual health of the recipe_index
 * collection: total entries, breakdown by category, sample titles.
 * Exists so index health is verifiable with a single GET request instead
 * of assumed. Safe to call anytime — read-only, no side effects.
 *
 * Usage: GET /api/index-status
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: "recipe_index" }],
        limit: 1000, // diagnostic sample, not exhaustive on very large datasets
      }
    };
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(500).json({ error: "Firestore query failed", status: r.status, detail: errText.slice(0, 500) });
    }
    const rows = await r.json();
    const docs = (Array.isArray(rows) ? rows : []).filter(row => row.document);

    const categoryCounts = {};
    const regionCounts = {};
    const sampleTitles = [];

    for (const row of docs) {
      const fields = row.document.fields || {};
      const title = fields.title?.stringValue;
      const region = fields.region?.stringValue;
      const categories = (fields.category?.arrayValue?.values || []).map(v => v.stringValue).filter(Boolean);

      if (title && sampleTitles.length < 15) sampleTitles.push(title);
      if (region) regionCounts[region] = (regionCounts[region] || 0) + 1;
      for (const cat of categories) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    return res.status(200).json({
      totalIndexed: docs.length,
      note: docs.length >= 1000 ? "Sample capped at 1000 — real total may be higher" : "Exact count",
      byCategory: categoryCounts,
      topRegions: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 15),
      sampleTitles,
      healthy: docs.length > 50,
      recommendation: docs.length === 0
        ? "Index is empty. Run POST /api/reindex-existing to backfill from existing seeded recipes."
        : docs.length < 50
          ? "Index is sparse. 'More Like This' will rely on its AI fallback often — that's expected and self-healing, but running the reindex backfill will speed things up immediately."
          : "Index looks healthy.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
