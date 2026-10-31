import { useState, useEffect, useRef, useCallback, Component } from "react";
import { auth, signInWithGoogle, signOutUser, getServerSearchCount, incrementServerSearchCount, syncBookmarksToFirestore, loadBookmarksFromFirestore, getSubscriptionStatus, logSearchHistory, getSearchHistory, updatePreferenceProfile, getAdaptiveSectionOrder, trackEngagement, cancelSubscription } from "./firebase.js";
import { onAuthStateChanged, deleteUser as fbDeleteUser } from "firebase/auth";

/* ─── Error Boundary ─────────────────────────────────────── */
/* Catches render crashes so users see a real error instead of a blank white screen.
   This is the single most important safety net in a production React app —
   without it, ANY uncaught exception anywhere silently unmounts the whole tree. */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("Mama K crash:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", fontFamily: "-apple-system, sans-serif", background: "#FAFAFA",
        }}>
          <div style={{ maxWidth: "480px", width: "100%", background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #FECACA" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#DC2626", marginBottom: "8px" }}>Something broke on this screen</div>
            <div style={{ fontSize: "13px", color: "#555", lineHeight: 1.6, marginBottom: "16px" }}>
              This is the real error — screenshot this and send it back so it can be fixed precisely:
            </div>
            <pre style={{
              background: "#1A1A1A", color: "#F87171", padding: "12px", borderRadius: "10px",
              fontSize: "11px", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
              marginBottom: "16px", maxHeight: "200px", overflowY: "auto",
            }}>
              {String(this.state.error?.message || this.state.error)}
              {this.state.info?.componentStack ? "\n\n" + this.state.info.componentStack.split("\n").slice(0, 6).join("\n") : ""}
            </pre>
            <button onClick={() => window.location.reload()} style={{
              width: "100%", padding: "12px", background: "#CE4F00", color: "#fff",
              border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer",
            }}>Reload App</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const result = await callAPIDetailed(query, isPro, uid);
  return result.recipes;
};

const callAPIDetailed = async (query, isPro = false, uid = null, aiSearch = false) => {
  const key = `${query.toLowerCase()}__${isPro}__${aiSearch}`;
  if (recipeCache.has(key)) return { recipes: recipeCache.get(key), searchCount: null, limitReached: false };
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, isPro, uid, aiSearch }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { recipes: [], searchCount: data.searchCount ?? null, limitReached: !!data.limitReached, proRequired: !!data.proRequired, error: data.error };
  }
  const recipes = data.recipes || [];
  if (recipes.length > 0) recipeCache.set(key, recipes);
  return { recipes, searchCount: data.searchCount ?? null, limitReached: false };
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
  @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
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
  <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
    <svg width={height * 0.75} height={height} viewBox="767 460 714 960" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <path d={FLAME} fill={light ? "#FFF0E0" : B.orange} fillRule="nonzero" />
    </svg>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 900,
        fontSize: height * 0.42, color: light ? "#fff" : B.dark,
        letterSpacing: "0.04em", lineHeight: 1, textTransform: "uppercase",
        whiteSpace: "nowrap", textAlign: "center",
      }}>MAMA K</div>
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontWeight: 400,
        fontSize: height * 0.2, color: light ? "rgba(255,255,255,0.7)" : B.orange,
        textTransform: "uppercase", letterSpacing: "0.75em",
        lineHeight: 1, marginTop: "3px",
        width: "100%", textAlign: "center", textIndent: "0.75em",
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
const Paywall = ({ user, onSignIn, onDismiss, onUpgrade, loading }) => {
  const [billingCycle, setBillingCycle] = useState("monthly");

  return (
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
          {user ? "Unlock Your Personal AI Chef" : "Sign in to start discovering"}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.muted, textAlign: "center", lineHeight: 1.6, marginBottom: "24px" }}>
          {user ? "You've used today's free search. Here's what unlimited access actually gets you." : "Create a free account to get 1 search daily."}
        </div>

        {(user ? [
          "Unlimited AI food discovery — no daily limit",
          "AI Meal Planner — your whole week, planned in one tap",
          "Pantry Mode — turn what's in your kitchen into dinner",
          "Transform any recipe — High Protein, Vegan, Budget, Air Fryer and more",
          "Ask AI about any recipe — substitutions, timing, storage",
          "Smarter recommendations powered by your Taste DNA",
        ] : [
          "1 free AI search daily",
          "Personalized feed that learns your taste",
          "Save recipes across devices",
          "Browse restaurants near you",
        ]).map(p => (
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
          <>
            <div style={{ display: "flex", background: B.bg, borderRadius: "10px", padding: "3px", marginTop: "20px", marginBottom: "12px" }}>
              {[["monthly", "Monthly"], ["annual", "Annual — save 33%"]].map(([id, label]) => (
                <button key={id} onClick={() => setBillingCycle(id)} style={{
                  flex: 1, padding: "9px", border: "none", borderRadius: "8px",
                  background: billingCycle === id ? B.white : "transparent",
                  color: billingCycle === id ? B.dark : B.muted,
                  fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: billingCycle === id ? 600 : 400,
                  cursor: "pointer", boxShadow: billingCycle === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}>{label}</button>
              ))}
            </div>
            <button onClick={() => onUpgrade(billingCycle)} className="btn-primary" style={{
              width: "100%", padding: "15px",
              borderRadius: "14px", fontSize: "15px", fontWeight: 600,
            }}>
              {loading ? "Redirecting..." : billingCycle === "annual" ? "Upgrade to Pro — $39.99/year" : "Upgrade to Pro — $4.99/month"}
            </button>
          </>
        )}
        <button onClick={onDismiss} style={{
          width: "100%", marginTop: "10px", padding: "12px",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted,
        }}>Maybe later</button>
      </div>
    </div>
  );
};

/* ─── Detail View ────────────────────────────────────────── */
const DetailView = ({ recipe, bookmarked, onBM, onBack, onOpen, isPro, onUpgrade, user }) => {
  const [tab, setTab] = useState("ingredients");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [recs, setRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  // Recommendations — always Firestore-indexed, zero AI cost, no query-guessing.
  useEffect(() => {
    let cancelled = false;
    setRecsLoading(true);
    setRecs([]);

    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: recipe.title,
        region: recipe.region,
        cuisine: recipe.cuisine,
        category: recipe.region, // region doubles as a reasonable category hint
        isPro,
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setRecs((d.recipes || []).slice(0, 4)); setRecsLoading(false); } })
      .catch(() => { if (!cancelled) setRecsLoading(false); });

    return () => { cancelled = true; };
  }, [recipe.title]);

  // Fire-and-forget view tracking — never blocks rendering.
  useEffect(() => {
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: recipe.title, isPro }),
    }).catch(() => {});
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
        <RecipeTools recipe={recipe} isPro={isPro} onUpgrade={onUpgrade} user={user} />

        {/* More like this */}
        {(recsLoading || recs.length > 0) && (
          <div style={{ marginTop: "36px", paddingTop: "24px", borderTop: `1px solid ${B.border}` }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "17px", color: B.dark, marginBottom: "4px" }}>More Like This</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>Based on {recipe.region || recipe.cuisine || "similar style"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {recsLoading
                ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
                : recs.map((r, i) => (
                    <RecipeCard key={i} r={r} onOpen={() => onOpen(r)} bookmarked={false} onBM={() => {}} />
                  ))
              }
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
  { id: "vegan",    label: "Vegan",         icon: "🥦", pro: true,  desc: "No animal products" },
  { id: "airfryer", label: "Air Fryer",     icon: "⚡", pro: true,  desc: "Air fryer adapted" },
  { id: "budget",   label: "Budget",        icon: "💰", pro: true,  desc: "Student friendly" },
  { id: "findnear", label: "Find Near Me",  icon: "📍", pro: true,  desc: "Nearby restaurants" },
];

const ASK_AI_SUGGESTIONS = ["Can I freeze this?", "What can I serve with it?", "Is this spicy?", "Can I cook this tomorrow?"];

const RecipeTools = ({ recipe, isPro, onUpgrade, user }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [partySize, setPartySize] = useState(10);
  const [shoppingDone, setShoppingDone] = useState({});
  const [transforms, setTransforms] = useState({});
  const [transformLoading, setTransformLoading] = useState(null);
  const [transformError, setTransformError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatEndRef = useRef(null);
  const [locStatus, setLocStatus] = useState("idle");
  const [locCoords, setLocCoords] = useState(null);
  const [locText, setLocText] = useState("");
  const [restaurants, setRestaurants] = useState(null);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [restaurantsError, setRestaurantsError] = useState(null);
  const [placesConfigured, setPlacesConfigured] = useState(true);

  const AI_TOOL_TYPES = { protein: "protein", lowcal: "lowcal", veggie: "veggie", vegan: "vegan", airfryer: "airfryer", budget: "budget" };

  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const loadConversation = () => {
    if (chatLoaded || !user?.uid) return;
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get-conversation", uid: user.uid, recipeTitle: recipe.title }) })
      .then(r => r.json()).then(d => { setChatMessages(d.messages || []); setChatLoaded(true); }).catch(() => setChatLoaded(true));
  };

  const sendAskAI = (questionOverride) => {
    const question = (questionOverride || chatInput).trim();
    if (!question || !user?.uid) return;
    setChatInput(""); setChatLoading(true);
    setChatMessages(prev => [...prev, { role: "user", text: question, at: Date.now() }]);
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ask", uid: user.uid, isPro, recipeTitle: recipe.title, recipeContext: { ingredients: recipe.ingredients, steps: recipe.steps }, question }) })
      .then(r => r.json())
      .then(d => { if (d.messages) setChatMessages(d.messages); else setChatMessages(prev => [...prev, { role: "assistant", text: d.error || "Something went wrong.", at: Date.now() }]); })
      .catch(() => setChatMessages(prev => [...prev, { role: "assistant", text: "Something went wrong. Try again.", at: Date.now() }]))
      .finally(() => setChatLoading(false));
  };

  const requestLocationAndSearch = () => {
    if (!navigator.geolocation) { setLocStatus("denied"); return; }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocCoords(c); setLocStatus("granted"); fetchRestaurants({ lat: c.lat, lng: c.lng }); },
      () => setLocStatus("denied"), { timeout: 8000 }
    );
  };

  const fetchRestaurants = ({ lat, lng, locationText } = {}) => {
    setRestaurantsLoading(true); setRestaurantsError(null);
    const dishOrCuisine = recipe.cuisine || recipe.region || recipe.title;
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restaurants", dishOrCuisine, lat, lng, locationText }) })
      .then(r => r.json())
      .then(d => { if (!d.configured) { setPlacesConfigured(false); setRestaurants([]); return; } if (d.error) setRestaurantsError(d.error); setRestaurants(d.restaurants || []); })
      .catch(() => setRestaurantsError("Couldn't load restaurants right now"))
      .finally(() => setRestaurantsLoading(false));
  };

  const handleTool = (tool) => {
    if (tool.pro && !isPro) { onUpgrade(); return; }
    const next = activeTool === tool.id ? null : tool.id;
    setActiveTool(next);
    if (next === "ask") loadConversation();
    if (next && AI_TOOL_TYPES[next] && !transforms[next]) {
      setTransformLoading(next); setTransformError(null);
      fetch("/api/transform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipe, transformType: AI_TOOL_TYPES[next], isPro }) })
        .then(r => r.json())
        .then(d => { if (d.result) setTransforms(prev => ({ ...prev, [next]: d.result })); else setTransformError(d.error || "Something went wrong"); })
        .catch(() => setTransformError("Something went wrong"))
        .finally(() => setTransformLoading(null));
    }
  };

  const baseServings = recipe.servings || 4;
  const scale = partySize / baseServings;
  const scaleIngredient = (ing) => ing.replace(/(\d+(\.\d+)?)/g, (match) => { const s = parseFloat(match) * scale; return s % 1 === 0 ? s.toString() : s.toFixed(1); });

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
      const lower = ing.toLowerCase(); let placed = false;
      for (const [group, keywords] of Object.entries(GROUPS)) { if (keywords.some(k => lower.includes(k))) { grouped[group].push(ing); placed = true; break; } }
      if (!placed) grouped["Other"].push(ing);
    });
    return Object.entries(grouped).filter(([,v]) => v.length > 0);
  };

  return (
    <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: `1px solid ${B.border}` }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "17px", color: B.dark, marginBottom: "4px" }}>Recipe Tools</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "14px" }}>Adapt this recipe to your needs</div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {TOOLS.map(tool => (
          <button key={tool.id} onClick={() => handleTool(tool)} style={{
            display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "20px", cursor: "pointer",
            fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 500,
            border: `1px solid ${activeTool === tool.id ? B.orange : B.border}`,
            background: activeTool === tool.id ? "#FFF7ED" : B.bg,
            color: activeTool === tool.id ? B.orange : B.dark, transition: "all 0.18s",
          }}>
            <span>{tool.icon}</span>{tool.label}
            {tool.pro && !isPro && <span style={{ fontSize: "9px", background: B.orange, color: "#fff", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>PRO</span>}
          </button>
        ))}
      </div>

      {activeTool === "party" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "20px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "4px" }}>🎉 Party Mode</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>Scaled for {partySize} people (original: {baseServings} servings)</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {[10, 20, 30, 50, 75, 100].map(n => (
              <button key={n} onClick={() => setPartySize(n)} style={{ padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, border: `1px solid ${partySize === n ? B.orange : B.border}`, background: partySize === n ? B.orange : B.white, color: partySize === n ? "#fff" : B.dark, transition: "all 0.15s" }}>{n}</button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>Custom:</span>
              <input type="number" value={partySize} min={1} max={500} onChange={e => setPartySize(parseInt(e.target.value)||1)} style={{ width: "60px", padding: "5px 8px", border: `1px solid ${B.border}`, borderRadius: "8px", fontFamily: "'Inter', sans-serif", fontSize: "13px", textAlign: "center" }} />
            </div>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Scaled Ingredients</div>
          {(recipe.ingredients || []).map((ing, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: `1px solid ${B.border}` }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: B.orange, flexShrink: 0 }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{scaleIngredient(ing)}</span>
            </div>
          ))}
          <div style={{ marginTop: "14px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>Est. total calories: ~{Math.round((recipe.calories || 0) * scale * baseServings)}</div>
        </div>
      )}

      {activeTool === "shopping" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "20px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark }}>🛒 Shopping List</div>
            <button onClick={() => { const text = `Shopping List — ${recipe.title}\n\n` + (recipe.ingredients || []).map(i => `□ ${i}`).join("\n"); navigator.clipboard?.writeText(text).then(() => alert("Copied to clipboard!")); }} style={{ background: B.dark, color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600 }}>Copy all</button>
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

      {activeTool && AI_TOOL_TYPES[activeTool] && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "20px", animation: "fadeUp 0.3s ease" }}>
          {transformLoading === activeTool && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>Adapting this recipe...</div>
            </div>
          )}
          {transformError && transformLoading !== activeTool && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#DC2626", marginBottom: "12px" }}>{transformError}</div>
              <button onClick={() => handleTool({ id: activeTool, pro: true })} className="btn-primary" style={{ padding: "8px 20px", borderRadius: "8px", fontSize: "13px" }}>Try Again</button>
            </div>
          )}
          {transforms[activeTool] && transformLoading !== activeTool && (() => {
            const t = transforms[activeTool];
            return (
              <>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "4px" }}>{t.title}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: t.substitution_note ? "8px" : "16px" }}>{t.tagline}</div>
                {t.substitution_note && (
                  <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px", padding: "10px 12px", marginBottom: "16px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#9A3412" }}>{t.substitution_note}</div>
                )}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                  {[["⏱", t.time], ["👥", `${t.servings} servings`], ["🔥", `~${t.calories} cal`], t.protein_grams ? ["💪", `${t.protein_grams}g protein`] : null, t.estimated_cost ? ["💰", t.estimated_cost] : null, t.cost_reduction_percent ? ["📉", `${t.cost_reduction_percent}% cheaper`] : null].filter(Boolean).map(([icon, val], i) => (
                    <div key={i} style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: "10px", padding: "6px 12px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.dark, display: "flex", alignItems: "center", gap: "5px" }}><span>{icon}</span>{val}</div>
                  ))}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Ingredients</div>
                {(t.ingredients || []).map((ing, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: `1px solid ${B.border}` }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: B.orange, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{ing}</span>
                  </div>
                ))}
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "16px 0 10px" }}>Steps</div>
                {(t.steps || []).map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: B.orange, color: "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 700 }}>{i + 1}</div>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, lineHeight: 1.6 }}>{step}</span>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {activeTool === "ask" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "16px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "4px" }}>Ask AI about this recipe</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, marginBottom: "14px" }}>Substitutions, timing, storage — anything about {recipe.title}</div>
          <div style={{ maxHeight: "320px", overflowY: "auto", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {chatMessages.length === 0 && !chatLoading && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "4px 0" }}>
                {ASK_AI_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => sendAskAI(s)} style={{ background: B.white, border: `1px solid ${B.border}`, borderRadius: "16px", padding: "7px 12px", fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.dark, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = B.dark; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = B.white; e.currentTarget.style.color = B.dark; }}
                  >{s}</button>
                ))}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "85%", padding: "9px 13px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.role === "user" ? B.orange : B.white, color: m.role === "user" ? "#fff" : B.dark, fontFamily: "'Inter', sans-serif", fontSize: "13px", lineHeight: 1.5, border: m.role === "user" ? "none" : `1px solid ${B.border}` }}>{m.text}</div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: "14px 14px 14px 4px", background: B.white, border: `1px solid ${B.border}`, display: "flex", gap: "5px" }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: B.muted, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !chatLoading && sendAskAI()} placeholder="Ask anything about this recipe..." style={{ flex: 1, padding: "11px 14px", borderRadius: "12px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "13px", outline: "none" }} />
            <button onClick={() => sendAskAI()} disabled={chatLoading || !chatInput.trim()} className="btn-primary" style={{ padding: "0 18px", borderRadius: "12px", fontSize: "13px", opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>Send</button>
          </div>
        </div>
      )}

      {activeTool === "findnear" && (
        <div style={{ background: B.bg, borderRadius: "16px", padding: "18px", animation: "fadeUp 0.3s ease" }}>
          {!placesConfigured ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>📍</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>Find Near Me isn't set up yet on this account.</div>
            </div>
          ) : locStatus === "idle" && !restaurants ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>📍</div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "4px" }}>Find restaurants near you</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>Serving {recipe.cuisine || recipe.region || "this"} food</div>
              <button onClick={requestLocationAndSearch} className="btn-primary" style={{ padding: "10px 20px", borderRadius: "10px", fontSize: "13px" }}>Use My Location</button>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, margin: "10px 0" }}>or</div>
              <div style={{ display: "flex", gap: "8px", maxWidth: "320px", margin: "0 auto" }}>
                <input value={locText} onChange={e => setLocText(e.target.value)} placeholder="City, neighbourhood, postcode" style={{ flex: 1, padding: "9px 12px", borderRadius: "10px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "13px", outline: "none" }} />
                <button onClick={() => locText.trim() && fetchRestaurants({ locationText: locText.trim() })} style={{ padding: "9px 16px", borderRadius: "10px", border: `1px solid ${B.border}`, background: B.white, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600 }}>Search</button>
              </div>
            </div>
          ) : locStatus === "requesting" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>Getting your location...</div>
            </div>
          ) : locStatus === "denied" && !restaurants ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "4px" }}>Where should we look?</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "14px" }}>Enter a city, neighbourhood or postcode</div>
              <div style={{ display: "flex", gap: "8px", maxWidth: "320px", margin: "0 auto" }}>
                <input value={locText} onChange={e => setLocText(e.target.value)} onKeyDown={e => e.key === "Enter" && locText.trim() && fetchRestaurants({ locationText: locText.trim() })} placeholder="e.g. Brooklyn" style={{ flex: 1, padding: "9px 12px", borderRadius: "10px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "13px", outline: "none" }} />
                <button onClick={() => locText.trim() && fetchRestaurants({ locationText: locText.trim() })} className="btn-primary" style={{ padding: "9px 16px", borderRadius: "10px", fontSize: "13px" }}>Search</button>
              </div>
            </div>
          ) : restaurantsLoading ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginBottom: "12px" }}>
                {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>Finding restaurants...</div>
            </div>
          ) : restaurantsError ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#DC2626", fontFamily: "'Inter', sans-serif", fontSize: "13px" }}>{restaurantsError}</div>
          ) : restaurants && restaurants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>No restaurants found nearby for this dish.</div>
          ) : restaurants ? (
            <div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "12px" }}>{recipe.cuisine || recipe.region || recipe.title} near you</div>
              {restaurants.map((r, i) => (
                <div key={i} style={{ background: B.white, borderRadius: "12px", padding: "12px 14px", marginBottom: "8px", border: `1px solid ${B.border}` }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: B.dark, marginBottom: "3px" }}>{r.name}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, marginBottom: "8px" }}>{[r.rating ? `${r.rating} ★` : null, r.distanceKm != null ? `${r.distanceKm} km` : null, r.openNow != null ? (r.openNow ? "Open now" : "Closed") : null].filter(Boolean).join(" · ")}</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <a href={r.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, textDecoration: "none" }}>View Restaurant</a>
                    <span style={{ color: B.border }}>·</span>
                    <a href={r.directionsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, textDecoration: "none" }}>Directions</a>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const MEAL_PLAN_GOALS = [
  { id: "lose_weight",  label: "Lose Weight",   icon: "⚖️" },
  { id: "build_muscle", label: "Build Muscle",  icon: "💪" },
  { id: "family",       label: "Family Meals",  icon: "👨‍👩‍👧" },
  { id: "budget",       label: "Budget Meals",  icon: "💰" },
  { id: "quick",        label: "Quick Meals",   icon: "⚡" },
  { id: "vegetarian",   label: "Vegetarian",    icon: "🌱" },
  { id: "high_protein", label: "High Protein",  icon: "🍗" },
];

const MealPlannerView = ({ user, isPro, preferences, onBack, onUpgrade }) => {
  const [planType, setPlanType] = useState("weekly");
  const [goals, setGoals] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shoppingList, setShoppingList] = useState(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    if (!user?.uid || !isPro) return;
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "get-meal-plan", uid: user.uid, planType }) })
      .then(r => r.json()).then(d => { if (d.days) setPlan(d.days); }).catch(() => {});
  }, [user?.uid, isPro, planType]);

  const toggleGoal = (id) => setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const generatePlan = () => {
    if (!isPro) { onUpgrade(); return; }
    setLoading(true); setError(null); setShowShoppingList(false); setShoppingList(null);
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "meal-plan", uid: user.uid, isPro, goals: goals.map(id => MEAL_PLAN_GOALS.find(g => g.id === id)?.label).filter(Boolean), planType, preferences }) })
      .then(r => r.json())
      .then(d => { if (d.days) setPlan(d.days); else setError(d.error || "Something went wrong"); })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  };

  const generateShoppingList = () => {
    if (!plan) return;
    setShoppingLoading(true);
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "shopping-list-from-plan", days: plan }) })
      .then(r => r.json())
      .then(d => { setShoppingList(d.list); setShowShoppingList(true); })
      .catch(() => setError("Couldn't generate shopping list"))
      .finally(() => setShoppingLoading(false));
  };

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
      </div>
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "4px" }}>Meal Planner</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "20px" }}>Your week, planned in one tap</div>
        {!isPro && (
          <div onClick={onUpgrade} style={{ background: B.dark, borderRadius: "16px", padding: "18px", marginBottom: "20px", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: "#fff", marginBottom: "4px" }}>Meal Planner is a Pro feature</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Tap to unlock unlimited AI meal plans</div>
          </div>
        )}
        <div style={{ display: "flex", background: B.bg, borderRadius: "12px", padding: "3px", marginBottom: "20px" }}>
          {["weekly", "monthly"].map(t => (
            <button key={t} onClick={() => setPlanType(t)} style={{ flex: 1, padding: "10px", border: "none", borderRadius: "10px", background: planType === t ? B.white : "transparent", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: planType === t ? 600 : 400, color: planType === t ? B.dark : B.muted, cursor: "pointer", textTransform: "capitalize", boxShadow: planType === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>{t}</button>
          ))}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>Goals (optional)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {MEAL_PLAN_GOALS.map(g => (
            <button key={g.id} onClick={() => toggleGoal(g.id)} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "20px", cursor: "pointer", border: `1px solid ${goals.includes(g.id) ? B.orange : B.border}`, background: goals.includes(g.id) ? "#FFF7ED" : B.white, color: goals.includes(g.id) ? B.orange : B.dark, fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: goals.includes(g.id) ? 600 : 400 }}><span>{g.icon}</span>{g.label}</button>
          ))}
        </div>
        <button onClick={generatePlan} disabled={loading} className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "14px", fontSize: "14px", marginBottom: "24px", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Building your plan..." : plan ? "Regenerate Plan" : `Generate ${planType === "weekly" ? "Weekly" : "Monthly"} Plan`}
        </button>
        {error && <div style={{ textAlign: "center", color: "#DC2626", fontFamily: "'Inter', sans-serif", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "14px" }} />)}
          </div>
        )}
        {plan && !loading && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {plan.map((day, i) => (
                <div key={i} style={{ background: B.bg, borderRadius: "16px", padding: "16px", animation: "fadeUp 0.3s ease both", animationDelay: `${i * 40}ms` }}>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "10px" }}>{day.day}</div>
                  {[["Breakfast", day.breakfast], ["Lunch", day.lunch], ["Dinner", day.dinner]].map(([label, meal]) => meal && (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${B.border}` }}>
                      <div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: B.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, fontWeight: 500 }}>{meal.title}</div>
                      </div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted }}>{meal.calories} cal</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={generateShoppingList} disabled={shoppingLoading} style={{ width: "100%", padding: "13px", borderRadius: "14px", border: `1px solid ${B.border}`, background: B.white, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: B.dark }}>
              {shoppingLoading ? "Building shopping list..." : "Generate Shopping List"}
            </button>
            {showShoppingList && shoppingList && (
              <div style={{ background: B.bg, borderRadius: "16px", padding: "18px", marginTop: "16px" }}>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "14px" }}>Shopping List</div>
                {Object.entries(shoppingList).map(([group, items]) => (Array.isArray(items) && items.length > 0) && (
                  <div key={group} style={{ marginBottom: "14px" }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700, color: B.muted, textTransform: "capitalize", marginBottom: "6px" }}>{group.replace(/_/g, " ")}</div>
                    {items.map((item, i) => (
                      <div key={i} onClick={() => setChecked(p => ({...p, [item]: !p[item]}))} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: `1px solid ${B.border}`, cursor: "pointer" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${checked[item] ? B.orange : B.border}`, background: checked[item] ? B.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{checked[item] && <span style={{ color: "#fff", fontSize: "10px" }}>✓</span>}</div>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark, textDecoration: checked[item] ? "line-through" : "none", opacity: checked[item] ? 0.4 : 1 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!plan && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: B.muted }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.3 }}>📅</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px" }}>Pick your goals and generate your first plan</div>
          </div>
        )}
      </div>
    </div>
  );
};

const PantryView = ({ isPro, onBack, onUpgrade, onOpenRecipe, bookmarks, onBM }) => {
  const [ingredients, setIngredients] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addIngredient = () => { const val = inputVal.trim(); if (!val || ingredients.includes(val)) return; setIngredients(prev => [...prev, val]); setInputVal(""); };
  const removeIngredient = (val) => setIngredients(prev => prev.filter(i => i !== val));

  const findRecipes = () => {
    if (ingredients.length === 0) return;
    setLoading(true); setError(null);
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pantry", ingredients, isPro }) })
      .then(r => r.json())
      .then(d => { if (d.recipes) setResults(d.recipes); else setError(d.error || "Something went wrong"); })
      .catch(() => setError("Something went wrong"))
      .finally(() => setLoading(false));
  };

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
      </div>
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "4px" }}>Pantry Mode</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "20px" }}>Tell us what you have, we'll tell you what to cook</div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === "Enter" && addIngredient()} placeholder="e.g. chicken, rice, peppers" style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "14px", outline: "none" }} />
          <button onClick={addIngredient} className="btn-primary" style={{ padding: "0 20px", borderRadius: "12px", fontSize: "14px" }}>Add</button>
        </div>
        {ingredients.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
            {ingredients.map(ing => (
              <div key={ing} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FFF7ED", border: `1px solid #FED7AA`, borderRadius: "20px", padding: "6px 8px 6px 14px" }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.dark }}>{ing}</span>
                <button onClick={() => removeIngredient(ing)} style={{ background: "none", border: "none", cursor: "pointer", color: B.muted, fontSize: "15px", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            ))}
          </div>
        )}
        <button onClick={findRecipes} disabled={ingredients.length === 0 || loading} className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "14px", fontSize: "14px", marginBottom: "20px", opacity: (ingredients.length === 0 || loading) ? 0.5 : 1 }}>
          {loading ? "Finding recipes..." : "Find Recipes"}
        </button>
        {error && <div style={{ textAlign: "center", color: "#DC2626", fontFamily: "'Inter', sans-serif", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
        {loading && (
          <div className="recipe-grid" style={{ padding: 0 }}>{Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
        )}
        {!loading && results.length > 0 && (
          <div className="recipe-grid" style={{ padding: 0 }}>
            {results.map((r, i) => <RecipeCard key={i} r={r} onOpen={() => onOpenRecipe(r)} bookmarked={bookmarks.some(b => b.title === r.title)} onBM={() => onBM(r)} />)}
          </div>
        )}
        {!isPro && results.length > 0 && (
          <div onClick={onUpgrade} style={{ background: B.dark, borderRadius: "16px", padding: "18px", marginTop: "16px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: "#fff", marginBottom: "4px" }}>Get more recipes from your pantry</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Pro unlocks more results per search</div>
          </div>
        )}
      </div>
    </div>
  );
};

const RESTAURANT_QUICK_FILTERS = ["Nearby", "Pizza", "Sushi", "Burgers", "Coffee", "Thai", "Italian", "Vegetarian"];

const RestaurantsView = ({ user }) => {
  const [query, setQuery] = useState("");
  const [locStatus, setLocStatus] = useState("idle"); // idle | requesting | granted | denied
  const [locText, setLocText] = useState("");
  const [restaurants, setRestaurants] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Nearby");

  // Location-first: request geolocation and show a feed immediately on
  // open, matching the rest of the app's discovery-first feel — searching
  // is there to narrow down, not required before anything shows.
  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("denied"); return; }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocStatus("granted"); fetchRestaurants({ lat: pos.coords.latitude, lng: pos.coords.longitude, term: "restaurants" }); },
      () => setLocStatus("denied"),
      { timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRestaurants = ({ lat, lng, locationText, term } = {}) => {
    const searchTerm = term || query.trim() || "restaurants";
    setLoading(true); setError(null);
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restaurants", dishOrCuisine: searchTerm, lat, lng, locationText }) })
      .then(r => r.json())
      .then(d => { if (!d.configured) { setConfigured(false); setRestaurants([]); return; } if (d.error) setError(d.error); setRestaurants(d.restaurants || []); })
      .catch(() => setError("Couldn't load restaurants right now"))
      .finally(() => setLoading(false));
  };

  const runSearch = (term) => {
    setActiveFilter(null);
    if (locStatus === "granted") fetchRestaurants({ term });
    else if (locText.trim()) fetchRestaurants({ locationText: locText.trim(), term });
  };

  const applyFilter = (f) => {
    setActiveFilter(f);
    const term = f === "Nearby" ? "restaurants" : f;
    if (locStatus === "granted") fetchRestaurants({ term });
    else if (locText.trim()) fetchRestaurants({ locationText: locText.trim(), term });
  };

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "16px", maxWidth: "700px", margin: "0 auto" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "4px" }}>Restaurants</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "16px" }}>What's good nearby</div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(query)} placeholder="Search a cuisine or dish..." style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "14px", outline: "none" }} />
          <button onClick={() => runSearch(query)} className="btn-primary" style={{ padding: "0 20px", borderRadius: "12px", fontSize: "14px" }}>Search</button>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "18px" }}>
          {RESTAURANT_QUICK_FILTERS.map(f => (
            <button key={f} onClick={() => applyFilter(f)} style={{
              padding: "7px 14px", borderRadius: "20px", cursor: "pointer",
              border: `1px solid ${activeFilter === f ? B.orange : B.border}`,
              background: activeFilter === f ? "#FFF7ED" : B.bg,
              color: activeFilter === f ? B.orange : B.dark,
              fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: activeFilter === f ? 600 : 400,
            }}>{f}</button>
          ))}
        </div>

        {!configured && (
          <div style={{ textAlign: "center", padding: "50px 0", color: B.muted }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.3 }}>📍</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px" }}>Restaurant search isn't set up yet on this account.</div>
          </div>
        )}

        {configured && locStatus === "requesting" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />)}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginTop: "10px" }}>Finding what's near you...</div>
          </div>
        )}

        {configured && locStatus === "denied" && !restaurants && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: B.dark, marginBottom: "4px" }}>Where should we look?</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "14px" }}>Location access wasn't available — enter a place instead</div>
            <div style={{ display: "flex", gap: "8px", maxWidth: "320px", margin: "0 auto" }}>
              <input value={locText} onChange={e => setLocText(e.target.value)} onKeyDown={e => e.key === "Enter" && locText.trim() && fetchRestaurants({ locationText: locText.trim(), term: "restaurants" })} placeholder="e.g. Brooklyn" style={{ flex: 1, padding: "9px 12px", borderRadius: "10px", border: `1px solid ${B.border}`, fontFamily: "'Inter', sans-serif", fontSize: "13px", outline: "none" }} />
              <button onClick={() => locText.trim() && fetchRestaurants({ locationText: locText.trim(), term: "restaurants" })} className="btn-primary" style={{ padding: "9px 16px", borderRadius: "10px", fontSize: "13px" }}>Go</button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "76px", borderRadius: "14px" }} />)}
          </div>
        )}

        {error && <div style={{ textAlign: "center", color: "#DC2626", fontFamily: "'Inter', sans-serif", fontSize: "13px", padding: "16px 0" }}>{error}</div>}

        {restaurants && restaurants.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted }}>No restaurants found.</div>
        )}

        {restaurants && restaurants.length > 0 && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {restaurants.map((r, i) => (
              <div key={i} style={{ background: B.bg, borderRadius: "14px", padding: "14px 16px", animation: "fadeUp 0.3s ease both", animationDelay: `${i*40}ms` }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: B.dark, marginBottom: "4px" }}>{r.name}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "10px" }}>{[r.rating ? `${r.rating} ★` : null, r.distanceKm != null ? `${r.distanceKm} km` : null, r.openNow != null ? (r.openNow ? "Open now" : "Closed") : null, r.address].filter(Boolean).join(" · ")}</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <a href={r.mapsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, textDecoration: "none" }}>View</a>
                  <a href={r.directionsUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, textDecoration: "none" }}>Directions</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AccountView = ({ user, onBack, onDeleteAccount }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
      </div>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "20px" }}>Manage Account</div>
        <div style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: "20px" }}>
          <div style={{ padding: "16px", borderBottom: `1px solid ${B.border}` }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Name</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.dark }}>{user?.displayName || "—"}</div>
          </div>
          <div style={{ padding: "16px" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Email</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.dark }}>{user?.email || "—"}</div>
          </div>
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, lineHeight: 1.6, marginBottom: "24px" }}>Signed in with Google. To change your name, email, or password, manage it directly through your Google Account.</div>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ width: "100%", padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: "#DC2626" }}>Delete Account</button>
        ) : (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "16px", padding: "18px" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: "#DC2626", marginBottom: "6px" }}>Are you sure?</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#7F1D1D", marginBottom: "16px", lineHeight: 1.6 }}>This permanently deletes your saved recipes, search history, taste profile, and cancels any active subscription. This cannot be undone.</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "11px", background: B.white, border: `1px solid ${B.border}`, borderRadius: "10px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: B.dark }}>Cancel</button>
              <button onClick={() => { setDeleting(true); onDeleteAccount().finally(() => setDeleting(false)); }} disabled={deleting} style={{ flex: 1, padding: "11px", background: "#DC2626", border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: "#fff", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Deleting..." : "Yes, Delete"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AskAIHistoryView = ({ user, onBack }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    fetch("/api/ai-tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list-conversations", uid: user.uid }) })
      .then(r => r.json()).then(d => setConversations(d.conversations || [])).catch(() => {}).finally(() => setLoading(false));
  }, [user?.uid]);
  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
      </div>
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "4px" }}>Ask AI</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "20px" }}>Your recent conversations</div>
        {loading && <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{Array(3).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: "60px", borderRadius: "12px" }} />)}</div>}
        {!loading && conversations.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: B.muted }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.3 }}>✨</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px" }}>Ask a question from any recipe page to start a conversation</div>
          </div>
        )}
        {!loading && conversations.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 12px", borderBottom: `1px solid ${B.border}` }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "15px" }}>✨</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: B.dark }}>{c.recipeTitle}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PrivacyView = ({ onBack }) => (
  <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
    <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
    </div>
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "24px", color: B.dark, marginBottom: "6px" }}>Privacy Policy</div>
      <div style={{ fontSize: "12px", color: B.muted, marginBottom: "28px" }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
      {[
        ["What we collect", "When you sign in with Google, we store your name, email, and profile photo. As you use Mama K, we record your searches, saved recipes, and which recipes you view, to personalise your feed and recommendations."],
        ["How we use it", "Your search and viewing history builds a taste profile used to personalise your home feed and recommendations. We never sell this data to third parties."],
        ["AI processing", "When you search, ask a question, or request a meal plan, your query is sent to our AI provider to generate a response. We do not send your name or email to the AI provider."],
        ["Location data", "Find Near Me and Restaurants only request your location when you explicitly search, used solely to find nearby restaurants, never stored linked to your account."],
        ["Payments", "Subscription payments are processed by Flutterwave. We do not store your card details."],
        ["Your rights", "You can delete your account at any time from Manage Account. This permanently removes your saved recipes, search history, taste profile, and conversation history."],
        ["Data retention", "We retain account data while your account is active. Deleted account data is removed within 30 days."],
        ["Contact", "Questions can be sent to support@keyangle.tech."],
      ].map(([title, body]) => (
        <div key={title} style={{ marginBottom: "22px" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "6px" }}>{title}</div>
          <div style={{ fontSize: "13px", color: "#3A3530", lineHeight: 1.7 }}>{body}</div>
        </div>
      ))}
    </div>
  </div>
);

const TermsView = ({ onBack }) => (
  <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
    <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: B.orange, fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: 0 }}>‹ Back</button>
    </div>
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "24px 20px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "24px", color: B.dark, marginBottom: "6px" }}>Terms of Service</div>
      <div style={{ fontSize: "12px", color: B.muted, marginBottom: "28px" }}>Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
      {[
        ["Using Mama K", "Mama K Recipes is a food discovery platform. Recipes, meal plans, and nutritional estimates are AI-generated for general guidance. Always use your own judgement, especially regarding allergies and food safety."],
        ["Accounts", "You must sign in with a valid Google account. One account per person."],
        ["Subscriptions", "Mama K Pro is billed monthly or annually via Flutterwave, renewing automatically. Cancelling stops future billing but you retain Pro access until the current period ends."],
        ["Free tier limits", "Free accounts include 1 AI-generated recipe search per day. Browsing and cached content are not limited."],
        ["Content accuracy", "Nutritional estimates are AI-generated approximations, not verified nutritional analysis."],
        ["Restaurants", "Restaurant suggestions come from a third-party places provider for convenience only. Always confirm details with the restaurant directly."],
        ["Acceptable use", "Don't use Mama K to generate harmful or illegal content, or abuse the free-tier limit through automation."],
        ["Changes", "We may update these terms as the product evolves."],
        ["Contact", "Questions can be sent to support@keyangle.tech."],
      ].map(([title, body]) => (
        <div key={title} style={{ marginBottom: "22px" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "6px" }}>{title}</div>
          <div style={{ fontSize: "13px", color: "#3A3530", lineHeight: 1.7 }}>{body}</div>
        </div>
      ))}
    </div>
  </div>
);

const HomeFeed = ({ user, isPro, preferences, recentSearches, bookmarks, onBM, onOpen, onUpgrade, activeFilter }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState(0);
  const [done, setDone] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
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

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setBatches([]); setBatch(0); setDone(false); setShowUpgrade(false);
    loadingRef.current = false;
    await loadNext();
    setRefreshing(false);
    setPullY(0);
  };
  const handleTouchStart = (e) => { if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    if (window.scrollY > 0 || touchStartY.current === 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.5, 80));
  };
  const handleTouchEnd = () => { if (pullY > 50) refresh(); else setPullY(0); touchStartY.current = 0; };

  const allRecipes = batches.flatMap(b => b.recipes);

  if (allRecipes.length === 0 && loading) {
    return (
      <div className="recipe-grid">
        {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} style={{ paddingBottom: "80px", transform: `translateY(${pullY}px)`, transition: pullY === 0 ? "transform 0.2s ease" : "none" }}>
      {(pullY > 0 || refreshing) && (
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0", opacity: Math.min(pullY / 50, 1) }}>
          <div style={{ width: "20px", height: "20px", border: `2px solid ${B.border}`, borderTopColor: B.orange, borderRadius: "50%", animation: refreshing ? "spin 0.7s linear infinite" : "none" }} />
        </div>
      )}
      <div className="recipe-grid">
        {allRecipes.map((r, i) => (
          <div key={`${r.title}-${i}`} style={{ animation: "fadeUp 0.4s ease both", animationDelay: `${(i % 6) * 40}ms` }}
            onMouseEnter={() => startDwell(r.title, r)} onMouseLeave={() => clearDwell(r.title)}
          >
            <RecipeCard
              r={r}
              tall={i > 0 && i % 5 === 0}
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
          textAlign: "center",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.92"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "18px", color: "#fff", marginBottom: "8px", lineHeight: 1.2 }}>
            Unlimited Discovery
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
            Keep exploring without limits
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
const SearchView = ({ user, isPro, bookmarks, onBM, onOpen, onShowPaywall, searchHistory, searchCount, onSyncCount }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef();

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const doSearch = async (overrideQuery) => {
    const raw = (overrideQuery || query || "").trim();
    if (!raw) return;
    if (!user) { onShowPaywall(); return; }
    if (aiMode && !isPro) { onShowPaywall(); return; }
    if (!isPro && searchCount >= FREE_LIMIT) { onShowPaywall(); return; }

    const normalized = raw.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
    setLoading(true); setSearched(true); setSearchError(false);

    let recipes = [];
    try {
      let outcome = await callAPIDetailed(normalized, isPro, user?.uid, aiMode);
      if (outcome.limitReached) { setLoading(false); if (outcome.searchCount != null) onSyncCount(outcome.searchCount); onShowPaywall(); return; }
      if (outcome.proRequired) { setLoading(false); onShowPaywall(); return; }
      if (outcome.recipes.length === 0) outcome = await callAPIDetailed(normalized, isPro, user?.uid, aiMode);
      recipes = outcome.recipes;
      if (outcome.searchCount != null) onSyncCount(outcome.searchCount);
      if (recipes.length === 0) setSearchError(!!outcome.error);
      setResults(recipes);
    } catch { setResults([]); setSearchError(true); }
    setLoading(false);

    if (user?.uid && recipes.length > 0) {
      logSearchHistory(user.uid, normalized);
      updatePreferenceProfile(user.uid, { query: normalized });
    }
  };

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "12px 16px", position: "sticky", top: 0, background: B.white, zIndex: 80, borderBottom: `1px solid ${B.border}` }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", background: B.bg, borderRadius: "12px", border: `1px solid ${B.border}` }}>
            <svg style={{ margin: "0 10px 0 14px", color: B.muted, flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder={aiMode ? "Something creamy tonight, under 20 minutes..." : "Jollof Rice, Pasta, Healthy Breakfast..."}
              style={{ flex: 1, border: "none", outline: "none", padding: "13px 0", fontFamily: "'Inter', sans-serif", fontSize: "15px", background: "transparent", color: B.dark }}
            />
            {query && <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} style={{ background: "none", border: "none", padding: "0 14px", cursor: "pointer", color: B.muted, fontSize: "18px" }}>×</button>}
            <button onClick={doSearch} className="btn-primary" style={{ margin: "5px", borderRadius: "9px", padding: "9px 16px", fontSize: "13px" }}>Search</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 2px 0" }}>
            {[["recipe", "Recipe Search", false], ["ai", "Ask AI", true]].map(([id, label, needsPro]) => (
              <button key={id} onClick={() => needsPro && !isPro ? onShowPaywall() : setAiMode(needsPro)} style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "16px", cursor: "pointer",
                border: `1px solid ${aiMode === needsPro ? B.orange : B.border}`,
                background: aiMode === needsPro ? "#FFF7ED" : "transparent",
                color: aiMode === needsPro ? B.orange : B.muted,
                fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: aiMode === needsPro ? 600 : 400,
              }}>
                {label}
                {needsPro && !isPro && <span style={{ fontSize: "9px", background: B.orange, color: "#fff", borderRadius: "4px", padding: "1px 5px", fontWeight: 700 }}>PRO</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px" }}>
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
          <div className="recipe-grid" style={{ padding: 0 }}>
            {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {searched && !loading && (
          <>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "18px", color: B.dark, marginBottom: "4px" }}>{query}</div>
            {!searchError && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted, marginBottom: "16px" }}>{results.length} recipes found</div>
            )}
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: B.muted }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>{searchError ? "⚠️" : "🔍"}</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: "16px", marginBottom: "6px" }}>{searchError ? "Something went wrong" : "No recipes found"}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "16px" }}>{searchError ? "That didn't cost your free search — try again." : "Try a different dish or spelling."}</div>
                {searchError && <button onClick={() => doSearch(query)} className="btn-primary" style={{ padding: "10px 24px", borderRadius: "10px", fontSize: "13px" }}>Try Again</button>}
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

const ProfileView = ({ user, isPro, subscription, onSignIn, onSignOut, onUpgrade, searchCount, searchHistory, bookmarks, loadingPayment, preferences, onOpen, onGoToSaved, onCancelSubscription, onNavigate }) => {
  const sub = subscription || { status: "free", isPro: false, endDate: null };
  const [billingCycle, setBillingCycle] = useState("monthly");

  const topCuisines = Object.entries(preferences?.regions || {})
    .sort((a,b) => b[1]-a[1]).slice(0,4)
    .map(([k]) => k.replace(/_/g," ").replace(/\b\w/g, l => l.toUpperCase()));
  const topDiet = Object.entries(preferences?.dietary || {})
    .sort((a,b) => b[1]-a[1]).slice(0,2)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const tastePrimary = topCuisines[0] || "Building...";
  const recipesExplored = (searchHistory?.length || 0) + (bookmarks?.length || 0);
  const explorerLevel = recipesExplored === 0 ? 1 : Math.min(20, Math.floor(recipesExplored / 3) + 1);
  const cookingPersonality =
    topDiet.some(d => /healthy|low/i.test(d)) ? "Health Conscious Cook" :
    topCuisines.length >= 3 ? "Global Food Explorer" :
    topCuisines[0] ? `${topCuisines[0]} Enthusiast` : "New Explorer";

  const fmtDate = (d) => {
    if (!d) return "";
    try { const date = d instanceof Date ? d : new Date(d); return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  if (!user) {
    return (
      <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px", padding: "60px 16px" }}>
        <div style={{ maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
          <Logo height={44} />
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, margin: "24px 0 8px" }}>Your Kitchen Awaits</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.muted, lineHeight: 1.6, marginBottom: "28px" }}>Sign in to personalise your feed and save your favourite recipes.</div>
          <button onClick={onSignIn} className="btn-primary" style={{ width: "100%", padding: "14px", borderRadius: "14px", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: B.white, minHeight: "100vh", paddingBottom: "80px" }}>
      <div style={{ padding: "20px 16px 0", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "22px", color: B.dark, marginBottom: "16px" }}>My Kitchen</div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: B.bg, borderRadius: "16px", marginBottom: "16px" }}>
          {user.photoURL && <img src={user.photoURL} alt="" style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${isPro ? B.orange : B.border}`, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark }}>{user.displayName || "User"}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>{cookingPersonality}</div>
          </div>
          <span style={{ background: isPro ? "#F0FDF4" : B.bg, color: isPro ? "#16A34A" : B.muted, border: `1px solid ${isPro ? "#BBF7D0" : B.border}`, borderRadius: "20px", padding: "3px 12px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>{isPro ? "✓ Pro" : "Free"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {[["❤️", bookmarks?.length || 0, "Saved"], ["🧠", tastePrimary, "Top Taste"], ["🧭", recipesExplored, "Recipes Explored"]].map(([icon, val, label]) => (
            <div key={label} style={{ background: B.bg, borderRadius: "14px", padding: "14px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: String(val).length > 7 ? "10px" : "13px", color: B.dark, lineHeight: 1.2 }}>{val}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: B.muted, marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>

        {(topCuisines.length > 0 || topDiet.length > 0) && (
          <div style={{ background: B.dark, borderRadius: "16px", padding: "18px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "14px", color: "#fff" }}>Taste DNA</div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: B.orange, background: `${B.orange}22`, borderRadius: "20px", padding: "3px 10px", fontWeight: 700 }}>Explorer Lv.{explorerLevel}</span>
            </div>
            {topCuisines.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Favourite Cuisines</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{topCuisines.map(c => <span key={c} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", borderRadius: "20px", padding: "4px 12px", fontSize: "12px" }}>{c}</span>)}</div>
              </div>
            )}
            {topDiet.length > 0 && (
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>Dietary Preferences</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{topDiet.map(d => <span key={d} style={{ background: `${B.orange}33`, color: B.orange, borderRadius: "20px", padding: "4px 12px", fontSize: "12px" }}>{d}</span>)}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark, marginBottom: "10px" }}>Your Personal Chef</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { id: "meal-planner", icon: "📅", label: "Meal Planner", desc: "Plan your week" },
              { id: "pantry", icon: "🥘", label: "Pantry Mode", desc: "Cook what you have" },
              { id: "ask-ai-history", icon: "✨", label: "Ask AI", desc: "Past conversations" },
              { id: "saved", icon: "🔖", label: "Saved Recipes", desc: `${bookmarks?.length || 0} recipes`, action: onGoToSaved },
            ].map(item => (
              <div key={item.id} onClick={item.action || (() => onNavigate(item.id))} style={{ background: B.bg, borderRadius: "14px", padding: "14px", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#F0EDE8"}
                onMouseLeave={e => e.currentTarget.style.background = B.bg}
              >
                <div style={{ fontSize: "20px", marginBottom: "8px" }}>{item.icon}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", fontWeight: 600, color: B.dark }}>{item.label}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.muted, marginTop: "2px" }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {bookmarks?.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "15px", color: B.dark }}>Recently Saved</div>
              <span onClick={onGoToSaved} style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.orange, fontWeight: 600, cursor: "pointer" }}>See all {bookmarks.length} →</span>
            </div>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", scrollbarWidth: "none", paddingBottom: "4px" }}>
              {bookmarks.slice(0, 6).map((r, i) => (
                <div key={i} onClick={() => onOpen(r)} style={{ flexShrink: 0, width: "100px", cursor: "pointer" }}>
                  <div style={{ height: "72px", borderRadius: "10px", overflow: "hidden", background: "#F0EDE8", marginBottom: "5px" }}>
                    {r.image ? <img src={r.imageSmall || r.image} alt={r.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{r.emoji}</div>}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: B.dark, lineHeight: 1.3 }}>{r.title}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isPro && (
          <div style={{ background: B.dark, borderRadius: "16px", padding: "20px", marginBottom: "16px" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "17px", color: "#fff", marginBottom: "10px" }}>Unlock Your Personal AI Chef</div>
            {["Unlimited AI food discovery", "AI Meal Planner", "Transform any recipe", "Pantry to meal suggestions", "Unlimited recipe adaptations", "Smarter, personalised recommendations"].map(f => (
              <div key={f} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "center" }}>
                <span style={{ color: B.orange, fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.75)" }}>{f}</span>
              </div>
            ))}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "3px", marginTop: "14px", marginBottom: "12px" }}>
              {[["monthly", "Monthly"], ["annual", "Annual — save 33%"]].map(([id, label]) => (
                <button key={id} onClick={() => setBillingCycle(id)} style={{ flex: 1, padding: "8px", border: "none", borderRadius: "8px", background: billingCycle === id ? B.orange : "transparent", color: "#fff", fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: billingCycle === id ? 700 : 400, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            <div onClick={() => onUpgrade(billingCycle)} style={{ display: "inline-block", background: B.orange, color: "#fff", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              {loadingPayment ? "Redirecting..." : billingCycle === "annual" ? "$39.99 / year" : "$4.99 / month"}
            </div>
          </div>
        )}

        <div style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: "16px" }}>
          <div style={{ padding: "14px 16px", borderBottom: isPro && sub.status === "active" ? `1px solid ${B.border}` : "none", background: B.white }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: "12px", color: B.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Subscription</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: B.dark, fontWeight: 500 }}>{isPro ? "Mama K Pro" : "Free Plan"}</div>
                {sub.endDate && (
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", color: sub.status === "cancelled" ? "#D97706" : B.muted, marginTop: "2px" }}>
                    {sub.status === "cancelled" ? `Access until ${fmtDate(sub.endDate)}` : `Next billing ${fmtDate(sub.endDate)}`}
                  </div>
                )}
              </div>
              <span style={{ background: isPro ? "#F0FDF4" : B.bg, color: isPro ? "#16A34A" : B.muted, border: `1px solid ${isPro ? "#BBF7D0" : B.border}`, borderRadius: "20px", padding: "3px 12px", fontSize: "11px", fontWeight: 700 }}>{sub.status === "cancelled" ? "Cancelling" : isPro ? "Active" : "Free"}</span>
            </div>
          </div>
          {isPro && sub.status === "active" && (
            <div onClick={onCancelSubscription} style={{ padding: "13px 16px", background: B.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
              onMouseLeave={e => e.currentTarget.style.background = B.white}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "#DC2626", fontWeight: 500 }}>Cancel Subscription</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          )}
          {!isPro && (
            <div onClick={() => onUpgrade(billingCycle)} style={{ padding: "13px 16px", background: B.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onMouseEnter={e => e.currentTarget.style.background = "#FFF7ED"}
              onMouseLeave={e => e.currentTarget.style.background = B.white}
            >
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: B.orange, fontWeight: 600 }}>Upgrade to Pro</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          )}
        </div>

        <div style={{ borderRadius: "16px", overflow: "hidden", border: `1px solid ${B.border}`, marginBottom: "16px" }}>
          {[
            { label: "Manage Account", sub: "Email, delete account", action: () => onNavigate("account") },
            { label: "Help & Support", sub: "support@keyangle.tech", action: () => window.open("mailto:support@keyangle.tech") },
            { label: "Privacy Policy", sub: "How we use your data", action: () => onNavigate("privacy") },
            { label: "Terms of Service", sub: "Rules for using Mama K", action: () => onNavigate("terms") },
          ].map((item, i, arr) => (
            <div key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderBottom: i < arr.length-1 ? `1px solid ${B.border}` : "none", cursor: "pointer", background: B.white, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = B.bg}
              onMouseLeave={e => e.currentTarget.style.background = B.white}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 500, color: B.dark }}>{item.label}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: B.muted }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          ))}
        </div>

        <button onClick={onSignOut} style={{ width: "100%", padding: "14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: "#DC2626" }}>Sign Out</button>
      </div>
    </div>
  );
};

const BottomNav = ({ activeTab, onChange }) => {
  const tabs = [
    { id: "home", label: "Home", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? B.orange : "none"} stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    )},
    { id: "search", label: "Search", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    )},
    { id: "restaurants", label: "Restaurants", icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? B.orange : B.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M17 12a5 5 0 0 0 0-10"/></svg>
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
function AppInner() {
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
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [activePage, setActivePage] = useState(null);
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

  const handleUpgrade = async (billingCycle) => {
    if (!user) { setShowPaywall(true); return; }
    setLoadingPayment(true);
    try {
      const res = await fetch("/api/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: user.uid, email: user.email, name: user.displayName, plan: billingCycle === "annual" ? "annual" : "monthly" }) });
      const data = await res.json();
      if (data.paymentLink) window.location.href = data.paymentLink;
      else alert("Payment unavailable. Try again.");
    } catch { alert("Something went wrong."); }
    setLoadingPayment(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const pid = "mama-k-recipies";
      await fetch(`https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/users/${user.uid}`, { method: "DELETE" }).catch(() => {});
      await fbDeleteUser(user);
      setUser(null); setIsPro(false); setBookmarks([]); setSearchHistory([]); setPreferences(null);
      setSubscription({ status: "free", isPro: false, endDate: null });
      setActivePage(null); setTab("home");
    } catch (err) {
      alert("Couldn't delete account. You may need to sign in again first, then retry.");
      throw err;
    }
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
              user={user}
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
        <SearchView
          user={user} isPro={isPro} bookmarks={bookmarks}
          onBM={toggleBM} onOpen={openRecipe}
          onShowPaywall={() => setShowPaywall(true)}
          searchHistory={searchHistory}
          searchCount={searchCount}
          onSyncCount={(newCount) => setSearchCount(newCount)}
        />
      )}

      {tab === "saved" && (
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <SavedView bookmarks={bookmarks} onOpen={openRecipe} onBM={toggleBM} />
        </div>
      )}

      {tab === "restaurants" && (
        <RestaurantsView user={user} />
      )}

      {tab === "profile" && (
        <ErrorBoundary>
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
            onNavigate={(page) => setActivePage(page)}
          />
        </ErrorBoundary>
      )}

      {/* Full-screen overlay pages, reached from Profile's Personal Chef section and settings list */}
      {activePage && (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, overflowY: "auto", background: B.white }}>
          {activePage === "meal-planner" && <MealPlannerView user={user} isPro={isPro} preferences={preferences} onBack={() => setActivePage(null)} onUpgrade={() => { setActivePage(null); setShowPaywall(true); }} />}
          {activePage === "pantry" && <PantryView isPro={isPro} onBack={() => setActivePage(null)} onUpgrade={() => { setActivePage(null); setShowPaywall(true); }} onOpenRecipe={r => { setActivePage(null); openRecipe(r); }} bookmarks={bookmarks} onBM={toggleBM} />}
          {activePage === "ask-ai-history" && <AskAIHistoryView user={user} onBack={() => setActivePage(null)} />}
          {activePage === "account" && <AccountView user={user} onBack={() => setActivePage(null)} onDeleteAccount={handleDeleteAccount} />}
          {activePage === "privacy" && <PrivacyView onBack={() => setActivePage(null)} />}
          {activePage === "terms" && <TermsView onBack={() => setActivePage(null)} />}
        </div>
      )}

      {/* Bottom nav — full width */}
      <BottomNav activeTab={tab} onChange={handleTabChange} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
