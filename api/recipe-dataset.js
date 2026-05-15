/**
 * Recipe Dataset Layer
 * Saves recipes to Firestore via REST API (no firebase-admin needed)
 */

export function slugify(query) {
  return query.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// Get Firestore REST base URL
function firestoreUrl(path) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

// Convert JS value to Firestore REST format
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

/**
 * Check Firestore for cached recipes
 */
export async function getCachedRecipes(query, isPro) {
  try {
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const url = firestoreUrl(`recipes/${key}`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const recipesField = data?.fields?.recipes;
    if (!recipesField) return null;
    // Decode array of maps
    const recipes = recipesField.arrayValue?.values?.map(v => {
      const fields = v.mapValue?.fields || {};
      const out = {};
      for (const [k, fv] of Object.entries(fields)) {
        if (fv.stringValue !== undefined) out[k] = fv.stringValue;
        else if (fv.integerValue !== undefined) out[k] = parseInt(fv.integerValue);
        else if (fv.booleanValue !== undefined) out[k] = fv.booleanValue;
        else if (fv.arrayValue) out[k] = fv.arrayValue.values?.map(av => av.stringValue || "") || [];
        else if (fv.nullValue !== undefined) out[k] = null;
      }
      return out;
    }) || [];
    return recipes.length > 0 ? recipes : null;
  } catch {
    return null;
  }
}

/**
 * Save recipes to Firestore dataset (non-blocking)
 */
export async function saveRecipesToDataset(query, recipes, isPro, provider, model) {
  try {
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const url = firestoreUrl(`recipes/${key}`);

    const body = {
      fields: {
        query: { stringValue: query.toLowerCase().trim() },
        slugKey: { stringValue: slugify(query) },
        isPro: { booleanValue: !!isPro },
        provider: { stringValue: provider || "claude" },
        model: { stringValue: model || "claude-haiku-4-5-20251001" },
        searchCount: { integerValue: "1" },
        recipes: toFirestoreValue(recipes.map(r => ({
          title: r.title || "",
          emoji: r.emoji || "",
          tagline: r.tagline || "",
          time: r.time || "",
          difficulty: r.difficulty || "Easy",
          servings: r.servings || 2,
          calories: r.calories || 0,
          cuisine: r.cuisine || "",
          region: r.region || "",
          tags: r.tags || [],
          ingredients: r.ingredients || [],
          steps: r.steps || [],
          image: r.image || "",
          imageSmall: r.imageSmall || "",
          imageLarge: r.imageLarge || "",
          photographer: r.photographer || "",
        }))),
      }
    };

    // Fire and forget — don't await, don't block the response
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});

  } catch {
    // Non-fatal
  }
}
