import { callAI } from "./_ai-provider.js";
import { indexRecipes } from "./_recipe-index.js";
import { searchNearbyRestaurants } from "./_places-provider.js";
const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";
const slugify = (s) => (s||"").toLowerCase().trim().replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").slice(0,80);
const rateLimits = new Map();
function isRateLimited(ip) {
  const now=Date.now(), e=rateLimits.get(ip)||{count:0,start:now};
  if (now-e.start>60000){rateLimits.set(ip,{count:1,start:now});return false;}
  if (e.count>=15) return true;
  e.count++; rateLimits.set(ip,e); return false;
}
function toFV(val) {
  if (val===null||val===undefined) return { nullValue:null };
  if (typeof val==="boolean") return { booleanValue:val };
  if (typeof val==="number") return { integerValue:String(Math.round(val)) };
  if (typeof val==="string") return { stringValue:val };
  if (Array.isArray(val)) return { arrayValue:{ values: val.map(toFV) } };
  if (typeof val==="object") { const f={}; for(const[k,v] of Object.entries(val)) f[k]=toFV(v); return{mapValue:{fields:f}}; }
  return { stringValue:String(val) };
}
function fromF(fields) {
  const out = {};
  for (const [k,fv] of Object.entries(fields||{})) {
    if (fv.stringValue!==undefined) out[k]=fv.stringValue;
    else if (fv.integerValue!==undefined) out[k]=parseInt(fv.integerValue);
    else if (fv.doubleValue!==undefined) out[k]=fv.doubleValue;
    else if (fv.booleanValue!==undefined) out[k]=fv.booleanValue;
    else if (fv.arrayValue) out[k]=(fv.arrayValue.values||[]).map(av=>av.mapValue?fromF(av.mapValue.fields):(av.stringValue??""));
    else if (fv.mapValue) out[k]=fromF(fv.mapValue.fields);
  }
  return out;
}
async function firestoreGet(path) {
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID()}/databases/(default)/documents/${path}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.fields ? fromF(d.fields) : null;
  } catch { return null; }
}
async function firestoreSet(path, fields) {
  try {
    const body = { fields:{} };
    for (const [k,v] of Object.entries(fields)) body.fields[k]=toFV(v);
    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID()}/databases/(default)/documents/${path}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  } catch {}
}
async function handleAsk(req,res) {
  const { uid, recipeTitle, recipeContext, question, isPro } = req.body||{};
  if (!isPro) return res.status(403).json({ error:"Pro subscription required" });
  if (!uid||!recipeTitle||!question) return res.status(400).json({ error:"Missing required fields" });
  const key = `conversations/${uid}__${slugify(recipeTitle)}`;
  const existing = await firestoreGet(key);
  const history = existing?.messages||[];
  const ctx = recipeContext ? `Recipe: "${recipeTitle}". Ingredients: ${(recipeContext.ingredients||[]).join(", ")}. Steps: ${(recipeContext.steps||[]).join(" ")}.` : `Recipe: "${recipeTitle}".`;
  const hb = history.slice(-6).map(m=>`${m.role}: ${m.text}`).join("\n");
  const prompt = `You are a helpful, concise cooking assistant answering a question about ONE specific recipe. ${ctx}\n${hb?"Previous conversation:\n"+hb+"\n":""}User question: "${question}"\nAnswer directly and practically in 2-4 sentences. If suggesting a substitution, be specific about ratios or method changes. No markdown, plain conversational text only.`;
  try {
    const answer = await callAI(prompt, 350);
    const newMessages = [...history, {role:"user",text:question,at:Date.now()}, {role:"assistant",text:answer.trim(),at:Date.now()}].slice(-30);
    await firestoreSet(key, { uid, recipeTitle, messages:newMessages, updatedAt:new Date().toISOString() });
    return res.status(200).json({ answer:answer.trim(), messages:newMessages });
  } catch(err) { return res.status(500).json({ error: err.message||"Ask AI failed" }); }
}
async function handleGetConversation(req,res) {
  const { uid, recipeTitle } = req.body||{};
  if (!uid||!recipeTitle) return res.status(400).json({ error:"Missing uid or recipeTitle" });
  const existing = await firestoreGet(`conversations/${uid}__${slugify(recipeTitle)}`);
  return res.status(200).json({ messages: existing?.messages||[] });
}
async function handleListConversations(req,res) {
  const { uid } = req.body||{};
  if (!uid) return res.status(400).json({ error:"Missing uid" });
  try {
    const body = { structuredQuery:{ from:[{collectionId:"conversations"}], where:{fieldFilter:{field:{fieldPath:"uid"},op:"EQUAL",value:{stringValue:uid}}}, limit:20 } };
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID()}/databases/(default)/documents:runQuery`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    if (!r.ok) return res.status(200).json({ conversations:[] });
    const rows = await r.json();
    const conversations = (Array.isArray(rows)?rows:[]).filter(row=>row.document).map(row=>fromF(row.document.fields)).filter(c=>c.messages?.length>0)
      .map(c=>({recipeTitle:c.recipeTitle,lastMessage:c.messages[c.messages.length-1]?.text,updatedAt:c.updatedAt,messageCount:c.messages.length}))
      .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    return res.status(200).json({ conversations });
  } catch { return res.status(200).json({ conversations:[] }); }
}
async function handleMealPlan(req,res) {
  const { uid, isPro, goals, planType, preferences } = req.body||{};
  if (!isPro) return res.status(403).json({ error:"Pro subscription required" });
  if (!uid) return res.status(400).json({ error:"Missing uid" });
  const days = planType==="monthly"?30:7;
  const goalsList = (goals||[]).join(", ")||"balanced everyday cooking";
  const topCuisines = Object.entries(preferences?.regions||{}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k])=>k.replace(/_/g," "));
  const cuisineHint = topCuisines.length?` Lean toward ${topCuisines.join(" and ")} cuisine where it fits naturally.`:"";
  try {
    const prompt = `Generate a ${days===30?"4 week":"7 day"} meal plan. Goals: ${goalsList}.${cuisineHint} Return ONLY a JSON object: {"days":[{"day":"Monday","breakfast":{"title":string,"calories":number},"lunch":{"title":string,"calories":number},"dinner":{"title":string,"calories":number}}]} with exactly ${Math.min(days,7)} entries. ONLY raw JSON object, no markdown.`;
    const text = await callAI(prompt, 2200);
    const plan = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
    if (!plan?.days?.length) throw new Error("Invalid plan generated");
    await firestoreSet(`meal_plans/${uid}__${planType||"weekly"}`, { uid, planType:planType||"weekly", goals:goals||[], plan:plan.days, generatedAt:new Date().toISOString() });
    return res.status(200).json({ days: plan.days, planType: planType||"weekly" });
  } catch(err) { return res.status(500).json({ error: err.message||"Meal plan generation failed" }); }
}
async function handleGetMealPlan(req,res) {
  const { uid, planType } = req.body||{};
  if (!uid) return res.status(400).json({ error:"Missing uid" });
  const existing = await firestoreGet(`meal_plans/${uid}__${planType||"weekly"}`);
  return res.status(200).json({ days: existing?.plan||null, generatedAt: existing?.generatedAt||null });
}
async function handleShoppingListFromPlan(req,res) {
  const { days } = req.body||{};
  if (!Array.isArray(days)||days.length===0) return res.status(400).json({ error:"Missing plan days" });
  const titles = days.flatMap(d=>[d.breakfast?.title,d.lunch?.title,d.dinner?.title]).filter(Boolean);
  try {
    const prompt = `Given these planned meals: ${titles.join(", ")}. Generate a single consolidated grocery shopping list combining and deduplicating ingredients. Return ONLY a JSON object: {"produce":[strings],"protein":[strings],"dairy":[strings],"grains":[strings],"spices_and_sauces":[strings],"other":[strings]}. ONLY raw JSON object, no markdown.`;
    const text = await callAI(prompt, 800);
    const list = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
    return res.status(200).json({ list });
  } catch(err) { return res.status(500).json({ error: err.message||"Shopping list generation failed" }); }
}
async function handlePantry(req,res) {
  const { ingredients, isPro } = req.body||{};
  if (!Array.isArray(ingredients)||ingredients.length===0) return res.status(400).json({ error:"Provide at least one ingredient" });
  const clean = ingredients.map(i=>String(i).trim()).filter(Boolean).slice(0,15);
  const cacheKey = `pantry_cache/${slugify(clean.slice().sort().join("-"))}`;
  const cached = await firestoreGet(cacheKey);
  if (cached?.recipes?.length) return res.status(200).json({ recipes:cached.recipes, cached:true });
  const count = isPro?6:3;
  try {
    const prompt = `I have these ingredients available: ${clean.join(", ")}. Return ONLY a valid JSON array of exactly ${count} recipes that primarily use these ingredients. Each: {"title":string,"emoji":emoji,"tagline":max 10 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings]}. ONLY raw JSON array, no markdown.`;
    const text = await callAI(prompt, isPro?2200:1200);
    let recipes = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim());
    if (!Array.isArray(recipes)||recipes.length===0) throw new Error("No pantry recipes generated");
    const pexelsKey = process.env.PEXELS_API_KEY;
    recipes = await Promise.all(recipes.map(async r => {
      try {
        const q = encodeURIComponent(`${r.title} food dish plated`);
        const pRes = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`, { headers:{Authorization:pexelsKey} });
        const pData = await pRes.json();
        const photo = pData?.photos?.[0];
        return photo ? { ...r, imageSmall:photo.src.tiny, image:photo.src.medium, imageLarge:photo.src.large2x, photographer:photo.photographer } : r;
      } catch { return r; }
    }));
    await firestoreSet(cacheKey, { ingredients:clean, recipes, createdAt:new Date().toISOString() });
    indexRecipes(recipes, !!isPro);
    return res.status(200).json({ recipes, cached:false });
  } catch(err) { return res.status(500).json({ error: err.message||"Pantry search failed" }); }
}
async function handleRestaurants(req,res) {
  const { dishOrCuisine, lat, lng, locationText } = req.body||{};
  if (!dishOrCuisine) return res.status(400).json({ error:"Missing dishOrCuisine" });
  if (!lat&&!lng&&!locationText) return res.status(400).json({ error:"Provide either coordinates or a location" });
  const roughLat = lat?Math.round(lat*100)/100:"any", roughLng = lng?Math.round(lng*100)/100:"any";
  const locKey = locationText?slugify(locationText):`${roughLat}_${roughLng}`;
  const cacheKey = `restaurant_cache/${slugify(dishOrCuisine)}__${locKey}`;
  const cached = await firestoreGet(cacheKey);
  if (cached?.restaurants && (Date.now()-(cached.cachedAt||0))<7*24*60*60*1000) return res.status(200).json({ restaurants:cached.restaurants, configured:true, cached:true });
  const result = await searchNearbyRestaurants({ query:dishOrCuisine, lat, lng, locationText });
  if (!result.configured) return res.status(200).json({ restaurants:[], configured:false, note:"Find Near Me needs GOOGLE_PLACES_API_KEY (or another configured PLACES_PROVIDER) in Vercel env vars to activate." });
  if (result.restaurants.length>0) await firestoreSet(cacheKey, { restaurants:result.restaurants, cachedAt:Date.now() });
  return res.status(200).json({ restaurants:result.restaurants, configured:true, cached:false, error:result.error });
}
export default async function handler(req,res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).json({ error:"Method not allowed" });
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]||"unknown";
  if (isRateLimited(ip)) return res.status(429).json({ error:"Too many requests" });
  const { action } = req.body||{};
  switch(action) {
    case "ask": return handleAsk(req,res);
    case "get-conversation": return handleGetConversation(req,res);
    case "list-conversations": return handleListConversations(req,res);
    case "meal-plan": return handleMealPlan(req,res);
    case "get-meal-plan": return handleGetMealPlan(req,res);
    case "shopping-list-from-plan": return handleShoppingListFromPlan(req,res);
    case "pantry": return handlePantry(req,res);
    case "restaurants": return handleRestaurants(req,res);
    default: return res.status(400).json({ error:"Unknown or missing action" });
  }
}
