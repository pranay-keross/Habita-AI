# Saheli — AI Context Brief

> **Read this first.** It is the cold-start brief for any AI agent working on this repo — enough to be productive without the user re-explaining the project. Depth lives elsewhere; this file points you there.
>
> **Last synced:** 2026-08-07 · branch `initial-static` · after `M1-T3b`, `M1-T4`, `M1-T9`, `M1-T11`–`T14`, `M2-T1`/`M2-T4`/`M2-T6`–`M2-T8` (`docs/DECISIONS.md` D-013–D-018) · `npx tsc --noEmit`, `npm run lint` (zero warnings) and `npm test` (29 tests) all pass.

---

## 1. What this is

**Saheli** ("friend" in Hindi) is an AI life assistant for Indian households — finance, health, home, safety, style, and payments in one app. The audience is the household manager, with family sharing built in and six-language support from day one.

This repository is the React Native 0.86 client (CLI, not Expo). React 19.2, TypeScript 5.8, React Navigation v7 native stack, `i18n-js`, `AsyncStorage`, `lucide-react-native` icons (`react-native-svg`, `M1-T13`), `react-native-otp-entry` (`M2-T7`).

## 2. What state it is in — read this before planning anything

It is a **mostly static, front-end-only prototype, with one real exception: auth.** Screens, navigation, theming, and localization are all still device-local. Onboarding (Phone → OTP → Profile), as of `M2-T1` (2026-08-05, `docs/DECISIONS.md` D-012), calls a **real backend** — `Saheli-Backend.postman_collection.json` (repo root) is the contract, `docs/ARCHITECTURE.md` §6 is the full writeup. This is a real behavior change: **the app now requires a reachable backend to get past onboarding** — it no longer works fully offline.

Specifically, do not assume these exist — they do not:

- **Session expiry.** A persisted `saheli.session` token is trusted forever; there is no idle timeout, no absolute expiry, and nothing calls `refresh()` yet even though it exists. (`M2-T3`)
- **Resend-OTP countdown or a re-auth banner.** (`M2-T2`, `M2-T5`)
- **A mid-session auth guard.** `_layout.tsx` only checks once, at cold start — manually navigating mid-session with a since-expired token isn't stopped.
- **Any API layer outside auth/profile.** Every other screen (dashboard, family, …) still reads and writes `AsyncStorage` directly — see `docs/DECISIONS.md` D-012 for why auth is the one exception, not a general policy change.
- **AI / OCR / assistant features.** None.
- **Invite lifecycle.** "Send invitation" writes a local record and shows an alert.
- **Most of auth confirmed against a live backend.** Profile creation — including the photo upload — is now confirmed working end-to-end against a real backend (`docs/DECISIONS.md` D-015), after two wrong turns on the multipart JSON part's Content-Type that real backend logs disproved one at a time (D-013, D-014). That same live test surfaced a backend-side bug, not fixed here (D-016): re-creating a profile for a user that already has one 500s. `register`/`login`/`verify-otp`/`refresh` and the profile-edit path are still only matched against `Saheli-Backend.postman_collection.json`'s saved examples, not confirmed live.

Earlier versions of this document claimed several of these were done, and were wrong. Verify before you build on top of anything.

## 3. Document map

| File | Answers |
| --- | --- |
| `README.md` | What the product is, what works today, how to run it |
| `docs/ARCHITECTURE.md` | How it is built — navigation, theming, i18n, storage contract, auth (§6), **known gaps (§8)** |
| `docs/BACKLOG.md` | What to build next — milestones M0–M9 with task IDs |
| `docs/DECISIONS.md` | Why things are the way they are; do not relitigate |
| `agent.md` | The working agreement for AI sessions in this repo |
| `prompts/` | Session start · task kickoff · doc sync, plus module/i18n/refactor prompts |

## 4. File map

```
App.tsx · index.js               entry
src/app/_layout.tsx              NavigationContainer + native stack + RootStackParamList + auth guard
src/app/dashboard.tsx            home dashboard (scroll-driven sticky header)
src/app/onboarding/              language · phone · otp · profile — phone/otp/profile call the real backend
src/features/auth/auth.ts        register/login/verifyOtp/refresh — real backend calls (M2-T1)
src/features/auth/api.ts         fetch wrapper, ApiError, parseAuthError (M2-T1)
src/config.ts                    API_BASE_URL — the one place the backend URL lives
src/hooks/useAuth.ts             session hook: signedIn/pending/login/verify/logout/getAccessToken
src/features/family/FamilyScreen.tsx   family members, roles, permissions, bottom sheet
src/components/                  Button · Card · SectionHeader · BottomSheet
src/i18n/index.ts + locales/     6 locales, LTR enforced, manual change listeners
src/theme.ts                     design tokens — 3 palettes (the only theme source)
src/hooks/useThemedStyles.ts     style factory hook — the theming entry point for screens
src/utils/storage.ts             AsyncStorage JSON helpers
jest.config.js · jest.setup.js   test harness — transform allowlist + native mocks
__tests__/                       App smoke · theme mechanism · themed screens + pattern guard
```

`M1-T1` (2026-07-30) deleted the four genuinely dead paths — `src/theme/`, `src/styles/`, `src/shared/`, `src/features/family/index.ts`. If a doc still mentions them, that doc is stale.

## 5. Patterns you must follow

**Theme.** `colors` and `shadow` are mutable singletons mutated by `applyPalette()`. Because `StyleSheet.create` snapshots values at module load, a style block written at module scope will **not** restyle when the palette changes. Write it as a factory instead and call it from the render (D-004, D-008):

```ts
const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({ /* body unchanged — the params shadow the imports */ });

const styles = useThemedStyles(makeStyles);   // src/hooks/useThemedStyles.ts
```

All ten style-owning files are migrated (`M1-T3b`, 2026-07-31), so screens import `ThemeTokens` as a **type only** — do not import `colors` into a screen. Need a colour as a *prop* (`placeholderTextColor`, `ActivityIndicator`)? Declare it as an entry in the factory and read `styles.placeholder.color`.

A module-scope `const styles = StyleSheet.create(...)` is now a defect; `__tests__/themedScreens.test.tsx` scans `src/` and fails if one appears. **No hardcoded hex is left in any screen** (`M1-T9`/`M1-T11`) — it type-checks and lints clean but silently ignores the palette, so do not reintroduce it. Text on a `primary`-filled surface uses `textOnPrimary` / `textOnPrimaryMuted` / `textOnPrimaryAccent`, never white: Midnight's primary is a light lavender and its `textOnPrimary` is dark ink.

The palette picker is in `profile.tsx` edit mode ("Appearance"), reached from the dashboard AppBar. It is manual-only — nothing follows the OS appearance setting.

**i18n.** Six locales: en, hi, bn, ta, es, ar. Every new user-facing string goes into **all six** files, namespaced by screen. `i18n-js` is not reactive, so screens call `subscribeToLanguageChanges()`, bump a `localeVersion` counter, and pass `key={localeVersion}` to their root view. Translated arrays are built inside the render body, not at module scope.

**Layout direction is pinned to LTR in every language, including Arabic** (`I18nManager.forceRTL(false)` on every switch). The back arrow is always a custom top-left `Pressable`. This is deliberate — `docs/DECISIONS.md` D-003.

**Navigation.** Native stack, `headerShown: false` — every screen draws its own header and handles its own `useSafeAreaInsets()`. Register new routes in `RootStackParamList` and `_layout.tsx` together. Destructive flows use `navigation.reset` to `Language`, not `goBack`.

**Storage.** Prefix `saheli.`, go through `src/utils/storage.ts`, and document the key in `docs/ARCHITECTURE.md` §5. Everything on disk is JSON, and `storage.ts` is the only module that may import `AsyncStorage` (D-007) — the helpers swallow errors and return your fallback, so callers need no try/catch. Current keys: `saheli.lang`, `saheli.theme.palette`, `saheli.user_phone`, `saheli.user_profile`, `saheli.family_members`, `saheli.session` (`M2-T1`).

**Auth.** `src/features/auth/api.ts` + `auth.ts` are the one place in the app allowed to make network calls (`agent.md` rule 8, narrowed by `docs/DECISIONS.md` D-012) — everything else stays `AsyncStorage`-only. `useAuth()` is a plain hook, not a Context; see `docs/ARCHITECTURE.md` §6 before touching any onboarding screen.

**Bottom sheets, not modals.** Add/edit flows use `src/components/BottomSheet.tsx` (drag-to-dismiss, optional blur backdrop), matching the Family screen.

## 6. Data models

```ts
// src/app/onboarding/profile.tsx — stored at saheli.user_profile
interface UserProfile {
  name: string; phone: string; email: string;   // email added M2-T1
  role: 'household_ceo' | 'individual';
  location: string;    // pre-filled from device GPS on first setup, still editable (M2-T1)
  avatar: string; photoUri: string | null;
}

// src/features/family/FamilyScreen.tsx — authoritative; stored at saheli.family_members
interface FamilyMember {
  id: string; name: string; phone: string;
  relation: string;                       // Self | Spouse | Parent | Child | Staff
  role: 'owner' | 'editor' | 'viewer';
  avatar: string;                         // emoji
  permissions: { medicines: boolean; expenses: boolean; documents: boolean; safety: boolean };
}
```

## 7. How to work here

1. Start with `prompts/session-start-context-load.md`.
2. Pick a ⏳ Ready task from `docs/BACKLOG.md` and run `prompts/backlog-task-kickoff.md` with its ID.
3. Close with `prompts/session-close-doc-sync.md` so the next session can trust these docs.

Non-negotiables for every change:

- `npx tsc --noEmit` must pass.
- New strings in all six locale files.
- Tokens from `src/theme.ts`; no inline hex.
- Back arrow top-left in every language.
- Update `docs/BACKLOG.md` and any affected doc in the same change as the code.
- Never mark something done in a doc without pointing at the code that implements it.
