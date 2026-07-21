/**
 * Recipe Index — flat, individually-queryable Firestore collection.
 *
 * WHY THIS EXISTS:
 * Recipes are generated and saved in BATCHES (2-6 at a time) under a single
 * document keyed by the search query that produced them. That's efficient for
 * search/cache-hit lookups, but Firestore can't run a field-level query
 * ("give me 4 recipes where region == Nigeria") against fields nested inside
 * an array of objects within a document. Two real problems needed that:
 *   1. Category filtering (was guessing likely-seeded query strings)
 *   2. "More Like This" recommendations (was guessing compound AI queries)
 *
 * FIX: every individual recipe ALSO gets one small, self-contained document
 * written to `recipe_index/{recipeSlug}`. It carries the full recipe object
 * plus classification fields (category, region, cuisine), so Firestore CAN
 * run real structured queries against it — array-contains on category,
 * equality on region — with zero AI cost and zero query-guessing.
 *
 * One piece of infrastructure, two gaps closed.
 */

const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";

const slugify = (s) => (s || "").toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 80);

/**
 * Classify a recipe into one or more of the app's category chips,
 * based on its region/cuisine/tags/title. Best-effort heuristic —
 * good enough for filtering, not meant to be perfectly precise.
 */
const REGION_TO_CATEGORY = {
  nigeria: "African", ghana: "African", senegal: "African", ethiopia: "African",
  kenya: "African", "south africa": "African", "west africa": "African",
  "east africa": "African", "north africa": "African", morocco: "African",
  egypt: "African", cameroon: "African", "ivory coast": "African", uganda: "African",
  tanzania: "African", somalia: "African", rwanda: "African", tunisia: "African", libya: "African",

  japan: "Asian", china: "Asian", korea: "Asian", thailand: "Asian", vietnam: "Asian",
  indonesia: "Asian", malaysia: "Asian", singapore: "Asian", philippines: "Asian",
  india: "Asian", pakistan: "Asian", "sri lanka": "Asian",

  italy: "European", france: "European", spain: "European", britain: "European",
  uk: "European", england: "European", scotland: "European", ireland: "European",
  germany: "European", greece: "European", turkey: "European", portugal: "European",
  poland: "European", hungary: "European", netherlands: "European", belgium: "European",
  sweden: "European", norway: "European", denmark: "European", russia: "European",

  usa: "American", america: "American", mexico: "American", brazil: "American",
  argentina: "American", peru: "American", colombia: "American", jamaica: "American",
  cuba: "American", "puerto rico": "American", trinidad: "American",

  lebanon: "European", israel: "European", iran: "Asian",
  "saudi arabia": "Asian", yemen: "Asian", emirates: "Asian",
};

function classifyCategory(recipe) {
  const cats = new Set();
  const region = (recipe.region || "").toLowerCase();
  const cuisine = (recipe.cuisine || "").toLowerCase();
  const tags = (recipe.tags || []).map(t => t.toLowerCase());
  const title = (recipe.title || "").toLowerCase();
  const type = (recipe.type || "food").toLowerCase();

  for (const [key, cat] of Object.entries(REGION_TO_CATEGORY)) {
    if (region.includes(key) || cuisine.includes(key)) cats.add(cat);
  }

  const cal = Number(recipe.calories) || 0;
  if (cal > 0 && cal < 400) cats.add("Healthy");
  if (tags.some(t => t.includes("protein")) || title.includes("protein")) cats.add("High Protein");
  if (tags.some(t => t.includes("vegetarian")) || title.includes("vegetarian")) cats.add("Vegetarian");
  if (tags.some(t => t.includes("vegan")) || title.includes("vegan")) cats.add("Vegetarian");
  if ((recipe.time || "").match(/\b([1-9]|1[0-9]|20)\s*min/) || tags.some(t => t.includes("quick"))) cats.add("Quick Meals");
  if (tags.some(t => /dessert|cake|sweet|pudding|pastry/.test(t)) || /dessert|cake|sweet|pudding|pastry|baklava|tiramisu/.test(title)) cats.add("Desserts");
  if (type === "drink" || tags.some(t => /drink|cocktail|smoothie|juice|tea|coffee/.test(t))) cats.add("Drinks");
  if (/breakfast|pancake|omelette|oats|cereal/.test(title) || tags.some(t => t.includes("breakfast"))) cats.add("Breakfast");
  if (/fish|shrimp|prawn|salmon|seafood|crab|lobster|tuna/.test(title) || tags.some(t => /fish|seafood|shrimp/.test(t))) cats.add("Seafood");

  return Array.from(cats);
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return { integerValue: String(Math.round(val)) };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, fv] of Object.entries(fields || {})) {
    if (fv.stringValue !== undefined) out[k] = fv.stringValue;
    else if (fv.integerValue !== undefined) out[k] = parseInt(fv.integerValue);
    else if (fv.doubleValue !== undefined) out[k] = fv.doubleValue;
    else if (fv.booleanValue !== undefined) out[k] = fv.booleanValue;
    else if (fv.arrayValue) out[k] = (fv.arrayValue.values || []).map(av =>
      av.mapValue ? fromFirestoreFields(av.mapValue.fields) : (av.stringValue ?? av.integerValue ?? "")
    );
    else if (fv.mapValue) out[k] = fromFirestoreFields(fv.mapValue.fields);
    else if (fv.nullValue !== undefined) out[k] = null;
  }
  return out;
}

/**
 * Write one lightweight, individually-queryable index entry per recipe.
 * Fire-and-forget — never blocks the main response.
 */
export function indexRecipes(recipes, isPro) {
  const projectId = PROJECT_ID();
  for (const recipe of recipes) {
    try {
      const category = classifyCategory(recipe);
      const entrySlug = slugify(recipe.title) + (isPro ? "__pro" : "__free");
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recipe_index/${entrySlug}`;
      const body = {
        fields: {
          ...Object.fromEntries(Object.entries({
            title: recipe.title, emoji: recipe.emoji, tagline: recipe.tagline,
            time: recipe.time, difficulty: recipe.difficulty, servings: recipe.servings,
            calories: recipe.calories, cuisine: recipe.cuisine, region: recipe.region,
            tags: recipe.tags, ingredients: recipe.ingredients, steps: recipe.steps,
            image: recipe.image, imageSmall: recipe.imageSmall, imageLarge: recipe.imageLarge,
            photographer: recipe.photographer, type: recipe.type || "food",
          }).map(([k, v]) => [k, toFirestoreValue(v)])),
          category: toFirestoreValue(category),
          viewCount: { integerValue: "0" },
          rating: { doubleValue: 0 },
          ratingCount: { integerValue: "0" },
          createdAt: { timestampValue: new Date().toISOString() },
        }
      };
      fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    } catch { /* never block on indexing failures */ }
  }
}

/**
 * Structured Firestore query against the index — real field-level filtering,
 * not slug-guessing. Returns hydrated recipe objects, ready to display.
 */
export async function queryRecipeIndex({ category, region, excludeTitle, limitCount = 6 }) {
  try {
    const projectId = PROJECT_ID();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const filters = [];
    if (category) {
      filters.push({
        fieldFilter: { field: { fieldPath: "category" }, op: "ARRAY_CONTAINS", value: { stringValue: category } }
      });
    }
    if (region) {
      filters.push({
        fieldFilter: { field: { fieldPath: "region" }, op: "EQUAL", value: { stringValue: region } }
      });
    }
    if (filters.length === 0) return [];

    const where = filters.length === 1
      ? filters[0]
      : { compositeFilter: { op: "AND", filters } };

    const body = {
      structuredQuery: {
        from: [{ collectionId: "recipe_index" }],
        where,
        limit: limitCount + (excludeTitle ? 4 : 0), // fetch a few extra in case we filter one out
      }
    };

    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return [];
    const rows = await res.json();

    const results = (Array.isArray(rows) ? rows : [])
      .filter(r => r.document)
      .map(r => fromFirestoreFields(r.document.fields));

    const filtered = excludeTitle ? results.filter(r => r.title !== excludeTitle) : results;
    return filtered.slice(0, limitCount);
  } catch {
    return [];
  }
}

/** Fire-and-forget view count increment on a recipe index entry. */
export function trackRecipeView(title, isPro) {
  try {
    const projectId = PROJECT_ID();
    const entrySlug = slugify(title) + (isPro ? "__pro" : "__free");
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
    const body = {
      writes: [{
        transform: {
          document: `projects/${projectId}/databases/(default)/documents/recipe_index/${entrySlug}`,
          fieldTransforms: [{ fieldPath: "viewCount", increment: { integerValue: "1" } }],
        }
      }]
    };
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  } catch { /* non-critical */ }
}

export { classifyCategory, slugify };
