import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, arrayUnion, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);

/* ─── Date helpers ───────────────────────────────────────── */
const todayKey = () => new Date().toISOString().slice(0, 10);

/* ─── Search count (server-side per user per day) ────────── */
export const getServerSearchCount = async (uid) => {
  if (!uid) return parseInt(localStorage.getItem("mk_sc_guest") || "0");
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return 0;
    return snap.data().searches?.[todayKey()] || 0;
  } catch { return 0; }
};

export const incrementServerSearchCount = async (uid) => {
  if (!uid) {
    const c = parseInt(localStorage.getItem("mk_sc_guest") || "0") + 1;
    localStorage.setItem("mk_sc_guest", c);
    return c;
  }
  try {
    const ref = doc(db, "users", uid);
    const today = todayKey();
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { searches: { [today]: 1 }, createdAt: serverTimestamp() });
      return 1;
    }
    const current = snap.data().searches?.[today] || 0;
    await updateDoc(ref, { [`searches.${today}`]: increment(1) });
    return current + 1;
  } catch { return 0; }
};

/* ─── Bookmarks ──────────────────────────────────────────── */
export const syncBookmarksToFirestore = async (uid, bookmarks) => {
  if (!uid) return;
  try { await setDoc(doc(db, "users", uid), { bookmarks }, { merge: true }); }
  catch {}
};

export const loadBookmarksFromFirestore = async (uid) => {
  if (!uid) return JSON.parse(localStorage.getItem("mk_bm") || "[]");
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists() && snap.data().bookmarks) return snap.data().bookmarks;
  } catch {}
  return [];
};

/* ─── Pro status ─────────────────────────────────────────── */
export const getUserProStatus = async (uid) => {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() && snap.data().isPro === true;
  } catch { return false; }
};

export const setUserPro = async (uid) => {
  if (!uid) return;
  await setDoc(doc(db, "users", uid), {
    isPro: true,
    proSince: serverTimestamp(),
  }, { merge: true });
};

/* ─── PHASE 2: Engagement Tracking ──────────────────────── */
/**
 * Track engagement signals — feeds into personalization scoring
 * Called when user: opens a recipe, dwells on it, bookmarks it
 */
export const trackEngagement = async (uid, signal) => {
  if (!uid) return;
  try {
    const { type, recipe, dwellSeconds } = signal;
    // type: "open" | "dwell" | "bookmark" | "scroll_depth"
    const updates = {
      lastActiveAt: serverTimestamp(),
      [`engagement.${type}Count`]: increment(1),
    };
    // Update cuisine/region scores based on engagement strength
    const weight = type === "bookmark" ? 5 : type === "dwell" && dwellSeconds > 30 ? 3 : 1;
    if (recipe?.cuisine) updates[`preferences.cuisines.${recipe.cuisine.toLowerCase().replace(/\s+/g, "_")}`] = increment(weight);
    if (recipe?.region)  updates[`preferences.regions.${recipe.region.toLowerCase().replace(/\s+/g, "_")}`] = increment(weight);
    if (recipe?.difficulty) updates[`preferences.difficulty.${recipe.difficulty.toLowerCase()}`] = increment(weight);
    await updateDoc(doc(db, "users", uid), updates);
  } catch {}
};

/**
 * Log every search to user's history
 * Structure: users/{uid}/searchHistory/{timestamp}
 * { query, timestamp, resultCount, cuisine, region }
 */
export const logSearchHistory = async (uid, query, resultCount = 0) => {
  if (!uid) return;
  try {
    const entry = {
      query: query.toLowerCase().trim(),
      searchedAt: serverTimestamp(),
      resultCount,
      id: Date.now().toString(),
    };
    // Store last 50 searches in user doc as array
    await setDoc(doc(db, "users", uid), {
      searchHistory: arrayUnion(entry),
      lastActiveAt: serverTimestamp(),
    }, { merge: true });
  } catch {}
};

export const getSearchHistory = async (uid) => {
  if (!uid) return [];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return [];
    const history = snap.data().searchHistory || [];
    // Return last 20, most recent first
    return history.slice(-20).reverse();
  } catch { return []; }
};

/* ─── PHASE 1: User Preference Profile ──────────────────── */
/**
 * Update preference profile silently on every search + bookmark
 * Tracks: cuisines, regions, difficulty, dietary patterns, activity times
 */
export const updatePreferenceProfile = async (uid, data) => {
  if (!uid) return;
  try {
    const { query, cuisine, region, difficulty, tags = [] } = data;
    const hour = new Date().getHours();
    const timeSlot = hour < 11 ? "morning" : hour < 15 ? "afternoon" : hour < 20 ? "evening" : "night";

    const updates = {
      lastActiveAt: serverTimestamp(),
      [`preferences.activityTimes.${timeSlot}`]: increment(1),
    };

    if (cuisine) updates[`preferences.cuisines.${cuisine.toLowerCase().replace(/\s+/g, "_")}`] = increment(1);
    if (region)  updates[`preferences.regions.${region.toLowerCase().replace(/\s+/g, "_")}`] = increment(1);
    if (difficulty) updates[`preferences.difficulty.${difficulty.toLowerCase()}`] = increment(1);

    // Track dietary signals from tags
    tags.forEach(tag => {
      const t = tag.toLowerCase();
      if (["vegan","vegetarian","healthy","low calorie","low-cal","plant-based"].some(k => t.includes(k))) {
        updates["preferences.dietary.healthy"] = increment(1);
      }
      if (["spicy","hot","chili"].some(k => t.includes(k))) {
        updates["preferences.dietary.spicy"] = increment(1);
      }
      if (["quick","easy","fast","30 min","20 min"].some(k => t.includes(k))) {
        updates["preferences.dietary.quick"] = increment(1);
      }
    });

    // Track African food interest
    const africanKeywords = ["nigerian","jollof","egusi","african","ghanaian","senegalese","ethiopian","kenyan","yoruba","igbo"];
    if (africanKeywords.some(k => query?.toLowerCase().includes(k))) {
      updates["preferences.regions.west_african"] = increment(2); // weight African searches higher
    }

    await updateDoc(doc(db, "users", uid), updates);
  } catch {}
};

export const getPreferenceProfile = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data().preferences || null;
  } catch { return null; }
};

/**
 * Get ordered section IDs based on user preferences
 * Returns array of section IDs sorted by user affinity
 */
export const getAdaptiveSectionOrder = async (uid) => {
  const defaultOrder = [
    "top-african", "top-american", "top-british",
    "top-european", "top-asian", "legacy", "healthy", "community"
  ];
  if (!uid) return defaultOrder;

  try {
    const prefs = await getPreferenceProfile(uid);
    if (!prefs) return defaultOrder;

    const regions = prefs.regions || {};
    const dietary = prefs.dietary || {};

    // Score each section based on user behavior
    const scores = {
      "top-african":  (regions.west_african || 0) + (regions.east_african || 0) + (regions.nigeria || 0) * 2,
      "top-american": (regions.usa || 0) + (regions.america || 0),
      "top-british":  (regions.england || 0) + (regions.uk || 0) + (regions.britain || 0),
      "top-european": (regions.italy || 0) + (regions.france || 0) + (regions.spain || 0) + (regions.europe || 0),
      "top-asian":    (regions.japan || 0) + (regions.china || 0) + (regions.india || 0) + (regions.asia || 0),
      "legacy":       0,
      "healthy":      (dietary.healthy || 0) * 3,
      "community":    0,
    };

    // Sort by score descending, keep default order for ties
    return [...defaultOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
  } catch {
    return defaultOrder;
  }
};
