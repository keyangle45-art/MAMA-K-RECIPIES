import { callAI } from "./ai-provider.js";

const hotCache = new Map();
const rateLimits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const e = rateLimits.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { rateLimits.set(ip, { count: 1, start: now }); return false; }
  if (e.count >= 15) return true;
  e.count++; rateLimits.set(ip, e);
  return false;
}

const slugify = q => q.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").slice(0,80);

async function checkFirestore(query, isPro) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recipes/${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const arr = data?.fields?.recipes?.arrayValue?.values;
    if (!arr?.length) return null;
    return arr.map(v => {
      const f = v.mapValue?.fields || {};
      const out = {};
      for (const [k, fv] of Object.entries(f)) {
        if (fv.stringValue !== undefined) out[k] = fv.stringValue;
        else if (fv.integerValue !== undefined) out[k] = parseInt(fv.integerValue);
        else if (fv.booleanValue !== undefined) out[k] = fv.booleanValue;
        else if (fv.arrayValue) out[k] = fv.arrayValue.values?.map(av => av.stringValue || "") || [];
        else if (fv.nullValue !== undefined) out[k] = null;
      }
      return out;
    });
  } catch { return null; }
}

async function saveToFirestore(query, recipes, isPro) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recipes/${key}`;
    const toFV = (val) => {
      if (val === null || val === undefined) return { nullValue: null };
      if (typeof val === "boolean") return { booleanValue: val };
      if (typeof val === "number") return { integerValue: String(Math.round(val)) };
      if (typeof val === "string") return { stringValue: val };
      if (Array.isArray(val)) return { arrayValue: { values: val.map(toFV) } };
      if (typeof val === "object") { const f={}; for(const[k,v] of Object.entries(val)) f[k]=toFV(v); return{mapValue:{fields:f}}; }
      return { stringValue: String(val) };
    };
    fetch(url, { method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ fields: { query:{stringValue:query}, slugKey:{stringValue:slugify(query)}, recipes:toFV(recipes), searchCount:{integerValue:"1"} } })
    }).catch(()=>{});
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]||"unknown";
  if (isRateLimited(ip)) return res.status(429).json({error:"Too many requests"});

  const { query, isPro } = req.body||{};
  if (!query||typeof query!=="string") return res.status(400).json({error:"No query"});
  const cleanQ = query.trim().slice(0,100);
  if (cleanQ.length<2) return res.status(400).json({error:"Query too short"});

  const count = isPro ? 6 : 2;
  const cacheKey = `${cleanQ.toLowerCase()}__${isPro}`;

  // 1. Hot memory cache
  const hot = hotCache.get(cacheKey);
  if (hot && Date.now()-hot.time < 1800000) {
    res.setHeader("X-Cache","HIT-MEMORY");
    return res.status(200).json({ recipes:hot.data, isPro, cached:true });
  }

  // 2. Firestore database cache
  const dbRecipes = await checkFirestore(cleanQ, isPro);
  if (dbRecipes?.length) {
    hotCache.set(cacheKey, { data:dbRecipes, time:Date.now() });
    res.setHeader("X-Cache","HIT-FIRESTORE");
    return res.status(200).json({ recipes:dbRecipes, isPro, cached:true });
  }

  // 3. Generate with AI
  try {
    const prompt = `Culinary database. Return ONLY valid JSON array of exactly ${count} recipes for: "${cleanQ}". Recipe 1 = most authentic original. Each: {"title":string,"emoji":emoji,"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings]}. ONLY raw JSON array.`;
    const text = await callAI(prompt, isPro?3000:1200);
    let recipes = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
    if (!Array.isArray(recipes)) throw new Error("Not array");

    // Fetch Pexels images
    const pexelsKey = process.env.PEXELS_API_KEY;
    const withImages = await Promise.all(recipes.map(async r => {
      try {
        const q = encodeURIComponent(`${r.title} food dish plated`);
        const pRes = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`,{headers:{Authorization:pexelsKey}});
        const pData = await pRes.json();
        const photo = pData?.photos?.[0];
        return photo ? {...r,imageSmall:photo.src.tiny,image:photo.src.medium,imageLarge:photo.src.large2x,photographer:photo.photographer} : {...r,image:null};
      } catch { return {...r,image:null}; }
    }));

    hotCache.set(cacheKey, { data:withImages, time:Date.now() });
    saveToFirestore(cleanQ, withImages, isPro);
    res.setHeader("X-Cache","MISS");
    return res.status(200).json({ recipes:withImages, isPro });
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
