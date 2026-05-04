import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";

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

/* ─── Search count (server-side per user per day) ─────────── */
const todayKey = () => new Date().toISOString().slice(0, 10); // "2026-05-03"

export const getServerSearchCount = async (uid) => {
  if (!uid) return parseInt(localStorage.getItem("mk_sc_guest") || "0");
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const data = snap.data();
    const today = todayKey();
    return data.searches?.[today] || 0;
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

/* ─── Bookmarks (Firestore sync) ─────────────────────────── */
export const syncBookmarksToFirestore = async (uid, bookmarks) => {
  if (!uid) return;
  try {
    await setDoc(doc(db, "users", uid), { bookmarks }, { merge: true });
  } catch (e) { console.error("Bookmark sync failed", e); }
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
