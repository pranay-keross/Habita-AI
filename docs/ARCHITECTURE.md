# Habita AI — Architecture

**Status:** reflects the codebase as of 2026-08-18, branch `initial-static`, after `M2-T1`–`M2-T2` (`docs/DECISIONS.md` D-012–D-018), the Saheli → Habita AI rebrand (D-019, D-020), **M4-T1/T2/T3/T5 (Medical Chest)** (D-021), **real Family & Managed Members backend integration** (D-023, superseding M3's local model), a **Postman-collection reconciliation pass** (D-024, adding the `invites/history` endpoint), three live-tested session/storage fixes — **silent token refresh** (D-027), **account-scoped local data no longer leaking across sign-in/sign-out** (D-028), and a **validated boot guard plus correct phone/photo/language sourcing on Profile edit and Dashboard** (D-029) —, the multi-profile Medchest switcher (D-038, 2026-08-17), and **D-039 (2026-08-18): Family's role model collapsed from `OWNER/ADMIN/MEMBER/VIEWER` to `OWNER` (creator) / `MEMBER`, the Medicine delete endpoint's missing access check was fixed and wired up client-side, and the prescription-upload pipeline's `ocrStatus`/duplicate-name/feedback gaps were closed** — profile creation confirmed working end-to-end against a real backend, and Family is now a second domain talking to it, alongside auth/profile.
This document describes what exists, not what is planned. Planned work lives in `docs/BACKLOG.md`.

### Target platform vision (not this document's subject)

`Habita AI Software Requirements Specification.md` (repo root) specifies a full enterprise backend — Spring Boot 3.3/Java 21/PostgreSQL 16, dual-LLM (OpenAI + Gemini) intelligence layer, 16 feature modules across identity, health, household ledger, and global finance. **None of that backend exists in this repo.** Everything below this line describes only what is actually built in this React Native client, per this document's stated job (`agent.md` §3) — the SRS is cross-referenced, never duplicated, and its scope should not be read as current state. See `docs/BACKLOG.md` M8 for the integration path once that backend exists, and `NEXT_STEPS.md` for what to build in this client in the meantime.

---

## 1. Shape of the system

Habita AI is a **React Native client that is mostly still backend-free, with a few exceptions**: onboarding (`M2-T1`, 2026-08-05, `docs/DECISIONS.md` D-012) calls a real backend for auth and profile creation — see §6 — and Family/Managed Members (`docs/DECISIONS.md` D-023, 2026-08-10) calls the same backend for family sharing — see §7. `dashboard.tsx` also calls the profile-details endpoint, but narrowly: since `docs/DECISIONS.md` D-029 (2026-08-11) it fetches `GET /profile/details` on every focus to keep the header photo and active language in sync with the signed-in account (§6, §8) — it does not otherwise talk to a server, and still reads/writes `AsyncStorage` directly for everything else on the screen (medicine adherence, cached avatar fallback). Everything else — theming, i18n, medicine's own CRUD — still reads and writes `AsyncStorage` directly from the screen component, no server involved.

```
┌──────────────────────────────────────────────────────┐
│ index.js → App.tsx (GestureHandlerRootView)          │
│   └── src/app/_layout.tsx                            │
│         SafeAreaProvider                             │
│         NavigationContainer (initialRouteName picked │
│           after useAuth()'s boot session check)      │
│         Native Stack: Language → Phone → Otp →       │
│                       Profile → Dashboard → Family   │
└──────────────────────────────────────────────────────┘
          │                    │                  │                │
   ┌──────▼──────┐     ┌───────▼──────┐   ┌───────▼──────┐  ┌──────▼──────────┐
   │ Screens     │     │ Components   │   │ Cross-cutting│  │ Backend         │
   │ app/*       │     │ Button, Card │   │ theme.ts     │  │ (auth, profile, │
   │ features/*  │     │ SectionHeader│   │ i18n/        │  │  family)        │
   │             │     │ BottomSheet  │   │ utils/storage│  │ features/       │
   └──────┬──────┘     └──────────────┘   └───────┬──────┘  │  auth/api.ts    │
          └────────────── AsyncStorage ───────────┘         │  family/api.ts  │
                                                              └─────────────────┘
                                                          src/config.ts (API_BASE_URL)
```

There is still no state container (no Redux/Zustand/Context store) and no general API/service layer — `src/features/auth/api.ts` and `src/features/family/api.ts` are each scoped to their own domain, not a repository pattern for the whole app. Screen-local `useState` plus `AsyncStorage` remains the state model everywhere else. This was a deliberate choice for the static-design phase (`docs/DECISIONS.md` D-002); D-012 and D-023 each narrow that decision's scope rather than replacing it — D-002 itself is unchanged and still governs every other domain (dashboard, documents, money, medicine's own data, …) until each gets its own such exception.

`src/features/household/HouseholdOperationsScreen.tsx` remains a static, localized M5 overview (`M5-T0`) for unfinished domains. Its Caregiver and Resources cards open their local-first modules (`src/features/staff/`, `src/features/resources/`), each following the `types.ts` / `*Store.ts` / `*Screen.tsx` shape. Events and vehicles remain separate follow-up modules under their existing M5 task rows.

---

## 2. Navigation

**File:** `src/app/_layout.tsx`

- `createNativeStackNavigator` with `initialRouteName="Language"`.
- `headerShown: false` globally — every screen draws its own header bar and handles its own safe-area insets via `useSafeAreaInsets()`.
- `animation: 'slide_from_right'`.
- Route contract:

```ts
export type RootStackParamList = {
  Language: undefined;
  Phone: undefined;
  Otp: { isNewUser: boolean } | undefined;
  Profile: { isEditing?: boolean } | undefined;
  Dashboard: undefined;
  Family: undefined;
  Medicine: undefined;   // M4-T1
};
```

**Conventions**

- Back navigation is a custom `Pressable` with a `←` glyph, always rendered top-left, in every language (LTR is force-enforced, see §4).
- Destructive flows reset the stack rather than pop: Sign Out and Delete Account both call `navigation.reset({ index: 0, routes: [{ name: 'Language' }] })`.
- `Profile` is reached two ways: as an onboarding step (no params) and as an in-app editor (`{ isEditing: true }` from the dashboard AppBar).

**Inconsistency to be aware of:** the navigator is a *native* stack (`@react-navigation/native-stack`), but screens type their props with `StackScreenProps` from `@react-navigation/stack`. It compiles and behaves correctly, but the two packages are not the same; unify on `NativeStackScreenProps` (backlog `M1-T5`).

---

## 3. Theming

**Active file:** `src/theme.ts`

Exports three palettes — `terracotta` (default), `ocean`, `midnight` (dark) — each implementing `PaletteColors` (21 semantic color roles: `primary`, `surface`, `textPrimary`, `border`, `danger`, …), plus `spacing`, `radius`, `fonts`, and `shadow` (with a web `boxShadow` branch).

**The `textOnPrimary` trio** (`M1-T9`/`M1-T11`, 2026-07-31) exists because "text on a filled primary surface" is not a synonym for white. Midnight's `primary` is a light lavender (`#A78BFA`), so white-on-primary is unreadable there and the role resolves to a dark ink instead. Use `textOnPrimary` for labels on filled chips and role badges (`FamilyScreen.tsx`, `profile.tsx`, `language.tsx`'s active-language card); `textOnPrimaryMuted` for the secondary line under them; `textOnPrimaryAccent` for a single highlighted label within one of those. `dashboard.tsx` stopped using this trio in `M1-T14` when its `primary`-filled hero card was removed (`docs/DECISIONS.md` D-011) — check current usages with `grep textOnPrimary src -r` before assuming where it applies. `turmericSoft`, `dangerSoft` and `dangerBorder` are the tinted backgrounds that pair with `turmeric` and `danger` — they invert to dark tints in Midnight rather than staying pastel.

**How palette switching works:**

```ts
export const colors: PaletteColors = { ...palettes[0].colors };  // mutable singleton
export function applyPalette(key) { Object.assign(colors, p.colors); }  // mutates in place
```

`applyPalette` mutates the exported `colors` object rather than replacing it, so every module holding a reference sees the new values. The selected key persists to `habita.theme.palette`; `loadSavedTheme()` restores it, `saveTheme()` writes it. `src/hooks/useTheme.ts` wraps both and is consumed once, in `_layout.tsx`, to set the stack's `contentStyle.backgroundColor`.

**Runtime switching — how it works since `M1-T3a` (2026-07-30).** The blocker was that screens build styles with `StyleSheet.create({...})` at *module load*, reading `colors.x` once; mutating `colors` afterwards cannot re-create those frozen style objects, and remounting does not help because module scope is evaluated once per module load, not per mount. Styles therefore have to be built in the render path.

Three pieces make that work, with no Provider and no change to D-004's mutable singleton:

1. **An observer in `theme.ts`** — `subscribeToThemeChanges(listener)`, with `applyPalette()` notifying every listener. Deliberately the same shape as `subscribeToLanguageChanges` in §4.
2. **`src/hooks/useThemedStyles.ts`** — `useThemedStyles(factory)` subscribes via `useSyncExternalStore` (the right primitive for an external mutable store) keyed on `currentPaletteMeta.key`, and `useMemo`s the built StyleSheet so it is only rebuilt when the palette actually changes.
3. **A factory-shaped style block.** Screens keep their style block verbatim and wrap it:

```ts
const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({ /* unchanged */ });

// inside the component:
const styles = useThemedStyles(makeStyles);
```

Destructuring the factory parameter shadows the module-level imports, so the body needs no edits — the migration is about three lines per file regardless of how large the style block is.

**Migration status: complete** (`M1-T3b`, 2026-07-31). All ten files that own a style block use the factory — `dashboard.tsx`, `language/phone/otp/profile.tsx`, `FamilyScreen.tsx`, and `Button/Card/SectionHeader/BottomSheet.tsx`. No file outside `theme.ts`, `useTheme.ts` and `useThemedStyles.ts` imports the token *values* any more; screens import `ThemeTokens` as a type only, which is why the shadowing above is now invisible to `@typescript-eslint/no-shadow`.

Two things a style block cannot express, and where they went:

- **Colour props, not styles.** `placeholderTextColor` (`phone`, `profile`, `FamilyScreen`) and `ActivityIndicator`'s `color` (`Button`) take a value, not a style. Each factory declares the colour as a normal entry (`styles.placeholder.color`, `styles.label.color`) so the factory stays the one place the screen reads the palette.
- **Conditional colours.** `language.tsx`'s active-language label and `profile.tsx`'s active-role subtitle were inline `{ color: colors.blush }`; they are now `labelActive` / `roleSubActive` style keys.

**No hardcoded hex remains in any screen** (`M1-T9`/`M1-T11`, 2026-07-31). All 38 literals — 12 of them `backgroundColor: '#FFF'` on cards and inputs — are palette roles now, so Midnight no longer leaves white cards on a dark page. `npm run lint` is warning-free as a result.

**The palette picker** (`M1-T4`) lives in `profile.tsx` edit mode, under "Appearance", alongside the language grid. It maps `palettes` to three swatch cards, reads the active key from `useTheme().paletteKey`, and calls `setTheme(key)` → `saveTheme` → `applyPalette` + persist. Selecting a palette restyles the app immediately with no remount, so form state on the screen survives the switch. Palette names and descriptions are localized under `theme.*` in all six locale files; `theme.ts`'s English `name`/`description` fields are now display-unused metadata.

`useTheme()` previously held `theme` in `useState` and re-set it after a change; since `theme.colors` is the same mutable object every time, React bailed out on identity and never re-rendered — so even its one consumer (`_layout.tsx`) did not update. It now subscribes on the palette *key*, which is the value that actually changes.

**Shadows follow the palette** (`M1-T10`). `shadow.soft`/`shadow.medium` used to hardcode `#C96B5D`/`#7D3F3F` while each `Palette.shadowColor` went unread, so Midnight cast a terracotta shadow. `shadow` is now a mutable singleton rebuilt by `applyPalette` from the active palette's `shadowColor`.

`src/theme.ts` is the only theme source. The older shadowed `src/theme/` directory was deleted in `M1-T1` (2026-07-30); all 12 `../theme` imports in the repo resolve to the file.

**Fonts:** `theme.fonts` names `Fraunces_*` and `DMSans_*`, but no `.ttf` assets are bundled and there is no `react-native.config.js` asset link. All text currently renders in the platform default font. Tracked as `M1-T4`.

---

## 4. Localization (i18n)

**File:** `src/i18n/index.ts` · **Locales:** `src/i18n/locales/{en,hi,bn,ta,es,ar}.json`

- Built on `i18n-js` with `enableFallback = true` and `defaultLocale = 'en'`.
- `SUPPORTED_LANGS` carries code, English label, native label, and flag for the picker.
- The current code persists to `habita.lang`; `loadSavedLanguage()` restores it on the Language screen.
- **Layout direction is deliberately pinned to LTR.** `applyLanguage()` calls `I18nManager.allowRTL(false)` and `forceRTL(false)` on every switch, including Arabic, so back buttons and flex rows stay left-aligned and the app does not need a native restart to change language. `RTL_LANGS` is declared but not acted on. See `docs/DECISIONS.md` (D-003).

**Re-render mechanism.** `i18n-js` is not reactive, so the app uses a hand-rolled observer:

```ts
subscribeToLanguageChanges(listener)   // returns an unsubscribe fn
```

Screens subscribe, bump a `localeVersion` counter, and pass `key={localeVersion}` to their root view — remounting the subtree so `t()` re-evaluates. Translated arrays (dashboard tiles, quick actions) are therefore built inside the render body, not hoisted to module scope. Follow this pattern in new screens, or replace it wholesale (`M1-T6`).

**Coverage gap:** `FamilyScreen.tsx` uses hardcoded English strings and is not wired to `t()`. Every other screen is localized. Tracked as `M3-T1`.

---

## 5. Persistence contract

**Helper:** `src/utils/storage.ts` — `getItem<T>(key, fallback)`, `setItem<T>(key, value)`, `removeItem(key)`, `clearAll()`. All swallow errors and fall back silently; all JSON-serialize.

Since `M1-T2` (2026-07-30) this is the **only** path to storage — `src/utils/storage.ts` is the single module that imports `AsyncStorage`, and every value on disk is JSON. Because the helpers already swallow errors and return the fallback, callers do not need their own try/catch (see `loadSavedLanguage` / `loadSavedTheme`). See `docs/DECISIONS.md` D-007.

| Key | Written by | Shape | Notes |
| --- | --- | --- | --- |
| `habita.lang` | `i18n/index.ts` | JSON string (`"hi"`) | validated against `SUPPORTED_LANGS` on read; falls back to `en` |
| `habita.theme.palette` | `theme.ts` | JSON string (`"ocean"`) | validated against `palettes` on read; falls back to `terracotta` |
| `habita.user_phone` | `onboarding/phone.tsx` | JSON string | pre-fills the profile step |
| `habita.user_profile` | `onboarding/profile.tsx` | `UserProfile` JSON | read by dashboard (avatar) and profile edit |
| `habita.session` | `hooks/useAuth.ts` | `{accessToken, refreshToken, expiresIn, userId, issuedAt, phone}` JSON | added `M2-T1`/`M2-T4` (`docs/DECISIONS.md` D-012); presence of this key is what `signedIn` means — see §6 |
| `habita.medicines` | `features/medicine/medicineStore.ts` | `Medicine[]` JSON | added `M4-T2`; empty until the user adds a first medicine |
| `habita.medicine_intake_log` | `features/medicine/medicineStore.ts` | `IntakeLogEntry[]` JSON | added `M4-T3`; append-only, one entry per marked-taken dose; read by `calculateAdherence()` |
| `habita.mood_entries` | `features/wellness/wellnessStore.ts` | `MoodEntry[]` JSON | added `M4-T6`; one entry per check-in, several per day allowed; read by `averageMood`/`checkInStreak`/`moodTrend`/`topFactors` and by the CBT coach's input |
| `habita.cycle_log` | `features/cycle/cycleStore.ts` | `PeriodCycle[]` JSON | added `M4-T8`; one entry per logged period, `endDate` null while ongoing; read by `predictNextCycle()` |
| `habita.cycle_settings` | `features/cycle/cycleStore.ts` | `CycleSettings` JSON | added `M4-T8`; life stage plus the user's own cycle/period length expectations, used until enough logged cycles exist to beat them. Read through a `{...DEFAULT_CYCLE_SETTINGS, ...stored}` merge, not raw — `getItem` only falls back when the key is *absent*, so an object written by an older build would otherwise arrive missing fields added since |
| `habita.caregivers` | `features/staff/staffStore.ts` | `Caregiver[]` JSON | added `M5-T6`; local caregiver and domestic-staff profiles |
| `habita.caregiver_transactions` | `features/staff/staffStore.ts` | `CaregiverTransaction[]` JSON | extra-payment records, added after M5-T6 |
| `habita.resource_log` | `features/resources/resourceStore.ts` | `ResourceLog[]` JSON | added `M5-T9`; local delivery history |
| `habita.quick_tap_items` | `features/resources/resourceStore.ts` | `QuickTapItem[]` JSON | added `M5-T9`; user-managed dashboard delivery counters |

`clearAll()` (Delete Account) wipes **all** of the above, including language, palette, and the session — so Delete Account also signs the device out. `handleSignOut` in `profile.tsx` calls `useAuth().logout()`, which since `M2-T6` clears `habita.session` and, since `docs/DECISIONS.md` D-028 (2026-08-11), also clears the account-scoped keys below via `clearAccountData()` — `habita.user_profile`, `habita.medicines`, `habita.medicine_intake_log`, and since `M4-T6`/`M4-T8` also `habita.mood_entries`, `habita.cycle_log`, `habita.cycle_settings` — so a second phone number signing in on the same device no longer inherits the first account's cached name/photo/medicines, mood history or cycle history. The last three matter most: they are the keys where leaking data across accounts would expose someone's mood notes and period history to whoever signs in next. Device preferences (`habita.lang`, `habita.theme.palette`) are deliberately left alone, and `habita.user_phone` is left alone too (the very next onboarding screen always overwrites it). The same clearing also runs pre-emptively inside `verify()` if the cached profile's phone doesn't match the number just verified, as a safety net for sessions that went stale without an explicit sign-out.

**Family has no local storage key at all** (`docs/DECISIONS.md` D-023, 2026-08-10) — same pattern as `UserProfile`'s `GET`/`PUT` split, not the local-first pattern the rest of this table follows. `FamilyScreen.tsx` always reads live from `GET /families`/`GET /families/invites`; nothing is cached to `AsyncStorage`, so there is no `habita.family_members` key to list here or to wipe on Delete Account. The old key is gone, not renamed — a device with pre-D-023 local data simply stops reading it, the same fallback-safe shape D-007 already established for other removed/renamed keys.

**Medicine is now real-backend-when-possible, same shape as the family permission gate it already had** (`src/features/medicine/api.ts`, `docs/DECISIONS.md` D-032/D-035). `habita.medicines`/`habita.medicine_intake_log` above are still exactly what a **family-less** account uses — unchanged local-first behavior. Once a family exists, `MedicineScreen.tsx` instead reads/writes through the Medchest API (`GET/POST /families/{id}/profiles`, `GET/POST /profiles/{id}/medicines`, `PUT /medicines/{id}`, `DELETE /medicine/{id}`, `POST /medicines/{id}/intake`). `habita.medicine_intake_log` is still written in this mode too, but only to drive the "already taken today" chip — the backend has no endpoint to query intake history back, so it's the only place that fact exists client-side, even though stock/adherence themselves now come from the backend's response, not `calculateAdherence()`. **"Remove Medicine" now works in family mode too** (D-039, 2026-08-18) — the backend's `DELETE /api/medicine/{id}` existed but had zero access control (any authenticated user could delete any medicine by id, cross-family); it now requires the caller to be a member of the medicine's family, same as every other write on this domain, and the client wires it up via `deleteMedicine()`. Every family member — creator or not — has full add/edit/delete access here; there is no read-only tier on Medicine at all (`canEdit` is unconditionally `true` once a membership resolves).

**A family can have several medicine profiles, not just one for the caller** (`docs/DECISIONS.md` D-038, 2026-08-17). A horizontal profile switcher (name + category icon, 🧑/🧒/👵/👤 for `SELF`/`KID`/`ELDER`/`OTHER`) sits above the medicine list whenever a family exists; tapping a chip re-fetches that profile's medicines and documents. Creating one is a two-step "Add Profile" sheet: step one lists every `Family.members[]` row (account holders and no-login `ManagedMember` dependents alike, tagged "Dependent") plus a "Someone Else" option for a person with no account and not yet added to the family; step two asks for category and date of birth (a native calendar picker, `@react-native-community/datetimepicker`, a new dependency, D-036), plus a name field **only** for "Someone Else" — an existing member's name is always derived server-side. "Add Profile" is available to any family member (not just admins), per the collection's own documented `OWNER`/`ADMIN`/`MEMBER` write-access grant for this specific endpoint — wider than the `canEdit` gate everything else on this screen still uses.

A "Prescriptions & Documents" section (`docs/DECISIONS.md` D-037) sits below the medicine list, gated on a profile being selected (no local-storage equivalent — this app has no local document store at all): an upload banner opens the OS file browser via `@react-native-documents/picker` (a second new dependency, for picking PDFs/Word docs, not just photos — `react-native-image-picker` can't) and calls `uploadMedicalDocument` with `documentType` fixed to `"PRESCRIPTION"`, the only value confirmed anywhere in the collection. The backend runs the uploaded file through an AI extraction step (Spring AI `ChatClient`) and auto-creates `Medicine` rows from whatever it reads — this already existed before D-039, it just had three real gaps, all closed 2026-08-18: `ocrStatus` was hardcoded to `PENDING` forever and now genuinely transitions to `PROCESSED`/`FAILED` based on whether extraction succeeded; a duplicate medicine name during extraction used to throw and roll back the *entire* upload (including the file, which had nothing wrong with it) and now just skips that one medicine and keeps going; and the upload response now carries `extractedMedicineNames`, which the client uses to refresh the medicine list and show the user what was just auto-added (or a "couldn't read that prescription" message on `FAILED`) — previously there was no feedback loop at all. The document list shows each file's name, upload date, and a translated `ocrStatus` label. Read `docs/BACKEND_CONTEXT.md`'s Medchest subsection for the full contract and what's still unconfirmed (the intake `status` enum beyond `"TAKEN"`, whether `dateOfBirth` is genuinely required, `documentType`'s full enum, and whether a second profile for the same `familyMemberId` is rejected or allowed).

### Data models

```ts
// src/app/onboarding/profile.tsx
interface UserProfile {
  name: string;
  phone: string;
  email: string;          // added M2-T1 alongside real profile-create; not in earlier docs
  role: 'household_ceo' | 'individual';
  location: string;       // pre-filled from device GPS on first setup (M2-T1), still editable
  avatar: string;        // emoji
  photoUri: string | null;  // device file URI from image picker
}

// src/features/family/types.ts — real backend shapes, not a local model (D-023, role
// model simplified D-039). No AsyncStorage key: always fetched live from GET /families
// / GET /families/invites.
type FamilyRole = 'OWNER' | 'MEMBER';   // OWNER = the family creator, permanent, never reassignable

interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
  managed: boolean;              // true for a dependent (ManagedMember-backed, no login)
  managedMemberId: string | null;
}

interface Family {
  id: string;
  name: string;
  ownerUserId: string;
  members: FamilyMember[];
}

interface FamilyInvite {
  id: string;
  familyId: string;
  familyName: string;
  invitedByName: string;
  role: FamilyRole;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
}

// src/features/medicine/types.ts  (M4-T1)
interface Medicine {
  id: string;
  name: string;
  dosage: string;
  schedule: ('morning' | 'afternoon' | 'evening' | 'night')[];
  stock: number;
}

interface IntakeLogEntry {
  id: string;
  medicineId: string;
  slot: 'morning' | 'afternoon' | 'evening' | 'night';
  takenAt: number;        // epoch ms
}

// src/features/wellness/types.ts  (M4-T6 / M4-T7)
interface MoodEntry {
  id: string;
  level: 1 | 2 | 3 | 4 | 5;                 // ascending: 1 is the hardest day
  factors: ('work' | 'family' | 'sleep' | 'health' | 'money' | 'self')[];
  note: string;
  loggedAt: number;       // epoch ms
}

// The AI hook-point for M8-T4. `LocalCbtCoach` (cbtCoach.ts) is the shipping
// implementation and the permanent offline fallback; replies are i18n *keys*, not
// text, so the coaching is multi-language by construction. See D-030.
interface CbtCoach {
  readonly source: 'local' | 'remote';
  respond(input: CbtCoachInput): Promise<CbtReply>;
}

// src/features/cycle/types.ts  (M4-T8 / M4-T9)
// Dates are `YYYY-MM-DD` local-calendar strings, never epoch ms — cycleStore.ts
// normalises to local midnight before any arithmetic, which is what keeps a cycle
// from drifting by a day across a DST boundary.
interface PeriodCycle {
  id: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string | null; // null while the period is ongoing
  flow: 'light' | 'medium' | 'heavy';
  symptoms: CycleSymptom[];
  note: string;
}

interface CycleSettings {
  lifeStage: 'cycling' | 'fertility' | 'postpartum' | 'perimenopause' | 'menopause';
  averageCycleLength: number;   // default 28
  averagePeriodLength: number;  // default 5
  remindersEnabled: boolean;
}
```

`FamilyMember`/`Family`/`FamilyInvite` are defined exactly once, in `src/features/family/types.ts`, matching the real `/api/families/**` response shapes — see §7. `FamilyScreen.tsx` re-exports `FamilyMember` rather than redefining it. This replaced an earlier local-only model (`relation: 'self' | 'spouse' | 'parent' | 'child' | 'staff'`, a `permissions` matrix, `familyStore.ts` backed by `habita.family_members`) that D-023 deleted outright, not deprecated — see `docs/DECISIONS.md` D-023 for why (the real backend has no permission matrix and no `relation` concept at all).

---

## 6. Authentication

**Status:** real, as of `M2-T1`/`M2-T4`/`M2-T6` (2026-08-05), **contract verified against `Saheli Backend — Auth, Profile & Family.postman_collection.json`'s saved examples** as of a follow-up pass the same day — see `docs/DECISIONS.md` D-012/D-013 for why this domain now makes network calls when D-002 otherwise forbids it. This is the one place in the app that talks to a server. For continuing the backend itself (a separate Spring Boot project, not in this repo) — confirmed-live behavior, known backend-side bugs, and the target API surface beyond auth/profile — see `docs/BACKEND_CONTEXT.md`, not this section.

**Files:** `src/config.ts` (`API_BASE_URL`) · `src/features/auth/api.ts` (`apiFetch`, `postMultipart`, `ApiError`, `parseAuthError`) · `src/features/auth/auth.ts` (`authService`: `register`, `login`, `loginOrRegister`, `verifyOtp`, `refresh`, `logout`) · `src/hooks/useAuth.ts`. `otp.tsx`'s input widget is `react-native-otp-entry` (`M2-T7`, `docs/DECISIONS.md` D-017) — pure JS, no native rebuild.

**Backend contract.** `Saheli Backend — Auth, Profile & Family.postman_collection.json` (repo root) is the only source for this — there is no OpenAPI spec, but this version of the collection ships full saved request/response examples for every endpoint (2xx and every documented error), unlike the collection `M2-T1` originally shipped against. Endpoints used:

- `POST /auth/register {phone}` and `POST /auth/login {phone}` — both **phone-only**, both just send an OTP. Neither returns tokens. Both responses include a `devOtp` when the backend's `OTP_DEMO_MODE=true`, but the client doesn't read it — `register`/`login` return `Promise<void>` (`docs/DECISIONS.md` D-017, reversing an earlier prefill feature the user explicitly didn't want).
- `POST /auth/verify-otp {phone, code}` → `{accessToken, refreshToken, expiresIn, userId}`. `expiresIn` is milliseconds from issuance (e.g. `3600000` = 1 hour) — captured into the session (below) but not yet enforced anywhere (`M2-T3`).
- `POST /auth/refresh {refreshToken}` → same shape as verify-otp. Called transparently by `useAuth()`'s silent-refresh layer (`docs/DECISIONS.md` D-027) whenever a stored access token is expired or about to be — not something screens call directly.
- `POST /auth/logout {refreshToken?}` (Bearer token required, despite sitting under the public `/api/auth/**` path) → plain-text `"Logged out successfully"`. Blacklists both tokens server-side. Added 2026-08-13 (`docs/DECISIONS.md` D-033); `useAuth().logout()` calls it best-effort before clearing local state.
- `POST /profile/create` (multipart: `profileRequest` JSON part `{name, email, city, preferredLanguage}` + optional `profilePhoto` file part) → plain-text `"Profile Saved Successfully"`, not JSON.
- `GET /profile/details` → `{phone, name, email, preferredLanguage, active, isVerified, avatarUrl, city}`. No `role` field — confirms `role` is genuinely local-only, not an oversight. `avatarUrl` is a fresh 10-minute S3 presigned URL, not a stored key.
- `PUT /profile/details {email, preferredLanguage, city}` → plain-text `"Profile Updated Successfully"`. **No `name` field** — unlike `create`, this DTO can't rename the user.
- `PUT /profile/profilePhoto` (multipart: `profilePhoto` file part only) → plain-text `"Profile Photo Updated Successfully"`.
- `PUT /profile/deletion/request` (Bearer token, no body) → plain-text confirming a 30-day-grace-period soft-delete. Added 2026-08-13 (D-033); `profile.tsx`'s Delete Account calls this before wiping local data, and aborts the local wipe if it fails.
- `PUT /profile/deletion/revoke` — documented but **not called anywhere client-side**; see the D-033 note below for why.

**Phone format.** The backend validates a **bare 10-digit Indian mobile number** — no country code, no `+`, no spaces (`register`/`login`/`verify-otp` all 400 with `"phone: must be a valid 10-digit Indian mobile number"` otherwise). Screens still work with the display-formatted string (`"+91 98765 43210"`, `getCountryCodeForLang` also offers `+34`/`+966` for the es/ar locales); `auth.ts`'s private `toBackendPhone()` strips to the trailing 10 digits before every request. This is the one place that conversion happens — a non-Indian number will still fail the backend's validator (a real backend limitation, not something the client papers over), surfaced to the user as the generic `invalid_phone` error.

**Flow.** `phone.tsx` calls `authService.loginOrRegister(phone)` — tries `login`, and on a `not_registered` result falls back to `register`; the result (`{isNewUser}`) is forwarded via `navigation.navigate('Otp', {isNewUser})`. `otp.tsx` calls `useAuth().verify(phone, code)`, which calls `verifyOtp` and, on success, persists `{accessToken, refreshToken, expiresIn, userId, issuedAt, phone}` to `habita.session` (§5) via the existing `storage.ts` helpers — no new storage path, no `react-native-keychain`. It then navigates to `'Profile'` if `isNewUser` (first-time setup still needed) or straight to `'Dashboard'` if not (`M2-T7`, `docs/DECISIONS.md` D-017 — a returning user previously landed on Profile setup every time, since this distinction didn't exist). `profile.tsx`: on first-time setup, posts to `create`; in edit mode, loads via `GET /profile/details` (local `AsyncStorage` is the immediate/offline fallback while that resolves) and saves via `PUT /profile/details`, plus a separate `PUT /profile/profilePhoto` call only when the photo is a fresh local file (detected by `!photoUri.startsWith('http')` — an S3 URL just loaded from `GET` needs no re-upload).

**The multipart JSON part problem — resolved, confirmed live (`M2-T1`, 2026-08-07 — `docs/DECISIONS.md` D-013/D-014/D-015).** `profileRequest` needs `Content-Type: application/json` on that specific part for Spring's `@RequestPart` to pick a message converter. Two client-side approaches were live-tested against a real backend, with real server logs both times:

1. `form.append('profileRequest', JSON.stringify(profileRequest))` — a plain string. **Confirmed broken**: arrives as `Content-Type: application/octet-stream` (an RN-native default, not documented anywhere in `Libraries/Network/FormData.js` — only visible from the server side), and Spring 415s on it.
2. `form.append('profileRequest', { string: json, type: 'application/json' })` — an object, whose `.type` `getParts()` reads into the part's Content-Type header. **This is what's shipped, and it works**: a live-test backend log shows `ProfileService` correctly reading `name`/`email` from the part, then successfully uploading the photo to S3, then `"profile ... saved successfully"`.

**Profile creation itself then hit a separate, backend-side bug** on that same test (`docs/DECISIONS.md` D-016, not fixed here): re-running Create Profile for a user that already has a `user_profiles` row 500s on a Postgres unique-constraint violation, since `createProfile` inserts unconditionally rather than checking for an existing row. Testing against a fresh, never-completed phone number avoids it; fixing it needs backend changes outside this repo.

**`parseAuthError`** (`src/features/auth/api.ts`) interprets a failed request into `'not_registered' | 'already_registered' | 'invalid_phone' | 'invalid_code' | 'network' | 'unknown'`. Every 4xx in the collection's examples is a 400 or 401 with a structured `{message, ...}` body — status code alone can't distinguish "phone not registered" (login) from "phone already registered" (register) from a validation failure, since they're all 400 — so this matches on the `message` string, not just the status. Every screen branches on this enum, never on a raw status or body, so a wrong mapping is a one-function fix.

**`useAuth()` is a plain hook, not a Context.** Each caller gets its own local `session`/`pending` state, backed by the same `habita.session` key — deliberate, not an oversight. Nothing today needs `signedIn` to update reactively *across* components mid-session, since navigation only ever moves forward through explicit `navigate()` calls (Phone → Otp → Profile → Dashboard); `_layout.tsx` reads it exactly once, at boot.

**Auth guard.** `_layout.tsx` calls `useAuth()` and renders a themed loading `View` (`styles.loading`, via the same `useThemedStyles` factory pattern every screen uses) while `pending`, then mounts `Stack.Navigator` with `initialRouteName={signedIn ? 'Dashboard' : 'Language'}`. Since `docs/DECISIONS.md` D-029 (2026-08-11), the boot check that sets `pending: false` actually validates the stored session through the same `getValidSession()` refresh-or-clear logic every screen's `getAccessToken()` uses (`D-027`), rather than just checking that a session object exists — a long-idle reopen whose token has genuinely died now correctly boots to `Language` instead of stranding the user on Dashboard with a token that fails every request. This still only guards **cold start** — `initialRouteName` is read once by React Navigation and never revisited, so this is not a per-screen guard against a session that dies *while the app is already open* on `Dashboard`. That gap is unchanged and is still `docs/ARCHITECTURE.md` §9's known gap #1.

**Resend and change-number** (`M2-T2`, `otp.tsx`): a 30-second self-rescheduling `setTimeout` countdown (`RESEND_COOLDOWN_SECONDS`) gates a "Resend" link — while it's running, `onboarding.resend_in` shows the remaining seconds; at zero, tapping "Resend" calls the same `useAuth().login()` (i.e. `loginOrRegister`) the Phone screen calls, clears the entered code, refocuses the input, and restarts the countdown. A separate "Change number" link (`onboarding.change_number`) calls `navigation.goBack()` — the same action as the top-left back arrow, just labeled for discoverability. Neither adds a new backend call; both reuse what `M2-T1` already wired.

**Silent token refresh** (`M2-T3`, `docs/DECISIONS.md` D-027, 2026-08-11): `useAuth()`'s `getAccessToken()`/`getUserId()` now check the stored session's `issuedAt + expiresIn` before returning it, and transparently call `authService.refresh()` first if it's expired or about to be (a 30-second skew) — confirmed live: a genuinely expired token was getting a bare `403` from the backend on `PUT /profile/details` before this, now gets a real, authenticated response. A module-level in-flight-refresh guard (not per-hook-instance) coalesces concurrent callers, since every screen holds its own `session` state (`useAuth()` is a plain hook, see below) and refresh tokens are typically single-use. If the refresh token itself has also expired, the session is cleared outright rather than kept around failing forever.

**Sign-out and account deletion now call the backend, not just local storage** (`docs/DECISIONS.md` D-033, 2026-08-13). `useAuth().logout()` calls `authService.logout(accessToken, refreshToken)` — best-effort (`.catch(() => {})`), since a failed blacklist call shouldn't block the sign-out the user asked for — before the existing local-clear (`removeItem(SESSION_KEY)` + `clearAccountData()`) runs. Account deletion is a **30-day soft-delete**, not immediate: `profile.tsx`'s Delete Account now calls `PUT /profile/deletion/request` first, and unlike logout, a failure here **aborts** — `clearAll()` and the navigation reset only run on success, since proceeding after a failed request would leave the user believing their account is scheduled for deletion when it isn't. The confirmation copy (`profile.delete_account_confirm_msg`) was rewritten in all six locales to describe the actual grace-period behavior. No "cancel my pending deletion" UI exists — `PUT /profile/deletion/revoke` is documented but unreachable, since nothing in this client can currently detect that a deletion is pending (`GET /profile/details` has no such field, and the one field that's supposed to carry this, `OtpResponse.deletionPopup`, has no confirmed shape in the collection — see `docs/BACKEND_CONTEXT.md`).

**Account-scoped local data no longer leaks across sign-in/sign-out** (`docs/DECISIONS.md` D-028, 2026-08-11). `verify()` now compares the *cached profile's* phone against the phone just verified before persisting the new session — a mismatch means this device holds another account's data, and `clearAccountData()` (`habita.user_profile`, `habita.medicines`, `habita.medicine_intake_log`) runs first. `logout()` calls the same function. See §5's storage table note for the full key list this does and doesn't touch.

**Profile edit reads phone from the session, and applies the account's saved language — and so does Dashboard, on every focus** (`docs/DECISIONS.md` D-029, 2026-08-11). `useAuth()` gained `getPhone()` (mirrors `getUserId()`/`getAccessToken()`) — `profile.tsx`'s edit-mode load calls it directly rather than reading `habita.user_profile`'s cached `phone`, which only ever had a value after at least one save on that device and was rendering empty for a freshly signed-in account. That screen's live `GET /profile/details` handler now also calls `setLanguage(details.preferredLanguage)` (validated against `SUPPORTED_LANGS`) on success — previously fetched and silently discarded, so the picker (and the whole app, since `i18n`'s current locale is shared, not screen-local) kept showing the device's last language instead of the signed-in account's own saved choice. `dashboard.tsx`'s own `focus` listener (§8) now makes the same `GET /profile/details` call, applying `avatarUrl` to the header photo and `preferredLanguage` the same way — so the correct photo and language show up the moment a returning user lands on Dashboard, not only once they happen to open Profile edit. A `liveProfileLoaded` guard (same shape as `profile.tsx`'s own) keeps the local-cache read from re-clobbering a fresher live photo if it resolves second.

**What this still does not do** (tracked as separate `docs/BACKLOG.md` M2 rows, not silently dropped): no *proactive* idle/absolute expiry detection — today's refresh only fires reactively, the next time something calls `getAccessToken()`, not on a timer — and no "session expired" re-auth banner for the case where the refresh token itself has died (`M2-T5`).

**Location permission** (`profile.tsx`, first-time setup only): `@react-native-community/geolocation` gets the device's current coordinates — GPS first (`enableHighAccuracy: true`, 15s timeout, no cached fix), falling back once to the network/WiFi-based provider only if that fails (`docs/DECISIONS.md` D-034, fixing a live report of a Kolkata user prefilling to California — the network provider alone, the original and only attempt, can return a badly wrong fix with no nearby WiFi/cell fingerprint to match) — then `reverseGeocode()` (same file) turns them into a real place name — `"City, State"`, falling back to just the city or Nominatim's full `display_name` if the address is sparse, and to raw `"lat, lng"` only if the lookup itself fails — and stays editable either way. Requires `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` (`android/app/src/main/AndroidManifest.xml`) and `NSLocationWhenInUseUsageDescription` (`ios/SaheliCLI/Info.plist`) — same native-rebuild caveat as `react-native-svg` in `M1-T13`: `pod install` and a fresh build are required, a Metro reload alone won't pick up the new native module. Jest has no way to reach the real module either, so `jest.setup.js` mocks it (the package ships no jest mock of its own, unlike gesture-handler/async-storage/safe-area-context — see §10).

**Reverse geocoding** (`M2-T8`, `docs/DECISIONS.md` D-018 — resolves what D-012 deliberately deferred): OpenStreetMap's Nominatim, plain `fetch`, no API key and no new dependency. Its usage policy asks for a descriptive `User-Agent` (set) and caps free usage around 1 request/second — fine for one lookup per profile setup, not something to scale up without revisiting (a paid provider or self-hosted Nominatim instance).

**Role is asked only in Profile edit mode, not first-time setup** (`M2-T8`) — it has no backend field at all (confirmed by `ProfileDetailsResponse`'s shape above), so asking for it during onboarding was friction for a purely local, changeable-later concept. `handleSaveProfile` still writes whatever `role` currently holds (default `'household_ceo'`) to `habita.user_profile` on every save, onboarding included — only the picker UI is conditional on `isEditing`.

---

## 7. Family & Sharing

**Status:** real, as of `docs/DECISIONS.md` D-023 (2026-08-10), with the collection's `invites/history` endpoint added 2026-08-11 (D-024) and relation tracking added 2026-08-13 (D-030). Every endpoint in the collection's Family folder is now implemented client-side. Only matched against `Saheli Backend — Auth, Profile & Family.postman_collection.json`'s saved examples so far, **not run against a live server in this session** — unlike auth/profile (§6), nothing here carries a "confirmed live" claim yet. See `docs/BACKEND_CONTEXT.md` for the full contract table and known gaps.

**Files:** `src/features/family/api.ts` (`createFamily`, `listMyFamilies`, `getFamily`, `inviteMember`, `listRelationOptions`, `listMyPendingInvites`, `acceptInvite`, `declineInvite`, `listFamilyPendingInvites`, `cancelInvite`, `listFamilyInviteHistory`, `listRelationships`, `getRelationship`, `updateRelationship`, `removeMember`, `addManagedMember`, `removeManagedMember`, plus `getMyPrimaryFamily`/`resolveMyMembership`/`getMyProfileName` helpers and `parseFamilyError`) · `src/features/family/types.ts` (`Family`, `FamilyMember`, `FamilyInvite`, `FamilyRole`, `FamilyRelation`, `FamilyRelationship`, `ALL_RELATIONS`) · `src/features/family/FamilyScreen.tsx`. Reuses `apiFetch`/`ApiError` from `src/features/auth/api.ts` — the fetch wrapper is domain-agnostic, so Family did not need its own. (`updateMemberRole` was removed in D-039 — with only `OWNER`/`MEMBER` left and `OWNER` immutable, there was nothing left to change a role to.)

**Relation tracking** (`D-030`, 2026-08-13). Every User-backed non-owner member now carries who they're related to and how: `relation` is set by the inviter on `Invite Member` (a required chip picker, `family.label_relation`, populated from `GET /families/relations` — a static 19-value enum, `FamilyRelation` — falling back to `types.ts`'s `ALL_RELATIONS` mirror if that fetch fails), `reciprocalRelation` is set by the invitee on Accept, via a dedicated "Accept Invitation" bottom sheet (accepting is no longer a single tap) showing the invite's `suggestedReciprocalRelations` as visually-accented (not restricted) quick picks alongside the full 19-value list. Both values live on the `FamilyMember` row for display and on a separate `FamilyRelationship` resource (its own `id`, distinct from the member row) so an admin can correct a wrong pick later without touching membership — surfaced as an optional section in the edit-member sheet, shown only when `member.relationshipId` is non-null (i.e. never for the `OWNER` or a managed member, neither of which has one). Managed Members are unaffected — they still use the pre-existing free-text `relationship` string (see below), a different field entirely.

**Every member card is tappable, not just the ones an admin can edit** (same-day D-030 follow-up, 2026-08-13). Tapping now branches in `handleMemberPress`: an admin tapping a non-owner member still opens the edit sheet; everyone else — a non-admin `MEMBER` (the common case for an invite recipient), or anyone tapping the `OWNER` row — opens a new read-only "View Member" sheet (`family.sheet_title_view`). Before this, the member list's `Pressable` was disabled outright for a non-admin viewer, so nothing was reachable by tapping it.

**Relation display is relative to the current viewer, not a literal echo of the row's own fields** (second same-day D-030 follow-up, 2026-08-13). `member.relation`/`relatedToName` describe one directed edge — recorded once, on the *accepted invitee's own row* — so echoing them directly only ever labels a member correctly from their inviter's point of view; the inviter's own row (often the `OWNER`) has no relation fields at all, since nobody accepted an invite to become them. `getDisplayRelation(member)` in `FamilyScreen.tsx` computes what to show instead: `null` for your own card; `member.relation` when you invited them (`member.relatedToUserId === myUserId`, a new piece of state from `getUserId()`); your own `reciprocalRelation` when the card is the `OWNER` and *you* were invited by them (`myMembership.member.relatedToUserId === family.ownerUserId`) — borrowing the other half of the same edge so the inviter's card isn't blank; `null` otherwise. Rendered as a compact badge next to the name (just the relation word, e.g. "Brother") and, in the View Member sheet, a single labeled value — omitted entirely, no fallback text, when unresolvable. This only resolves "who invited me" for an `OWNER` inviter, since non-owner `FamilyMemberResponse` rows still carry no `userId` to match against (the identity-resolution gap below) — a member invited by a non-owner `ADMIN` still sees no badge on that admin's card.

**Invite history** (`D-024`, 2026-08-11): an admin-only, collapsed-by-default "Invite history" section beneath the pending-invites panel — `GET /families/{id}/invites/history` is fetched lazily on first expand (not on every screen load, since it's admin-only and rarely needed), and lists every invite ever sent for the family with a status-colored badge (`family.status_pending/accepted/declined/cancelled`, all six locales). Unlike `listFamilyPendingInvites`, the backend does not filter this by status.

**The screen's initial load no longer alerts on failure** (`D-025`, 2026-08-11). `reload()` takes an optional `{silent}` flag: the mount effect calls `reload({silent: true})`, and on failure sets a `loadError` state instead of calling `showError`'s `Alert.alert` — rendered as an inline "Couldn't load your family" card (same visual language as the create-family empty state) with a "Try Again" button that re-runs the silent reload. The most common trigger in practice is simply no backend being reachable, and greeting the user with a modal alert the instant they open the screen read as a bug, not a status. Every other call site (create/invite/accept/decline/cancel/save-role/remove/leave) still calls `reload()` without `silent` and still alerts on failure — those are direct responses to something the user just tapped, where a modal is the right amount of interruption.

**Invite vs. Add Dependent is explained inline, not just separated** (`D-026`, 2026-08-11). Both bottom sheets carry a `sheetInfoBox` callout above their fields — the Invite sheet's explains a phone-identified request goes to the invitee's own account for them to accept; the Add Dependent sheet's explains the opposite (no account, no request, attached immediately). The Add Dependent sheet's submit button was also relabeled from the shared `family.send_invitation` string (which it had been reusing, contradicting its own callout) to a dedicated `family.add_dependent_btn`.

**No local storage key.** Unlike every other domain module in this app, Family has nothing in the §5 table — it is always read live from `GET /families` and `GET /families/invites`, the same "network is the source of truth" shape §6 already established for Profile, not the local-first-with-a-storage-key shape everything else in §5 follows.

**Roles are `OWNER` (the family creator) / `MEMBER`, not a tiered `owner`/`admin`/`member`/`viewer` hierarchy** (`docs/DECISIONS.md` D-039, 2026-08-18, replacing the `OWNER`/`ADMIN`/`MEMBER` model D-023 originally shipped — the backend had also quietly grown an unused fourth `VIEWER` value that D-039 removed along with `ADMIN`). `OWNER` is assigned once at family creation and is permanent — no endpoint can reassign it, and the creator can never be removed or demoted by anyone, including themselves. Every other member is a plain `MEMBER`, and the split is now purely **add vs. remove**, not a read/write tier: any member — creator or not — can invite new members, add a managed (dependent) member, view every pending invite and the invite history, and correct a relationship; only the creator can remove another member or a managed member; any non-creator member can remove *themselves* (leave). **There is still no per-module permission matrix on this backend** — `docs/DECISIONS.md` D-023 records the original decision to drop the client's old `permissions: {medicines, expenses, documents, safety}` concept entirely rather than fake it locally, and D-039 carries that forward: Medicine grants full add/edit/delete access to every family member with no exceptions.

**Invite flow is real cross-account consent, not a same-device toggle.** `POST /families/{id}/members {phone, role}` creates a `PENDING` `FamilyInvite` for an **already-registered** user — it does not attach them as a member. That person must accept or decline it themselves, from their own session (`POST/GET .../invites`, `.../accept`, `.../decline`) — `FamilyScreen.tsx` fetches `GET /families/invites` on every load to show invites addressed to the current user, independent of whether they have a family of their own yet. The inviter never gets to set the invitee's name — it comes from the invitee's own account once they accept.

**A user can belong to zero or many families** (`GET /families` returns a list) — the client only supports one at a time (`getMyPrimaryFamily()` takes `families[0]`), with a create-family empty state (`family.no_family_title`, `POST /families`) when the list is empty. No family switcher exists; picking a second family isn't reachable from the UI at all.

**Identity resolution is a real, working, but honestly fragile heuristic.** `FamilyMemberResponse` carries no `userId` for a non-owner row — the only unambiguous match is `Family.ownerUserId === useAuth().getUserId()`. For a non-owner, `resolveMyMembership()` (`src/features/family/api.ts`) falls back to matching the caller's own cached `habita.user_profile` name against the member list; if that doesn't resolve, it defaults to a plain `MEMBER` read (`isCreator: false`) rather than guessing. Since D-039 this only costs the ability to leave or to be shown "Remove" on others (both creator-gated) — Medicine's `canEdit` no longer depends on this resolution at all, since every member gets full access there regardless. `FamilyScreen.tsx` still uses it to decide whether to show a "Remove" action on another member's row. Documented as a real backend contract gap in `docs/BACKEND_CONTEXT.md` — a `userId` per member, or a dedicated "my membership" endpoint, would remove the guesswork.

**Self-service "leave family" now works for any non-creator member** (D-039, 2026-08-18 — previously `DELETE /families/{id}/members/{id}` required admin access on the *caller*, so a plain `MEMBER` had no way to remove themselves at all). `removeMember` now allows the request when the acting member either **is** the creator (removing anyone else) or **is removing themselves** — never when a non-creator member targets someone other than their own row, and never when the target is the creator. `FamilyScreen.tsx` renders "Leave Family" for any resolved member except the `OWNER`.

**Managed Members** (dependents — children, elderly parents, anyone without their own login) are real (`POST/DELETE .../managed-members`), closing what was tracked as `M2-T9`. `relationship` is a free-text string on the backend (`"Mother"`, `"Grandfather"`, …), not an enum — the client's `label_relationship`/`placeholder_relationship` fields reflect that; there is no fixed relation picker the way the old local model had. Removing a managed member (`removeManagedMember`) is distinct from removing a regular member (`removeMember`): it takes `managedMemberId`, not `familyMemberId`, and also deactivates the underlying dependent record, not just the family link.

**Errors.** `parseFamilyError()` (`src/features/family/api.ts`) mirrors `parseAuthError`'s message-matching shape (§6) — every 4xx here is also a 400 or 401 with a structured `{message, ...}` body, so status code alone can't distinguish "not found" from "no permission" from "already a member." Buckets into `not_found | no_permission | phone_not_registered | already_member | family_full | network | unknown`, each mapped to a localized `family.error_*` string.

---

## 8. UI component system

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `components/Button.tsx` | primary CTA, token-styled |
| `Card` | `components/Card.tsx` | renders `Pressable` when `onPress` is given, else `View` |
| `SectionHeader` | `components/SectionHeader.tsx` | title + subtitle pair |
| `BottomSheet` | `components/BottomSheet.tsx` | `Modal` + `Animated` + `PanResponder`; drag-to-dismiss (>120px or velocity >0.6), only when the inner scroll is at the top; `@react-native-community/blur` loaded through a `try/require` so a missing native module degrades gracefully instead of crashing; content wrapped in `KeyboardAvoidingView` (`docs/DECISIONS.md` D-034) since Android's `Modal` renders its own Dialog window that doesn't inherit the Activity's `windowSoftInputMode="adjustResize"` — every other screen gets that for free, Modals don't |

Screens still define most of their own `StyleSheet` blocks locally. Only `Card`, `SectionHeader` and `BottomSheet` are reused across screens. Import them from `src/components/` directly — the `src/shared/components/index.ts` re-export barrel was deleted in `M1-T1` (2026-07-30).

**Icons** (`M1-T13`, 2026-08-05, `docs/DECISIONS.md` D-010) — `dashboard.tsx` renders `lucide-react-native` stroke icons instead of emoji, imported per-icon (`lucide-react-native/icons/pill`, not the package barrel) so Metro doesn't bundle the full icon set. Icon color is read from the same style factory as everything else (`styles.moduleIconColor.color`, `styles.actionIconColor.color`), so it follows the palette. `WellnessScreen.tsx` and `CycleScreen.tsx` (`M4-T6`/`M4-T8`) follow the same convention, exposing icon colors as `styles.iconAccent.color` / `styles.iconOnPrimary.color` / `styles.iconMuted.color`. `FamilyScreen.tsx` and `MedicineScreen.tsx` still render emoji or plain text glyphs.

**Responsive layout** (`M4-T6`/`M4-T8`, 2026-08-20, `docs/DECISIONS.md` D-030) — `src/hooks/useResponsive.ts` is the one place that turns window size into layout numbers. It reads `useWindowDimensions()` (built into React Native — no new dependency) and returns `scale(size)`, `font(size)`, `columns(minItemWidth)`, `columnWidth(n, gap, padding)`, `contentWidth`, `contentMaxWidth` and the `isCompact`/`isExpanded` size classes.

The division of labour matters: **`useThemedStyles` owns colour, type and spacing tokens; `useResponsive` owns window-dependent numbers, applied as inline overrides on top of a themed style.** The style-factory signature stays `(tokens: ThemeTokens) => StyleSheet`, so §11's convention and `themedScreens.test.tsx`'s source-scan guard both still hold. Scaling is relative to a 390dp base, clamped so an ordinary phone gets exactly the values already tuned by hand; type is clamped much harder than boxes (0.94–1.1 vs 0.86–1.24), and the OS font-scale setting is deliberately not read — `Text` applies it on top, and applying it twice is what makes accessibility-sized text overflow. Only the two `M4` screens use it so far; earlier screens are unchanged and still fixed-width.

### Signature interaction: the dashboard scroll header

`dashboard.tsx` drives two interpolations from one `Animated.Value` bound to `onScroll`:

| Interpolation | Input range | Effect |
| --- | --- | --- |
| `appbarBgOpacity` | 0 → 60 | sticky AppBar background fades in |
| `appbarPillOpacity` / `TranslateY` | 10 → 60 | compact `2 Pending · 4 Due` pill rises and fades in |

`useNativeDriver: false` is required because `backgroundColor`/layout properties are animated. Keep that in mind before adding more animation to this screen.

**`M1-T14` (2026-08-05) removed the scaling/fading hero card** that used to own this section — see `docs/DECISIONS.md` D-011. The greeting is now plain text directly on `colors.background`, and there is nothing left that needs a scroll-driven scale/opacity transform, so `heroCardScale`/`heroCardOpacity` (and the ranges tuned for them in `M1-T12`) no longer exist. The AppBar's fade-in ranges were tightened (`80`→`60`, `30–90`→`10–60`) to match — the trigger content is shorter now (a text block, not a tall filled card), so the transition needed to start and finish sooner to still feel tied to what's scrolling past it.

**Entrance animation cut back to one fade, not a cascade (2026-08-11, D-025).** Every mount previously fired 18 separate staggered `FadeInDown.springify()` entrances — the greeting, the stat-cards row, each of the 6 quick actions (40ms apart), and each of the 10 module rows (30ms apart) — direct user feedback called this "too much animation." Only one `Animated.View` remains, wrapping the greeting + stat cards together in a single 280ms fade with no spring/bounce and no per-item delay; quick actions and module rows render as plain `View`/`Pressable` with no entrance animation at all. The scroll-driven AppBar fade above is unchanged — it is functional (it's what makes the sticky header appear), not decorative, and wasn't part of the complaint.

---

## 9. Known gaps and technical debt

Ordered by how much they will hurt later. All are tracked in `docs/BACKLOG.md`.

1. **Auth is real but partial.** `M2-T1`/`M2-T4`/`M2-T6` (§6) wired register/login/verify-otp against a real backend and added a cold-start auth guard; `M2-T2` added the resend-OTP countdown and change-number link; `M2-T3`'s silent refresh landed 2026-08-11 (D-027). Still missing: *proactive* idle/absolute expiry detection (refresh today is reactive, not timer-driven) and a "session expired" re-auth banner for a refresh token that's itself died. Also still missing: a *mid-session* guard — the cold-start check only runs once at boot, so nothing stops in-app navigation to `Dashboard` if a token has since expired. (`M2-T3`, `M2-T5`)
2. **No proactive session expiry.** A persisted access token now silently refreshes itself on next use if expired (`M2-T3`, D-027) rather than being trusted forever, but nothing checks on a timer — an idle app doesn't detect expiry until something calls `getAccessToken()` again. (`M2-T3`)
3. **Theming is complete for the screens that exist** (`M1-T3b`, `M1-T4`, `M1-T9`, `M1-T11`). What is left is a product question, not a gap: Midnight is manual-only and does not follow the OS appearance setting (`docs/BACKLOG.md` → Open question 6). (§3)
4. **Most of auth's backend contract is still matched against saved examples, not confirmed live.** `Saheli Backend — Auth, Profile & Family.postman_collection.json` ships full request/response examples for every endpoint, and `parseAuthError` (§6) is written to match them exactly. Profile creation specifically *is* now confirmed working end-to-end against a live backend, including the photo upload (`docs/DECISIONS.md` D-015) — that live test also surfaced a backend-side bug, not fixed here (D-016): re-creating a profile for a user that already has one 500s instead of updating or returning a clean conflict. `register`/`login`/`verify-otp`/`refresh` and the profile-edit path (`PUT /profile/details`, `PUT /profile/profilePhoto`) still haven't been run live.
5. **Fonts not bundled** — the visual design in the palette definitions is not what renders. (`M1-T4`)
6. **Two navigation typing sources** (`native-stack` navigator vs `stack` prop types). (`M1-T5`)
7. **Test coverage is theming plus one smoke test** — `__tests__/App.test.tsx`, `theme.test.tsx`, `themedScreens.test.tsx` (34 tests). No storage, i18n, or interaction tests, and no React Native Testing Library. The harness itself was repaired in `M1-T1` (2026-07-30) — see §10. (`M9-T1`)
8. **One dashboard number is still hardcoded** — `₹12,450` (30-day spend) in the dashboard stat card. `2`/`4` in the greeting's `Pending`/`Due` status line are also still placeholders, pending `M5-T11`'s Events module and `M6-T3`'s spend rollup. Medicine adherence (the card next to it) went live in `M4-T3`.
9. **Family's "which member is me" is a name-match heuristic, not a real identity lookup** (§7, `docs/DECISIONS.md` D-023). `FamilyMemberResponse` has no `userId` for a non-owner row, so `resolveMyMembership()` falls back to matching the caller's own cached profile name — wrong if two members share a display name, or if the caller renamed since joining (falls back to a plain `MEMBER` read in that case, not a crash, but still not a correct answer — since D-039 this only affects whether "Remove"/"Leave" render, not read/write access anywhere). Fixing this needs a backend change (a `userId` per member, or a "my membership" endpoint) — see `docs/BACKEND_CONTEXT.md`.
10. **No multi-family switcher.** The backend supports a user belonging to several families; the client only ever shows `families[0]` (`getMyPrimaryFamily()`). Joining a second family (by accepting an invite) works, but there is no UI to switch to it afterward. (§7)

Resolved this pass, kept here as a record rather than silently deleted:

- ~~Family screen not localized~~ — done, `M3-T1`, then rebuilt against the real backend in `M8-T3`/D-023 with a fresh localization pass.
- ~~Tile navigation is string-matched~~ — done, `M1-T7`: `dashboard.tsx`'s `tiles`/`quickActions` now carry a stable `id`, and `handleTilePress`/`handleActionPress` route on it instead of `tile.title`.
- ~~Family's "Modules Synced" stat was a fake local registry~~ — moot as of D-023: the stat (and the whole permission-matrix concept it measured) was removed, not fixed, since the real backend has no permission matrix to synchronize.
- ~~No self-service "leave family" for a plain `MEMBER`~~ — done, D-039 (2026-08-18): `removeMember` now allows any member to remove themselves, not just the creator.
- ~~Medicine's `DELETE` endpoint had no access control and wasn't wired up client-side~~ — done, D-039: secured with the same `requireWriteAccess` check every other Medicine write already used, and `MedicineScreen.tsx` now calls it in family mode.

---

## 10. Test harness

**Files:** `jest.config.js` · `jest.setup.js` · `__tests__/`

`npm test` runs jest on the `@react-native/jest-preset` preset. Two pieces of configuration are required for a test that renders `App` to run at all, both added in `M1-T1`:

- **`transformIgnorePatterns`** — the preset only lets `react-native` and `@react-native*` through babel. Every other RN-ecosystem package in this app ships untranspiled ESM, so `@react-navigation`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`, `react-native-image-picker`, `@react-native-async-storage`, `react-native-svg` and `lucide-react-native` are added to the allowlist. `@react-native-community/datetimepicker` and `@react-native-community/geolocation` are already covered by the existing `@react-native(-community)?` group, but `@react-native-documents/picker` (`docs/DECISIONS.md` D-037) is not — its scope doesn't match that pattern, so it needed its own explicit entry, confirmed by `App.test.tsx` actually failing with a raw `export` `SyntaxError` until it was added. **Adding a new RN dependency that ships ESM means adding it here too — check the scope actually matches an existing group instead of assuming it does.**
- **`transform`** (added in `M1-T13`) — the preset's own `transform` map only matches `.js`/`.ts`/`.tsx`. That was invisible until `lucide-react-native`: its package `exports` resolve subpath imports to `.mjs` files, which cleared `transformIgnorePatterns` (correctly, it should be transformed) but then hit Jest's raw module loader anyway because nothing matched the `.mjs` extension — "Cannot use import statement outside a module." Declaring our own `transform` fixes it, but **replaces** the preset's map rather than extending it, so it re-declares the asset-file transformer too. **A dependency whose `exports` map points at `.mjs` needs this, not just the `transformIgnorePatterns` entry.**
- **`jest.setup.js`** — swaps native modules for the mocks each package ships: `react-native-gesture-handler/jestSetup`, `@react-native-async-storage/async-storage/jest`, and `react-native-safe-area-context/jest/mock`. The safe-area mock is a default-exported object while consumers use named imports, so it is unwrapped with `.default`. `@react-native-community/geolocation` (`M2-T1`) ships no jest mock of its own — despite shipping a `jest.setup.d.ts` *type* file, there's no corresponding runtime file in the published package — so `jest.setup.js` hand-rolls one (`getCurrentPosition`, etc., all `jest.fn()`). `@react-native-community/datetimepicker` (D-036) is the opposite case — it ships a real, directly-`require()`-able runtime mock at `@react-native-community/datetimepicker/jest`, wired the same way `react-native-safe-area-context`'s is. `@react-native-documents/picker` (D-037) is a third case: it *does* ship a mock, but as a `setupFiles`-style script that self-registers `jest.mock()` calls against its own deep, build-output-relative internal paths — too fragile to `require()` inline, so it got the hand-rolled treatment instead, same shape as geolocation's. **A native dependency needs one of these treatments** (or confirmation an existing `transformIgnorePatterns` group already covers its scope) **before any test can import a screen that uses it.** `App.test.tsx` renders the whole app including every registered screen (`_layout.tsx`'s `Stack.Navigator`), so it transitively imports `MedicineScreen.tsx` and `profile.tsx` — a new dependency used by either one *will* be exercised by the existing smoke test, immediately, not just "eventually" once a dedicated test exists.

`__tests__/theme.test.tsx` (added in `M1-T3a`) is the pattern to copy for behavioural tests: it mounts a component, calls `applyPalette()` **while it stays mounted**, and asserts the resolved `backgroundColor` actually changed — proving the mechanism rather than asserting it. Unmount inside `act()` before any `afterEach` that changes global state, or the reset pushes a store update into a live tree.

`theme.test.tsx` also covers `M1-T4`'s persistence criterion: `saveTheme` → reset in-memory palette → `loadSavedTheme` returns the saved key, which is what a cold start does.

`__tests__/themedScreens.test.tsx` (added in `M1-T3b`) does the same for the real files — `Card`, `Button`, `SectionHeader` and `otp.tsx` — and adds a source-scan guard: every file under `src/` is asserted not to contain a top-level `const styles = StyleSheet.create(`. That is the one form the type checker and eslint both accept and that silently breaks theming, so it is checked by reading the source rather than by rendering. `otp.tsx` is still the screen chosen to mount, though it's no longer effect-free: `M2-T2` added a self-rescheduling `setTimeout` countdown (the resend timer) that starts on mount. It's still a safe mount target because the test unmounts inside `act()` (line ~99), which runs the effect's cleanup (`clearTimeout`) before the suite moves on — no leaked timer, no new open-handle warning. `M2-T1`'s async storage read and network call still only run from the Verify button's `onPress`, which this test never triggers.

`__tests__/healthModules.test.ts` (added `M4-T6`/`M4-T8`, 2026-08-20) is the pattern for **pure-logic** tests, as opposed to the render-and-assert pattern above: it imports only from `cycleStore.ts`, `wellnessStore.ts` and `cbtCoach.ts`, renders nothing, and mocks nothing — every function under test takes `now`/`today` as an argument rather than reading the clock, which is what makes date-sensitive behaviour (leap days, month boundaries, a late period, a streak that survives midnight) testable without fake timers. `M4-T8`'s acceptance criterion asked for exactly this.

Current run (2026-08-20): 4 suites, 80 tests, all passing — up from 34 because `healthModules.test.ts` adds 38, and `themedScreens.test.tsx`'s per-file source-scan guard generates one more test for each of the 8 new files under `src/` (`hooks/useResponsive.ts`, `features/wellness/{types,wellnessStore,cbtCoach,WellnessScreen}`, `features/cycle/{types,cycleStore,CycleScreen}`). Both pre-existing warnings still appear and are still tracked as `M9-T8a`/`M9-T8b` — they come from `App.test.tsx`'s smoke test, not the new suite.

Previous run (2026-08-10): 3 suites, 34 tests, all passing — up from 29 because `themedScreens.test.tsx`'s source-scan guard (`it.each(sourceFiles(SRC)...)`, above) generates one test per `.tsx?` file under `src/`; `M3-T4`/`M4-T1` originally added five (`family/types.ts`, `family/familyStore.ts`, `medicine/types.ts`, `medicine/medicineStore.ts`, `medicine/MedicineScreen.tsx`), and D-023's Family backend integration swapped `family/familyStore.ts` for `family/api.ts` — net file count unchanged, so the total is still 34. Jest still reports `A worker process has failed to exit gracefully` — `@react-navigation/native`'s `useLinking` timer stays pending because the smoke test never unmounts (`M9-T8b`). The React `act()` warning previously recorded here **did not reproduce**, on this tree or on a stashed-clean one; treat it as timing-dependent rather than fixed (`M9-T8a`). `M2-T1` added a second candidate for this warning — `_layout.tsx`'s `useAuth()` boot check resolves its `getItem` promise asynchronously, same shape as the language-loading pattern already tolerated here — but it did not reproduce either on this run.

---

## 11. Conventions for new code

- **Screens** go in `src/app/` (app-level flow) or `src/features/<domain>/` (domain module). A feature folder owns its screen, its types, and its storage key.
- **Register the route** in `RootStackParamList` and `_layout.tsx` in the same change.
- **Styling:** write the style block as `const makeStyles = ({ colors, … }: ThemeTokens) => StyleSheet.create({…})` and call `useThemedStyles(makeStyles)` in the component. Import `ThemeTokens` as a type from `src/theme`; do not import the token values into a screen. Never inline hex. A module-scope `const styles = StyleSheet.create(...)` is a defect — `__tests__/themedScreens.test.tsx` fails the build if one appears.
- **Strings:** add to `src/i18n/locales/en.json` first, then all five other locale files in the same commit. Namespace by screen (`dashboard.*`, `profile.*`, `family.*`) — or by domain when the strings are not screen-specific (`theme.*`).
- **Reactivity to language:** subscribe via `subscribeToLanguageChanges` and key the root view on a `localeVersion` counter.
- **Storage:** always through `src/utils/storage.ts`, always with a `habita.` key prefix, and document the key in §5 of this file.
- **Safe area:** screens handle their own insets; the navigator has no header.
- **Responsive layout:** window-dependent numbers come from `useResponsive()` (§8) and are applied as inline style overrides. Do not put them in the themed style factory, and do not read `Dimensions.get()` at module scope — that value is captured once and never updates on rotation or split-screen.
- **Before finishing:** `npx tsc --noEmit` must pass.

---

## 12. Modern Glassmorphism & Reusable Component System (D-044)

Added in **D-044** (2026-08-23) to transform the application's visual architecture into a futuristic glassmorphic UI matching high-tech mobile design standards:

1. **Floating Modern Bottom Navigation Dock (`src/components/ModernBottomNav.tsx`):**
   - Floating dock with pill curvature (`borderRadius: 36`), frosted translucent background (`navBackground`), luminous borders (`navBorder`), and subtle drop shadow.
   - Houses 5 primary navigational nodes: **Home** (Dashboard), **Life OS** (Smart Life / Operations), **Floating Center Action Button** (AI Voice Copilot with glowing gradient circle & elevation), **Health** (Medicine / Cabinet), and **Vault** (DocHub / Expenses).
   - Responsive centering (`maxWidth: 520`) with tablet and landscape adaptation.
2. **Frosted Glass Cards (`src/components/GlassCard.tsx`):**
   - Translucent frosted glass containers with subtle glow borders (`glassBorder`), variants (`default`, `elevated`, `glow`, `accent`), and spring press physics (`withSpring`).
3. **SVG Sine Wave Data Charts (`src/components/StatWaveChart.tsx`):**
   - Interactive cubic bezier wave chart powered by `react-native-svg` showing weekly data trends, gradient fills, and highlighted node points.
4. **Squircle Quick Action Tiles (`src/components/QuickActionTile.tsx`):**
   - Glassmorphic square/squircle tiles with tinted glowing icon containers and active press scale feedback.
5. **Capsule Search Bar (`src/components/SearchPill.tsx`):**
   - Modern search & voice prompt pill with search icon and voice shortcut.
6. **Responsive Layout Container (`src/components/ResponsiveContainer.tsx`):**
   - Device and tablet-responsive wrapper applying dynamic max-width constraints (`contentMaxWidth: 640`) to maintain optimal reading widths on tablets and foldable devices.
