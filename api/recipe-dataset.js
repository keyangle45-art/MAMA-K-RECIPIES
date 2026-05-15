/**
 * Recipe Dataset Layer
 * ────────────────────
 * Saves every generated recipe permanently to Firestore.
 * Structure:
 *
 * recipes/{slugKey}/
 *   query: "jollof rice"
 *   slugKey: "jollof-rice"
 *   recipes: [...] full recipe array
 *   provider: "claude"
 *   model: "claude-haiku-4-5-20251001"
 *   searchCount: 847
 *   firstGeneratedAt: timestamp
 *   lastSearchedAt: timestamp
 *   isPro: false
 *
 * analytics/searches/
 *   topQueries: { "jollof rice": 847, "carbonara": 312, ... }
 *   totalSearches: 12043
 *   totalRecipes: 4821
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Init Firebase Admin (server-side only)
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

// Convert query to a clean Firestore document key
export function slugify(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Check Firestore for cached recipes
 * Returns null if not found or expired
 */
export async function getCachedRecipes(query, isPro) {
  try {
    const db = getAdminDb();
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const snap = await db.collection("recipes").doc(key).get();
    if (!snap.exists) return null;

    const data = snap.data();

    // Update search analytics without blocking
    db.collection("recipes").doc(key).update({
      searchCount: FieldValue.increment(1),
      lastSearchedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    // Update global analytics
    db.collection("analytics").doc("searches").set({
      totalSearches: FieldValue.increment(1),
      [`topQueries.${slugify(query)}`]: FieldValue.increment(1),
    }, { merge: true }).catch(() => {});

    return data.recipes || null;
  } catch {
    return null;
  }
}

/**
 * Save recipes to Firestore permanently
 */
export async function saveRecipesToDataset(query, recipes, isPro, provider, model) {
  try {
    const db = getAdminDb();
    const key = slugify(query) + (isPro ? "__pro" : "__free");
    const slug = slugify(query);

    await db.collection("recipes").doc(key).set({
      query: query.toLowerCase().trim(),
      slugKey: slug,
      recipes,
      isPro,
      provider: provider || "claude",
      model: model || "claude-haiku-4-5-20251001",
      searchCount: 1,
      firstGeneratedAt: FieldValue.serverTimestamp(),
      lastSearchedAt: FieldValue.serverTimestamp(),
    });

    // Update global analytics
    await db.collection("analytics").doc("searches").set({
      totalSearches: FieldValue.increment(1),
      totalRecipes: FieldValue.increment(recipes.length),
      [`topQueries.${slug}`]: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (err) {
    // Non-fatal — log but don't crash the request
    console.error("Dataset save failed:", err.message);
  }
}
