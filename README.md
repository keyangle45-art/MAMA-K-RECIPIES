# Mama K Recipes 🔥

Premium AI-powered recipe discovery. Built with React + Vite + Claude API + Firebase Auth.

---

## Stack
- **Frontend**: React + Vite
- **AI**: Claude API (proxied through Vercel serverless — key is secure)
- **Auth**: Firebase Google Auth (free)
- **Payments**: Paystack (wire up to /api/paystack endpoint)
- **Hosting**: Vercel (free tier)

---

## Deploy to Vercel

### Step 1 — Firebase (Google Auth)
1. Go to https://console.firebase.google.com
2. Create a new project → name it "mamak-recipes"
3. Go to Authentication → Sign-in method → Enable Google
4. Go to Project Settings → Web App → Register app → copy config keys

### Step 2 — Anthropic API Key
1. Go to https://console.anthropic.com
2. API Keys → Create Key → copy it
3. This goes in Vercel as a SERVER-SIDE env var (no VITE_ prefix = not exposed to browser)

### Step 3 — Deploy
1. Push this folder contents to a GitHub repo
2. Go to vercel.com → New Project → import repo
3. Set Framework: Vite
4. Add ALL environment variables from .env.example
5. Deploy

### Environment Variables for Vercel
| Key | Where to get it |
|-----|----------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `VITE_FIREBASE_API_KEY` | Firebase project settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase project settings |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project settings |
| `VITE_FIREBASE_APP_ID` | Firebase project settings |

### Step 4 — Add your domain in Firebase
In Firebase Console → Authentication → Settings → Authorized domains
→ Add your Vercel domain (e.g. mamak-recipes.vercel.app) AND your custom domain

---

## Architecture
```
Browser → /api/recipes (Vercel serverless) → Anthropic API
Browser → Firebase (Google Auth, free)
Browser → Paystack (payment, coming soon)
```

The ANTHROPIC_API_KEY never touches the browser. Secure by design.
