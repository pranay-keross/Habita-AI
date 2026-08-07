# Saheli — Architecture

**Status:** reflects the codebase as of 2026-08-07, branch `initial-static`, after `M2-T1`/`M2-T4`/`M2-T6`–`M2-T8` (`docs/DECISIONS.md` D-013–D-018) — profile creation confirmed working end-to-end against a real backend, with onboarding's returning-user routing, OTP input, role prompt, and location prefill all fixed from direct device testing.
This document describes what exists, not what is planned. Planned work lives in `docs/BACKLOG.md`.

---

## 1. Shape of the system

Saheli is a **React Native client that is mostly still backend-free, with one exception**: onboarding (`M2-T1`, 2026-08-05, `docs/DECISIONS.md` D-012) now calls a real backend for auth and profile creation — see §6. Everything else — theming, i18n, family, dashboard — still reads and writes `AsyncStorage` directly from the screen component, no server involved.

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
   ┌──────▼──────┐     ┌───────▼──────┐   ┌───────▼──────┐  ┌──────▼───────┐
   │ Screens     │     │ Components   │   │ Cross-cutting│  │ Backend      │
   │ app/*       │     │ Button, Card │   │ theme.ts     │  │ (auth only)  │
   │ features/*  │     │ SectionHeader│   │ i18n/        │  │ features/    │
   │             │     │ BottomSheet  │   │ utils/storage│  │  auth/api.ts │
   └──────┬──────┘     └──────────────┘   └───────┬──────┘  └──────┬───────┘
          └────────────── AsyncStorage ───────────┘                │
                                                          src/config.ts (API_BASE_URL)
```

There is still no state container (no Redux/Zustand/Context store) and no general API/service layer — `src/features/auth/api.ts` is scoped to auth+profile, not a repository pattern for the whole app. Screen-local `useState` plus `AsyncStorage` remains the state model everywhere else. This was a deliberate choice for the static-design phase (`docs/DECISIONS.md` D-002); D-012 narrows that decision's scope rather than replacing it — D-002 itself is unchanged and still governs every other domain (family, dashboard, documents, money, …) until each gets its own such exception.

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
  Otp: undefined;
  Profile: { isEditing?: boolean } | undefined;
  Dashboard: undefined;
  Family: undefined;
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

`applyPalette` mutates the exported `colors` object rather than replacing it, so every module holding a reference sees the new values. The selected key persists to `saheli.theme.palette`; `loadSavedTheme()` restores it, `saveTheme()` writes it. `src/hooks/useTheme.ts` wraps both and is consumed once, in `_layout.tsx`, to set the stack's `contentStyle.backgroundColor`.

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
- The current code persists to `saheli.lang`; `loadSavedLanguage()` restores it on the Language screen.
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
| `saheli.lang` | `i18n/index.ts` | JSON string (`"hi"`) | validated against `SUPPORTED_LANGS` on read; falls back to `en` |
| `saheli.theme.palette` | `theme.ts` | JSON string (`"ocean"`) | validated against `palettes` on read; falls back to `terracotta` |
| `saheli.user_phone` | `onboarding/phone.tsx` | JSON string | pre-fills the profile step |
| `saheli.user_profile` | `onboarding/profile.tsx` | `UserProfile` JSON | read by dashboard (avatar) and profile edit |
| `saheli.family_members` | `features/family/FamilyScreen.tsx` | `FamilyMember[]` JSON | seeded with 3 demo members on first read |
| `saheli.session` | `hooks/useAuth.ts` | `{accessToken, refreshToken, expiresIn, userId, issuedAt, phone}` JSON | added `M2-T1`/`M2-T4` (`docs/DECISIONS.md` D-012); presence of this key is what `signedIn` means — see §6 |

`clearAll()` (Delete Account) wipes **all** of the above, including language, palette, and the session — so Delete Account also signs the device out. `handleSignOut` in `profile.tsx` clears just `saheli.session` via `useAuth().logout()`, added `M2-T6` (previously it only reset navigation and left the token behind).

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

// src/features/family/FamilyScreen.tsx  (authoritative)
interface FamilyMember {
  id: string;            // Date.now().toString()
  name: string;
  phone: string;
  relation: string;      // 'Self' | 'Spouse' | 'Parent' | 'Child' | 'Staff'
  role: 'owner' | 'editor' | 'viewer';
  avatar: string;        // emoji derived from relation
  permissions: {
    medicines: boolean;
    expenses: boolean;
    documents: boolean;
    safety: boolean;
  };
}
```

The duplicate, thinner `FamilyMember` in `src/features/family/index.ts` was deleted in `M1-T1` (2026-07-30). The screen's definition above is the only one. `M3-T4` still applies: move it to `src/features/family/types.ts` and the storage access to `familyStore.ts`.

---

## 6. Authentication

**Status:** real, as of `M2-T1`/`M2-T4`/`M2-T6` (2026-08-05), **contract verified against `Saheli-Backend.postman_collection.json`'s saved examples** as of a follow-up pass the same day — see `docs/DECISIONS.md` D-012/D-013 for why this domain now makes network calls when D-002 otherwise forbids it. This is the one place in the app that talks to a server.

**Files:** `src/config.ts` (`API_BASE_URL`) · `src/features/auth/api.ts` (`apiFetch`, `postMultipart`, `ApiError`, `parseAuthError`) · `src/features/auth/auth.ts` (`authService`: `register`, `login`, `loginOrRegister`, `verifyOtp`, `refresh`) · `src/hooks/useAuth.ts`. `otp.tsx`'s input widget is `react-native-otp-entry` (`M2-T7`, `docs/DECISIONS.md` D-017) — pure JS, no native rebuild.

**Backend contract.** `Saheli-Backend.postman_collection.json` (repo root) is the only source for this — there is no OpenAPI spec, but this version of the collection ships full saved request/response examples for every endpoint (2xx and every documented error), unlike the collection `M2-T1` originally shipped against. Endpoints used:

- `POST /auth/register {phone}` and `POST /auth/login {phone}` — both **phone-only**, both just send an OTP. Neither returns tokens. Both responses include a `devOtp` when the backend's `OTP_DEMO_MODE=true`, but the client doesn't read it — `register`/`login` return `Promise<void>` (`docs/DECISIONS.md` D-017, reversing an earlier prefill feature the user explicitly didn't want).
- `POST /auth/verify-otp {phone, code}` → `{accessToken, refreshToken, expiresIn, userId}`. `expiresIn` is milliseconds from issuance (e.g. `3600000` = 1 hour) — captured into the session (below) but not yet enforced anywhere (`M2-T3`).
- `POST /auth/refresh {refreshToken}` → same shape as verify-otp. Exists in `auth.ts`; nothing calls it yet.
- `POST /profile/create` (multipart: `profileRequest` JSON part `{name, email, city, preferredLanguage}` + optional `profilePhoto` file part) → plain-text `"Profile Saved Successfully"`, not JSON.
- `GET /profile/details` → `{phone, name, email, preferredLanguage, active, isVerified, avatarUrl, city}`. No `role` field — confirms `role` is genuinely local-only, not an oversight. `avatarUrl` is a fresh 10-minute S3 presigned URL, not a stored key.
- `PUT /profile/details {email, preferredLanguage, city}` → plain-text `"Profile Updated Successfully"`. **No `name` field** — unlike `create`, this DTO can't rename the user.
- `PUT /profile/profilePhoto` (multipart: `profilePhoto` file part only) → plain-text `"Profile Photo Updated Successfully"`.

**Phone format.** The backend validates a **bare 10-digit Indian mobile number** — no country code, no `+`, no spaces (`register`/`login`/`verify-otp` all 400 with `"phone: must be a valid 10-digit Indian mobile number"` otherwise). Screens still work with the display-formatted string (`"+91 98765 43210"`, `getCountryCodeForLang` also offers `+34`/`+966` for the es/ar locales); `auth.ts`'s private `toBackendPhone()` strips to the trailing 10 digits before every request. This is the one place that conversion happens — a non-Indian number will still fail the backend's validator (a real backend limitation, not something the client papers over), surfaced to the user as the generic `invalid_phone` error.

**Flow.** `phone.tsx` calls `authService.loginOrRegister(phone)` — tries `login`, and on a `not_registered` result falls back to `register`; the result (`{isNewUser}`) is forwarded via `navigation.navigate('Otp', {isNewUser})`. `otp.tsx` calls `useAuth().verify(phone, code)`, which calls `verifyOtp` and, on success, persists `{accessToken, refreshToken, expiresIn, userId, issuedAt, phone}` to `saheli.session` (§5) via the existing `storage.ts` helpers — no new storage path, no `react-native-keychain`. It then navigates to `'Profile'` if `isNewUser` (first-time setup still needed) or straight to `'Dashboard'` if not (`M2-T7`, `docs/DECISIONS.md` D-017 — a returning user previously landed on Profile setup every time, since this distinction didn't exist). `profile.tsx`: on first-time setup, posts to `create`; in edit mode, loads via `GET /profile/details` (local `AsyncStorage` is the immediate/offline fallback while that resolves) and saves via `PUT /profile/details`, plus a separate `PUT /profile/profilePhoto` call only when the photo is a fresh local file (detected by `!photoUri.startsWith('http')` — an S3 URL just loaded from `GET` needs no re-upload).

**The multipart JSON part problem — resolved, confirmed live (`M2-T1`, 2026-08-07 — `docs/DECISIONS.md` D-013/D-014/D-015).** `profileRequest` needs `Content-Type: application/json` on that specific part for Spring's `@RequestPart` to pick a message converter. Two client-side approaches were live-tested against a real backend, with real server logs both times:

1. `form.append('profileRequest', JSON.stringify(profileRequest))` — a plain string. **Confirmed broken**: arrives as `Content-Type: application/octet-stream` (an RN-native default, not documented anywhere in `Libraries/Network/FormData.js` — only visible from the server side), and Spring 415s on it.
2. `form.append('profileRequest', { string: json, type: 'application/json' })` — an object, whose `.type` `getParts()` reads into the part's Content-Type header. **This is what's shipped, and it works**: a live-test backend log shows `ProfileService` correctly reading `name`/`email` from the part, then successfully uploading the photo to S3, then `"profile ... saved successfully"`.

**Profile creation itself then hit a separate, backend-side bug** on that same test (`docs/DECISIONS.md` D-016, not fixed here): re-running Create Profile for a user that already has a `user_profiles` row 500s on a Postgres unique-constraint violation, since `createProfile` inserts unconditionally rather than checking for an existing row. Testing against a fresh, never-completed phone number avoids it; fixing it needs backend changes outside this repo.

**`parseAuthError`** (`src/features/auth/api.ts`) interprets a failed request into `'not_registered' | 'already_registered' | 'invalid_phone' | 'invalid_code' | 'network' | 'unknown'`. Every 4xx in the collection's examples is a 400 or 401 with a structured `{message, ...}` body — status code alone can't distinguish "phone not registered" (login) from "phone already registered" (register) from a validation failure, since they're all 400 — so this matches on the `message` string, not just the status. Every screen branches on this enum, never on a raw status or body, so a wrong mapping is a one-function fix.

**`useAuth()` is a plain hook, not a Context.** Each caller gets its own local `session`/`pending` state, backed by the same `saheli.session` key — deliberate, not an oversight. Nothing today needs `signedIn` to update reactively *across* components mid-session, since navigation only ever moves forward through explicit `navigate()` calls (Phone → Otp → Profile → Dashboard); `_layout.tsx` reads it exactly once, at boot.

**Auth guard.** `_layout.tsx` calls `useAuth()` and renders a themed loading `View` (`styles.loading`, via the same `useThemedStyles` factory pattern every screen uses) while `pending`, then mounts `Stack.Navigator` with `initialRouteName={signedIn ? 'Dashboard' : 'Language'}`. This only guards **cold start** — `initialRouteName` is read once by React Navigation and never revisited, so this is not a per-screen guard against, say, manually navigating to `Dashboard` mid-session with an expired token. That is unchanged from before this work and is still `docs/ARCHITECTURE.md` §8's known gap #1.

**What this explicitly does not do yet** (tracked as separate `docs/BACKLOG.md` M2 rows, not silently dropped): no resend-OTP countdown (`M2-T2`), no idle/absolute session expiry or silent token refresh on 401 (`M2-T3`'s remaining half — `refresh()` exists in `auth.ts`, `expiresIn` is now captured, but nothing acts on either yet), no "session expired" re-auth banner (`M2-T5`).

**Location permission** (`profile.tsx`, first-time setup only): `@react-native-community/geolocation` gets the device's current coordinates, then `reverseGeocode()` (same file) turns them into a real place name — `"City, State"`, falling back to just the city or Nominatim's full `display_name` if the address is sparse, and to raw `"lat, lng"` only if the lookup itself fails — and stays editable either way. Requires `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` (`android/app/src/main/AndroidManifest.xml`) and `NSLocationWhenInUseUsageDescription` (`ios/SaheliCLI/Info.plist`) — same native-rebuild caveat as `react-native-svg` in `M1-T13`: `pod install` and a fresh build are required, a Metro reload alone won't pick up the new native module. Jest has no way to reach the real module either, so `jest.setup.js` mocks it (the package ships no jest mock of its own, unlike gesture-handler/async-storage/safe-area-context — see §9).

**Reverse geocoding** (`M2-T8`, `docs/DECISIONS.md` D-018 — resolves what D-012 deliberately deferred): OpenStreetMap's Nominatim, plain `fetch`, no API key and no new dependency. Its usage policy asks for a descriptive `User-Agent` (set) and caps free usage around 1 request/second — fine for one lookup per profile setup, not something to scale up without revisiting (a paid provider or self-hosted Nominatim instance).

**Role is asked only in Profile edit mode, not first-time setup** (`M2-T8`) — it has no backend field at all (confirmed by `ProfileDetailsResponse`'s shape above), so asking for it during onboarding was friction for a purely local, changeable-later concept. `handleSaveProfile` still writes whatever `role` currently holds (default `'household_ceo'`) to `saheli.user_profile` on every save, onboarding included — only the picker UI is conditional on `isEditing`.

---

## 7. UI component system

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `components/Button.tsx` | primary CTA, token-styled |
| `Card` | `components/Card.tsx` | renders `Pressable` when `onPress` is given, else `View` |
| `SectionHeader` | `components/SectionHeader.tsx` | title + subtitle pair |
| `BottomSheet` | `components/BottomSheet.tsx` | `Modal` + `Animated` + `PanResponder`; drag-to-dismiss (>120px or velocity >0.6), only when the inner scroll is at the top; `@react-native-community/blur` loaded through a `try/require` so a missing native module degrades gracefully instead of crashing |

Screens still define most of their own `StyleSheet` blocks locally. Only `Card`, `SectionHeader` and `BottomSheet` are reused across screens. Import them from `src/components/` directly — the `src/shared/components/index.ts` re-export barrel was deleted in `M1-T1` (2026-07-30).

**Icons** (`M1-T13`, 2026-08-05, `docs/DECISIONS.md` D-010) — `dashboard.tsx` renders `lucide-react-native` stroke icons instead of emoji, imported per-icon (`lucide-react-native/icons/pill`, not the package barrel) so Metro doesn't bundle the full icon set. Icon color is read from the same style factory as everything else (`styles.moduleIconColor.color`, `styles.actionIconColor.color`), so it follows the palette. No other screen has been migrated yet — `FamilyScreen.tsx` and the rest still render whatever glyphs they used before.

### Signature interaction: the dashboard scroll header

`dashboard.tsx` drives two interpolations from one `Animated.Value` bound to `onScroll`:

| Interpolation | Input range | Effect |
| --- | --- | --- |
| `appbarBgOpacity` | 0 → 60 | sticky AppBar background fades in |
| `appbarPillOpacity` / `TranslateY` | 10 → 60 | compact `2 Pending · 4 Due` pill rises and fades in |

`useNativeDriver: false` is required because `backgroundColor`/layout properties are animated. Keep that in mind before adding more animation to this screen.

**`M1-T14` (2026-08-05) removed the scaling/fading hero card** that used to own this section — see `docs/DECISIONS.md` D-011. The greeting is now plain text directly on `colors.background`, and there is nothing left that needs a scroll-driven scale/opacity transform, so `heroCardScale`/`heroCardOpacity` (and the ranges tuned for them in `M1-T12`) no longer exist. The AppBar's fade-in ranges were tightened (`80`→`60`, `30–90`→`10–60`) to match — the trigger content is shorter now (a text block, not a tall filled card), so the transition needed to start and finish sooner to still feel tied to what's scrolling past it.

---

## 8. Known gaps and technical debt

Ordered by how much they will hurt later. All are tracked in `docs/BACKLOG.md`.

1. **Auth is real but partial.** `M2-T1`/`M2-T4`/`M2-T6` (§6) wired register/login/verify-otp against a real backend and added a cold-start auth guard. Still missing: resend-OTP countdown, idle/absolute session expiry, silent refresh on an expired token (`refresh()` exists but nothing calls it), and a "session expired" re-auth banner. Also still missing: a *mid-session* guard — the cold-start check only runs once at boot, so nothing stops in-app navigation to `Dashboard` if a token has since expired. (`M2-T2`, `M2-T3`, `M2-T5`)
2. **No session expiry.** No idle timeout or absolute expiry is enforced — a persisted token is trusted until the backend itself rejects it. (`M2-T3`)
3. **Theming is complete for the screens that exist** (`M1-T3b`, `M1-T4`, `M1-T9`, `M1-T11`). What is left is a product question, not a gap: Midnight is manual-only and does not follow the OS appearance setting (`docs/BACKLOG.md` → Open question 6). (§3)
4. **Most of auth's backend contract is still matched against saved examples, not confirmed live.** `Saheli-Backend.postman_collection.json` ships full request/response examples for every endpoint, and `parseAuthError` (§6) is written to match them exactly. Profile creation specifically *is* now confirmed working end-to-end against a live backend, including the photo upload (`docs/DECISIONS.md` D-015) — that live test also surfaced a backend-side bug, not fixed here (D-016): re-creating a profile for a user that already has one 500s instead of updating or returning a clean conflict. `register`/`login`/`verify-otp`/`refresh` and the profile-edit path (`PUT /profile/details`, `PUT /profile/profilePhoto`) still haven't been run live.
5. **Family screen not localized** — breaks the 6-language promise on a shipped screen. (`M3-T1`)
6. **Fonts not bundled** — the visual design in the palette definitions is not what renders. (`M1-T4`)
7. **Two navigation typing sources** (`native-stack` navigator vs `stack` prop types). (`M1-T5`)
8. **Test coverage is theming plus one smoke test** — `__tests__/App.test.tsx`, `theme.test.tsx`, `themedScreens.test.tsx` (29 tests). No storage, i18n, or interaction tests, and no React Native Testing Library. The harness itself was repaired in `M1-T1` (2026-07-30) — see §9. (`M9-T1`)
9. **Dashboard numbers are hardcoded** — `₹12,450` and `3 Active` in the dashboard stat cards, `2`/`4` in the greeting's `Pending`/`Due` status line, and (on `FamilyScreen.tsx`, not the dashboard) `Modules Synced`. They must become derived values before the modules that own them land. (`M4`+)
10. **Tile navigation is string-matched.** `dashboard.tsx`'s `handleTilePress` routes on `title === 'Family' || title === t('dashboard.tile_family')`. The `t()` arm means it does work in every locale today, but the match is by label rather than identity, so it breaks the moment a translation is reworded and every new route needs another string comparison. Tiles need stable IDs. (`M1-T7`)

---

## 9. Test harness

**Files:** `jest.config.js` · `jest.setup.js` · `__tests__/`

`npm test` runs jest on the `@react-native/jest-preset` preset. Two pieces of configuration are required for a test that renders `App` to run at all, both added in `M1-T1`:

- **`transformIgnorePatterns`** — the preset only lets `react-native` and `@react-native*` through babel. Every other RN-ecosystem package in this app ships untranspiled ESM, so `@react-navigation`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`, `react-native-image-picker`, `@react-native-async-storage`, `react-native-svg` and `lucide-react-native` are added to the allowlist. **Adding a new RN dependency that ships ESM means adding it here too.**
- **`transform`** (added in `M1-T13`) — the preset's own `transform` map only matches `.js`/`.ts`/`.tsx`. That was invisible until `lucide-react-native`: its package `exports` resolve subpath imports to `.mjs` files, which cleared `transformIgnorePatterns` (correctly, it should be transformed) but then hit Jest's raw module loader anyway because nothing matched the `.mjs` extension — "Cannot use import statement outside a module." Declaring our own `transform` fixes it, but **replaces** the preset's map rather than extending it, so it re-declares the asset-file transformer too. **A dependency whose `exports` map points at `.mjs` needs this, not just the `transformIgnorePatterns` entry.**
- **`jest.setup.js`** — swaps native modules for the mocks each package ships: `react-native-gesture-handler/jestSetup`, `@react-native-async-storage/async-storage/jest`, and `react-native-safe-area-context/jest/mock`. The safe-area mock is a default-exported object while consumers use named imports, so it is unwrapped with `.default`. `@react-native-community/geolocation` (`M2-T1`) ships no jest mock of its own — despite shipping a `jest.setup.d.ts` *type* file, there's no corresponding runtime file in the published package — so `jest.setup.js` hand-rolls one (`getCurrentPosition`, etc., all `jest.fn()`). **A native dependency that ships no jest mock needs this treatment**, not just a `transformIgnorePatterns`/`transform` entry.

`__tests__/theme.test.tsx` (added in `M1-T3a`) is the pattern to copy for behavioural tests: it mounts a component, calls `applyPalette()` **while it stays mounted**, and asserts the resolved `backgroundColor` actually changed — proving the mechanism rather than asserting it. Unmount inside `act()` before any `afterEach` that changes global state, or the reset pushes a store update into a live tree.

`theme.test.tsx` also covers `M1-T4`'s persistence criterion: `saveTheme` → reset in-memory palette → `loadSavedTheme` returns the saved key, which is what a cold start does.

`__tests__/themedScreens.test.tsx` (added in `M1-T3b`) does the same for the real files — `Card`, `Button`, `SectionHeader` and `otp.tsx` — and adds a source-scan guard: every file under `src/` is asserted not to contain a top-level `const styles = StyleSheet.create(`. That is the one form the type checker and eslint both accept and that silently breaks theming, so it is checked by reading the source rather than by rendering. `otp.tsx` is still the screen chosen to mount because it has no *mount-time* effects — `M2-T1` gave it an async storage read and a network call, but both only run from the Verify button's `onPress`, which this test never triggers; the "no effects" property that made it a safe, undemanding mount target is unchanged.

Current run (2026-08-05): 3 suites, 29 tests, all passing. Jest still reports `A worker process has failed to exit gracefully` — `@react-navigation/native`'s `useLinking` timer stays pending because the smoke test never unmounts (`M9-T8b`). The React `act()` warning previously recorded here **did not reproduce**, on this tree or on a stashed-clean one; treat it as timing-dependent rather than fixed (`M9-T8a`). `M2-T1` added a second candidate for this warning — `_layout.tsx`'s `useAuth()` boot check resolves its `getItem` promise asynchronously, same shape as the language-loading pattern already tolerated here — but it did not reproduce either on this run.

---

## 10. Conventions for new code

- **Screens** go in `src/app/` (app-level flow) or `src/features/<domain>/` (domain module). A feature folder owns its screen, its types, and its storage key.
- **Register the route** in `RootStackParamList` and `_layout.tsx` in the same change.
- **Styling:** write the style block as `const makeStyles = ({ colors, … }: ThemeTokens) => StyleSheet.create({…})` and call `useThemedStyles(makeStyles)` in the component. Import `ThemeTokens` as a type from `src/theme`; do not import the token values into a screen. Never inline hex. A module-scope `const styles = StyleSheet.create(...)` is a defect — `__tests__/themedScreens.test.tsx` fails the build if one appears.
- **Strings:** add to `src/i18n/locales/en.json` first, then all five other locale files in the same commit. Namespace by screen (`dashboard.*`, `profile.*`, `family.*`) — or by domain when the strings are not screen-specific (`theme.*`).
- **Reactivity to language:** subscribe via `subscribeToLanguageChanges` and key the root view on a `localeVersion` counter.
- **Storage:** always through `src/utils/storage.ts`, always with a `saheli.` key prefix, and document the key in §5 of this file.
- **Safe area:** screens handle their own insets; the navigator has no header.
- **Before finishing:** `npx tsc --noEmit` must pass.
