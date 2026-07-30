# Saheli

**Saheli** ("friend" in Hindi) is an AI-powered life assistant for Indian households — one app for finance, health, home, safety, style, and payments.

This repository (`SaheliCLI`) is the React Native 0.86 client. It is currently a **static, front-end-only prototype**: screens, navigation, theming, and localization are real; there is no backend, no authentication, and no AI integration yet. All data lives in `AsyncStorage` on the device.

| | |
| --- | --- |
| Stack | React Native 0.86 (CLI, not Expo) · React 19.2 · TypeScript 5.8 |
| Navigation | React Navigation v7 (native stack) |
| Persistence | `@react-native-async-storage/async-storage` |
| Localization | `i18n-js` — 6 languages |
| Branch | `initial-static` |
| Last verified | 2026-07-30 (`npx tsc --noEmit` passes) |

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

### Onboarding flow
- **Language picker** (`src/app/onboarding/language.tsx`) — 6 languages (English, Hindi, Bengali, Tamil, Spanish, Arabic); selection persists to `saheli.lang` and switches the UI live.
- **Phone entry** (`src/app/onboarding/phone.tsx`) — country code pre-filled from the chosen language (`+91` for en/hi/bn/ta, `+34` for es, `+966` for ar); the number is saved to `saheli.user_phone`.
- **OTP screen** (`src/app/onboarding/otp.tsx`) — 6-box input with auto-advance, backspace-to-previous, and full-code paste support.
- **Profile setup / edit** (`src/app/onboarding/profile.tsx`) — one screen in two modes (`isEditing`): name, phone, role (Household CEO / Individual), location, emoji avatar or real photo via camera/gallery (`react-native-image-picker`). Edit mode additionally shows the language grid, Sign Out, and Delete Account.

### Home dashboard
`src/app/dashboard.tsx` — scroll-driven header: the hero card scales and fades out while a sticky AppBar fades in with compact `2 Pending · 4 Due` pills and a profile button. Below it: a horizontal quick-actions strip (6 actions) and a 3-column tile grid (9 tiles). Only the **Family** tile navigates; the rest are static.

### Family & sharing
`src/features/family/FamilyScreen.tsx` — member list with role badges (Owner / Editor / Viewer), permission pills, an add/edit bottom sheet (name, phone, relationship, role, four module permission toggles), and member removal. Members persist to `saheli.family_members`, seeded with three demo members.

### Design system
- Three palettes in `src/theme.ts`: Terracotta (default), Ocean Breeze, Midnight (dark).
- Shared tokens: `colors`, `spacing`, `radius`, `fonts`, `shadow`.
- Reusable components: `Button`, `Card`, `SectionHeader`, and a draggable `BottomSheet` with optional backdrop blur.

---

## What does **not** work yet

These are intentionally listed so nobody plans around them. Each is tracked in `docs/BACKLOG.md`.

- **No OTP verification.** The Verify button navigates onward regardless of what was typed. There is no `123456` check.
- **No session lifecycle.** No idle timeout, no absolute expiry, no re-auth banner, no auth guard on the navigation stack. `src/hooks/useAuth.ts` and `src/features/auth/auth.ts` are unwired stubs.
- **No backend or API layer.** Everything is device-local `AsyncStorage`.
- **No AI features.** No OCR, no bill parsing, no assistant.
- **No invite lifecycle.** "Send invitation" writes a local record and shows an alert; there is no accept/decline, no real SMS, no multi-tenant isolation.
- **Family screen is English-only** — its strings are hardcoded, not routed through `i18n`.
- **Custom fonts are not bundled.** `theme.fonts` names Fraunces/DM Sans, but no font files are linked, so text renders in the platform default.
- **Palette switching has no UI** and would not restyle already-mounted screens (see `docs/ARCHITECTURE.md` → Known gaps).
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

Checks:

```sh
npx tsc --noEmit            # type check — must pass before any commit
npm run lint                # eslint
npm test                    # jest (currently one render smoke test)
```

---

## Source layout

```
App.tsx                     # root, wraps AppLayout in GestureHandlerRootView
index.js                    # AppRegistry entry
src/
  app/
    _layout.tsx             # NavigationContainer + native stack, RootStackParamList
    dashboard.tsx           # home dashboard
    onboarding/
      language.tsx  phone.tsx  otp.tsx  profile.tsx
  components/               # Button, Card, SectionHeader, BottomSheet
  features/
    auth/auth.ts            # stub (unused)
    family/FamilyScreen.tsx # family module screen
    family/index.ts         # stub (unused)
  hooks/
    useTheme.ts             # used by _layout
    useAuth.ts              # stub (unused)
  i18n/
    index.ts                # i18n-js setup, language listeners, LTR enforcement
    locales/{en,hi,bn,ta,es,ar}.json
  theme.ts                  # ACTIVE theme: palettes + tokens
  theme/                    # legacy tokens — shadowed by theme.ts, do not edit
  styles/onboarding.ts      # legacy styles (unused)
  shared/components/        # legacy barrel (unused)
  utils/storage.ts          # AsyncStorage JSON helpers
```

See `docs/ARCHITECTURE.md` for why the shadowed/unused paths exist and what to do about them.

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
