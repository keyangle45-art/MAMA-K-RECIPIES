import { useState, useEffect, useRef } from "react";
import { auth, signInWithGoogle, signOutUser } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

/* ─── Brand ──────────────────────────────────────────────── */
const B = {
  orange: "#E06612",
  orangeHover: "#F07828",
  black: "#0A0A0A",
  white: "#FFFFFF",
  bg: "#F5F5F7",       // Apple's exact background gray
  cream: "#F3ECD8",
  border: "#D2D2D7",   // Apple's border color
  muted: "#86868B",    // Apple's secondary text
  dark: "#1D1D1F",     // Apple's near-black
  card: "#FBFBFD",     // Apple card white
};

/* ─── Data ───────────────────────────────────────────────── */
const FEATURED_SECTIONS = [
  {
    id: "top-african",
    title: "Top African Dishes",
    subtitle: "Bold, soulful flavours from across the continent",
    icon: "🌍",
    dark: true,
    searches: [
      { q: "Nigerian Jollof Party Rice authentic", label: "Party Jollof Rice", emoji: "🍛", region: "Nigeria" },
      { q: "West African Egusi Soup", label: "Egusi Soup", emoji: "🥣", region: "Nigeria" },
      { q: "West African Pepper Soup goat meat", label: "Pepper Soup", emoji: "🍲", region: "Nigeria" },
      { q: "Ghanaian Kelewele spiced plantain", label: "Kelewele", emoji: "🍌", region: "Ghana" },
      { q: "Senegalese Thieboudienne fish rice", label: "Thieboudienne", emoji: "🐟", region: "Senegal" },
      { q: "Ethiopian Doro Wat chicken stew", label: "Doro Wat", emoji: "🫕", region: "Ethiopia" },
      { q: "South African Bobotie", label: "Bobotie", emoji: "🥘", region: "South Africa" },
      { q: "Kenyan Nyama Choma grilled meat", label: "Nyama Choma", emoji: "🔥", region: "Kenya" },
    ],
  },
  {
    id: "top-american",
    title: "Top American Dishes",
    subtitle: "Classic American comfort food, elevated",
    icon: "🇺🇸",
    dark: false,
    searches: [
      { q: "Classic American Smash Burgers", label: "Smash Burger", emoji: "🍔", region: "USA" },
      { q: "Southern BBQ Ribs slow cooked", label: "BBQ Ribs", emoji: "🥩", region: "USA" },
      { q: "New England Clam Chowder", label: "Clam Chowder", emoji: "🍵", region: "New England" },
      { q: "Southern Fried Chicken crispy", label: "Fried Chicken", emoji: "🍗", region: "South" },
      { q: "Classic Mac and Cheese homemade", label: "Mac & Cheese", emoji: "🧀", region: "USA" },
      { q: "New York Style Cheesecake", label: "NY Cheesecake", emoji: "🍰", region: "New York" },
      { q: "Texas Beef Brisket smoked", label: "Texas Brisket", emoji: "🫕", region: "Texas" },
      { q: "Classic American Apple Pie", label: "Apple Pie", emoji: "🥧", region: "USA" },
    ],
  },
  {
    id: "top-british",
    title: "Top British Dishes",
    subtitle: "Great British classics worth every bite",
    icon: "🇬🇧",
    dark: true,
    searches: [
      { q: "British Sunday Roast beef yorkshire pudding", label: "Sunday Roast", emoji: "🥩", region: "England" },
      { q: "Classic Fish and Chips British", label: "Fish & Chips", emoji: "🐟", region: "England" },
      { q: "Beef Wellington classic", label: "Beef Wellington", emoji: "🥩", region: "England" },
      { q: "Traditional British Shepherd's Pie", label: "Shepherd's Pie", emoji: "🫕", region: "England" },
      { q: "Scottish Haggis traditional", label: "Haggis", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", region: "Scotland" },
      { q: "Welsh Rarebit cheese toast", label: "Welsh Rarebit", emoji: "🍞", region: "Wales" },
      { q: "Classic British Sticky Toffee Pudding", label: "Toffee Pudding", emoji: "🍮", region: "England" },
      { q: "Full English Breakfast fry up", label: "Full English", emoji: "🍳", region: "England" },
    ],
  },
  {
    id: "top-european",
    title: "Top European Dishes",
    subtitle: "From Paris to Rome — Europe's finest plates",
    icon: "🇪🇺",
    dark: false,
    searches: [
      { q: "Classic French Coq au Vin", label: "Coq au Vin", emoji: "🍷", region: "France" },
      { q: "Italian Spaghetti Carbonara authentic", label: "Carbonara", emoji: "🍝", region: "Italy" },
      { q: "Spanish Paella Valenciana", label: "Paella", emoji: "🥘", region: "Spain" },
      { q: "German Sauerbraten pot roast", label: "Sauerbraten", emoji: "🥩", region: "Germany" },
      { q: "Greek Moussaka traditional", label: "Moussaka", emoji: "🫕", region: "Greece" },
      { q: "Portuguese Bacalhau salt cod", label: "Bacalhau", emoji: "🐟", region: "Portugal" },
      { q: "Classic French Croissant buttery", label: "Croissant", emoji: "🥐", region: "France" },
      { q: "Italian Tiramisu classic dessert", label: "Tiramisu", emoji: "🍮", region: "Italy" },
    ],
  },
  {
    id: "top-asian",
    title: "Top Asian Dishes",
    subtitle: "Ancient recipes, extraordinary depth of flavour",
    icon: "🌏",
    dark: true,
    searches: [
      { q: "Japanese Tonkotsu Ramen authentic", label: "Tonkotsu Ramen", emoji: "🍜", region: "Japan" },
      { q: "Chinese Peking Duck classic", label: "Peking Duck", emoji: "🦆", region: "China" },
      { q: "Indian Butter Chicken murgh makhani", label: "Butter Chicken", emoji: "🍗", region: "India" },
      { q: "Thai Pad Thai authentic street food", label: "Pad Thai", emoji: "🍜", region: "Thailand" },
      { q: "Korean Beef Bulgogi BBQ", label: "Bulgogi", emoji: "🥩", region: "Korea" },
      { q: "Vietnamese Pho Bo beef noodle soup", label: "Pho Bo", emoji: "🍲", region: "Vietnam" },
      { q: "Chinese Dim Sum dumplings", label: "Dim Sum", emoji: "🥟", region: "China" },
      { q: "Japanese Sushi Rolls homemade", label: "Sushi Rolls", emoji: "🍱", region: "Japan" },
    ],
  },
  {
    id: "legacy",
    title: "Legacy Dishes",
    subtitle: "Timeless recipes passed down through generations",
    icon: "🏺",
    dark: false,
    searches: [
      { q: "Classic Beef Wellington", label: "Beef Wellington", emoji: "🥩", region: "Classic" },
      { q: "Traditional Moroccan Tagine", label: "Lamb Tagine", emoji: "🫕", region: "Morocco" },
      { q: "Classic French Bouillabaisse", label: "Bouillabaisse", emoji: "🍵", region: "France" },
      { q: "Traditional Jerk Chicken Jamaican", label: "Jerk Chicken", emoji: "🍗", region: "Jamaica" },
      { q: "Classic Spanish Paella", label: "Paella", emoji: "🥘", region: "Spain" },
      { q: "Traditional Ethiopian Injera with Doro Wat", label: "Doro Wat", emoji: "🫓", region: "Ethiopia" },
    ],
  },
  {
    id: "healthy",
    title: "Healthy & Low Calorie",
    subtitle: "Under 450 calories — nourishing, not boring",
    icon: "🥗",
    dark: true,
    searches: [
      { q: "Low Calorie High Protein Bowls under 400 calories", label: "Protein Bowls", emoji: "🥣", region: "Healthy" },
      { q: "Healthy Vegan Buddha Bowl", label: "Buddha Bowl", emoji: "🥗", region: "Vegan" },
      { q: "Low Calorie Grilled Salmon 350 calories", label: "Grilled Salmon", emoji: "🐟", region: "Healthy" },
      { q: "Vegan African Groundnut Stew", label: "Groundnut Stew", emoji: "🥜", region: "Vegan" },
      { q: "Light Mediterranean Salad under 300 calories", label: "Mediterranean Salad", emoji: "🥙", region: "Healthy" },
      { q: "Low Calorie Smoothie Bowl 250 calories", label: "Smoothie Bowl", emoji: "🍓", region: "Healthy" },
    ],
  },
  {
    id: "community",
    title: "Top Community Recipes",
    subtitle: "Most-cooked dishes loved by our users",
    icon: "⭐",
    dark: false,
    searches: [
      { q: "Marry Me Chicken Creamy", label: "Marry Me Chicken", emoji: "🍗", region: "Trending" },
      { q: "Brown Butter Sage Pasta", label: "Brown Butter Pasta", emoji: "🍝", region: "Trending" },
      { q: "Viral Baked Feta Pasta", label: "Baked Feta Pasta", emoji: "🧀", region: "Trending" },
      { q: "Japanese Milk Bread Soft", label: "Milk Bread", emoji: "🍞", region: "Trending" },
      { q: "One Pan Lemon Herb Chicken", label: "Lemon Herb Chicken", emoji: "🍋", region: "Popular" },
      { q: "Crispy Smashed Potatoes", label: "Smashed Potatoes", emoji: "🥔", region: "Popular" },
    ],
  },
];

const REGIONS = [
  { label: "West African", emoji: "🌍", q: "Popular West African Dishes" },
  { label: "East African", emoji: "🫘", q: "Popular East African Dishes" },
  { label: "Italian", emoji: "🇮🇹", q: "Classic Italian Recipes" },
  { label: "Asian", emoji: "🥢", q: "Popular Asian Dishes" },
  { label: "Mediterranean", emoji: "🫒", q: "Mediterranean Recipes" },
  { label: "Latin American", emoji: "🌮", q: "Latin American Recipes" },
  { label: "British", emoji: "🇬🇧", q: "Classic British Recipes" },
  { label: "American", emoji: "🔥", q: "American Comfort Food" },
  { label: "Chinese", emoji: "🏮", q: "Classic Chinese Recipes" },
  { label: "Indian", emoji: "🍛", q: "Popular Indian Recipes" },
  { label: "French", emoji: "🥐", q: "Classic French Recipes" },
  { label: "Vegan", emoji: "🌱", q: "Vegan Recipes from Around the World" },
  { label: "Low Calorie", emoji: "💚", q: "Low Calorie Healthy Meals Under 400 Calories" },
  { label: "Desserts", emoji: "🍮", q: "World Famous Desserts" },
];

/* ─── Helpers ────────────────────────────────────────────── */
const FREE_LIMIT = 3;
const getCount = (uid) => parseInt(localStorage.getItem(`mk_sc_${uid || "guest"}`) || "0");
const incCount = (uid) => localStorage.setItem(`mk_sc_${uid || "guest"}`, getCount(uid) + 1);
const getBM = () => JSON.parse(localStorage.getItem("mk_bm") || "[]");
const saveBM = (b) => localStorage.setItem("mk_bm", JSON.stringify(b));

const callAPI = async (query) => {
  const res = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  return data.recipes || [];
};

/* ─── Global Styles Injection ────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Bebas+Neue&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 0; height: 0; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn  { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }
  @keyframes slideUp  { from { transform:translateY(100%); } to { transform:translateY(0); } }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes spin     { to { transform:rotate(360deg); } }

  .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06) !important; }

  .pill-hover { transition: all 0.18s ease; }
  .pill-hover:hover { background: #E06612 !important; color: #fff !important; border-color: #E06612 !important; }

  .scroll-row { display:flex; gap:14px; overflow-x:auto; padding-bottom:8px; scroll-snap-type:x mandatory; }
  .scroll-row > * { scroll-snap-align: start; flex-shrink:0; }

  .btn-orange { background:#E06612; color:#fff; border:none; cursor:pointer; font-family:"DM Sans",sans-serif; font-weight:600; transition:all 0.18s ease; letter-spacing:-0.01em; }
  .btn-orange:hover { background:#F07828; }
  .btn-orange:active { transform:scale(0.98); }

  .skeleton { background: linear-gradient(90deg, #E8E8ED 25%, #F2F2F7 50%, #E8E8ED 75%); background-size: 600px 100%; animation: shimmer 1.6s ease infinite; border-radius:10px; }
  .recipe-img { animation: imgFade 0.4s ease; object-fit: cover; width: 100%; height: 100%; display:block; }
  @keyframes imgFade { from{opacity:0} to{opacity:1} }
`;

/* ─── Logo ───────────────────────────────────────────────── */
const FLAME_PATH = "M1124.64 460.74C1124.64 460.74 1018.08 559.09 969.82 679.96C918.56 808.31 950.33 857.42 926.18 884.04C898.73 914.3 844.54 889.67 862.76 758.23C808.7 858.61 767.84 966.45 767.84 1063.14C767.84 1190.23 834.29 1301.78 934.34 1364.99L945.62 1306.46C950.51 1281.09 941.48 1255.22 922.29 1237.93C904.98 1222.3 895.93 1202.79 903.6 1162.96C917.82 1089.21 979.92 994.98 1032.18 1005.05C1084.45 1015.13 1107.08 1125.69 1092.86 1199.44C1085.18 1239.27 1069.53 1254.03 1047.64 1262.09C1023.4 1271 1005.38 1291.66 1000.5 1317.04L986.04 1392.02C1028.65 1409.99 1075.48 1419.95 1124.64 1419.95C1172.96 1419.95 1219.01 1410.32 1261.04 1392.92L1248.78 1329.27C1243.92 1304.09 1226.26 1283.22 1202.15 1274.51C1180 1266.48 1164.16 1251.8 1156.42 1211.66L1126.48 1056.31C1124.26 1044.82 1131.76 1033.73 1143.25 1031.52C1148.98 1030.41 1154.63 1031.73 1159.11 1034.77C1163.61 1037.8 1166.93 1042.56 1168.04 1048.29L1198.5 1206.34L1227.82 1200.69L1197.92 1045.6C1195.4 1032.49 1203.97 1019.81 1217.09 1017.29C1223.65 1016.02 1230.1 1017.52 1235.22 1020.99C1240.36 1024.46 1244.16 1029.9 1245.42 1036.45L1275.31 1191.53L1304.62 1185.88L1274.15 1027.84C1271.94 1016.36 1279.45 1005.26 1290.94 1003.04C1296.67 1001.93 1302.32 1003.25 1306.81 1006.29C1311.3 1009.33 1314.63 1014.09 1315.73 1019.83L1345.68 1175.18C1353.42 1215.32 1344.15 1234.84 1326.57 1250.52C1307.45 1267.57 1298.79 1293.51 1303.65 1318.68L1312.83 1366.3C1414.05 1303.34 1481.45 1191.12 1481.45 1063.14C1481.45 809.09 1169.68 729.91 1124.64 460.74Z";

const Logo = ({ height = 48, light = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <svg width={height * 0.74} height={height} viewBox="767 460 714 960" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={FLAME_PATH} fill={light ? "#fff9e5" : B.orange} />
    </svg>
    <div>
      <div style={{
        fontFamily: "'Bebas Neue', Impact, sans-serif",
        fontSize: height * 0.54, letterSpacing: "0.06em", lineHeight: 1,
        color: light ? "#fff" : B.black,
      }}>MAMA K</div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: height * 0.22, letterSpacing: "0.22em",
        textTransform: "uppercase", fontWeight: 700,
        color: light ? "#fff9e5" : B.orange,
      }}>RECIPES</div>
    </div>
  </div>
);

/* ─── Skeleton Card ──────────────────────────────────────── */
const SkeletonCard = () => (
  <div style={{ width: "220px", borderRadius: "18px", overflow: "hidden", background: B.white, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
    <div className="skeleton" style={{ height: "120px" }} />
    <div style={{ padding: "14px" }}>
      <div className="skeleton" style={{ height: "16px", marginBottom: "8px", width: "80%" }} />
      <div className="skeleton" style={{ height: "12px", width: "55%" }} />
    </div>
  </div>
);

/* ─── Recipe Card ────────────────────────────────────────── */
const RecipeCard = ({ r, onOpen, bookmarked, onBM, idx = 0, wide = false }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const w = wide ? "280px" : "220px";

  return (
    <div className="card-hover" onClick={onOpen} style={{
      width: w, background: B.card, borderRadius: "16px",
      overflow: "hidden", position: "relative",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)",
      animation: "fadeUp 0.45s ease both",
      animationDelay: `${(idx % 8) * 45}ms`,
    }}>
      {/* Image / Fallback */}
      <div style={{
        height: wide ? "148px" : "120px", position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${B.cream} 0%, #E8DEC8 100%)`,
      }}>
        {r.image ? (
          <>
            {!imgLoaded && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "40px", color: B.muted,
              }}>{r.emoji}</div>
            )}
            <img
              className="recipe-img"
              src={r.image}
              alt={r.title}
              onLoad={() => setImgLoaded(true)}
              style={{
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.35s ease",
                position: "absolute", inset: 0,
              }}
            />
          </>
        ) : (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: wide ? "56px" : "44px",
          }}>{r.emoji}</div>
        )}

        {/* Subtle gradient overlay for text legibility */}
        {r.image && imgLoaded && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
            background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* Bookmark */}
      <button onClick={e => { e.stopPropagation(); onBM(); }} style={{
        position: "absolute", top: "8px", right: "8px",
        background: "rgba(255,255,255,0.88)", backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "none", borderRadius: "50%", width: "30px", height: "30px",
        cursor: "pointer", fontSize: "13px", color: bookmarked ? B.orange : "#AAA",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.18s", boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
      }}>
        {bookmarked ? "♥" : "♡"}
      </button>

      {/* Region tag */}
      {r.region && (
        <div style={{
          position: "absolute", top: "8px", left: "8px",
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "#fff", fontSize: "9px", fontWeight: 600,
          padding: "3px 8px", borderRadius: "6px", letterSpacing: "0.06em",
          textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
        }}>{r.region}</div>
      )}

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "15px", fontWeight: 600, lineHeight: 1.3,
          marginBottom: "3px", color: B.dark,
          letterSpacing: "-0.01em",
        }}>{r.title}</div>
        <div style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: "11px",
          color: B.muted, lineHeight: 1.45, marginBottom: "10px",
        }}>{r.tagline}</div>
        <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
          <span style={{
            fontSize: "9px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
            background: r.difficulty === "Easy" ? "#F0FDF4" : r.difficulty === "Medium" ? "#FFFBEB" : "#FFF1F2",
            color: r.difficulty === "Easy" ? "#15803D" : r.difficulty === "Medium" ? "#D97706" : "#BE123C",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{r.difficulty}</span>
          <span style={{
            marginLeft: "auto", fontFamily: "'DM Sans', sans-serif",
            fontSize: "10px", color: B.muted,
          }}>⏱ {r.time}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── Section Row ────────────────────────────────────────── */
const GUTTER = "40px";

const SectionRow = ({ section, onSelect, bookmarks, onBM }) => {
  const [recipes, setRecipes] = useState({});
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const ref = useRef();
  const scrollRef = useRef();

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setRevealed(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!revealed) return;
    setLoading(true);
    Promise.all(
      section.searches.map(s =>
        callAPI(s.q).then(res => ({ key: s.q, data: res.slice(0, 1), label: s.label, emoji: s.emoji, region: s.region }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { if (r.data[0]) map[r.key] = { ...r.data[0], region: r.region }; });
      setRecipes(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [revealed]);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 480, behavior: "smooth" });
    setTimeout(updateArrows, 400);
  };

  const cards = section.searches.map(s =>
    recipes[s.q] || { title: s.label, emoji: s.emoji, region: s.region, _stub: true, _search: s.q, _label: s.label }
  );

  const arrowStyle = (visible, dark) => ({
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    width: "38px", height: "38px", borderRadius: "50%",
    background: dark ? "rgba(255,255,255,0.12)" : B.white,
    border: `1px solid ${dark ? "rgba(255,255,255,0.2)" : B.border}`,
    color: dark ? "#fff" : B.black,
    backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: "16px",
    boxShadow: dark ? "none" : "0 2px 12px rgba(0,0,0,0.1)",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 0.2s, background 0.2s",
    zIndex: 10,
  });

  return (
    <div ref={ref} style={{ padding: "52px 0", background: section.dark ? B.dark : B.bg }}>
      {/* Section header — aligned to GUTTER */}
      <div style={{ padding: `0 ${GUTTER}`, marginBottom: "24px", animation: revealed ? "fadeUp 0.5s ease" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
              <span style={{ fontSize: "20px" }}>{section.icon}</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "11px", fontWeight: 700, color: B.orange, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {section.subtitle}
              </span>
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,3vw,36px)", fontWeight: 600, color: section.dark ? B.white : B.black, lineHeight: 1.1 }}>
              {section.title}
            </div>
          </div>
          {/* Desktop arrow hints */}
          <div style={{ display: "flex", gap: "8px" }}>
            {[{ dir: -1, visible: canLeft }, { dir: 1, visible: canRight }].map(({ dir, visible }) => (
              <button key={dir} onClick={() => scroll(dir)} style={{
                width: "36px", height: "36px", borderRadius: "50%", border: `1px solid ${section.dark ? "rgba(255,255,255,0.2)" : B.border}`,
                background: section.dark ? "rgba(255,255,255,0.08)" : B.white,
                color: section.dark ? "#fff" : B.black,
                cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: visible ? 1 : 0.3, transition: "all 0.2s",
              }}>{dir === -1 ? "←" : "→"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll row — starts at GUTTER, arrows overlay edges */}
      <div style={{ position: "relative" }}>
        {/* Left fade + arrow */}
        {canLeft && (
          <>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: "80px", zIndex: 5, pointerEvents: "none",
              background: `linear-gradient(to right, ${section.dark ? B.dark : B.bg}, transparent)`,
            }} />
            <button onClick={() => scroll(-1)} style={{ ...arrowStyle(canLeft, section.dark), left: "16px" }}>←</button>
          </>
        )}

        {/* Right fade + arrow */}
        {canRight && (
          <>
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: "80px", zIndex: 5, pointerEvents: "none",
              background: `linear-gradient(to left, ${section.dark ? B.dark : B.bg}, transparent)`,
            }} />
            <button onClick={() => scroll(1)} style={{ ...arrowStyle(canRight, section.dark), right: "16px" }}>→</button>
          </>
        )}

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          style={{
            display: "flex", gap: "14px", overflowX: "auto", overflowY: "visible",
            paddingLeft: GUTTER, paddingRight: GUTTER, paddingBottom: "12px", paddingTop: "4px",
            scrollSnapType: "x mandatory", scrollbarWidth: "none",
          }}
        >
          {loading
            ? Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : cards.map((card, i) => (
              card._stub ? (
                <div key={i} className="card-hover" onClick={() => onSelect(card._search, card._label)} style={{
                  width: "220px", flexShrink: 0, background: section.dark ? "rgba(255,255,255,0.06)" : B.white,
                  borderRadius: "18px", overflow: "hidden", cursor: "pointer",
                  border: `1px solid ${section.dark ? "rgba(255,255,255,0.1)" : B.border}`,
                  scrollSnapAlign: "start",
                  animation: "fadeUp 0.5s ease both", animationDelay: `${i * 50}ms`,
                }}>
                  <div style={{ height: "115px", fontSize: "48px", background: section.dark ? "rgba(255,255,255,0.04)" : B.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {card.emoji}
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "15px", fontWeight: 600, color: section.dark ? "#fff" : B.black }}>{card.title}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: "10px", color: B.muted, marginTop: "4px" }}>{card.region}</div>
                  </div>
                </div>
              ) : (
                <div key={i} style={{ flexShrink: 0, scrollSnapAlign: "start" }}>
                  <RecipeCard
                    idx={i} r={card}
                    onOpen={() => onSelect(section.searches[i]?.q, card.title, card)}
                    bookmarked={bookmarks.some(b => b.title === card.title)}
                    onBM={() => onBM(card)}
                  />
                </div>
              )
            ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Detail View ────────────────────────────────────────── */
const DetailView = ({ recipe, bookmarked, onBM, onBack }) => {
  const [tab, setTab] = useState("ingredients");
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "40px 28px 100px", animation: "fadeUp 0.35s ease" }}>
      {/* Back button — Apple style */}
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer", marginBottom: "28px",
        fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
        color: B.orange, fontWeight: 500,
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: 0,
      }}>‹ Back</button>

      {/* Hero image */}
      <div style={{
        height: "320px", borderRadius: "20px", overflow: "hidden",
        background: `linear-gradient(135deg, ${B.cream}, #E0D4B8)`,
        marginBottom: "32px", position: "relative",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05)",
      }}>
        {recipe.image ? (
          <>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "96px", opacity: imgLoaded ? 0 : 1, transition: "opacity 0.3s",
            }}>{recipe.emoji}</div>
            <img
              src={recipe.image}
              alt={recipe.title}
              onLoad={() => setImgLoaded(true)}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                opacity: imgLoaded ? 1 : 0, transition: "opacity 0.4s ease",
                display: "block",
              }}
            />
            {/* Credit */}
            {imgLoaded && recipe.photographer && (
              <div style={{
                position: "absolute", bottom: "10px", right: "12px",
                fontFamily: "'DM Sans', sans-serif", fontSize: "10px",
                color: "rgba(255,255,255,0.6)",
              }}>Photo: {recipe.photographer} / Pexels</div>
            )}
          </>
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "96px" }}>
            {recipe.emoji}
          </div>
        )}
      </div>

      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "8px" }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "clamp(28px,5vw,44px)", fontWeight: 600,
          color: B.dark, lineHeight: 1.1, letterSpacing: "-0.02em",
        }}>
          {recipe.title}
        </h1>
        <button onClick={onBM} style={{
          background: bookmarked ? B.orange : B.bg,
          border: `1px solid ${bookmarked ? B.orange : B.border}`,
          borderRadius: "50%", width: "44px", height: "44px", flexShrink: 0,
          cursor: "pointer", fontSize: "17px", color: bookmarked ? "#fff" : B.muted,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.18s",
        }}>{bookmarked ? "♥" : "♡"}</button>
      </div>

      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "15px",
        color: B.muted, marginBottom: "28px", lineHeight: 1.65,
      }}>{recipe.tagline}</p>

      {/* Meta strip — Apple segmented style */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        background: B.bg, borderRadius: "14px", overflow: "hidden",
        border: `1px solid ${B.border}`, marginBottom: "36px",
      }}>
        {[["⏱", "Time", recipe.time], ["👥", "Serves", recipe.servings], ["🔥", "Cal", recipe.calories ? `~${recipe.calories}` : "—"], ["📊", "Level", recipe.difficulty]].map(([icon, l, v], i) => (
          <div key={l} style={{
            padding: "16px 8px", textAlign: "center",
            borderRight: i < 3 ? `1px solid ${B.border}` : "none",
            background: B.white,
          }}>
            <div style={{ fontSize: "14px", marginBottom: "4px" }}>{icon}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 600, color: B.dark, marginBottom: "1px" }}>{v}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "10px", color: B.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Apple-style segmented tabs */}
      <div style={{
        display: "flex", gap: "3px",
        background: B.bg, border: `1px solid ${B.border}`,
        borderRadius: "10px", padding: "3px", marginBottom: "28px",
      }}>
        {["ingredients", "steps"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px", border: "none", borderRadius: "8px",
            background: tab === t ? B.white : "transparent",
            fontFamily: "'DM Sans', sans-serif", fontSize: "13px", fontWeight: 600,
            color: tab === t ? B.dark : B.muted, cursor: "pointer", textTransform: "capitalize",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05)" : "none",
            transition: "all 0.15s",
          }}>{tab === t ? (t === "ingredients" ? "🥕 Ingredients" : "📋 Steps") : t === "ingredients" ? "🥕 Ingredients" : "📋 Steps"}</button>
        ))}
      </div>

      {tab === "ingredients" && (recipe.ingredients || []).map((ing, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 0", borderBottom: `1px solid ${B.border}`,
          fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: B.dark,
          animation: "fadeUp 0.3s ease both", animationDelay: `${i * 20}ms`,
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, flexShrink: 0 }} />
          {ing}
        </div>
      ))}

      {tab === "steps" && (recipe.steps || []).map((step, i) => (
        <div key={i} style={{
          display: "flex", gap: "16px", marginBottom: "24px",
          animation: "fadeUp 0.3s ease both", animationDelay: `${i * 35}ms`,
        }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "50%",
            background: B.orange, color: "#fff", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 700,
            boxShadow: `0 3px 10px ${B.orange}33`,
          }}>{i + 1}</div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
            color: "#3A3530", lineHeight: 1.75, paddingTop: "5px",
          }}>{step}</div>
        </div>
      ))}
    </div>
  );
};

/* ─── Search Results ─────────────────────────────────────── */
const ResultsView = ({ query, label, preloaded, onOpen, bookmarks, onBM, onSearch }) => {
  const [recipes, setRecipes] = useState(preloaded || []);
  const [loading, setLoading] = useState(!preloaded?.length);
  const [input, setInput] = useState(query);

  useEffect(() => {
    if (preloaded?.length) return;
    setLoading(true);
    callAPI(query).then(r => { setRecipes(r); setLoading(false); });
  }, [query]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "36px 32px" }}>
      {/* Search bar */}
      <div style={{
        background: B.white, borderRadius: "16px", border: `1.5px solid ${B.border}`,
        display: "flex", alignItems: "center", marginBottom: "36px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}>
        <span style={{ padding: "0 12px 0 18px", fontSize: "16px", opacity: 0.4 }}>🔍</span>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && onSearch(input, input)}
          style={{ flex: 1, border: "none", outline: "none", padding: "15px 0", fontFamily: "'DM Sans', sans-serif", fontSize: "14px", background: "transparent" }} />
        <button className="btn-orange" onClick={() => onSearch(input, input)}
          style={{ margin: "5px", borderRadius: "11px", padding: "10px 22px", fontSize: "13px" }}>Search</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "120px 0" }}>
          <div style={{ fontSize: "52px", display: "inline-block", animation: "float 1.5s ease infinite", marginBottom: "20px" }}>🔥</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "26px", color: B.muted }}>Finding your recipes...</div>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "34px", fontWeight: 600, marginBottom: "4px" }}>{label || query}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "28px" }}>{recipes.length} recipes generated</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "16px" }}>
            {recipes.map((r, i) => (
              <RecipeCard key={i} idx={i} r={r} wide onOpen={() => onOpen(r)}
                bookmarked={bookmarks.some(b => b.title === r.title)} onBM={() => onBM(r)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ─── Paywall ────────────────────────────────────────────── */
const Paywall = ({ user, onSignIn, onDismiss }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(10,10,10,0.75)",
    backdropFilter: "blur(18px)", zIndex: 999,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
  }}>
    <div style={{
      background: B.white, borderRadius: "28px", padding: "48px 40px",
      maxWidth: "420px", width: "100%", textAlign: "center",
      animation: "scaleIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",
    }}>
      <div style={{ marginBottom: "20px" }}><Logo height={40} /></div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "30px", fontWeight: 600, lineHeight: 1.2, marginBottom: "12px" }}>
        {user ? "Upgrade to Pro" : "Sign in to continue"}
      </div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: B.muted, lineHeight: 1.7, marginBottom: "28px" }}>
        {user ? "You've used your free searches. Go Pro for unlimited access." : "Create a free account to get 5 searches/day."}
      </p>

      {["5 free searches daily (free)", "Unlimited with Pro — $4.99/mo", "Save collections to your account", "Top regional & legacy recipes"].map(p => (
        <div key={p} style={{ display: "flex", gap: "10px", textAlign: "left", marginBottom: "10px", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#3A3530" }}>
          <span style={{ color: B.orange, fontWeight: 700 }}>✓</span> {p}
        </div>
      ))}

      {!user && (
        <button onClick={onSignIn} style={{
          width: "100%", marginTop: "24px", padding: "15px",
          background: B.black, color: "#fff", border: "none", borderRadius: "14px",
          fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          transition: "all 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#2A2A2A"}
          onMouseLeave={e => e.currentTarget.style.background = B.black}
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>
      )}

      {user && (
        <button onClick={() => alert("Flutterwave coming soon!")} className="btn-orange" style={{
          width: "100%", marginTop: "24px", padding: "15px", borderRadius: "14px",
          fontSize: "15px", boxShadow: `0 8px 28px ${B.orange}44`,
        }}>
          Upgrade to Pro — $4.99 / month
        </button>
      )}

      <button onClick={onDismiss} style={{
        width: "100%", marginTop: "10px", padding: "12px",
        background: "none", color: B.muted, border: "none",
        fontFamily: "'DM Sans', sans-serif", fontSize: "13px", cursor: "pointer",
      }}>Not now</button>
    </div>
  </div>
);

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
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState("home"); // home | results | detail | saved
  const [searchQ, setSearchQ] = useState("");
  const [searchLabel, setSearchLabel] = useState("");
  const [preloadedRecipes, setPreloadedRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bookmarks, setBookmarks] = useState(getBM);
  const [showPaywall, setShowPaywall] = useState(false);
  const [heroInput, setHeroInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  const isBM = (r) => bookmarks.some(b => b.title === r.title);
  const toggleBM = (r) => {
    const u = isBM(r) ? bookmarks.filter(b => b.title !== r.title) : [...bookmarks, r];
    setBookmarks(u); saveBM(u);
  };

  const doSearch = (q, label, preloaded) => {
    const uid = user?.uid;
    const count = getCount(uid);
    if (count >= FREE_LIMIT) { setShowPaywall(true); return; }
    incCount(uid);
    setSearchQ(q);
    setSearchLabel(label || q);
    setPreloadedRecipes(preloaded ? [preloaded] : []);
    setView("results");
  };

  const remaining = Math.max(0, FREE_LIMIT - getCount(user?.uid));

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: B.bg, minHeight: "100vh", color: B.black }}>
      {showPaywall && (
        <Paywall
          user={user}
          onSignIn={async () => { try { await signInWithGoogle(); setShowPaywall(false); } catch (e) { console.error(e); } }}
          onDismiss={() => setShowPaywall(false)}
        />
      )}

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 90,
        background: "rgba(249,248,245,0.9)", backdropFilter: "blur(24px)",
        borderBottom: `1px solid ${B.border}`,
        padding: `0 ${GUTTER}`, height: "64px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer" }}><Logo height={44} /></div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => setView("saved")} style={{
            background: view === "saved" ? B.black : B.border,
            color: view === "saved" ? "#fff" : B.black,
            border: "none", borderRadius: "24px", padding: "8px 18px",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px", fontWeight: 600, transition: "all 0.2s",
          }}>
            ♥ Saved {bookmarks.length > 0 && `(${bookmarks.length})`}
          </button>

          <div style={{
            background: remaining > 1 ? "#E8F5E9" : remaining === 1 ? "#FFF8E1" : "#FCE4EC",
            color: remaining > 1 ? "#2E7D32" : remaining === 1 ? "#E65100" : "#880E4F",
            padding: "8px 14px", borderRadius: "24px",
            fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 700,
          }}>
            {remaining}/{FREE_LIMIT} searches
          </div>

          {user ? (
            <div style={{ position: "relative" }}>
              <img
                src={user.photoURL} alt={user.displayName}
                onClick={() => setMenuOpen(!menuOpen)}
                style={{ width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", border: `2px solid ${B.orange}`, objectFit: "cover" }}
              />
              {menuOpen && (
                <div style={{
                  position: "absolute", top: "44px", right: 0,
                  background: B.white, borderRadius: "14px", padding: "8px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: `1px solid ${B.border}`,
                  minWidth: "180px", animation: "fadeIn 0.2s ease", zIndex: 100,
                }}>
                  <div style={{ padding: "10px 12px 8px", fontFamily: "'DM Sans', sans-serif" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: B.black }}>{user.displayName}</div>
                    <div style={{ fontSize: "11px", color: B.muted }}>{user.email}</div>
                  </div>
                  <div style={{ height: "1px", background: B.border, margin: "4px 0" }} />
                  <button onClick={() => { signOutUser(); setMenuOpen(false); }} style={{
                    width: "100%", background: "none", border: "none", padding: "9px 12px",
                    fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "#C62828",
                    cursor: "pointer", textAlign: "left", borderRadius: "8px",
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FFF0F0"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowPaywall(true)} style={{
              background: B.orange, color: "#fff", border: "none", borderRadius: "24px",
              padding: "8px 18px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              fontSize: "12px", fontWeight: 700, transition: "all 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = B.orangeHover}
              onMouseLeave={e => e.currentTarget.style.background = B.orange}
            >Sign in</button>
          )}
        </div>
      </nav>

      {/* ── HOME ── */}
      {view === "home" && (
        <>
          {/* CINEMATIC HERO */}
          <div style={{
            background: B.dark, position: "relative", overflow: "hidden",
            padding: `100px ${GUTTER} 80px`,
            minHeight: "520px", display: "flex", alignItems: "center",
          }}>
            {/* Decorative orbs */}
            <div style={{
              position: "absolute", top: "-80px", right: "-60px",
              width: "500px", height: "500px", borderRadius: "50%",
              background: `radial-gradient(circle, ${B.orange}22 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: "-120px", left: "10%",
              width: "400px", height: "400px", borderRadius: "50%",
              background: `radial-gradient(circle, ${B.orange}12 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />

            <div style={{ maxWidth: "1200px", margin: "0 auto", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center", position: "relative", zIndex: 1 }}>
              <div style={{ animation: "fadeUp 0.6s ease" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  background: `${B.orange}20`, border: `1px solid ${B.orange}40`,
                  borderRadius: "24px", padding: "6px 16px", marginBottom: "28px",
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: B.orange, animation: "pulse 1.5s ease infinite" }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 700, color: B.orange, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    AI-Powered Recipe Discovery
                  </span>
                </div>

                <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(44px,5.5vw,74px)", fontWeight: 300, color: "#fff", lineHeight: 1.05, marginBottom: "22px" }}>
                  The world's<br />
                  <em style={{ fontStyle: "italic", color: B.orange, fontWeight: 600 }}>finest recipes</em>,<br />
                  in one place.
                </h1>

                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "16px", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: "40px", maxWidth: "400px" }}>
                  From Nigerian Party Jollof to Japanese Ramen — discover authentic, AI-generated recipes from every corner of the world.
                </p>

                <div style={{
                  background: "rgba(255,255,255,0.08)", backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: "18px",
                  display: "flex", alignItems: "center", overflow: "hidden", maxWidth: "480px",
                }}>
                  <span style={{ padding: "0 14px 0 20px", fontSize: "18px", opacity: 0.5 }}>🔍</span>
                  <input
                    value={heroInput}
                    onChange={e => setHeroInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && heroInput.trim() && doSearch(heroInput, heroInput)}
                    placeholder="Nigerian Jollof, low-cal meals, pasta..."
                    style={{
                      flex: 1, border: "none", outline: "none", padding: "18px 0",
                      fontFamily: "'DM Sans', sans-serif", fontSize: "15px",
                      background: "transparent", color: "#fff",
                    }}
                  />
                  <button className="btn-orange" onClick={() => heroInput.trim() && doSearch(heroInput, heroInput)}
                    style={{ margin: "6px", borderRadius: "13px", padding: "13px 22px", fontSize: "13px" }}>
                    Search
                  </button>
                </div>
              </div>

              {/* Featured grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", animation: "fadeUp 0.7s ease 0.15s both" }}>
                {[
                  { q: "Nigerian Party Jollof Rice", label: "Jollof Rice", emoji: "🍛", hot: true },
                  { q: "Classic Italian Carbonara", label: "Carbonara", emoji: "🍝", hot: false },
                  { q: "Japanese Tonkotsu Ramen", label: "Ramen", emoji: "🍜", hot: false },
                  { q: "Mexican Birria Tacos", label: "Birria Tacos", emoji: "🌮", hot: true },
                  { q: "Low Calorie Protein Bowl", label: "Protein Bowl", emoji: "🥗", hot: false },
                  { q: "British Sunday Roast", label: "Sunday Roast", emoji: "🥩", hot: false },
                ].map((f, i) => (
                  <div key={i} onClick={() => doSearch(f.q, f.label)} style={{
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "16px", padding: "16px 12px", cursor: "pointer",
                    textAlign: "center", transition: "all 0.25s ease", position: "relative",
                    animation: "fadeUp 0.5s ease both", animationDelay: `${i * 60 + 300}ms`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${B.orange}22`; e.currentTarget.style.borderColor = `${B.orange}50`; e.currentTarget.style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = ""; }}
                  >
                    {f.hot && <div style={{ position: "absolute", top: "6px", right: "6px", background: B.orange, color: "#fff", fontSize: "8px", fontWeight: 700, padding: "2px 6px", borderRadius: "8px", letterSpacing: "0.06em" }}>HOT</div>}
                    <div style={{ fontSize: "28px", marginBottom: "7px" }}>{f.emoji}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600, color: "#fff" }}>{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* REGIONS BAR */}
          <div style={{ background: B.white, borderBottom: `1px solid ${B.border}`, padding: `0 ${GUTTER}` }}>
            <div className="scroll-row" style={{ padding: "16px 0", gap: "10px" }}>
              {REGIONS.map((r, i) => (
                <button key={r.label} className="pill-hover" onClick={() => doSearch(r.q, r.label)} style={{
                  background: B.bg, border: `1.5px solid ${B.border}`,
                  borderRadius: "24px", padding: "9px 18px", cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", fontSize: "12px", fontWeight: 600, color: B.black,
                  display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
                }}>
                  <span>{r.emoji}</span> {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* FEATURED SECTIONS */}
          {FEATURED_SECTIONS.map(section => (
            <SectionRow
              key={section.id}
              section={section}
              onSelect={doSearch}
              bookmarks={bookmarks}
              onBM={toggleBM}
            />
          ))}

          {/* FOOTER */}
          <footer style={{ background: B.dark, padding: "48px 40px" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
              <Logo height={40} light />
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
                © 2026 Mama K Recipes. AI-powered culinary discovery.
              </div>
              <div style={{ display: "flex", gap: "24px" }}>
                {["Privacy", "Terms", "Contact"].map(l => (
                  <span key={l} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>{l}</span>
                ))}
              </div>
            </div>
          </footer>
        </>
      )}

      {/* ── RESULTS ── */}
      {view === "results" && (
        <ResultsView
          query={searchQ}
          label={searchLabel}
          preloaded={preloadedRecipes}
          onOpen={r => setSelected(r) || setView("detail")}
          bookmarks={bookmarks}
          onBM={toggleBM}
          onSearch={doSearch}
        />
      )}

      {/* ── DETAIL ── */}
      {view === "detail" && selected && (
        <DetailView
          recipe={selected}
          bookmarked={isBM(selected)}
          onBM={() => toggleBM(selected)}
          onBack={() => setView("results")}
        />
      )}

      {/* ── SAVED ── */}
      {view === "saved" && (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 32px" }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "42px", fontWeight: 600, marginBottom: "8px" }}>Saved Recipes</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "36px" }}>{bookmarks.length} recipes saved</div>

          {bookmarks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <div style={{ fontSize: "60px", opacity: 0.2, marginBottom: "20px" }}>♡</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", marginBottom: "20px", color: B.muted }}>Nothing saved yet</div>
              <button className="btn-orange" onClick={() => setView("home")} style={{ padding: "14px 32px", borderRadius: "14px", fontSize: "14px" }}>
                Explore Recipes
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "16px" }}>
              {bookmarks.map((r, i) => (
                <RecipeCard key={i} idx={i} r={r} wide
                  onOpen={() => { setSelected(r); setView("detail"); }}
                  bookmarked={true} onBM={() => toggleBM(r)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
