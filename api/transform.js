import { callAI } from "./ai-provider.js";

/**
 * Recipe Transformations — High Protein / Low Calorie / Vegetarian / Air Fryer / Budget.
 * Same architecture as everything else in this app: check Firestore first,
 * generate via AI only on a genuine miss, save the result permanently so
 * the exact same transformation of the exact same recipe is never
 * regenerated. Pro-gated, enforced server-side.
 */

const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";
const slugify = (s) => (s || "").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);

const rateLimits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { rateLimits.set(ip, { count: 1, start: now }); return false; }
  if (e.count >= 15) return true;
  e.count++; rateLimits.set(ip, e);
  return false;
}

const TRANSFORM_PROMPTS = {
  protein: (r) => `Rewrite this recipe to maximise protein content while keeping it recognisably the same dish. Original: "${r.title}" — ${(r.ingredients||[]).join(", ")}. Return ONLY a JSON object: {"title":string (prefixed "High Protein"),"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"protein_grams":number,"ingredients":[8-12 strings],"steps":[4-6 strings]}. Boost protein via swaps (e.g. add lean meat, Greek yogurt, lentils, tofu, whey) without losing the dish's identity. ONLY raw JSON object, no markdown.`,
  lowcal: (r) => `Rewrite this recipe to be under 400 calories per serving while keeping it recognisably the same dish. Original: "${r.title}" — ${(r.ingredients||[]).join(", ")}. Return ONLY a JSON object: {"title":string (prefixed "Low Calorie"),"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number (must be under 400),"ingredients":[8-12 strings],"steps":[4-6 strings]}. Reduce oil/sugar/cream, add volume with vegetables, use lighter cooking methods. ONLY raw JSON object, no markdown.`,
  veggie: (r) => `Rewrite this recipe as a fully vegetarian version, replacing all meat/fish/poultry with satisfying plant-based alternatives, while keeping it recognisably the same dish. Original: "${r.title}" — ${(r.ingredients||[]).join(", ")}. Return ONLY a JSON object: {"title":string (prefixed "Vegetarian"),"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"ingredients":[8-12 strings],"steps":[4-6 strings]}. ONLY raw JSON object, no markdown.`,
  airfryer: (r) => `Rewrite this recipe's cooking method to use an air fryer instead of the original method, adjusting temperatures and times accordingly. Original: "${r.title}" — steps: ${(r.steps||[]).join(" ")}. Return ONLY a JSON object: {"title":string (prefixed "Air Fryer"),"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"ingredients":[8-12 strings],"steps":[4-6 strings including exact air fryer temperature in F/C and time]}. ONLY raw JSON object, no markdown.`,
  budget: (r) => `Rewrite this recipe using cheaper, widely available substitute ingredients to minimise cost, while keeping it recognisably the same dish, suitable for a student on a tight budget. Original: "${r.title}" — ${(r.ingredients||[]).join(", ")}. Return ONLY a JSON object: {"title":string (prefixed "Budget"),"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"estimated_cost":string (e.g. "$6-8 total"),"ingredients":[8-12 strings],"steps":[4-6 strings]}. ONLY raw JSON object, no markdown.`,
};

const VALID_TYPES = Object.keys(TRANSFORM_PROMPTS);

function toFV(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return { integerValue: String(Math.round(val)) };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFV) } };
  if (typeof val === "object") { const f={}; for(const[k,v] of Object.entries(val)) f[k]=toFV(v); return{mapValue:{fields:f}}; }
  return { stringValue: String(val) };
}
function fromF(fields) {
  const out = {};
  for (const [k, fv] of Object.entries(fields || {})) {
    if (fv.stringValue !== undefined) out[k] = fv.stringValue;
    else if (fv.integerValue !== undefined) out[k] = parseInt(fv.integerValue);
    else if (fv.arrayValue) out[k] = (fv.arrayValue.values || []).map(av => av.stringValue || "");
  }
  return out;
}

async function checkCache(baseTitle, transformType) {
  try {
    const projectId = PROJECT_ID();
    const key = `${slugify(baseTitle)}__${transformType}`;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/transforms/${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.fields) return null;
    return fromF(d.fields);
  } catch { return null; }
}

async function saveTransform(baseTitle, transformType, result) {
  try {
    const projectId = PROJECT_ID();
    const key = `${slugify(baseTitle)}__${transformType}`;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/transforms/${key}`;
    const fields = {};
    for (const [k, v] of Object.entries(result)) fields[k] = toFV(v);
    fields.baseTitle = { stringValue: baseTitle };
    fields.transformType = { stringValue: transformType };
    await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
  } catch { /* non-fatal — result still returns to the user even if the save fails */ }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error: "Too many requests" });

  const { recipe, transformType, isPro } = req.body || {};

  // Recipe Tools' AI transformations are Pro-only — enforced server-side,
  // not just via the frontend paywall gate.
  if (!isPro) return res.status(403).json({ error: "Pro subscription required" });
  if (!recipe?.title) return res.status(400).json({ error: "Missing recipe" });
  if (!VALID_TYPES.includes(transformType)) return res.status(400).json({ error: "Invalid transform type" });

  // 1. Check permanent cache — this exact transformation of this exact
  //    recipe should only ever be generated once, ever.
  const cached = await checkCache(recipe.title, transformType);
  if (cached && cached.ingredients?.length) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json({ result: cached, cached: true });
  }

  // 2. Genuine miss — generate once, save forever.
  try {
    const prompt = TRANSFORM_PROMPTS[transformType](recipe);
    const text = await callAI(prompt, 900);
    const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const result = JSON.parse(clean);
    if (!result?.ingredients?.length) throw new Error("Invalid transform result");

    saveTransform(recipe.title, transformType, result); // fire and forget
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json({ result, cached: false });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Transformation failed" });
  }
}
