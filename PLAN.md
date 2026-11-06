# Plate — Implementation Plan

A premium, minimal, light-themed calorie tracker. Log food by voice or photo; AI estimates calories and macros. Installable from the browser on Android and laptops. Multi-user with Google sign-in.

Status: **approved** (revision 3). OpenAI for all AI. Firebase stays on the free **Spark** plan; the AI endpoint runs as a **Vercel Function** and the app is hosted on Vercel.

Progress: Phase 1 ✅ built · Phase 2 ✅ built (voice, photo, text logging) · Extras ✅ built (see §13) · Phase 3 pending.

---

## 1. Core experience

1. Open Plate from the home screen → **Today**: an Activity-style ring shows calories remaining, with protein / carbs / fat bars and today's meals below.
2. Tap the mic and speak ("egg bhurji with two tablespoons of oil"). A live waveform reacts to your voice; recording stops automatically when you pause.
3. ~2–4 s later a confirm card slides up: the transcript, each food item with quantity, kcal and macros, and any assumptions highlighted ("Assumed 2 eggs — tap to change"). Tap **Add**; the ring animates to the new total.
4. Or tap the camera, photograph the plate, optionally add a voice/text note ("2 rotis with dal") → same confirm card.
5. Typing is always available as a fallback.

## 2. Accounts and onboarding (per user)

Any Google account can sign in. Each user's data is private to them. First sign-in runs a short onboarding:

| Step | Asks | Notes |
|---|---|---|
| Basics | Name (prefilled from Google), date of birth, sex | DOB so age stays current. Sex is used only for the BMR formula; "Prefer not to say" uses the midpoint of the two constants. |
| Body | Height (cm), current weight (kg), optional goal weight | |
| Lifestyle | Work type (mostly sitting / on feet part of the day / on feet most of the day / physical labour), workouts per week (0 / 1–2 / 3–4 / 5+), typical walking (light / moderate / a lot, with step ranges as hints) | The app turns these answers into an activity level — the user never picks a multiplier. |
| Goal | Maintain · Lose slowly (0.25 kg/wk) · Lose (0.5 kg/wk, recommended) · Lose faster (0.75 kg/wk) | 1 kg of body fat ≈ 7,700 kcal → 0.5 kg/wk ≈ 550 kcal/day deficit. |
| Reveal | Animated maintenance, daily target, macro targets, projected date to goal weight | |

All of it is editable later in Settings.

## 3. How the app calculates targets

- **BMR (Mifflin-St Jeor):** 10 × kg + 6.25 × cm − 5 × age + 5 (male) / − 161 (female) / − 78 (prefer not to say).
- **Maintenance (TDEE):** BMR × activity factor (1.2–1.9) derived from the lifestyle answers.
- **Daily target:** maintenance − deficit for the chosen pace.
- **Macros:** protein 1.6 g/kg body weight, fat ~27% of target, carbs fill the rest.
- **Safety rails:** deficit capped at 25% of maintenance; target never below 1,500 kcal (male) / 1,200 kcal (female). If a pace would break these, the app clamps it and says why.
- **Auto-recalculation:** on every new weigh-in and as age changes.
- **Adaptive maintenance:** after ~3 weeks of logging plus weekly weigh-ins, the app estimates each user's *real* maintenance from intake vs. weight trend (average intake + weight change × 7,700 ÷ days) and offers to update the target. This automatically accounts for steps and exercise.
- **Step counting:** a web app cannot read Android's step counter (no browser API, and it can't run in the background). The adaptive maintenance covers this. Real step data would need a native Android wrapper with Health Connect — out of scope for now.

## 4. Tech stack

| Layer | Choice |
|---|---|
| App | React + TypeScript + Vite |
| Styling / motion | Tailwind CSS with design tokens · Motion (spring physics, drag-to-dismiss sheets, layout transitions) |
| Installable | vite-plugin-pwa (manifest, icons, offline app shell, update prompt, Android install prompt) |
| Auth | Firebase Auth — Google sign-in |
| Database | Cloud Firestore with offline cache |
| Backend | Vercel Function `/api/analyze` (Node, plain JS + JSDoc types) — holds the OpenAI key, verifies Firebase ID tokens, enforces daily limits |
| Speech-to-text | OpenAI `gpt-transcribe` (English, with keyword hints for Indian dishes and measures) |
| Food analysis (text + photo) | OpenAI `gpt-6.1-terra`, Responses API with a strict JSON schema; model configurable via `OPENAI_MODEL` |
| Abuse protection | Firebase ID-token verification + per-user daily AI limit (Firestore counter that rules only allow to increase) + optional email allowlist |
| Hosting | Vercel (HTTPS required for mic, camera, install); `/__/auth` proxied to Firebase so redirect sign-in works |

```
mic ──► record (waveform, auto-stop on silence) ──► audio ─┐
camera ──► photo resized on device (~150 KB) ──────────────┤
typed text ────────────────────────────────────────────────┤
                                                           ▼
             Vercel Function: verify user + daily limit
                 │  audio → OpenAI transcription → text
                 │  text / photo → food analysis model → JSON items
                 ▼
     confirm & edit card ──► Firestore (synced across devices)
```

Voice is one round trip: the function transcribes and analyzes in the same call.

## 5. AI food analysis

- Tuned for Indian home cooking: counts cooking fat explicitly (oil, ghee, butter), understands katori, tsp/tbsp, roti sizes, home vs. restaurant portions.
- Returns per item: name, quantity + unit, estimated grams, kcal, protein, carbs, fat, confidence, one-line assumption.
- Never asks follow-up questions; it assumes a sensible default and highlights it.
- Editing a quantity rescales numbers instantly on the device (no second AI call). Editing the transcript re-runs analysis.
- Meal type (breakfast / lunch / snack / dinner) auto-set from time of day, changeable.
- Photos are not stored.

## 6. Design

- White cards on soft gray (#F5F5F7), near-black text, system font (SF Pro on Apple, Roboto/Inter on Android/Windows), large bold titles, generous whitespace, one accent color, frosted-glass tab bar and sheets.
- Motion: ring fill, odometer-style rolling numbers, spring bottom sheets with swipe-to-dismiss, real-audio waveform while recording, shimmer while analyzing, items cascading in, checkmark + haptic tick on save, swipe between days, swipe-to-delete. Respects "reduce motion".
- Phone: single column with bottom tab bar. Laptop: two panes (ring + capture left, meal log right).

**Screens:** Sign in · Onboarding · Today · Capture sheet · Trends (calories vs. target, weight trend line, adaptive maintenance) · Settings (profile, goal, targets override, sign out).

## 7. Data model and security

```
users/{uid}                    profile, lifestyle answers, goal, computed targets
users/{uid}/entries/{id}       date, meal, source (voice/photo/text), transcript, items[], totals
users/{uid}/weights/{date}     weigh-ins
users/{uid}/usage/{day}        AI call counter (rules: create at 1, +1 only, no delete)
```

- Firestore rules: a user can read/write only their own `users/{uid}` subtree; `usage` is server-only.
- `/api/analyze` requires a valid Firebase ID token (verified against Google's public keys).
- Per-user limit (default 40 AI analyses/day), audio capped at 30 s, images capped in size.
- Optional invite-only switch (email allowlist) if strangers start consuming credits.

## 8. Platform focus

Android (Chrome) and laptop browsers (Chrome / Edge) are the test targets: native install prompt, vibration haptics, camera opens directly. iPhone should mostly work but is not specifically tested in this scope.

## 9. Build phases

Checkpoint with the user after each phase.

1. **Foundation** — scaffold, design system, Firebase wiring, Google sign-in, onboarding + target calculator, Today screen with typed manual entry, installable PWA shell.
2. **AI logging** — Vercel Function (transcribe + analyze), voice capture with waveform and silence detection, photo capture, confirm/edit card, per-user limits.
3. **History and polish** — day navigation, Trends, weigh-ins, adaptive maintenance, recent meals ("log again"), offline behavior, animation polish, deploy, test on Android + laptop.

## 10. Costs (rough)

- **Firebase:** free Spark plan. **Vercel:** free Hobby plan.
- **Transcription (OpenAI):** a fraction of a cent per voice clip.
- **Food analysis:** roughly 1–3¢ per log depending on provider/model and whether a photo is included. Scales with number of users; the per-user daily limit bounds the worst case.

## 11. Decisions

- Food analysis provider: **OpenAI for everything** (transcription, text analysis, photo analysis) — one API key, uses existing credits.

## 12. Setup the owner does

- Create a Firebase project (Spark), enable Google sign-in, create Firestore, publish `firestore.rules`.
- OpenAI API key.
- Run `firebase login` once the CLI is installed.

## 13. Extras (approved 2026-11-06)

1. **In-app camera** — live viewfinder (back camera, torch where supported) with a gallery button; falls back to the gallery when the camera is blocked or missing. Works with laptop webcams.
2. **Should I eat this?** — the review screen shows the meal's effect on the day's target, ½ / ¾ / all portion buttons (rescaled on the device), which share fits, and one lighter swap from the AI (`tip`, same call). Actions: add, skip, or decide later (kept in localStorage for 12 h, logged later without another AI call).
3. **Home-screen shortcuts** — manifest shortcuts open `/?capture=photo|voice|text`.
4. **Edit a logged meal** — tap an entry to change amounts, meal or day (manual entries reopen the manual form).
5. **Kitchen profile** — `profile.kitchen` (roti/katori size, oil, ghee, milk, free-text note) is sent with each analysis and added to the prompt as defaults.
6. **Packaged food** — the prompt treats branded products separately: copy a visible nutrition label (`basis: "label"`), otherwise look the product up with OpenAI's `web_search` tool (`basis: "web"`, `source_url` kept only if it's on a site the search returned), assume the whole pack for single-serve packs. Home-cooked food never searches. `OPENAI_WEB_SEARCH=off` disables search.
