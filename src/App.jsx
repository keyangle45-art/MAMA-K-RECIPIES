import { useState, useEffect, useRef, useCallback } from "react";
import { auth, signInWithGoogle, signOutUser, getServerSearchCount, incrementServerSearchCount, syncBookmarksToFirestore, loadBookmarksFromFirestore, getSubscriptionStatus, logSearchHistory, getSearchHistory, updatePreferenceProfile, getAdaptiveSectionOrder, trackEngagement, cancelSubscription } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

/* ─── Brand ──────────────────────────────────────────────── */
const B = {
  orange: "#CE4F00",
  orangeHover: "#E06612",
  black: "#0A0A0A",
  white: "#FFFFFF",
  bg: "#FAFAFA",
  border: "#E8E8E8",
  muted: "#8A8A8A",
  dark: "#1A1A1A",
  card: "#FFFFFF",
};

/* ─── Helpers ────────────────────────────────────────────── */
const FREE_LIMIT = 1;
const getBM = () => JSON.parse(localStorage.getItem("mk_bm") || "[]");
const saveBM = (b) => localStorage.setItem("mk_bm", JSON.stringify(b));
const recipeCache = new Map();

const callAPI = async (query, isPro = false, uid = null) => {
  const key = `${query.toLowerCase()}__${isPro}`;
  if (recipeCache.has(key)) return recipeCache.get(key);
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, isPro, uid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.limitReached) throw new Error("LIMIT_REACHED");
    return [];
  }
  const data = await res.json();
  const recipes = data.recipes || [];
  if (recipes.length > 0) recipeCache.set(key, recipes);
  return recipes;
};

const callFeed = async (preferences, recentSearches, batch, isPro, filter) => {
  const res = await fetch("/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences, recentSearches, batch, isPro, filter }),
  });
  return res.json();
};

/* ─── Global Styles ──────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&family=Inter:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #FAFAFA; -webkit-font-smoothing: antialiased; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  input, button { font-family: inherit; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes shimmer  { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  @keyframes imgFade  { from{opacity:0} to{opacity:1} }
  @keyframes slideUp  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }

  .skeleton { background: linear-gradient(90deg,#F0F0F0 25%,#F8F8F8 50%,#F0F0F0 75%); background-size:600px 100%; animation:shimmer 1.4s ease infinite; }
  .card-tap { transition: transform 0.15s ease, box-shadow 0.15s ease; cursor: pointer; }
  .card-tap:active { transform: scale(0.97); }
  @media (hover: hover) { .card-tap:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.10) !important; } }
  .btn-primary { background: #CE4F00; color: #fff; border: none; cursor: pointer; font-weight: 600; transition: all 0.18s; }
  .btn-primary:hover { background: #E06612; }
  .btn-primary:active { transform: scale(0.97); }
  .filter-chip { background: #fff; border: 1px solid #E8E8E8; border-radius: 20px; padding: 7px 14px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.18s; white-space: nowrap; color: #1A1A1A; }
  .filter-chip:hover, .filter-chip.active { background: #1A1A1A; color: #fff; border-color: #1A1A1A; }
  .filter-chip.active { font-weight: 600; }

  /* ── Responsive Pinterest grid ── */
  .recipe-grid {
    display: grid;
    gap: 12px;
    padding: 16px;
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 540px)  { .recipe-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 768px)  { .recipe-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 20px; } }
  @media (min-width: 1100px) { .recipe-grid { grid-template-columns: repeat(5, 1fr); gap: 16px; padding: 24px; } }

  /* ── Full-width surface elements ── */
  .surface-full {
    width: 100%;
    max-width: 100%;
  }

  /* Profile desktop 2-col */
  @media (min-width: 768px) {
    .profile-grid { grid-template-columns: 340px 1fr !important; align-items: start; }
  }
`;

/* ─── Flame SVG Path ─────────────────────────────────────── */
const FLAME = "M 1124.640625 460.738281 C 1124.640625 460.738281 1018.078125 559.09375 969.816406 679.957031 C 918.5625 808.308594 950.328125 857.421875 926.183594 884.042969 C 898.734375 914.304688 844.542969 889.671875 862.761719 758.234375 C 808.699219 858.609375 767.835938 966.453125 767.835938 1063.144531 C 767.835938 1190.230469 834.292969 1301.777344 934.335938 1364.988281 L 945.617188 1306.457031 C 950.511719 1281.09375 941.480469 1255.21875 922.292969 1237.933594 C 904.976562 1222.304688 895.925781 1202.789062 903.601562 1162.957031 C 917.820312 1089.207031 979.917969 994.976562 1032.183594 1005.050781 C 1084.445312 1015.128906 1107.078125 1125.691406 1092.863281 1199.4375 C 1085.183594 1239.273438 1069.527344 1254.027344 1047.640625 1262.09375 C 1023.402344 1271.003906 1005.382812 1291.664062 1000.496094 1317.042969 L 986.039062 1392.019531 C 1028.652344 1409.996094 1075.484375 1419.945312 1124.640625 1419.945312 C 1172.957031 1419.945312 1219.011719 1410.316406 1261.042969 1392.917969 L 1248.777344 1329.269531 C 1243.921875 1304.09375 1226.257812 1283.21875 1202.152344 1274.511719 C 1180.003906 1266.480469 1164.160156 1251.804688 1156.417969 1211.660156 L 1126.476562 1056.3125 C 1124.257812 1044.824219 1131.761719 1033.730469 1143.246094 1031.519531 C 1148.976562 1030.410156 1154.628906 1031.726562 1159.113281 1034.773438 C 1163.613281 1037.796875 1166.933594 1042.5625 1168.039062 1048.292969 L 1198.503906 1206.335938 L 1227.820312 1200.6875 L 1197.921875 1045.601562 C 1195.398438 1032.492188 1203.96875 1019.8125 1217.085938 1017.285156 C 1223.648438 1016.015625 1230.101562 1017.519531 1235.222656 1020.992188 C 1240.359375 1024.460938 1244.160156 1029.898438 1245.417969 1036.445312 L 1275.3125 1191.527344 L 1304.621094 1185.878906 L 1274.148438 1027.839844 C 1271.9375 1016.355469 1279.453125 1005.257812 1290.9375 1003.042969 C 1296.667969 1001.933594 1302.320312 1003.25 1306.808594 1006.292969 C 1311.304688 1009.332031 1314.628906 1014.089844 1315.730469 1019.828125 L 1345.683594 1175.183594 C 1353.421875 1215.320312 1344.152344 1234.835938 1326.570312 1250.519531 C 1307.449219 1267.570312 1298.792969 1293.511719 1303.648438 1318.683594 L 1312.828125 1366.304688 C 1414.050781 1303.335938 1481.445312 1191.121094 1481.445312 1063.144531 C 1481.445312 809.085938 1169.675781 729.90625 1124.640625 460.738281";

/* ─── Logo Component ─────────────────────────────────────── */
const Logo = ({ height = 40, light = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <svg width={height * 0.75} height={height} viewBox="767 460 714 960" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <path d={FLAME} fill={light ? "#FFF0E0" : B.orange} fillRule="nonzero" />
    </svg>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 900,
        fontSize: height * 0.42, color: light ? "#fff" : B.dark,
        letterSpacing: "0.04em", lineHeight: 1, textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>MAMA K</div>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 400,
        fontSize: height * 0.2, color: light ? "rgba(255,255,255,0.7)" : B.orange,
        textTransform: "uppercase", letterSpacing: "0.55em",
        lineHeight: 1, marginTop: "2px",
        width: "100%", textAlign: "center",
      }}>RECIPES</div>
    </div>
  </div>
);

/* ─── Skeleton Card ──────────────────────────────────────── */
const SkeletonCard = ({ tall = false }) => (
  <div style={{ borderRadius: "16px", overflow: "hidden", background: B.card, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
    <div className="skeleton" style={{ height: tall ? "220px" : "180px" }} />
    <div style={{ padding: "12px" }}>
      <div className="skeleton" style={{ height: "14px", borderRadius: "6px", marginBottom: "8px", width: "80%" }} />
      <div className="skeleton" style={{ height: "11px", borderRadius: "6px", width: "55%" }} />
    </div>
  </div>
);

/* ─── Recipe Card ────────────────────────────────────────── */
const RecipeCard = ({ r, onOpen, bookmarked, onBM, tall = false }) => {
  const [fullLoaded, setFullLoaded] = useState(false);
  const h = tall ? "220px" : "180px";

  return (
    <div className="card-tap" onClick={onOpen} style={{
      borderRadius: "16px", overflow: "hidden", background: B.card,
      boxShadow: "0 1px 6px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(0,0,0,0.04)",
      position: "relative",
    }}>
      {/* Image */}
      <div style={{ height: h, position: "relative", overflow: "hidden", background: "#F0EDE8" }}>
        {r.image ? (
          <>
            <img src={r.imageSmall || r.image} alt="" aria-hidden="true"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", filter:"blur(4px)", transform:"scale(1.04)" }}
            />
            <img src={r.image} alt={r.title} loading="lazy" decoding="async"
              onLoad={() => setFullLoaded(true)}
              style={{
                position:"absolute", inset:0, width:"100%", height:"100%",
                objectFit:"cover", opacity: fullLoaded ? 1 : 0, transition:"opacity 0.25s ease",
              }}
            />
          </>
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: tall ? "52px" : "44px" }}>
            {r.emoji}
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: "linear-gradient(to top,rgba(0,0,0,0.55),transparent)", pointerEvents: "none" }} />
        {/* Region badge */}
        {r.region && (
          <div style={{
            position: "absolute", bottom: "10px", left: "10px",
            background: "rgba(0,0,0,0.45)",
            color: "#fff", fontSize: "10px", fontWeight: 600,
            padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.04em",
          }}>{r.region}</div>
        )}
        {/* Bookmark */}
        <button onClick={e => { e.stopPropagation(); onBM(); }} style={{
          position: "absolute", top: "8px", right: "8px",
          background: "rgba(255,255,255,0.88)",
          border: "none", borderRadius: "50%", width: "30px", height: "30px",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", color: bookmarked ? B.orange : "#999",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", transition: "all 0.18s",
        }}>{bookmarked ? "♥" : "♡"}</button>
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{
          fontFamily: "'Poppins', sans-serif", fontWeight: 600,
          fontSize: "13px", color: B.dark, lineHeight: 1.3,
          marginBottom: "5px", letterSpacing: "-0.01em",
        }}>{r.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: B.muted, fontWeight: 500 }}>{r.time}</span>
          <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: B.border, flexShrink: 0 }} />
          <span style={{
            fontSize: "10px", fontWeight: 600,
            color: r.difficulty === "Easy" ? "#16A34A" : r.difficulty === "Medium" ? "#D97706" : "#DC2626",
          }}>{r.difficulty}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Filter Chips ───────────────────────────────────────── */
const FILTERS = [
  "What to Eat", "African", "Asian", "European", "American",
  "Healthy", "High Protein", "Vegetarian", "Quick Meals",
  "Desserts", "Drinks", "Breakfast", "Seafood"
];

const FilterBar = ({ active, onChange }) => (
  <div className="surface-full" style={{
    display: "flex", gap: "8px", overflowX: "auto", scrollbarWidth: "none",
    padding: "12px 16px", background: B.white,
    borderBottom: `1px solid ${B.border}`,
    position: "sticky", top: "52px", zIndex: 70,
  }}>
    {FILTERS.map(f => (
      <button key={f} onClick={() => onChange(f)}
        className={`filter-chip${active === f ? " active" : ""}`}
      >{f}</button>
    ))}
  </div>
);

/* ─── Paywall Modal ──────────────────────────────────────── */
const Paywall = ({ user, onSignIn, onDismiss, onUpgrade, loading }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)", zIndex: 999,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    padding: "0",
  }}>
    <div style={{
      background: B.white, borderRadius: "24px 24px 0 0", padding: "32px 24px 40px",
      width: "100%", maxWidth: "520px",
      animation: "slideUp 0.3s ease",
    }}>
      <div style={{ width: "36px", height: "4px", background: B.border, borderRadius: "2px", margin: "0 auto 24px" }} />
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <Logo height={36} />
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "22px", fontWeight: 700, color: B.dark, textAlign: "center", marginBottom: "8px", marginTop: "16px" }}>
        {user ? "You've used your free search" : "Sign in to start discovering"}
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.muted, textAlign: "center", lineHeight: 1.6, marginBottom: "28px" }}>
        {user ? "Upgrade to Pro for unlimited searches and 6 recipes per search." : "Create a free account to get 1 search daily."}
      </div>

      {["1 free AI search daily", "6 recipes per search with Pro", "Personalized feed that learns your taste", "Saved collections synced across devices"].map(p => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 700 }}>✓</span>
          </div>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{p}</span>
        </div>
      ))}

      {!user ? (
        <button onClick={onSignIn} className="btn-primary" style={{
          width: "100%", marginTop: "20px", padding: "15px",
          borderRadius: "14px", fontSize: "15px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      ) : (
        <button onClick={onUpgrade} className="btn-primary" style={{
          width: "100%", marginTop: "20px", padding: "15px",
          borderRadius: "14px", fontSize: "15px", fontWeight: 600,
        }}>
          {loading ? "Redirecting..." : "Upgrade to Pro — $4.99/month"}
        </button>
      )}
      <button onClick={onDismiss} style={{
        width: "100%", marginTop: "10px", padding: "12px",
        background: "none", border: "none", cursor: "pointer",
        fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted,
      }}>Maybe later</button>
    </div>
  </div>
);

/* ─── Detail View ────────────────────────────────────────── */
const DetailView = ({ recipe, bookmarked, onBM, onBack, onOpen, isPro, onUpgrade }) => {
  const [tab, setTab] = useState("ingredients");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [recs, setRecs] = useState([]);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const q = recipe.region ? `${recipe.region} cuisine similar to ${recipe.title}` : `similar to ${recipe.title}`;
    callAPI(q, false).then(r => setRecs(r.filter(x => x.title !== recipe.title).slice(0, 4)));
  }, [recipe.title]);

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "100px" }}>
      {/* Back button */}
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "6px",
          fontFamily: "'Inter', sans-serif", fontSize: "14px",
          color: B.orange, fontWeight: 500, padding: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
      </div>

      {/* Hero image */}
      <div style={{ height: "280px", position: "relative", overflow: "hidden", background: "#F0EDE8" }}>
        {recipe.image ? (
          <>
            <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${recipe.imageSmall || recipe.image})`, backgroundSize: "cover", backgroundPosition: "center", filter: imgLoaded ? "none" : "blur(12px)", transform: "scale(1.05)", transition: "filter 0.5s ease" }} />
            <img src={recipe.imageLarge || recipe.image} alt={recipe.title} loading="eager" onLoad={() => setImgLoaded(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
            />
          </>
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "80px" }}>{recipe.emoji}</div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />
        {recipe.photographer && imgLoaded && (
          <div style={{ position: "absolute", bottom: "10px", right: "12px", fontSize: "9px", color: "rgba(255,255,255,0.55)", fontFamily: "'Inter', sans-serif" }}>
            Photo: {recipe.photographer} / Pexels
          </div>
        )}
      </div>

      <div style={{ padding: "20px 16px 0" }}>
        {/* Title + actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "6px" }}>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {recipe.title}
          </h1>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "2px" }}>
            <button onClick={() => setLiked(!liked)} style={{
              background: liked ? "#FEF2F2" : B.bg, border: `1px solid ${liked ? "#FECACA" : B.border}`,
              borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px", color: liked ? "#DC2626" : B.muted, transition: "all 0.18s",
            }}>{liked ? "♥" : "♡"}</button>
            <button onClick={onBM} style={{
              background: bookmarked ? "#FFF7ED" : B.bg, border: `1px solid ${bookmarked ? "#FED7AA" : B.border}`,
              borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "15px", color: bookmarked ? B.orange : B.muted, transition: "all 0.18s",
            }}>🔖</button>
            <button onClick={() => {
              const text = `${recipe.title} — found on Mama K Recipes 🍽️\nhttps://recipes.keyangle.tech`;
              if (navigator.share) navigator.share({ title: recipe.title, text, url: "https://recipes.keyangle.tech" });
              else navigator.clipboard?.writeText(text).then(() => alert("Link copied!"));
            }} style={{
              background: B.bg, border: `1px solid ${B.border}`,
              borderRadius: "50%", width: "38px", height: "38px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: B.muted, transition: "all 0.18s",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Region + cuisine */}
        {(recipe.region || recipe.cuisine) && (
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: B.orange }}>
              {recipe.region || recipe.cuisine}
            </span>
            {recipe.region && recipe.cuisine && recipe.region !== recipe.cuisine && (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}> · {recipe.cuisine}</span>
            )}
          </div>
        )}

        {recipe.tagline && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, lineHeight: 1.6, marginBottom: "20px" }}>
            {recipe.tagline}
          </p>
        )}

        {/* Meta strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "24px" }}>
          {[["⏱", recipe.time, "Time"], ["👥", recipe.servings, "Serves"], ["🔥", recipe.calories ? `~${recipe.calories}` : "N/A", "Cal"], ["📊", recipe.difficulty, "Level"]].map(([icon, val, label]) => (
            <div key={label} style={{ background: B.bg, borderRadius: "12px", padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: "16px", marginBottom: "3px" }}>{icon}</div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 600, color: B.dark }}>{val}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: B.muted, marginTop: "1px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: B.bg, borderRadius: "12px", padding: "3px", marginBottom: "20px" }}>
          {["ingredients", "steps"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "9px", border: "none", borderRadius: "10px",
              background: tab === t ? B.white : "transparent",
              fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: tab === t ? 600 : 400,
              color: tab === t ? B.dark : B.muted, cursor: "pointer",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              textTransform: "capitalize", transition: "all 0.15s",
            }}>{t === "ingredients" ? "Ingredients" : "Instructions"}</button>
          ))}
        </div>

        {tab === "ingredients" && (
          <div>
            {(recipe.ingredients || []).map((ing, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: `1px solid ${B.border}`, animation: "fadeUp 0.3s ease both", animationDelay: `${i * 20}ms` }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.dark }}>{ing}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "steps" && (
          <div>
            {(recipe.steps || []).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "14px", marginBottom: "20px", animation: "fadeUp 0.3s ease both", animationDelay: `${i * 30}ms` }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: B.orange, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 700, boxShadow: `0 2px 8px ${B.orange}33` }}>{i + 1}</div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#333", lineHeight: 1.75, paddingTop: "4px" }}>{step}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recipe Tools */}
        <RecipeTools recipe={recipe} isPro={isPro} onUpgrade={onUpgrade} />

        {/* More like this */}
        {recs.length > 0 && (
          <div style={{ marginTop: "36px", paddingTop: "24px", borderTop: `1px solid ${B.border}` }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "17px", color: B.dark, marginBottom: "4px" }}>More Like This</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>Based on {recipe.region || recipe.cuisine || "similar style"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {recs.map((r, i) => (
                <RecipeCard key={i} r={r} onOpen={() => onOpen(r)} bookmarked={false} onBM={() => {}} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Recipe Tools ───────────────────────────────────────── */
const TOOLS = [
  { id: "party",    label: "Party Mode",    icon: "🎉", pro: true,  desc: "Scale for any crowd" },
  { id: "shopping", label: "Shopping List", icon: "🛒", pro: false, desc: "Get ingredients list" },
  { id: "protein",  label: "High Protein",  icon: "💪", pro: true,  desc: "Protein optimised" },
  { id: "lowcal",   label: "Low Calorie",   icon: "🥗", pro: true,  desc: "Under 400 calories" },
  { id: "veggie",   label: "Vegetarian",    icon: "🌱", pro: true,  desc: "Plant based version" },
  { id: "airfryer", label: "Air Fryer",     icon: "⚡", pro: true,  desc: "Air fryer adapted" },
  { id: "budget",   label: "Budget",        icon: "💰", pro: true,  desc: "Student friendly" },
];

const RecipeTools = ({ recipe, isPro, onUpgrade }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [partySize, setPartySize] = useState(10);
  const [shoppingDone, setShoppingDone] = useState({});

  const handleTool = (tool) => {
    if (tool.pro && !isPro) { onUpgrade(); return; }
    setActiveTool(activeTool === tool.id ? null : tool.id);
  };

  // Scale ingredient quantities for party mode
  const baseServings = recipe.servings || 4;
  const scale = partySize / baseServings;
  const scaleIngredient = (ing) => {
    return ing.replace(/(\d+(\.\d+)?)/g, (match) => {
      const scaled = parseFloat(match) * scale;
      return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
    });
  };

  // Group ingredients for shopping list
  const GROUPS = {
    "Produce": ["tomato","onion","garlic","pepper","lettuce","spinach","cucumber","lemon","lime","carrot","potato","mushroom","ginger","celery","parsley","coriander","basil","chili","leek","avocado","plantain"],
    "Protein": ["chicken","beef","pork","lamb","fish","shrimp","prawn","egg","tofu","beans","lentil","turkey","salmon","tuna","crab","meat","bacon","sausage"],
    "Dairy": ["milk","cream","butter","cheese","yogurt","cheddar","mozzarella","parmesan","feta"],
    "Grains": ["rice","pasta","flour","bread","oats","noodle","couscous","quinoa","cornmeal","spaghetti"],
    "Spices & Sauces": ["salt","pepper","cumin","paprika","turmeric","cinnamon","oil","sauce","vinegar","soy","stock","broth","bay","thyme","oregano","curry","spice"],
  };
  const groupIngredients = (ingredients) => {
    const grouped = { "Produce": [], "Protein": [], "Dairy": [], "Grains": [], "Spices & Sauces": [], "Other": [] };
    ingredients.forEach(ing => {
      const lower = ing.toLowerCase();
      let placed = false;
      for (const [group, keywords] of Object.entries(GROUPS)) {
        if (keywords.some(k => lower.includes(k))) { grouped[group].push(ing); placed = true; break; }
      }
      if (!placed) grouped["Other"].push(ing);
    });
    return Object.entries(grouped).filter(([,v]) => v.length > 0);
  };

  return (
    <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: `1px solid ${B.border}` }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "17px", color: B.dark, marginBottom: "4px" }}>Recipe Tools</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "14px" }}>Adapt this recipe to your needs</div>

      {/* Tool chips */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => handleTool(tool)} style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "7px 12px", borderRadius: "20px", cursor: "pointer",
            fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 500,
            border: `1px solid ${activeTool === tool.id ? B.orange : B.border}`,
            background: activeTool === tool.id ? "#FFF7ED" : B.bg,
            color: activeTool === tool.id ? B.orange : B.dark,
            transition: "all 0.18s",
          }}>
            <span>{tool.icon}</span>
            {tool.label}
            {tool.pro && !isPro && <span style={{ fontSize: "9px", background: B.orange, color: "#fff", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>PRO</span>}
          </button>
        ))}
      </div>

      {/* Party Mode panel */}
      {activeTool === "party" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "20px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "4px" }}>🎉 Party Mode</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>Scaled for {partySize} people (original: {baseServings} servings)</div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {[10, 20, 30, 50, 75, 100].map(n => (
              <button key={n} onClick={() => setPartySize(n)} style={{
                padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
                fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600,
                border: `1px solid ${partySize === n ? B.orange : B.border}`,
                background: partySize === n ? B.orange : B.white,
                color: partySize === n ? "#fff" : B.dark, transition: "all 0.15s",
              }}>{n}</button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>Custom:</span>
              <input type="number" value={partySize} min={1} max={500} onChange={e => setPartySize(parseInt(e.target.value)||1)}
                style={{ width: "60px", padding: "5px 8px", border: `1px solid ${B.border}`, borderRadius: "8px", fontFamily: "'Inter', sans-serif", fontSize: "13px", textAlign: "center" }}
              />
            </div>
          </div>

          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Scaled Ingredients</div>
          {(recipe.ingredients || []).map((ing, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: `1px solid ${B.border}` }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: B.orange, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{scaleIngredient(ing)}</span>
            </div>
          ))}
          <div style={{ marginTop: "14px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>
            Est. total calories: ~{Math.round((recipe.calories || 0) * scale * baseServings)}
          </div>
        </div>
      )}

      {/* Shopping List panel */}
      {activeTool === "shopping" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "20px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark }}>🛒 Shopping List</div>
            <button onClick={() => {
              const text = `Shopping List — ${recipe.title}\n\n` + (recipe.ingredients || []).map(i => `□ ${i}`).join("\n");
              navigator.clipboard?.writeText(text).then(() => alert("Copied to clipboard!"));
            }} style={{ background: B.dark, color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600 }}>
              Copy all
            </button>
          </div>
          {groupIngredients(recipe.ingredients || []).map(([group, items]) => (
            <div key={group} style={{ marginBottom: "14px" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{group}</div>
              {items.map((ing, i) => (
                <div key={i} onClick={() => setShoppingDone(p => ({...p, [ing]: !p[ing]}))} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: `1px solid ${B.border}`, cursor: "pointer" }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `2px solid ${shoppingDone[ing] ? B.orange : B.border}`, background: shoppingDone[ing] ? B.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {shoppingDone[ing] && <span style={{ color: "#fff", fontSize: "11px", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, textDecoration: shoppingDone[ing] ? "line-through" : "none", opacity: shoppingDone[ing] ? 0.4 : 1 }}>{ing}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Home Feed ──────────────────────────────────────────── */
const HomeFeed = ({ user, isPro, preferences, recentSearches, bookmarks, onBM, onOpen, onUpgrade, activeFilter }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState(0);
  const [done, setDone] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const loaderRef = useRef(null);
  const loadingRef = useRef(false);
  const dwellTimers = useRef({});

  const loadNext = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await callFeed(preferences, recentSearches, batch, isPro, activeFilter);
      if (data.done) { setDone(true); if (!isPro) setShowUpgrade(true); }
      else if (data.recipes?.length > 0) {
        setBatches(prev => [...prev, { id: batch, recipes: data.recipes, query: data.query }]);
        setBatch(b => b + 1);
        if (!isPro && batch >= 4) { setDone(true); setShowUpgrade(true); }
      }
    } catch {}
    loadingRef.current = false;
    setLoading(false);
  }, [batch, done, preferences, recentSearches, isPro]);

  useEffect(() => { setBatches([]); setBatch(0); setDone(false); setShowUpgrade(false); }, [activeFilter]);
  useEffect(() => { if (batches.length === 0) loadNext(); }, []);

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadNext(); }, { rootMargin: "800px" });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [loadNext]);

  const startDwell = (title, r) => {
    if (dwellTimers.current[title]) return;
    dwellTimers.current[title] = setTimeout(() => { if (user?.uid) trackEngagement(user.uid, { type: "dwell", recipe: r, dwellSeconds: 8 }); }, 8000);
  };
  const clearDwell = t => { clearTimeout(dwellTimers.current[t]); delete dwellTimers.current[t]; };

  const allRecipes = batches.flatMap(b => b.recipes);

  if (allRecipes.length === 0 && loading) {
    return (
      <div className="recipe-grid">
        {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "80px" }}>
      <div className="recipe-grid">
        {allRecipes.map((r, i) => (
          <div key={`${r.title}-${i}`} style={{ animation: "fadeUp 0.4s ease both", animationDelay: `${(i % 6) * 40}ms` }}
            onMouseEnter={() => startDwell(r.title, r)} onMouseLeave={() => clearDwell(r.title)}
          >
            <RecipeCard
              r={r}
              tall={i % 5 === 0}
              onOpen={() => { clearDwell(r.title); if (user?.uid) trackEngagement(user.uid, { type: "open", recipe: r }); onOpen(r); }}
              bookmarked={bookmarks.some(b => b.title === r.title)}
              onBM={() => onBM(r)}
            />
          </div>
        ))}
      </div>

      {/* Sentinel */}
      <div ref={loaderRef} style={{ height: "1px" }} />

      {/* Loading dots */}
      {loading && (
        <div style={{ padding: "28px", textAlign: "center", display: "flex", gap: "6px", justifyContent: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
        </div>
      )}

      {/* Upgrade prompt */}
      {showUpgrade && (
        <div onClick={onUpgrade} style={{
          background: B.dark, borderRadius: "20px", padding: "24px 20px",
          cursor: "pointer", marginTop: "8px", transition: "opacity 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.92"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "18px", color: "#fff", marginBottom: "8px", lineHeight: 1.2 }}>
            Your feed goes deeper with Pro
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
            Unlock unlimited personalised food discovery
          </div>
          <div style={{ display: "inline-block", background: B.orange, color: "#fff", borderRadius: "10px", padding: "10px 20px", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600 }}>
            Upgrade to Pro — $4.99/month
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Search View ────────────────────────────────────────── */
const SearchView = ({ user, isPro, bookmarks, onBM, onOpen, onShowPaywall, searchHistory, searchCount, onIncrementCount }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef();

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const doSearch = async (overrideQuery) => {
    const raw = (overrideQuery || query || "").trim();
    if (!raw) return;
    if (!user) { onShowPaywall(); return; }
    if (!isPro && searchCount >= FREE_LIMIT) { onShowPaywall(); return; }

    // Normalize
    const normalized = raw.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

    // Increment server-side BEFORE calling AI so limit is enforced even if user refreshes
    if (!isPro) await onIncrementCount();

    setLoading(true);
    setSearched(true);

    // Try normalized first, then raw if empty
    try {
      let r = await callAPI(normalized, isPro, user?.uid);
      if (!r.length) r = await callAPI(raw, isPro, user?.uid);
      setResults(r);
    } catch (e) {
      if (e.message === "LIMIT_REACHED") { onShowPaywall(); }
      setResults([]);
    }
    setLoading(false);

    if (user?.uid && r.length > 0) {
      logSearchHistory(user.uid, normalized);
      updatePreferenceProfile(user.uid, { query: normalized });
    }
  };

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      {/* Search bar */}
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: B.white, zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <div style={{ display: "flex", alignItems: "center", background: B.bg, borderRadius: "12px", border: `1px solid ${B.border}` }}>
          <svg style={{ margin: "0 10px 0 14px", color: B.muted, flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
            placeholder="Jollof Rice, Pasta, Healthy Breakfast..."
            style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontFamily: "'Inter', sans-serif", fontSize: "15px", background: "transparent", color: B.dark }}
          />
          {query && <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} style={{ background: "none", border: "none", padding: "0 14px", cursor: "pointer", color: B.muted, fontSize: "18px" }}>×</button>}
          <button onClick={doSearch} className="btn-primary" style={{ margin: "5px", borderRadius: "9px", padding: "9px 16px", fontSize: "13px" }}>Search</button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {!searched && (
          <>
            {searchHistory.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 700, color: B.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Recent</div>
                {searchHistory.slice(0, 6).map((item, i) => (
                  <div key={i} onClick={() => { setQuery(item.query); doSearch(item.query); }} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 8px", borderRadius: "10px", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = B.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.dark, flex: 1, textTransform: "capitalize" }}>{item.query}</span>
                  </div>
                ))}
              </div>
            )}
            <div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 700, color: B.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Trending</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {["Jollof Rice","Carbonara","Chicken Tikka","Birria Tacos","Ramen","Egusi Soup","Smash Burger","Pad Thai","Tiramisu","Suya","Butter Chicken","Peking Duck","Shakshuka","Ceviche"].map(s => (
                  <button key={s} onClick={() => { setQuery(s); setTimeout(() => doSearch(s), 50); }} style={{ background: B.bg, border: `1px solid ${B.border}`, borderRadius: "20px", padding: "7px 14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, transition: "all 0.18s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = B.dark; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = B.bg; e.currentTarget.style.color = B.dark; }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {searched && !loading && (
          <>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "18px", color: B.dark, marginBottom: "4px" }}>{query}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>{results.length} recipes found</div>
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: B.muted }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "16px" }}>No recipes found</div>
              </div>
            ) : (
              <div className="recipe-grid" style={{ padding: 0 }}>
                {results.map((r, i) => (
                  <RecipeCard key={i} r={r} onOpen={() => onOpen(r)} bookmarked={bookmarks.some(b => b.title === r.title)} onBM={() => onBM(r)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Saved View ─────────────────────────────────────────── */
const SavedView = ({ bookmarks, onOpen, onBM }) => (
  <div style={{ padding: "20px 16px 80px", background: B.white, minHeight: "100vh" }}>
    <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "4px" }}>Saved</div>
    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "20px" }}>{bookmarks.length} recipes</div>
    {bookmarks.length === 0 ? (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <div style={{ fontSize: "48px", opacity: 0.2, marginBottom: "16px" }}>🔖</div>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "18px", color: B.muted }}>Nothing saved yet</div>
      </div>
    ) : (
      <div className="recipe-grid" style={{ padding: 0 }}>
        {bookmarks.map((r, i) => <RecipeCard key={i} r={r} onOpen={() => onOpen(r)} bookmarked={true} onBM={() => onBM(r)} />)}
      </div>
    )}
  </div>
);

/* ─── Profile View ───────────────────────────────────────── */
const ProfileView = ({ user, isPro, subscription, onSignIn, onSignOut, onUpgrade, searchCount, searchHistory, bookmarks, loadingPayment, preferences, onOpen, onGoToSaved, onCancelSubscription }) => {
  // Derive top cuisines from preferences
  const topCuisines = Object.entries(preferences?.regions || {})
    .sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([k]) => k.replace(/_/g," ").replace(/\b\w/g, l => l.toUpperCase()));

  const topDiet = Object.entries(preferences?.dietary || {})
    .sort((a,b) => b[1]-a[1]).slice(0,2)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

  const streak = Math.min(searchHistory.length, 7);
  const tastePrimary = topCuisines[0] || "Building...";

  return (
  <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
    {user ? (
      <div style={{ padding: "20px 16px 0", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "16px" }}>My Kitchen</div>
        {/* Desktop 2-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: "16px" }}
          className="profile-grid"
        >

          {/* User card */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: B.bg, borderRadius: "16px", marginBottom: "16px" }}>
            <img src={user.photoURL} alt={user.displayName} style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${isPro ? B.orange : B.border}`, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.displayName}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>{user.email}</div>
            </div>
            <span style={{ background: isPro ? "#F0FDF4" : B.bg, color: isPro ? "#16A34A" : B.muted, border: `1px solid ${isPro ? "#BBF7D0" : B.border}`, borderRadius: "20px", padding: "3px 12px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>
              {isPro ? "✓ Pro" : "Free"}
            </span>
          </div>

          {/* Stats — meaningful ones */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            {[
              ["❤️", bookmarks.length, "Saved"],
              ["🧠", tastePrimary, "Top Taste"],
              ["🔥", `${streak} day${streak !== 1 ? "s" : ""}`, "Streak"],
            ].map(([icon, val, label]) => (
              <div key={label} style={{ background: B.bg, borderRadius: "14px", padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: val.toString().length > 6 ? "11px" : "14px", color: B.dark, lineHeight: 1.2 }}>{val}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: B.muted, marginTop: "2px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Taste Profile */}
          {(topCuisines.length > 0 || topDiet.length > 0) && (
            <div style={{ background: B.dark, borderRadius: "16px", padding: "18px", marginBottom: "16px" }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: "#fff", marginBottom: "12px" }}>Your Taste Profile</div>
              {topCuisines.length > 0 && (
                <div style={{ marginBottom: "10px" }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Favourite Cuisines</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {topCuisines.map(c => (
                      <span key={c} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: "20px", padding: "4px 12px", fontSize: "12px", fontWeight: 500 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {topDiet.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Dietary Preferences</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {topDiet.map(d => (
                      <span key={d} style={{ background: `${B.orange}33`, color: B.orange, borderRadius: "20px", padding: "4px 12px", fontSize: "12px", fontWeight: 500 }}>{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {topCuisines.length === 0 && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "8px 0" }}>
                  Search and save recipes to build your taste profile
                </div>
              )}
            </div>
          )}

          {/* Recently saved */}
          {bookmarks.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark }}>Recently Saved</div>
                <span onClick={() => onGoToSaved()} style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, cursor: "pointer" }}>
                  See all {bookmarks.length} →
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", overflowX: "auto", scrollbarWidth: "none", paddingBottom: "4px" }}>
                {bookmarks.slice(0, 6).map((r, i) => (
                  <div key={i} onClick={() => onOpen(r)} style={{ flexShrink: 0, width: "110px", cursor: "pointer" }}>
                    <div style={{ height: "80px", borderRadius: "10px", overflow: "hidden", background: "#F0EDE8", marginBottom: "6px", position: "relative" }}>
                      {r.image ? <img src={r.imageSmall || r.image} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>{r.emoji}</div>}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 500, color: B.dark, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pro upgrade card */}
          {!isPro && (
            <div onClick={onUpgrade} style={{ background: B.dark, borderRadius: "16px", padding: "20px", cursor: "pointer", marginBottom: "16px", transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.92"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "16px", color: "#fff", marginBottom: "10px" }}>Unlock Pro</div>
              {["Unlimited AI searches", "6 recipes per search", "Full taste personalisation", "Saved collections across devices", "Priority support"].map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: `${B.orange}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: B.orange, fontSize: "10px", fontWeight: 700 }}>✓</span>
                  </div>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.75)" }}>{f}</span>
                </div>
              ))}
              <div style={{ marginTop: "14px", display: "inline-block", background: B.orange, color: "#fff", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 700 }}>
                {loadingPayment ? "Redirecting..." : "$4.99 / month"}
              </div>
            </div>
          )}

          {/* Subscription section */}
          <div style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: "16px" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${B.border}`, background: B.white }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "13px", color: B.dark, marginBottom: "10px" }}>Subscription</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, fontWeight: 500 }}>
                    {isPro ? "Mama K Pro" : "Free Plan"}
                  </div>
                  {subscription?.endDate && (() => {
                    try {
                      const d = subscription.endDate instanceof Date ? subscription.endDate : new Date(subscription.endDate);
                      const fmt = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                      return <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: subscription.status === "cancelled" ? "#D97706" : B.muted, marginTop: "2px" }}>
                        {subscription.status === "cancelled" ? `Access until ${fmt}` : `Next billing ${fmt}`}
                      </div>;
                    } catch { return null; }
                  })()}
                </div>
                <span style={{ background: isPro ? "#F0FDF4" : B.bg, color: isPro ? "#16A34A" : B.muted, border: `1px solid ${isPro ? "#BBF7D0" : B.border}`, borderRadius: "20px", padding: "3px 12px", fontSize: "11px", fontWeight: 700 }}>
                  {(subscription?.status === "cancelled") ? "Cancelling" : isPro ? "Active" : "Free"}
                </span>
              </div>
            </div>
            {isPro && subscription?.status === "active" && (
              <div onClick={onCancelSubscription} style={{ padding: "13px 16px", background: B.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                onMouseLeave={e => e.currentTarget.style.background = B.white}
              >
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#DC2626", fontWeight: 500 }}>Cancel Subscription</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            )}
            {!isPro && (
              <div onClick={onUpgrade} style={{ padding: "13px 16px", background: B.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FFF7ED"}
                onMouseLeave={e => e.currentTarget.style.background = B.white}
              >
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.orange, fontWeight: 600 }}>Upgrade to Pro</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            )}
          </div>

          {/* Settings menu */}
          <div style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: "16px" }}>
            {[
              { label: "Help & Support", sub: "support@keyangle.tech", action: () => window.open("mailto:support@keyangle.tech") },
              { label: "Privacy Policy", sub: "How we use your data", action: () => {} },
              { label: "Delete Account", sub: "Permanently remove your data", action: () => {}, danger: true },
            ].map((item, i, arr) => (
              <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderBottom: i < arr.length-1 ? `1px solid ${B.border}` : "none", cursor: "pointer", background: B.white, transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = B.bg}
                onMouseLeave={e => e.currentTarget.style.background = B.white}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 500, color: item.danger ? "#DC2626" : B.dark }}>{item.label}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>{item.sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            ))}
          </div>

          <button onClick={onSignOut} style={{ width: "100%", padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: "#DC2626" }}>
            Sign Out
          </button>
        </div>
      </div>
    ) : (
      <div style={{ textAlign: "center", padding: "60px 16px" }}>
        <Logo height={44} />
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, margin: "24px 0 8px" }}>Your Kitchen Awaits</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.muted, lineHeight: 1.6, marginBottom: "28px" }}>Sign in to personalise your feed, track your taste, and save your favourite recipes.</div>
        <button onClick={onSignIn} className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "14px", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      </div>
    )}
  </div>
  );
};

/* ─── Bottom Navigation ──────────────────────────────────── */
const BottomNav = ({ activeTab, onChange }) => {
  const tabs = [
    { id: "home", label: "Home", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? B.orange : "none"} stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    )},
    { id: "search", label: "Search", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    )},
    { id: "saved", label: "Saved", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? B.orange : "none"} stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    )},
    { id: "profile", label: "Profile", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )},
  ];

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
      borderTop: `1px solid ${B.border}`,
      display: "flex", alignItems: "center",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          padding: "10px 0 8px", background: "none", border: "none", cursor: "pointer",
          transition: "all 0.18s",
        }}>
          {tab.icon(activeTab === tab.id)}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", fontWeight: activeTab === tab.id ? 600 : 400, color: activeTab === tab.id ? B.orange : B.muted, marginTop: "3px" }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
};

/* ─── Main App ───────────────────────────────────────────── */
export default function App() {
  useEffect(() => {
    if (!document.querySelector("#mamak-css")) {
      const el = document.createElement("style");
      el.id = "mamak-css";
      el.textContent = STYLES;
      document.head.appendChild(el);
    }
  }, []);

  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [activeFilter, setActiveFilter] = useState("What to Eat");
  const [selected, setSelected] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [subscription, setSubscription] = useState({ status: "free", isPro: false, endDate: null });
  const [searchCount, setSearchCount] = useState(0);
  const [searchHistory, setSearchHistory] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState(1); // 1=retention 2=confirm 3=done
  const prevTab = useRef("home");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const [sub, count, bm, hist] = await Promise.all([
          getSubscriptionStatus(u.uid),
          getServerSearchCount(u.uid),
          loadBookmarksFromFirestore(u.uid),
          getSearchHistory(u.uid),
        ]);
        setSubscription(sub);
        setIsPro(sub.isPro);
        setSearchCount(count);
        setBookmarks(bm);
        setSearchHistory(hist);
        const { getPreferenceProfile } = await import("./firebase.js");
        const prefs = await getPreferenceProfile(u.uid);
        setPreferences(prefs);
      } else {
        setBookmarks(getBM());
        setSearchCount(parseInt(localStorage.getItem("mk_sc_guest") || "0"));
      }
    });
    return unsub;
  }, []);

  const isBM = r => bookmarks.some(b => b.title === r.title);
  const toggleBM = r => {
    const updated = isBM(r) ? bookmarks.filter(b => b.title !== r.title) : [...bookmarks, r];
    setBookmarks(updated);
    saveBM(updated);
    if (user?.uid) {
      syncBookmarksToFirestore(user.uid, updated);
      if (!isBM(r)) updatePreferenceProfile(user.uid, { query: r.title, cuisine: r.cuisine, region: r.region, difficulty: r.difficulty, tags: r.tags || [] });
    }
  };

  const openRecipe = r => { setSelected(r); if (user?.uid) trackEngagement(user.uid, { type: "open", recipe: r }); };
  const closeRecipe = () => setSelected(null);

  const handleUpgrade = async () => {
    if (!user) { setShowPaywall(true); return; }
    setLoadingPayment(true);
    try {
      const res = await fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: user.uid, email: user.email, name: user.displayName }) });
      const data = await res.json();
      if (data.paymentLink) window.location.href = data.paymentLink;
      else alert("Payment unavailable. Try again.");
    } catch { alert("Something went wrong."); }
    setLoadingPayment(false);
  };

  const handleCancel = async () => {
    if (!user?.uid) return;
    await cancelSubscription(user.uid);
    setSubscription(s => ({ ...s, status: "cancelled" }));
    setShowCancelModal(false);
    setCancelStep(1);
  };

  const handleTabChange = t => { prevTab.current = tab; setTab(t); };

  // Check Flutterwave redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && params.get("status") === "successful" && user?.uid) {
      import("./firebase.js").then(({ setUserPro }) => {
        setUserPro(user.uid).then(() => {
          setIsPro(true);
          setSubscription({ status: "active", isPro: true, endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
          window.history.replaceState({}, "", window.location.pathname);
        });
      });
    } else if (params.get("payment")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: B.bg, minHeight: "100vh", position: "relative" }}>
      {/* Cancellation modal */}
      {showCancelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: B.white, borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: "520px", animation: "slideUp 0.3s ease" }}>
            <div style={{ width: "36px", height: "4px", background: B.border, borderRadius: "2px", margin: "0 auto 20px" }} />

            {cancelStep === 1 && (<>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "20px", color: B.dark, marginBottom: "8px" }}>Wait before you leave</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, lineHeight: 1.7, marginBottom: "16px" }}>Your Pro subscription currently gives you:</div>
              {["Unlimited AI recipe discovery","Recipe Tools — Party Mode, Air Fryer, Budget","Shopping list generator","High Protein, Low Calorie and Vegetarian versions","Smarter personalised recommendations","6 recipes per search"].map(f => (
                <div key={f} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "flex-start" }}>
                  <span style={{ color: B.orange, fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{f}</span>
                </div>
              ))}
              {subscription?.endDate && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "10px 14px", marginTop: "14px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#D97706" }}>
                  Your subscription remains active until {subscription.endDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              <button onClick={() => setShowCancelModal(false)} className="btn-primary" style={{ width: "100%", marginTop: "20px", padding: "14px", borderRadius: "12px", fontSize: "15px" }}>Keep Pro</button>
              <button onClick={() => setCancelStep(2)} style={{ width: "100%", marginTop: "8px", padding: "12px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>Continue to cancel</button>
            </>)}

            {cancelStep === 2 && (<>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "20px", color: B.dark, marginBottom: "8px" }}>Are you sure?</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, lineHeight: 1.6, marginBottom: "16px" }}>After your billing period ends you will lose access to:</div>
              {["Unlimited AI searches","Recipe Tools","Party Mode and Party Scaling","Shopping list generator","Meal planning features"].map(f => (
                <div key={f} style={{ display: "flex", gap: "8px", marginBottom: "7px" }}>
                  <span style={{ color: "#DC2626", flexShrink: 0 }}>✕</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{f}</span>
                </div>
              ))}
              <button onClick={() => setShowCancelModal(false)} className="btn-primary" style={{ width: "100%", marginTop: "20px", padding: "14px", borderRadius: "12px", fontSize: "15px" }}>Keep Pro</button>
              <button onClick={handleCancel} style={{ width: "100%", marginTop: "8px", padding: "12px", background: "none", border: "1px solid #FECACA", borderRadius: "12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#DC2626", fontWeight: 600 }}>
                Cancel Subscription
              </button>
            </>)}
          </div>
        </div>
      )}

      {showPaywall && (
        <Paywall
          user={user}
          onSignIn={async () => { try { await signInWithGoogle(); setShowPaywall(false); } catch {} }}
          onDismiss={() => setShowPaywall(false)}
          onUpgrade={handleUpgrade}
          loading={loadingPayment}
        />
      )}

      {/* Recipe detail overlay */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, overflowY: "auto", background: B.white }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>
            <DetailView
              recipe={selected}
              bookmarked={isBM(selected)}
              onBM={() => toggleBM(selected)}
              onBack={closeRecipe}
              onOpen={r => { closeRecipe(); setTimeout(() => openRecipe(r), 50); }}
              isPro={isPro}
              onUpgrade={() => setShowPaywall(true)}
            />
          </div>
        </div>
      )}

      {/* Top bar — full width, content inside centered */}
      {(tab === "home" || tab === "saved") && (
        <div style={{
          position: "sticky", top: 0, zIndex: 90,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${B.border}`,
          width: "100%",
        }}>
          <div style={{
            maxWidth: "1400px", margin: "0 auto",
            padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Logo height={34} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {!isPro && (
                <div style={{ background: searchCount >= FREE_LIMIT ? "#FFF1F2" : B.bg, border: `1px solid ${searchCount >= FREE_LIMIT ? "#FECDD3" : B.border}`, borderRadius: "20px", padding: "4px 12px", fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600, color: searchCount >= FREE_LIMIT ? "#DC2626" : B.muted }}>
                  {searchCount >= FREE_LIMIT ? "Limit reached" : "1 free"}
                </div>
              )}
              {isPro && (
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "20px", padding: "4px 12px", fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: "#16A34A" }}>
                  Pro
                </div>
              )}
              {user ? (
                <img src={user.photoURL} alt="" onClick={() => handleTabChange("profile")} style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover", cursor: "pointer", border: `2px solid ${isPro ? B.orange : B.border}` }} />
              ) : (
                <button onClick={() => setShowPaywall(true)} className="btn-primary" style={{ padding: "7px 16px", borderRadius: "20px", fontSize: "12px" }}>Sign in</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab content — full width */}
      {tab === "home" && (
        <>
          <FilterBar active={activeFilter} onChange={setActiveFilter} />
          <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
            <HomeFeed
              user={user} isPro={isPro} preferences={preferences}
              recentSearches={searchHistory} bookmarks={bookmarks}
              onBM={toggleBM} onOpen={openRecipe}
              onUpgrade={() => setShowPaywall(true)}
              activeFilter={activeFilter}
            />
          </div>
        </>
      )}

      {tab === "search" && (
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <SearchView
            user={user} isPro={isPro} bookmarks={bookmarks}
            onBM={toggleBM} onOpen={openRecipe}
            onShowPaywall={() => setShowPaywall(true)}
            searchHistory={searchHistory}
            searchCount={searchCount}
            onIncrementCount={async () => {
              const newCount = await incrementServerSearchCount(user?.uid);
              setSearchCount(newCount);
              return newCount;
            }}
          />
        </div>
      )}

      {tab === "saved" && (
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <SavedView bookmarks={bookmarks} onOpen={openRecipe} onBM={toggleBM} />
        </div>
      )}

      {tab === "profile" && (
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <ProfileView
            user={user} isPro={isPro} subscription={subscription}
            onSignIn={async () => { try { await signInWithGoogle(); } catch {} }}
            onSignOut={() => { signOutUser(); setIsPro(false); setSearchCount(0); setBookmarks([]); setSearchHistory([]); setPreferences(null); setSubscription({ status: "free", isPro: false, endDate: null }); }}
            onUpgrade={handleUpgrade}
            searchCount={searchCount}
            searchHistory={searchHistory}
            bookmarks={bookmarks}
            loadingPayment={loadingPayment}
            preferences={preferences}
            onOpen={openRecipe}
            onGoToSaved={() => handleTabChange("saved")}
            onCancelSubscription={() => { setCancelStep(1); setShowCancelModal(true); }}
          />
        </div>
      )}

      {/* Bottom nav — full width */}
      <BottomNav activeTab={tab} onChange={handleTabChange} />
    </div>
  );
}
