# Saheli

**Saheli** ("friend" in Hindi) is an AI-powered life assistant for Indian households — one app for finance, health, home, safety, style, and payments.

This repository (`SaheliCLI`) is the React Native 0.86 client. It is mostly still a **static, front-end-only prototype** — theming, localization, family, dashboard are all device-local — but **onboarding now calls a real backend for auth and profile creation** (`M2-T1`, 2026-08-05; see `docs/DECISIONS.md` D-012 for why). Everything else still lives in `AsyncStorage` on the device, and no AI integration exists yet.

| | |
| --- | --- |
| Stack | React Native 0.86 (CLI, not Expo) · React 19.2 · TypeScript 5.8 |
| Navigation | React Navigation v7 (native stack) |
| Persistence | `@react-native-async-storage/async-storage` |
| Localization | `i18n-js` — 6 languages |
| Icons | `lucide-react-native` (`react-native-svg`) — replaced the emoji-glyph icons `M1-T13` |
| OTP input | `react-native-otp-entry` — replaced a hand-rolled 6-`TextInput` array `M2-T7` |
| Auth backend | `Saheli-Backend.postman_collection.json` (repo root) — see "Getting started" below, the app needs it reachable to get past onboarding |
| Branch | `initial-static` |
| Last verified | 2026-08-07 (`npx tsc --noEmit` passes, `M2-T8`) |

---

## Documentation map

| Document | Purpose |
| --- | --- |
| `README.md` (this file) | Product story, what actually works today, how to run |
| `AI_CONTEXT.md` | Single-source context brief for AI agents starting a session |
| `docs/ARCHITECTURE.md` | Layers, navigation, theming, i18n, storage contracts, known gaps |
| `docs/BACKLOG.md` | Milestone-based backlog tracker — the source of truth for what to build next |
| `docs/DECISIONS.md` | Decision log (why things are the way they are) |
| `agent.md` | How the AI agent works in this repo: workflow, guardrails, doc-sync duties |
| `prompts/` | Reusable prompts — session start, task kickoff, session-close doc sync |

---

## What works today (verified against source)

### Onboarding flow — now backed by a real server (`M2-T1`, 2026-08-05)
- **Language picker** (`src/app/onboarding/language.tsx`) — 6 languages (English, Hindi, Bengali, Tamil, Spanish, Arabic); selection persists to `saheli.lang` and switches the UI live.
- **Phone entry** (`src/app/onboarding/phone.tsx`) — country code pre-filled from the chosen language (`+91` for en/hi/bn/ta, `+34` for es, `+966` for ar); submitting calls the backend's `login`, falling back to `register` for a first-time number, before saving the number and moving on.
- **OTP screen** (`src/app/onboarding/otp.tsx`) — 6-digit input (`react-native-otp-entry`, `M2-T7`) with auto-advance and paste support; Verify calls the backend's `verify-otp` and shows a real inline error on a wrong code (auto-clearing the input so it's easy to retry) instead of always advancing. A returning user lands on the Dashboard after verifying; a first-time user goes to Profile setup — distinguished by whether `login` or `register` fired on the Phone screen.
- **Profile setup / edit** (`src/app/onboarding/profile.tsx`) — one screen in two modes (`isEditing`): name, phone, email, location (pre-filled from device GPS and reverse-geocoded to a real city/state name via OpenStreetMap Nominatim, `M2-T8` — still editable), emoji avatar or real photo via camera/gallery (`react-native-image-picker`). First-time setup posts to the backend's create endpoint; editing loads from and saves to the backend's details endpoint (local storage is the offline fallback while that loads), with a separate call for photo changes. Edit mode additionally shows the role picker (Household CEO / Individual — asked only here, not during first-time setup, since it has no backend field), the language grid, Sign Out (now actually clears the session), and Delete Account.
- **Session** persists to `saheli.session`; a valid session on cold start skips onboarding straight to the dashboard (`src/app/_layout.tsx`'s auth guard). No idle/absolute expiry yet — see `docs/ARCHITECTURE.md` §6.

### Home dashboard
`src/app/dashboard.tsx` — a plain-background greeting with a muted `2 Pending · 4 Due` status line, two neutral stat cards (30-day spend, medicine adherence), a wrapping grid of quick-action icon buttons (6 actions), and a bordered module list (9 tiles, `M1-T14`). A sticky AppBar fades in on scroll with a compact echo of the pending/due status. Only the **Family** row navigates; the rest are static.

### Family & sharing
`src/features/family/FamilyScreen.tsx` — member list with role badges (Owner / Editor / Viewer), permission pills, an add/edit bottom sheet (name, phone, relationship, role, four module permission toggles), and member removal. Members persist to `saheli.family_members`, seeded with three demo members.

### Design system
- Three palettes in `src/theme.ts`: Terracotta (default), Ocean Breeze, Midnight (dark).
- Shared tokens: `colors`, `spacing`, `radius`, `fonts`, `shadow`.
- Reusable components: `Button`, `Card`, `SectionHeader`, and a draggable `BottomSheet` with optional backdrop blur.
- **Palette picker** in Profile → Appearance (edit mode): tap a swatch card and the whole app restyles instantly — no restart, no remount, and the choice survives relaunch (`saheli.theme.palette`).
- **Icons** are `lucide-react-native` stroke icons tinted with palette tokens, not emoji glyphs (`M1-T13`, 2026-08-05) — only `dashboard.tsx`'s tiles and quick actions are migrated so far.

---

## What does **not** work yet

These are intentionally listed so nobody plans around them. Each is tracked in `docs/BACKLOG.md`.

- **No session expiry.** A persisted token is trusted forever — no idle timeout, no absolute expiry, and `refresh()` exists but nothing calls it yet.
- **No resend-OTP countdown or re-auth banner.**
- **No mid-session auth guard.** The guard in `_layout.tsx` only runs once, at cold start.
- **No backend or API layer outside auth/profile.** Everything else is still device-local `AsyncStorage` — see `docs/DECISIONS.md` D-012 for why auth is the one exception.
- **Most of auth still hasn't been run against a live backend.** Profile creation has, and is confirmed working end-to-end including the photo upload (`docs/DECISIONS.md` D-015, after two wrong turns — D-013, D-014 — that real backend logs each disproved). `register`/`login`/`verify-otp`/`refresh` and the profile-edit path still only match `Saheli-Backend.postman_collection.json`'s saved examples, not a live server — see `docs/ARCHITECTURE.md` §6. Separately, a **backend-side bug** (D-016, not fixable in this repo): re-creating a profile for a user that already has one 500s instead of updating or returning a clean conflict — test with a fresh phone number.
- **No AI features.** No OCR, no bill parsing, no assistant.
- **No invite lifecycle.** "Send invitation" writes a local record and shows an alert; there is no accept/decline, no real SMS, no multi-tenant isolation.
- **Family screen is English-only** — its strings are hardcoded, not routed through `i18n`.
- **Custom fonts are not bundled.** `theme.fonts` names Fraunces/DM Sans, but no font files are linked, so text renders in the platform default.
- **Midnight does not follow the OS.** Dark mode is whatever you picked; the system appearance setting is ignored (open question 6 in `docs/BACKLOG.md`).
- **Modules not started:** Medicine, Documents, Money/UPI, Vehicles, Safety SOS, Wellness, Style, Events.

---

## Getting started

Requires Node ≥ 22.11, and the standard React Native CLI environment (Android Studio / Xcode).

```sh
npm install                 # install JS dependencies
cd ios && pod install && cd ..   # iOS only, first run and after native dep changes

npm start                   # Metro bundler
npm run android             # build & run on Android
npm run ios                 # build & run on iOS
```

`react-native-svg` (pulled in by `lucide-react-native`, `M1-T13`) and `@react-native-community/geolocation` (`M2-T1`, profile location prefill) both have native code — if either was added after your last build, `pod install` and a fresh `npm run android`/`npm run ios` are required; a Metro reload alone will not pick it up.

**Onboarding needs the backend reachable** (`M2-T1`). `src/config.ts`'s `API_BASE_URL` defaults to `http://10.0.2.2:8080/api` (Android-emulator-only — that address resolves to the emulator host machine). Run the backend (`Saheli-Backend.postman_collection.json`'s target — not part of this repo) yourself, then point `API_BASE_URL` at wherever it's actually reachable from your device: an iOS simulator can use `http://localhost:8080/api` directly, a physical device needs your machine's LAN IP, and a real deployed server needs its actual URL.

Checks:

```sh
npx tsc --noEmit            # type check — must pass before any commit
npm run lint                # eslint
npm test                    # jest — 3 suites, 29 tests (app smoke test + theming)
```

---

## Source layout

```
App.tsx                     # root, wraps AppLayout in GestureHandlerRootView
index.js                    # AppRegistry entry
src/
  app/
    _layout.tsx             # NavigationContainer + native stack, RootStackParamList, auth guard
    dashboard.tsx           # home dashboard
    onboarding/
      language.tsx  phone.tsx  otp.tsx  profile.tsx   # phone/otp/profile call the real backend
  components/               # Button, Card, SectionHeader, BottomSheet
  config.ts                 # API_BASE_URL — the one place the backend URL lives (M2-T1)
  features/
    auth/
      auth.ts                # register/login/verifyOtp/refresh — real backend calls (M2-T1)
      api.ts                 # fetch wrapper, ApiError, parseAuthError (M2-T1)
    family/FamilyScreen.tsx # family module screen
  hooks/
    useTheme.ts             # used by _layout
    useThemedStyles.ts      # style factory hook — how screens read the palette
    useAuth.ts              # session hook: signedIn/pending/login/verify/logout/getAccessToken
  i18n/
    index.ts                # i18n-js setup, language listeners, LTR enforcement
    locales/{en,hi,bn,ta,es,ar}.json
  theme.ts                  # the only theme source: palettes + tokens
  utils/storage.ts          # AsyncStorage JSON helpers
__tests__/                  # App smoke test, theme mechanism, themed screens
```

The `theme/`, `styles/`, `shared/` and `family/index.ts` paths this file used to list were deleted in `M1-T1` (2026-07-30). `useAuth.ts`/`features/auth/*` were unwired stubs through `M1`; `M2-T1` (2026-08-05) made them real — see `docs/ARCHITECTURE.md` §6.

---

## Working in this repo

1. Start a session with `prompts/session-start-context-load.md`.
2. Pick the next task from `docs/BACKLOG.md` and kick it off with `prompts/backlog-task-kickoff.md`.
3. Close the session with `prompts/session-close-doc-sync.md` so the docs match the code.

Rules that apply to every change:

- Keep `npx tsc --noEmit` green.
- Add every new user-facing string to all six locale files.
- Use tokens from `src/theme.ts` — no hardcoded hex values in screens.
- Keep navigation LTR (back arrow top-left) in all languages, including Arabic.
- Update `docs/BACKLOG.md` status and the relevant docs in the same change as the code.
