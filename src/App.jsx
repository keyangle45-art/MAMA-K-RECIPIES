import { useState, useEffect, useRef } from "react";
import { auth, signInWithGoogle, signOutUser } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

/* ─── Brand ──────────────────────────────────────────────── */
const B = {
  orange: "#CE4F00",
  orangeHover: "#E06612",
  black: "#0A0A0A",
  white: "#FFFFFF",
  bg: "#F5F5F7",
  cream: "#F3ECD8",
  border: "#D2D2D7",
  muted: "#86868B",
  dark: "#1D1D1F",
  card: "#FFFFFF",
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
    subtitle: "From Paris to Rome, Europe's finest plates",
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
    subtitle: "Under 450 calories, nourishing not boring",
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
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400;1,600&family=Poppins:wght@400;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #F5F5F7; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  input::placeholder { color: #86868B; }

  @keyframes fadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
  @keyframes scaleIn { from { opacity:0; transform:scale(0.94) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
  @keyframes imgFade { from{opacity:0} to{opacity:1} }

  .card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,0.11) !important; }

  .pill-hover { transition: all 0.18s ease; }
  .pill-hover:hover { background: #CE4F00 !important; color: #fff !important; border-color: #CE4F00 !important; }

  .btn-orange { background:#CE4F00; color:#fff; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:500; transition:all 0.18s ease; }
  .btn-orange:hover { background:#E06612; }
  .btn-orange:active { transform:scale(0.98); }

  .skeleton { background: linear-gradient(90deg, #E8E8ED 25%, #F2F2F7 50%, #E8E8ED 75%); background-size: 600px 100%; animation: shimmer 1.6s ease infinite; border-radius:10px; }
  .recipe-img { object-fit:cover; width:100%; height:100%; display:block; }
`;

/* ─── Logo ───────────────────────────────────────────────── */
const FLAME_PATH = "M 1124.640625 460.738281 C 1124.640625 460.738281 1018.078125 559.09375 969.816406 679.957031 C 918.5625 808.308594 950.328125 857.421875 926.183594 884.042969 C 898.734375 914.304688 844.542969 889.671875 862.761719 758.234375 C 808.699219 858.609375 767.835938 966.453125 767.835938 1063.144531 C 767.835938 1190.230469 834.292969 1301.777344 934.335938 1364.988281 L 945.617188 1306.457031 C 950.511719 1281.09375 941.480469 1255.21875 922.292969 1237.933594 C 904.976562 1222.304688 895.925781 1202.789062 903.601562 1162.957031 C 917.820312 1089.207031 979.917969 994.976562 1032.183594 1005.050781 C 1084.445312 1015.128906 1107.078125 1125.691406 1092.863281 1199.4375 C 1085.183594 1239.273438 1069.527344 1254.027344 1047.640625 1262.09375 C 1023.402344 1271.003906 1005.382812 1291.664062 1000.496094 1317.042969 L 986.039062 1392.019531 C 1028.652344 1409.996094 1075.484375 1419.945312 1124.640625 1419.945312 C 1172.957031 1419.945312 1219.011719 1410.316406 1261.042969 1392.917969 L 1248.777344 1329.269531 C 1243.921875 1304.09375 1226.257812 1283.21875 1202.152344 1274.511719 C 1180.003906 1266.480469 1164.160156 1251.804688 1156.417969 1211.660156 L 1126.476562 1056.3125 C 1124.257812 1044.824219 1131.761719 1033.730469 1143.246094 1031.519531 C 1148.976562 1030.410156 1154.628906 1031.726562 1159.113281 1034.773438 C 1163.613281 1037.796875 1166.933594 1042.5625 1168.039062 1048.292969 L 1198.503906 1206.335938 L 1227.820312 1200.6875 L 1197.921875 1045.601562 C 1195.398438 1032.492188 1203.96875 1019.8125 1217.085938 1017.285156 C 1223.648438 1016.015625 1230.101562 1017.519531 1235.222656 1020.992188 C 1240.359375 1024.460938 1244.160156 1029.898438 1245.417969 1036.445312 L 1275.3125 1191.527344 L 1304.621094 1185.878906 L 1274.148438 1027.839844 C 1271.9375 1016.355469 1279.453125 1005.257812 1290.9375 1003.042969 C 1296.667969 1001.933594 1302.320312 1003.25 1306.808594 1006.292969 C 1311.304688 1009.332031 1314.628906 1014.089844 1315.730469 1019.828125 L 1345.683594 1175.183594 C 1353.421875 1215.320312 1344.152344 1234.835938 1326.570312 1250.519531 C 1307.449219 1267.570312 1298.792969 1293.511719 1303.648438 1318.683594 L 1312.828125 1366.304688 C 1414.050781 1303.335938 1481.445312 1191.121094 1481.445312 1063.144531 C 1481.445312 809.085938 1169.675781 729.90625 1124.640625 460.738281";

const Logo = ({ height = 44, light = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <svg
      width={height * 0.745}
      height={height}
      viewBox="767 460 714 960"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <path d={FLAME_PATH} fill={light ? "#fff9e5" : "#ce4f00"} fillRule="nonzero" />
    </svg>
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 900,
        fontSize: height * 0.42,
        color: light ? "#fff" : B.dark,
        letterSpacing: "0.02em",
        lineHeight: 1.1,
        textTransform: "uppercase",
      }}>MAMA K</div>
      <div style={{
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 400,
        fontSize: height * 0.19,
        color: light ? "rgba(255,255,255,0.65)" : B.orange,
        letterSpacing: "0.35em",
        textTransform: "uppercase",
        lineHeight: 1,
        marginTop: "1px",
      }}>RECIPES</div>
    </div>
  </div>
);

/* ─── Cuisine thumbnail gradients ────────────────────────── */
const CUISINE_BG = {
  nigeria: "linear-gradient(135deg,#3D2010,#5C3018)",
  ghana: "linear-gradient(135deg,#2A1A08,#4A2A10)",
  senegal: "linear-gradient(135deg,#1A2A3A,#1A3A2A)",
  ethiopia: "linear-gradient(135deg,#1A2E1A,#2A4A1A)",
  "south africa": "linear-gradient(135deg,#1A1A2E,#2E1A1A)",
  kenya: "linear-gradient(135deg,#0A2E0A,#1A4A1A)",
  usa: "linear-gradient(135deg,#0A1A2E,#1A2E3A)",
  italy: "linear-gradient(135deg,#2E1A0A,#3A2A10)",
  france: "linear-gradient(135deg,#0A0A2E,#1A1A3A)",
  spain: "linear-gradient(135deg,#2E0A0A,#3A1A10)",
  japan: "linear-gradient(135deg,#2E0A1A,#3A1A2A)",
  china: "linear-gradient(135deg,#2E0A0A,#4A1A10)",
  india: "linear-gradient(135deg,#2E1A0A,#4A2A10)",
  thailand: "linear-gradient(135deg,#1A2E0A,#2A4A10)",
  korea: "linear-gradient(135deg,#0A1A2E,#1A2A3A)",
  vietnam: "linear-gradient(135deg,#1A2E1A,#2A3A10)",
  morocco: "linear-gradient(135deg,#2E1A0A,#4A2A10)",
  mexico: "linear-gradient(135deg,#2E1A0A,#4A1A10)",
  default: "linear-gradient(135deg,#1A1A1A,#2A2A2A)",
};
const thumbBg = (region) => CUISINE_BG[(region || "").toLowerCase()] || CUISINE_BG.default;
const lightThumb = (region) => ["usa","italy","france","spain","japan","china","india","thailand","korea","vietnam","morocco","mexico","new england","south","texas","new york","scotland","wales","england","germany","greece","portugal"].includes((region||"").toLowerCase());

/* ─── Skeleton Card ──────────────────────────────────────── */
const SkeletonCard = ({ dark = false }) => (
  <div style={{ width: "166px", flexShrink: 0, borderRadius: "14px", overflow: "hidden", background: dark ? "rgba(255,255,255,0.06)" : B.white, boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.05)" }}>
    <div className="skeleton" style={{ height: "96px", borderRadius: 0 }} />
    <div style={{ padding: "10px 12px 12px" }}>
      <div className="skeleton" style={{ height: "13px", marginBottom: "6px", width: "75%" }} />
      <div className="skeleton" style={{ height: "10px", width: "50%" }} />
    </div>
  </div>
);

/* ─── Recipe Card ────────────────────────────────────────── */
const DIFF_STYLE = {
  Easy:     { bg: "#F0FDF4", color: "#15803D" },
  Medium:   { bg: "#FFFBEB", color: "#D97706" },
  Advanced: { bg: "#FFF1F2", color: "#BE123C" },
};

const RecipeCard = ({ r, onOpen, bookmarked, onBM, idx = 0, dark = false, wide = false }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const diff = DIFF_STYLE[r.difficulty] || DIFF_STYLE.Easy;
  const w = wide ? "220px" : "166px";
  const h = wide ? "120px" : "96px";

  return (
    <div className="card-hover" onClick={onOpen} style={{
      width: w, flexShrink: 0, borderRadius: "14px", overflow: "hidden",
      position: "relative", scrollSnapAlign: "start",
      background: dark ? "rgba(255,255,255,0.07)" : B.white,
      border: `0.5px solid ${dark ? "rgba(255,255,255,0.1)" : B.border}`,
      boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.05)",
      animation: "fadeUp 0.4s ease both",
      animationDelay: `${(idx % 8) * 40}ms`,
    }}>
      {/* Thumbnail */}
      <div style={{ height: h, position: "relative", overflow: "hidden", background: thumbBg(r.region) }}>
        {r.image ? (
          <>
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: wide ? "42px" : "34px",
              opacity: imgLoaded ? 0 : 1, transition: "opacity 0.3s",
            }}>{r.emoji}</div>
            <img
              className="recipe-img"
              src={r.image} alt={r.title}
              onLoad={() => setImgLoaded(true)}
              style={{ position: "absolute", inset: 0, opacity: imgLoaded ? 1 : 0, transition: "opacity 0.35s ease" }}
            />
          </>
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: wide ? "42px" : "34px" }}>
            {r.emoji}
          </div>
        )}
        {/* Gradient overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to top,rgba(0,0,0,0.4),transparent)", pointerEvents: "none" }} />
        {/* Region tag */}
        {r.region && (
          <div style={{
            position: "absolute", top: "6px", left: "6px",
            background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)",
            color: "#fff", fontSize: "8px", fontWeight: 500,
            padding: "2px 7px", borderRadius: "5px", letterSpacing: "0.05em", textTransform: "uppercase",
          }}>{r.region}</div>
        )}
        {/* Bookmark */}
        <button onClick={e => { e.stopPropagation(); onBM(); }} style={{
          position: "absolute", top: "6px", right: "6px",
          background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)",
          border: "none", borderRadius: "50%", width: "24px", height: "24px",
          cursor: "pointer", fontSize: "11px", color: bookmarked ? B.orange : "#AAA",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.18s",
        }}>{bookmarked ? "♥" : "♡"}</button>
      </div>

      {/* Body */}
      <div style={{ padding: "9px 11px 11px" }}>
        <div style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "13px", fontWeight: 400, lineHeight: 1.3,
          marginBottom: "3px", color: dark ? "#fff" : B.dark,
          letterSpacing: "-0.01em",
        }}>{r.title}</div>
        <div style={{ fontSize: "10px", color: dark ? "rgba(255,255,255,0.42)" : B.muted, lineHeight: 1.4, marginBottom: "8px" }}>
          {r.tagline}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "8px", fontWeight: 600, padding: "2px 7px", borderRadius: "5px", background: diff.bg, color: diff.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {r.difficulty}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "9px", color: dark ? "rgba(255,255,255,0.35)" : B.muted }}>
            {r.time}
          </span>
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
    <div ref={ref} style={{ padding: "36px 0 28px", background: section.dark ? B.dark : B.bg }}>
      <div style={{ padding: `0 ${GUTTER}`, marginBottom: "18px", animation: revealed ? "fadeUp 0.5s ease" : "none" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: B.orange, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "5px" }}>
              {section.subtitle}
            </div>
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(20px,3vw,28px)", fontWeight: 400, color: section.dark ? "#fff" : B.dark, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {section.title}
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            {[{ dir: -1, active: canLeft }, { dir: 1, active: canRight }].map(({ dir, active }) => (
              <button key={dir} onClick={() => scroll(dir)} style={{
                width: "30px", height: "30px", borderRadius: "50%",
                border: `0.5px solid ${section.dark ? "rgba(255,255,255,0.2)" : B.border}`,
                background: section.dark ? "rgba(255,255,255,0.07)" : B.white,
                color: section.dark ? "#fff" : B.dark,
                cursor: "pointer", fontSize: "13px",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: active ? 1 : 0.28, transition: "all 0.18s",
              }}>{dir === -1 ? "←" : "→"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll row - no overlay arrows, just fade edges */}
      <div style={{ position: "relative" }}>
        {/* Left fade */}
        {canLeft && (
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: "60px", zIndex: 5, pointerEvents: "none",
            background: `linear-gradient(to right, ${section.dark ? B.dark : B.bg}, transparent)`,
          }} />
        )}
        {/* Right fade */}
        {canRight && (
          <div style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: "60px", zIndex: 5, pointerEvents: "none",
            background: `linear-gradient(to left, ${section.dark ? B.dark : B.bg}, transparent)`,
          }} />
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
            ? Array(6).fill(0).map((_, i) => <SkeletonCard key={i} dark={section.dark} />)
            : cards.map((card, i) => (
              card._stub ? (
                <div key={i} className="card-hover" onClick={() => onSelect(card._search, card._label)} style={{
                  width: "166px", flexShrink: 0,
                  background: section.dark ? "rgba(255,255,255,0.06)" : B.white,
                  borderRadius: "14px", overflow: "hidden", cursor: "pointer",
                  border: `0.5px solid ${section.dark ? "rgba(255,255,255,0.1)" : B.border}`,
                  scrollSnapAlign: "start",
                  animation: "fadeUp 0.5s ease both", animationDelay: `${i * 50}ms`,
                }}>
                  <div style={{ height: "96px", background: thumbBg(card.region), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "34px" }}>
                    {card.emoji}
                  </div>
                  <div style={{ padding: "9px 11px 11px" }}>
                    <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", color: section.dark ? "#fff" : B.dark, lineHeight: 1.3 }}>{card.title}</div>
                    <div style={{ fontSize: "10px", color: B.muted, marginTop: "3px" }}>{card.region}</div>
                  </div>
                </div>
              ) : (
                <RecipeCard
                  key={i} idx={i} r={card} dark={section.dark}
                  onOpen={() => onSelect(section.searches[i]?.q, card.title, card)}
                  bookmarked={bookmarks.some(b => b.title === card.title)}
                  onBM={() => onBM(card)}
                />
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
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(26px,5vw,40px)", fontWeight: 400,
          color: B.dark, lineHeight: 1.1, letterSpacing: "-0.02em",
        }}>
          {recipe.title}
        </h1>
        <button onClick={onBM} style={{
          background: bookmarked ? B.orange : B.bg,
          border: `0.5px solid ${bookmarked ? B.orange : B.border}`,
          borderRadius: "50%", width: "40px", height: "40px", flexShrink: 0,
          cursor: "pointer", fontSize: "16px", color: bookmarked ? "#fff" : B.muted,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.18s",
        }}>{bookmarked ? "♥" : "♡"}</button>
      </div>

      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
        color: B.muted, marginBottom: "24px", lineHeight: 1.65,
      }}>{recipe.tagline}</p>

      {/* Meta strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)",
        gap: "1px", background: B.border, borderRadius: "12px",
        overflow: "hidden", marginBottom: "32px",
        border: `0.5px solid ${B.border}`,
      }}>
        {[["Time", recipe.time], ["Serves", recipe.servings], ["Cal", recipe.calories ? `~${recipe.calories}` : "N/A"], ["Level", recipe.difficulty]].map(([l, v], i) => (
          <div key={l} style={{ background: B.white, padding: "14px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "17px", fontWeight: 400, color: B.dark, marginBottom: "2px" }}>{v}</div>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.09em", color: B.muted }}>{l}</div>
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
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "26px", color: B.muted }}>Finding your recipes...</div>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "34px", fontWeight: 600, marginBottom: "4px" }}>{label || query}</div>
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
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "30px", fontWeight: 600, lineHeight: 1.2, marginBottom: "12px" }}>
        {user ? "Upgrade to Pro" : "Sign in to continue"}
      </div>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: B.muted, lineHeight: 1.7, marginBottom: "28px" }}>
        {user ? "You've used your free searches. Go Pro for unlimited access." : "Create a free account to get 5 searches/day."}
      </p>

      {["5 free searches daily (free)", "Unlimited with Pro at $4.99/mo", "Save collections to your account", "Top regional & legacy recipes"].map(p => (
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
          Upgrade to Pro at $4.99 per month
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
        background: "rgba(249,248,245,0.92)", backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${B.border}`,
        padding: "0 16px", height: "56px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "8px",
      }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", flexShrink: 0 }}>
          <Logo height={36} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Saved — icon only on mobile */}
          <button onClick={() => setView("saved")} style={{
            background: view === "saved" ? B.dark : B.bg,
            color: view === "saved" ? "#fff" : B.dark,
            border: `1px solid ${B.border}`,
            borderRadius: "20px", padding: "6px 12px",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px", fontWeight: 600, transition: "all 0.18s",
            display: "flex", alignItems: "center", gap: "4px",
            whiteSpace: "nowrap",
          }}>
            <span style={{ color: view === "saved" ? "#fff" : B.orange }}>♥</span>
            {bookmarks.length > 0 && <span>{bookmarks.length}</span>}
          </button>

          {/* Search counter — compact */}
          <div style={{
            background: remaining > 1 ? "#F0FDF4" : remaining === 1 ? "#FFFBEB" : "#FFF1F2",
            color: remaining > 1 ? "#15803D" : remaining === 1 ? "#D97706" : "#BE123C",
            border: `1px solid ${remaining > 1 ? "#BBF7D0" : remaining === 1 ? "#FDE68A" : "#FECDD3"}`,
            padding: "6px 10px", borderRadius: "20px",
            fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 700,
            whiteSpace: "nowrap",
          }}>
            {remaining}/{FREE_LIMIT}
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

                <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(30px,5vw,60px)", fontWeight: 400, color: "#fff", lineHeight: 1.08, marginBottom: "18px", letterSpacing: "-0.02em" }}>
                  The world's<br />
                  <em style={{ fontStyle: "italic", color: B.orange }}>finest recipes</em>,<br />
                  in one place.
                </h1>

                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: "32px", maxWidth: "380px" }}>
                  From Nigerian Party Jollof to Japanese Ramen, discover authentic, AI-generated recipes from every corner of the world.
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
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "42px", fontWeight: 600, marginBottom: "8px" }}>Saved Recipes</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: B.muted, marginBottom: "36px" }}>{bookmarks.length} recipes saved</div>

          {bookmarks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <div style={{ fontSize: "60px", opacity: 0.2, marginBottom: "20px" }}>♡</div>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "28px", marginBottom: "20px", color: B.muted }}>Nothing saved yet</div>
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
