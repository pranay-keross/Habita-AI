# Habita AI — AI Context Brief

> **Read this first.** It is the cold-start brief for any AI agent working on this repo — enough to be productive without the user re-explaining the project. Depth lives elsewhere; this file points you there.
>
> **Last synced:** 2026-08-24 · branch `enhancement` · after the **Saheli → Habita AI rebrand** (D-019, D-020), `M2-T2` (resend timer), `M4-T1/T2/T3/T5` (Medical Chest), **real Family & Managed Members backend integration** (D-023), **Postman-collection reconciliation** (D-024), **silent session-token refresh** (D-027), **Medchest API integration** (D-032, D-035, D-038), **Prescription document OCR** (D-037, D-040, D-041, D-042), **Medicine normalization** (D-043), **Glassmorphic System** (D-044), **CRED Minimalist Light Mode** (D-045, D-046, D-047), **CRED Dark Profile Canvas & Sub-Screens Alignment** (D-048), and **Bottom Navigation, App Launcher Icons, Animated Splash Screen, Profile Photo Sync & Medicine Resilience** (D-049) · `npx tsc --noEmit`, `npm run lint` (zero errors on modified code) and `npm test` (169 tests) all pass.
>
> **2026-08-24 addendum:** **D-049** fixed bottom navigation crash by adding missing `Button` import and route typing, generated crisp branded Habita AI launcher icons for all Android & iOS densities, built a luxury dark animated `SplashScreen` with native Android background support, fixed dashboard profile photo live sync via `GET /profile/details`, and eliminated "An unexpected error occurred" popups on entering the Medicine section with resilient fallback.

---

## 1. What this is

**Habita AI** (renamed from **Saheli**, `docs/DECISIONS.md` D-019/D-020) is an AI life assistant — finance, health, home, staff, style, and payments in one app. The audience is the household manager, with family sharing built in and six-language support from day one. `Habita AI Software Requirements Specification.md` (repo root) is the full target vision: an enterprise Spring Boot/PostgreSQL backend with 16 feature modules — none of it exists in this repo yet. This repo is the **client only**, and mostly a local-first prototype at that. Don't confuse the SRS's scope with what's actually built — `NEXT_STEPS.md` has the short version of the gap and what to do about it.

This repository is the React Native 0.86 client (CLI, not Expo). React 19.2, TypeScript 5.8, React Navigation v7 native stack, `i18n-js`, `AsyncStorage`, `lucide-react-native` icons (`react-native-svg`, `M1-T13`), `react-native-otp-entry` (`M2-T7`).

## 2. What state it is in — read this before planning anything

It is a **mostly static, front-end-only prototype, with two real exceptions: auth/profile and Family.** Screens, navigation, theming, and localization are all still device-local. Onboarding (Phone → OTP → Profile), as of `M2-T1` (2026-08-05, `docs/DECISIONS.md` D-012), calls a **real backend** — `Saheli Backend — Auth, Profile & Family.postman_collection.json` (repo root) is the contract, `docs/ARCHITECTURE.md` §6 is the full writeup. Family & Managed Members (`docs/DECISIONS.md` D-023, 2026-08-10) calls the same backend — `docs/ARCHITECTURE.md` §7. The collection file was itself renamed on disk in the same 2026-08-10 update that added the Family folder (`Saheli-Backend.postman_collection.json` → `Saheli Backend — Auth, Profile & Family.postman_collection.json`, `docs/DECISIONS.md` D-024) — it's still an external service's own exported artifact, not this repo's branding (D-019), just no longer the same filename D-019 described as unchanged. This is a real behavior change: **the app now requires a reachable backend to get past onboarding, and to use Family at all** — it no longer works fully offline for either.

Specifically, do not assume these exist — they do not:

- **Proactive session expiry.** A persisted `habita.session` token now silently refreshes itself via `refresh()` the next time `useAuth().getAccessToken()`/`getUserId()` is called after it expires (`M2-T3`, `docs/DECISIONS.md` D-027, 2026-08-11) — but there's still no idle timeout or absolute-expiry timer; an untouched app doesn't detect expiry until something asks for the token again.
- **A re-auth banner.** (`M2-T5`. The resend-OTP countdown and "Change number" link are now built, `M2-T2`.)
- **A mid-session auth guard.** `_layout.tsx` only checks once, at cold start — manually navigating mid-session with a since-expired token isn't stopped.
- **A per-module permission matrix on Family.** The real backend only has `OWNER` (creator)/`MEMBER` roles (simplified from `OWNER`/`ADMIN`/`MEMBER`/`VIEWER` by `docs/DECISIONS.md` D-039, 2026-08-18) — the old local model's `permissions: {medicines, expenses, documents, safety}` toggle grid was deleted, not kept as fake state (`docs/DECISIONS.md` D-023). There is no read-only tier at all now: every member can add (invite, managed-member) and has full Medicine access; only removing another member is gated, to the creator only.
- **Reliable "which family member is me."** `FamilyMemberResponse` has no `userId` for a non-owner row — `resolveMyMembership()` (`src/features/family/api.ts`) falls back to a best-effort name match, defaulting to a plain `MEMBER` read if it can't resolve (since D-039 this only affects whether "Remove"/"Leave" render correctly, not read/write access). A real limitation of the backend contract, not a client bug — see `docs/ARCHITECTURE.md` §7 and `docs/BACKEND_CONTEXT.md`.
- **Any API layer outside auth/profile/family.** Every other screen (dashboard, medicine's own CRUD, …) still reads and writes `AsyncStorage` directly — see `docs/DECISIONS.md` D-012/D-023 for why those two are the exceptions, not a general policy change.
- **AI / OCR / assistant features, or any of the SRS's other backend-driven modules** (pantry, wardrobe, cycle, staff, resources, dochub, expensegroups, payments, voice, wellness/CBT, …). Only Medical Chest (`medicine/`) and Family exist so far. `docs/BACKLOG.md` M4–M7 tracks the rest; build order is in `NEXT_STEPS.md`.
- **Local notification reminders for medicine doses.** `M4-T4` needs a library decision first — the rest of Medical Chest (`M4-T1`/`T2`/`T3`/`T5`) is built.
- **Most of auth confirmed against a live backend.** Profile creation — including the photo upload — is now confirmed working end-to-end against a real backend (`docs/DECISIONS.md` D-015), after two wrong turns on the multipart JSON part's Content-Type that real backend logs disproved one at a time (D-013, D-014). That same live test surfaced a backend-side bug, not fixed here (D-016): re-creating a profile for a user that already has one 500s. `register`/`login`/`verify-otp`/`refresh`, the profile-edit path, and **all of Family** are still only matched against `Saheli Backend — Auth, Profile & Family.postman_collection.json`'s saved examples, not confirmed live.

Earlier versions of this document claimed several of these were done, and were wrong. Verify before you build on top of anything.

## 3. Document map

| File | Answers |
| --- | --- |
| `README.md` | What the product is, what works today, how to run it |
| `Habita AI Software Requirements Specification.md` | Target vision — the full product/backend this repo is building toward. Not current state |
| `NEXT_STEPS.md` | Short, ordered "what to build next" |
| `docs/ARCHITECTURE.md` | How it is built — navigation, theming, i18n, storage contract, auth (§6), family (§7), **known gaps (§9)** |
| `docs/BACKEND_CONTEXT.md` | Continuing the **Spring Boot backend** (a separate project, not in this repo) — confirmed-live contract, known backend bugs, target API surface. Read this instead of re-deriving it from `docs/DECISIONS.md` D-012–D-018 |
| `docs/BACKLOG.md` | What to build next in full detail — milestones M0–M9 with task IDs |
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
src/hooks/useAuth.ts             session hook: signedIn/pending/login/verify/logout/getAccessToken/getUserId
src/features/family/             FamilyScreen.tsx, types.ts, api.ts — real backend calls (D-023), no local storage
src/features/medicine/           MedicineScreen.tsx, types.ts, medicineStore.ts — CRUD, intake log, adherence
src/components/                  Button · Card · SectionHeader · BottomSheet
src/i18n/index.ts + locales/     6 locales, LTR enforced, manual change listeners
src/theme.ts                     design tokens — 3 palettes (the only theme source)
src/hooks/useThemedStyles.ts     style factory hook — the theming entry point for screens
src/utils/storage.ts             AsyncStorage JSON helpers
jest.config.js · jest.setup.js   test harness — transform allowlist + native mocks
__tests__/                       App smoke · theme mechanism · themed screens + pattern guard
```

`M1-T1` (2026-07-30) deleted the four genuinely dead paths — `src/theme/`, `src/styles/`, `src/shared/`, `src/features/family/index.ts`. If a doc still mentions them, that doc is stale.

**Native project identifiers are unchanged by the rebrand** (`docs/DECISIONS.md` D-019): Android's package `com.sahelicli` (`android/app/src/main/java/com/sahelicli/`) and the iOS project `ios/SaheliCLI.xcodeproj` still carry the old name. Deliberate — renaming them needs Xcode/Android Studio to verify, which this environment couldn't do — not a miss.

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

**i18n.** Six locales: en, hi, bn, ta, es, ar. Every new user-facing string goes into **all six** files, namespaced by screen. `i18n-js` is not reactive, so screens call `subscribeToLanguageChanges()`, bump a `localeVersion` counter, and pass `key={localeVersion}` to their root view. Translated arrays are built inside the render body, not at module scope. The brand name inside translated strings (`onboarding.welcome`, `dashboard.greeting`, etc.) stays `Habita AI` in Latin script in every locale, including Hindi/Bengali/Tamil/Arabic — it is never transliterated (same pattern the old `Saheli` brand name used).

**Layout direction is pinned to LTR in every language, including Arabic** (`I18nManager.forceRTL(false)` on every switch). The back arrow is always a custom top-left `Pressable`. This is deliberate — `docs/DECISIONS.md` D-003.

**Navigation.** Native stack, `headerShown: false` — every screen draws its own header and handles its own `useSafeAreaInsets()`. Register new routes in `RootStackParamList` and `_layout.tsx` together. Destructive flows use `navigation.reset` to `Language`, not `goBack`.

**Storage.** Prefix `habita.` (changed from `saheli.` in the rebrand, D-019), go through `src/utils/storage.ts`, and document the key in `docs/ARCHITECTURE.md` §5. Everything on disk is JSON, and `storage.ts` is the only module that may import `AsyncStorage` (D-007) — the helpers swallow errors and return your fallback, so callers need no try/catch. Current keys: `habita.lang`, `habita.theme.palette`, `habita.user_phone`, `habita.user_profile`, `habita.session` (`M2-T1`), `habita.medicines`, `habita.medicine_intake_log` (`M4-T1`/`T2`/`T3`). **Family has no key at all** (`docs/DECISIONS.md` D-023) — always read live from the network, same shape as Profile.

**Auth.** `src/features/auth/api.ts` + `auth.ts` are the one place in the app allowed to make network calls for auth/profile (`agent.md` rule 8, narrowed by `docs/DECISIONS.md` D-012) — everything else stays `AsyncStorage`-only, except `src/features/family/api.ts` for Family (D-023, same rule, widened). `useAuth()` is a plain hook, not a Context; see `docs/ARCHITECTURE.md` §6 before touching any onboarding screen, §7 before touching `FamilyScreen.tsx`.

**Bottom sheets, not modals.** Add/edit flows use `src/components/BottomSheet.tsx` (drag-to-dismiss, optional blur backdrop), matching the Family screen.

## 6. Data models

```ts
// src/app/onboarding/profile.tsx — stored at habita.user_profile
interface UserProfile {
  name: string; phone: string; email: string;   // email added M2-T1
  role: 'household_ceo' | 'individual';
  location: string;    // pre-filled from device GPS on first setup, still editable (M2-T1)
  avatar: string; photoUri: string | null;
}

// src/features/family/types.ts — real backend shapes (D-023, relation fields D-030,
// role model simplified D-039), no storage key at all
type FamilyRole = 'OWNER' | 'MEMBER';   // OWNER = the creator, permanent, no permission matrix
type FamilyRelation = 'MOTHER' | 'FATHER' | 'SON' | /* …19 total, see types.ts's ALL_RELATIONS */ 'OTHER';
interface FamilyMember {
  id: string; name: string; role: FamilyRole;
  managed: boolean; managedMemberId: string | null;   // true = a dependent, no login of their own
  relationshipId: string | null; relatedToUserId: string | null; relatedToName: string | null;
  relation: FamilyRelation | null; reciprocalRelation: FamilyRelation | null;   // null for OWNER/managed
}
interface Family { id: string; name: string; ownerUserId: string; members: FamilyMember[] }
interface FamilyInvite {
  id: string; familyId: string; familyName: string; invitedByName: string;
  role: FamilyRole; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'; createdAt: string;
  relation: FamilyRelation; suggestedReciprocalRelations: FamilyRelation[];
}

// src/features/medicine/types.ts — stored at habita.medicines / habita.medicine_intake_log
interface Medicine {
  id: string; name: string; dosage: string;
  schedule: ('morning' | 'afternoon' | 'evening' | 'night')[];
  scheduleTimes?: Partial<Record<'morning' | 'afternoon' | 'evening' | 'night', string>>;
  stock: number | null;
  isLiquid: boolean;
}
interface IntakeLogEntry {
  id: string; medicineId: string;
  slot: 'morning' | 'afternoon' | 'evening' | 'night';
  takenAt: number;   // epoch ms
}
```

## 7. How to work here

1. Read `NEXT_STEPS.md` for the short version of what's next.
2. Start with `prompts/session-start-context-load.md`.
3. Pick a ⏳ Ready task from `docs/BACKLOG.md` and run `prompts/backlog-task-kickoff.md` with its ID.
4. Close with `prompts/session-close-doc-sync.md` so the next session can trust these docs.

Non-negotiables for every change:

- `npx tsc --noEmit` must pass.
- New strings in all six locale files.
- Tokens from `src/theme.ts`; no inline hex.
- Back arrow top-left in every language.
- Update `docs/BACKLOG.md` and any affected doc in the same change as the code.
- Never mark something done in a doc without pointing at the code that implements it.
