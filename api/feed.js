import { callAI } from "./ai-provider.js";

const cache = new Map();
const rateLimit = new Map();

function limited(ip) {
  const now = Date.now();
  const e = rateLimit.get(ip)||{count:0,start:now};
  if (now-e.start>60000){rateLimit.set(ip,{count:1,start:now});return false;}
  if (e.count>=20) return true;
  e.count++;rateLimit.set(ip,e);return false;
}

const slugify = q => q.toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").slice(0,80);

async function getFromFirestore(query) {
  try {
    const pid = process.env.FIREBASE_PROJECT_ID||"mama-k-recipies";
    const key = slugify(query)+"__free";
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/recipes/${key}`);
    if (!r.ok) return null;
    const d = await r.json();
    const arr = d?.fields?.recipes?.arrayValue?.values;
    if (!arr?.length) return null;
    return arr.map(v => {
      const f=v.mapValue?.fields||{};const out={};
      for(const[k,fv] of Object.entries(f)){
        if(fv.stringValue!==undefined)out[k]=fv.stringValue;
        else if(fv.integerValue!==undefined)out[k]=parseInt(fv.integerValue);
        else if(fv.arrayValue)out[k]=fv.arrayValue.values?.map(av=>av.stringValue||"")||[];
        else if(fv.nullValue!==undefined)out[k]=null;
      }
      return out;
    });
  } catch { return null; }
}

function buildQuery(prefs, recent, batch) {
  const cuisines = Object.entries(prefs?.cuisines||{}).sort((a,b)=>b[1]-a[1]).map(([k])=>k.replace(/_/g," "));
  const regions = Object.entries(prefs?.regions||{}).sort((a,b)=>b[1]-a[1]).map(([k])=>k.replace(/_/g," "));
  const isHealthy = (prefs?.dietary?.healthy||0) > 2;
  const isAfrican = (prefs?.regions?.west_african||0)+(prefs?.regions?.nigeria||0) > 3;
  const hour = new Date().getHours();
  const meal = hour<11?"breakfast":hour<15?"lunch":hour<20?"dinner":"late night snack";

  const queries = [
    cuisines[0] ? `popular ${cuisines[0]} dishes` : "popular world dishes",
    cuisines[0] ? `${cuisines[0]} ${meal} recipes` : `quick ${meal} recipes`,
    isAfrican ? "West African street food and snacks" : cuisines[0] ? `traditional ${cuisines[0]} comfort food` : "comfort food world",
    regions[1] ? `popular ${regions[1]} dishes` : "trending global recipes",
    isHealthy ? `healthy ${cuisines[0]||"international"} meals under 400 calories` : `rich ${cuisines[0]||"global"} dishes`,
    isAfrican ? "Nigerian party celebration food" : cuisines[0] ? `authentic ${cuisines[0]} home cooking` : "authentic home cooking",
    ["Japanese street food","Moroccan tagine","Brazilian churrasco","Lebanese mezze","Korean BBQ"][Math.floor(Math.random()*5)],
    cuisines[1] ? `best ${cuisines[1]} recipes` : "hidden gem world cuisines",
    `trending ${cuisines[0]||"global"} recipes`,
    isAfrican ? "African fusion modern recipes" : `modern fusion ${cuisines[0]||"world cuisine"}`,
  ];

  // Every 3rd batch use recent search for relevance
  if (recent?.length && batch%3===0) {
    const r = recent[Math.floor(Math.random()*Math.min(3,recent.length))];
    if (r?.query) return `dishes similar to ${r.query}`;
  }

  return queries[batch%queries.length] || "popular world dishes";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const ip = req.headers["x-forwarded-for"]?.split(",")[0]||"unknown";
  if (limited(ip)) return res.status(429).json({error:"Too many requests"});

  const { preferences, recentSearches, batch=0, isPro=false, filter="What to Eat" } = req.body||{};
  const batchNum = Number(batch);
  const limit = isPro ? 999 : 5;

  if (batchNum >= limit) {
    return res.status(200).json({ recipes:[], done:true, upgradePrompt:!isPro });
  }

  // Build query based on active filter
  const CATEGORY_QUERIES = {
    "African": ["popular West African dishes","East African cuisine","North African recipes","South African food","Nigerian street food","Ghanaian dishes"],
    "Asian": ["Japanese cuisine dishes","Korean food recipes","Chinese authentic dishes","Thai street food","Vietnamese recipes","Indian curry dishes"],
    "European": ["Italian pasta recipes","French cuisine dishes","Spanish food","British classic meals","German recipes","Greek Mediterranean food"],
    "American": ["American comfort food","BBQ American dishes","Southern fried chicken recipes","Mexican Tex-Mex food","Latin American cuisine","Brazilian dishes"],
    "Healthy": ["healthy meals under 400 calories","low calorie nutritious food","clean eating recipes","balanced diet meals","low fat high nutrition food"],
    "High Protein": ["high protein chicken meals","protein rich beef dishes","high protein fish recipes","protein meal prep ideas","muscle building meals"],
    "Vegetarian": ["vegetarian world cuisine","meat-free comfort food","vegetarian Asian dishes","vegetarian Mediterranean food","vegetarian African dishes"],
    "Quick Meals": ["quick 15 minute meals","easy 20 minute dinner","fast weeknight cooking","simple quick lunch ideas","speedy breakfast recipes"],
    "Desserts": ["world famous desserts","African sweet treats","Asian desserts","European classic desserts","chocolate desserts","fruit based desserts"],
    "Drinks": ["healthy smoothies and juices","African traditional drinks","world famous beverages","herbal teas and infusions","fresh fruit juices"],
    "Breakfast": ["healthy breakfast ideas","African breakfast dishes","full cooked breakfast","protein rich morning meals","quick breakfast recipes"],
    "Seafood": ["grilled fish recipes","shrimp seafood dishes","salmon cooking ideas","African fish stew","Asian seafood recipes","Mediterranean seafood"],
  };

  let query;
  if (filter === "What to Eat" || filter === "All") {
    query = buildQuery(preferences, recentSearches, batchNum);
  } else {
    const catQueries = CATEGORY_QUERIES[filter] || [`popular ${filter} recipes`];
    query = catQueries[batchNum % catQueries.length];
  }
  const cacheKey = `feed__${query}__${isPro}`;

  // Memory cache
  const hot = cache.get(cacheKey);
  if (hot && Date.now()-hot.time < 1800000) {
    return res.status(200).json({ recipes:hot.data, query, batch:batchNum, cached:true });
  }

  // Firestore database cache — serve existing recipes first
  const dbRecipes = await getFromFirestore(query);
  if (dbRecipes?.length) {
    cache.set(cacheKey, { data:dbRecipes, time:Date.now() });
    return res.status(200).json({ recipes:dbRecipes, query, batch:batchNum, cached:true });
  }

  // Generate with AI only on cache miss
  const count = isPro ? 6 : 4;
  try {
    const prompt = `Culinary database. Return ONLY valid JSON array of exactly ${count} diverse recipes for: "${query}". Each: {"title":string,"emoji":emoji,"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings]}. ONLY raw JSON array.`;
    const text = await callAI(prompt, 1800);
    let recipes = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
    if (!Array.isArray(recipes)) throw new Error("Not array");

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

    cache.set(cacheKey, { data:withImages, time:Date.now() });
    return res.status(200).json({ recipes:withImages, query, batch:batchNum, done:false });
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
