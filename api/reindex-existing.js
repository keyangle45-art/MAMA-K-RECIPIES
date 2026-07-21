import { indexRecipes } from "./recipe-index.js";

/**
 * One-time migration: reads every existing `recipes/{slug}` document and
 * writes individual index entries for each recipe inside it — no AI calls,
 * no cost. Needed because recipes seeded before recipe-index.js existed
 * aren't queryable by category/region yet. Safe to re-run (idempotent PATCH).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { secret, pageToken } = req.body || {};
  if (secret !== process.env.SEED_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";

  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: "recipes" }],
        limit: 20,
      }
    };
    if (pageToken) body.structuredQuery.startAt = { values: [{ referenceValue: pageToken }], before: false };

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const res2 = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const rows = await res2.json();

    let indexed = 0;
    let lastDocName = null;

    for (const row of (Array.isArray(rows) ? rows : [])) {
      if (!row.document) continue;
      lastDocName = row.document.name;
      const fields = row.document.fields || {};
      const docType = fields.type?.stringValue || "food";
      const arr = fields.recipes?.arrayValue?.values || [];

      const recipes = arr.map(v => {
        const f = v.mapValue?.fields || {};
        const out = { type: docType };
        for (const [k, fv] of Object.entries(f)) {
          if (fv.stringValue !== undefined) out[k] = fv.stringValue;
          else if (fv.integerValue !== undefined) out[k] = parseInt(fv.integerValue);
          else if (fv.arrayValue) out[k] = (fv.arrayValue.values || []).map(av => av.stringValue || "");
        }
        return out;
      }).filter(r => r.title);

      if (recipes.length > 0) {
        indexRecipes(recipes, false);
        indexed += recipes.length;
      }
    }

    return res.status(200).json({
      indexedThisBatch: indexed,
      documentsProcessed: (Array.isArray(rows) ? rows : []).filter(r => r.document).length,
      lastDocName,
      done: !lastDocName || (Array.isArray(rows) ? rows.length : 0) < 20,
      hint: lastDocName ? "Call again with pageToken=lastDocName to continue" : "Finished",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
