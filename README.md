# Plate

A minimal, installable calorie tracker. Sign in with Google, answer a few questions, and Plate works out your maintenance calories and a daily target. Log food by saying it, photographing it, or typing it — OpenAI estimates the calories and macros, and you confirm before anything is saved.

## How it works

```
Phone or laptop (installable web app — React + Vite)
 │
 ├─ Google sign-in ─────────────────► Firebase Authentication   (free Spark plan)
 ├─ profile, food log, weigh-ins ───► Cloud Firestore            (free Spark plan, private per person)
 │
 └─ voice / photo / description ────► Vercel Function  POST /api/analyze   (free Hobby plan)
                                        1. checks the person's Google sign-in token
                                        2. counts today's AI uses (40 per person per day)
                                        3. voice → text with OpenAI gpt-transcribe
                                        4. text or photo → foods, portions, kcal, macros with OpenAI gpt-6.1-terra
                                        5. returns the estimate; the app shows it for review and saves it to Firestore
```

- **The OpenAI key only lives in Vercel's environment variables.** It is never sent to the browser.
- **Nothing is saved until you tap Add.** Voice recordings and photos go to OpenAI for that one request (`store: false`) and are not kept by Plate.
- **No Firebase Cloud Functions**, so Firebase stays on the free Spark plan.
- **Targets** are calculated in the browser from each person's answers (see [How targets are calculated](#how-targets-are-calculated)).

### What it costs

| Service | Plan | Cost |
|---|---|---|
| Firebase Auth + Firestore | Spark | Free (50,000 reads and 20,000 writes a day — far more than a few people need) |
| Vercel | Hobby | Free for personal, non-commercial use |
| OpenAI | Pay as you go | About half a US cent per log: transcription is $0.0045 a minute and `gpt-6.1-terra` is $1 / $5 per million input / output tokens. 10 logs a day ≈ $2 a month per active person |

Set a monthly budget in the OpenAI dashboard (Settings → Limits) so nothing can run away.

## Try it without any accounts

```bash
npm install
npm run demo
```

Sign-in is simulated, data stays in the browser, and the AI returns sample estimates.

## Run locally with your Firebase project

`.env.local` needs the six `VITE_FIREBASE_*` values (already done) plus your OpenAI key:

```
OPENAI_API_KEY=sk-...
```

Then:

```bash
npm run dev
```

The dev server also runs `/api/analyze`, so voice, photo and text logging work locally. Before the app can read or write data, publish the Firestore rules (step 1 below).

## One-time setup

### 1. Firebase — publish the security rules

Firebase console → **Firestore Database → Rules** → replace everything with the contents of [`firestore.rules`](firestore.rules) → **Publish**.

These rules keep each person's data private and protect the daily AI limit. Publish again whenever `firestore.rules` changes.

### 2. OpenAI — create a key

https://platform.openai.com/api-keys → **Create new secret key**. Put it in `.env.local` for local use and in Vercel (step 3) for the live app. Never commit it or share it.

### 3. Vercel — deploy

```bash
npx vercel login          # opens the browser
npx vercel link           # create a new project, e.g. "plate"; settings come from vercel.json
```

Add the environment variables: Vercel dashboard → your project → **Settings → Environment Variables** → paste the whole contents of `.env.local` (the six `VITE_FIREBASE_*` lines and `OPENAI_API_KEY`) → tick **Production** and **Preview** → **Save**.

```bash
npx vercel --prod         # prints your URL, e.g. https://plate-xyz.vercel.app
```

Re-run `npx vercel --prod` after code changes. Changing environment variables also needs a redeploy.

### 4. Firebase — allow sign-in from your Vercel domain

Firebase console → **Authentication → Settings → Authorized domains → Add domain** → `plate-xyz.vercel.app`.

### 5. Google — allow sign-in on phones

Phones and the installed app sign in by redirecting to Google and back. Plate serves Firebase's sign-in handler from its own domain (`vercel.json` proxies `/__/auth` to `plate-4c81f.firebaseapp.com`), which keeps this working in browsers that block third-party cookies. Google has to know about that address:

1. Open https://console.cloud.google.com/apis/credentials?project=plate-4c81f
2. Edit **Web client (auto created by Google Service)**.
3. Under **Authorized redirect URIs**, add `https://plate-xyz.vercel.app/__/auth/handler` → **Save**. (It can take a few minutes to apply.)

### 6. Install on Android

Open your Vercel URL in Chrome → **⋮ → Install app** (or **Install Plate** on Plate's profile screen).

## Settings

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `VITE_FIREBASE_*` (6) | app build | — | Firebase web config (public) |
| `OPENAI_API_KEY` | server | — | Required for AI logging |
| `OPENAI_MODEL` | server | `gpt-6.1-terra` | Food analysis. `gpt-6-luna` is ~10× cheaper but less accurate |
| `OPENAI_TRANSCRIBE_MODEL` | server | `gpt-transcribe` | Speech to text |
| `OPENAI_REASONING_EFFORT` | server | `low` | `none`, `low`, `medium`, `high` — higher is slower and costlier |
| `AI_DAILY_LIMIT` | server | `40` | AI logs per person per day |
| `ALLOWED_EMAILS` | server | (anyone) | Comma-separated emails; when set, only these accounts can use AI logging |

## Security

- **Firestore rules** let a person read and write only their own `users/{uid}` data.
- **`/api/analyze` rejects** any request without a valid Firebase sign-in token, which is checked against Google's public keys.
- **The daily AI counter** is stored at `users/{uid}/usage/{day}`. The rules only let it start at 1 and go up by exactly 1, so it can't be reset from the app.
- **The OpenAI key** never leaves the server.

## How targets are calculated

`src/lib/nutrition.ts`:

- **BMR** — Mifflin-St Jeor: `10 × kg + 6.25 × cm − 5 × age + s`, where `s` is +5 for male, −161 for female and −78 for "prefer not to say".
- **Activity factor** — derived from the onboarding answers (type of work + workouts + walking), clamped to 1.2–1.9.
- **Target** — maintenance minus the chosen pace (0.25 / 0.5 / 0.75 kg a week ≈ 275 / 550 / 825 kcal a day).
  - Never more than 25% below maintenance.
  - Never below 1,500 kcal (male) or 1,200 kcal (female).
  - Under-18s get maintenance only.
- **Macros** — protein 1.6 g/kg (capped at the weight for BMI 30), fat 27% of calories, carbs the rest.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server + local `/api/analyze`, using `.env.local` |
| `npm run demo` | Dev server with no Firebase or OpenAI |
| `npm run build` | Typecheck the app and server, then build into `dist/` |
| `npm test` | Unit tests (targets, portion scaling) |
| `npm run icons` | Regenerate app icons from `public/logo.svg` |

## Project layout

```
api/analyze.js     Vercel Function entry point
server/            AI endpoint: auth check, daily limit, OpenAI calls (plain JS, type-checked)
src/lib/           pure logic: nutrition maths, portions, dates
src/data/          backend interface + Firebase and demo implementations
src/components/    design system (buttons, sheets, ring, rolling numbers, toasts)
src/screens/       sign-in, onboarding, today, capture (voice/photo/text), profile
firestore.rules    per-person data isolation + daily AI counter
vercel.json        build, function timeout, sign-in proxy, SPA routing
```
