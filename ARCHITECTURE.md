# Mama K Recipes — Architecture Reference

Last updated: this session. This document reflects the actual current state of the codebase, not aspirational design — every claim here can be verified against the source files listed.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), single-page app, tab-based state (no router) |
| Hosting | Vercel — static frontend + serverless functions |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firestore, accessed via raw REST API server-side (no `firebase-admin` SDK anywhere in this codebase) |
| AI | Provider-agnostic — `AI_PROVIDER` env var switches between Claude / DeepSeek / OpenAI with zero code changes |
| Images | Pexels API, 3-tier resolution (tiny/medium/large2x) |
| Payments | Flutterwave recurring subscriptions |
| Deployment | GitHub → Vercel, auto-deploy per branch (production branch → live site, other branches → isolated preview URLs) |

---

## 2. Vercel Function Budget — a hard constraint, not a suggestion

**Hobby plan caps every deployment at exactly 12 serverless functions.** On a plain Vite project (unlike Next.js), Vercel maps *every file* sitting directly in `/api` to its own function — including shared utility modules that were never meant to be called over HTTP.

**Convention enforced in this codebase:** any file in `/api` whose filename starts with `_` is excluded from function counting by Vercel. Two files currently use this:

- `api/_ai-provider.js` — the AI provider abstraction, imported by 4 handlers
- `api/_recipe-index.js` — the recipe indexing/querying layer, imported by 6 handlers

**Current count: 11 real functions, 1 slot of headroom before hitting the cap again.**

| File | Type | Purpose |
|---|---|---|
| `recipes.js` | function | Search endpoint — Firestore-first, AI on genuine miss |
| `feed.js` | function | Home feed batches — indexed category queries + personalized AI queries |
| `recommendations.js` | function | "More Like This" — indexed first, self-healing AI fallback |
| `transform.js` | function | Recipe Tools AI transformations (High Protein/Low Cal/etc) |
| `seed.js` | function | One-time bulk database seeder |
| `reindex-existing.js` | function | One-time backfill of `recipe_index` from pre-existing seeded data |
| `track-view.js` | function | Fire-and-forget view count increment |
| `index-status.js` | function | Diagnostic — reports `recipe_index` health |
| `debug.js` | function | Diagnostic — reports AI provider/Pexels/Firestore health |
| `payment.js` | function | Flutterwave checkout session creation |
| `webhook.js` | function | Flutterwave subscription lifecycle events |
| `_ai-provider.js` | **not counted** | Shared: `callAI(prompt, maxTokens)` |
| `_recipe-index.js` | **not counted** | Shared: `indexRecipes()`, `queryRecipeIndex()`, `trackRecipeView()`, `classifyCategory()` |

**Rule going forward:** any new file that is a pure helper/library (imported by other files, never called directly by the frontend) must be named with a leading underscore. Any file that IS a direct HTTP endpoint counts against the 12-function budget — plan additions accordingly, or upgrade to Vercel Pro ($20/mo) to remove the cap entirely.

---

## 3. Data Architecture — Firestore-first, AI as enrichment only

Every user-facing request follows the same principle: **check the cheapest source first, only pay for AI on a genuine, confirmed miss, and permanently save whatever AI generates so the same request never costs money twice.**

```
Request
  ↓
In-memory hot cache (per serverless instance, 30 min TTL)
  ↓ miss
Firestore lookup
  ↓ miss
AI generation (only path that costs money or a user's free-search quota)
  ↓
Save permanently to Firestore
  ↓
Return to user
```

### 3.1 Two Firestore collections for recipes — and why

**`recipes/{slugKey}__{free|pro}`** — recipes are generated and stored in *batches* (2–6 at a time), keyed by the search query that produced them. Efficient for cache-hit lookups on repeated searches.

**`recipe_index/{recipeSlug}__{free|pro}`** — one flat, individually-queryable document *per recipe*, carrying the same full recipe payload plus classification fields (`category[]`, `region`, `cuisine`).

**Why both exist:** Firestore cannot run a field-level query ("give me recipes where region == Nigeria") against fields nested inside an array of objects within a single document. The batched `recipes/*` collection is great for "has this exact query been searched before?" but structurally useless for "show me anything African" or "show me something like this dish." `recipe_index` exists specifically to make those two real, common needs into actual Firestore structured queries — `ARRAY_CONTAINS` on category, `EQUAL` on region — instead of guessing likely query strings.

Every recipe generated anywhere in the app (`recipes.js`, `feed.js`, `seed.js`, `recommendations.js`'s fallback) gets written to *both* collections. Source of truth: `api/_recipe-index.js`.

### 3.2 Recipe document schema

```js
// recipe_index/{slug}
{
  title, emoji, tagline, time, difficulty, servings, calories,
  cuisine, region, tags: [], ingredients: [], steps: [],
  image, imageSmall, imageLarge, photographer,
  type: "food" | "drink",
  category: ["African", "Healthy", ...],   // classifyCategory() heuristic
  viewCount: number,                        // incremented via track-view.js
  rating: number, ratingCount: number,      // schema exists, no rating UI built yet
  createdAt: ISO timestamp,
}
```

### 3.3 User document schema

```js
// users/{uid}
{
  isPro: boolean,
  subscriptionStatus: "free" | "active" | "cancelled" | "expired",
  subscriptionEndDate: timestamp,
  cancelledAt, proSince: timestamp,
  searches: { "2026-07-14": 1, ... },       // per-day free-search count
  bookmarks: [...],
  searchHistory: [{ query, searchedAt, id }],
  preferences: {
    regions: {...}, cuisines: {...}, dietary: {...},
    difficulty: {...}, activityTimes: {...}
  },
  lastActiveAt,
}
```

### 3.4 `transforms/{recipeSlug}__{transformType}`

Recipe Tools AI transformations (High Protein, Low Calorie, Vegetarian, Air Fryer, Budget). Same principle: generated once per unique (recipe, transformation) pair, cached forever, never regenerated.

---

## 4. Free / Pro Enforcement — server-authoritative

**Free tier:** 1 AI generation per calendar day. Cache hits (Firestore or memory) are **always free and unlimited**, regardless of plan — only a genuine new AI generation costs a free search.

**Enforcement is entirely server-side**, in `api/recipes.js`:

1. Server reads today's count *without incrementing it*
2. If already at the limit → `403 limitReached`, no AI call, nothing charged
3. If under the limit → check hot cache, then Firestore, then AI
4. **Only after a confirmed successful AI generation** does the server increment the count (atomic Firestore PATCH)
5. A failed/parse-error AI attempt never costs the user their free search — the increment only fires on genuine success

The client never pre-increments and never has final say on whether a search is allowed — it only reads whatever `searchCount` the server's response tells it, keeping client and server state from ever diverging.

**Historical note:** an earlier version incremented the count *before* running the search, which combined with the server's own independent check created a guaranteed-failure race condition — literally 100% of free searches failed, every time, for every user. Fixed by moving the increment to fire only after confirmed success.

---

## 5. Subscription Lifecycle

Proper 4-state model, not a boolean:

```
free → active → cancelled → expired → (back to free)
```

- **Cancel flow:** 2-step retention UI (shows what they'll lose, "Keep Pro" prominent) → confirmation → `subscriptionStatus: "cancelled"` written, but `isPro` stays `true` until `subscriptionEndDate` passes. Matches Netflix/Spotify — no instant feature loss on cancellation.
- **Webhook (`api/webhook.js`):** identifies the user via `uid` embedded directly in Flutterwave's `tx_ref` (format: `mamak_{uid}_{timestamp}`, set at checkout creation in `api/payment.js`) — not by querying an `email` field, since email is never stored as a queryable field on the user document. On `subscription.activated`/`charge.completed` → sets active + 30-day end date. On `subscription.cancelled` → sets status to cancelled only, mirroring the in-app flow exactly (access retained until expiry).

---

## 6. "More Like This" — Recommendations

`api/recommendations.js`, called from `DetailView` on every recipe open.

1. Query `recipe_index` for same `region` (most specific)
2. Fall back to same `category`
3. Fall back to same `cuisine`
4. **Self-healing fallback:** if all three come back empty (index still sparse, or a genuinely novel dish), generate 4 similar recipes via AI *once*, attach real Pexels images, index them immediately — every subsequent lookup for that region/category becomes a free, instant cache hit. The section never permanently depends on someone remembering to run a data migration; it heals itself the first time it's needed.

---

## 7. Recipe Tools

Beneath every recipe detail page:

- **Party Mode** — pure math, ingredient quantities scaled by crowd size, no AI, free for Pro
- **Shopping List** — free for everyone, ingredients auto-grouped by category (Produce/Protein/Dairy/Grains/Spices), checkable
- **High Protein / Low Calorie / Vegetarian / Air Fryer / Budget** — Pro-gated (enforced server-side in `api/transform.js`, not just the frontend paywall), each transformation generated once via AI and cached forever in `transforms/*`

---

## 8. Diagnostic Endpoints

Two read-only health-check endpoints exist specifically so system health is *verifiable*, not assumed:

- **`GET /api/debug`** — tests whichever AI provider is actually configured via `AI_PROVIDER` (not hardcoded to one), Pexels connectivity, Firestore connectivity
- **`GET /api/index-status`** — reports `recipe_index` size, category breakdown, top regions, and a plain-English recommendation on whether the backfill needs running

---

## 9. Known, Explicitly Flagged Gaps

Being direct about what is *not* done, rather than implying completeness that isn't there:

1. **`rating`/`ratingCount` fields exist in the schema but there is no rating UI.** Ready for a future feature, not built yet.
2. **`classifyCategory()` is a heuristic**, not a curated taxonomy — it infers category from region/cuisine/tags/title keyword matching. Good enough for filtering today; will need refinement as the dataset grows into the thousands.
3. **The `recipe_index` backfill (`api/reindex-existing.js`) must be run once** against production Firestore for the ~500 originally-seeded recipes to become indexed. New recipes generated from this point forward index themselves automatically — this is a one-time catch-up step, not an ongoing maintenance burden.
4. **No composite Firestore indexes have been explicitly created** for compound queries (e.g. `category` + `region` together). Current query patterns only filter on one field at a time, which Firestore auto-indexes by default — if compound filtering is added later, corresponding composite indexes will need to be created in the Firebase console first.

---

## 10. Verifying This Document Is Accurate

Every claim above can be checked directly:

```bash
# Function count
ls api/ | grep -v "^_" | wc -l    # should be ≤ 12

# Recipe index health
curl https://recipes.keyangle.tech/api/index-status

# Core dependency health
curl https://recipes.keyangle.tech/api/debug
```
