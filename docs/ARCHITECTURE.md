# Saheli — Architecture

**Status:** reflects the codebase as of 2026-07-30, branch `initial-static`, commit `3646fcf`.
This document describes what exists, not what is planned. Planned work lives in `docs/BACKLOG.md`.

---

## 1. Shape of the system

Saheli today is a **single-process React Native client with no server**. Every layer that would normally talk to a backend currently reads and writes `AsyncStorage` directly from the screen component.

```
┌──────────────────────────────────────────────────────┐
│ index.js → App.tsx (GestureHandlerRootView)          │
│   └── src/app/_layout.tsx                            │
│         SafeAreaProvider                             │
│         NavigationContainer                          │
│         Native Stack: Language → Phone → Otp →       │
│                       Profile → Dashboard → Family   │
└──────────────────────────────────────────────────────┘
          │                    │                  │
   ┌──────▼──────┐     ┌───────▼──────┐   ┌───────▼──────┐
   │ Screens     │     │ Components   │   │ Cross-cutting│
   │ app/*       │     │ Button, Card │   │ theme.ts     │
   │ features/*  │     │ SectionHeader│   │ i18n/        │
   │             │     │ BottomSheet  │   │ utils/storage│
   └──────┬──────┘     └──────────────┘   └───────┬──────┘
          └────────────── AsyncStorage ───────────┘
```

There is no state container (no Redux/Zustand/Context store), no API client, no service layer. Screen-local `useState` plus `AsyncStorage` is the entire state model. This is a deliberate choice for the static-design phase — see `docs/DECISIONS.md` (D-002).

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

Exports three palettes — `terracotta` (default), `ocean`, `midnight` (dark) — each implementing `PaletteColors` (15 semantic color roles: `primary`, `surface`, `textPrimary`, `border`, `danger`, …), plus `spacing`, `radius`, `fonts`, and `shadow` (with a web `boxShadow` branch).

**How palette switching works:**

```ts
export const colors: PaletteColors = { ...palettes[0].colors };  // mutable singleton
export function applyPalette(key) { Object.assign(colors, p.colors); }  // mutates in place
```

`applyPalette` mutates the exported `colors` object rather than replacing it, so every module holding a reference sees the new values. The selected key persists to `saheli.theme.palette`; `loadSavedTheme()` restores it, `saveTheme()` writes it. `src/hooks/useTheme.ts` wraps both and is consumed once, in `_layout.tsx`, to set the stack's `contentStyle.backgroundColor`.

**Why runtime switching does not actually work yet:** screens build their styles with `StyleSheet.create({...})` at *module load*, reading `colors.x` once. Mutating `colors` afterwards does not re-create those frozen style objects. So a palette change only takes effect on a fresh app start, and there is no UI to trigger one. Fixing this means either moving to a theme Context with styles built inside the render, or a `useThemedStyles(fn)` hook. Tracked as `M1-T3`.

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

**Helper:** `src/utils/storage.ts` — `getItem<T>(key, fallback)`, `setItem<T>(key, value)`, `removeItem(key)`, `clearAll()`. All swallow errors and fall back silently; all JSON-serialize. **Exception:** `src/theme.ts` and `src/i18n/index.ts` call `AsyncStorage` directly with raw strings, not through these helpers.

| Key | Written by | Shape | Notes |
| --- | --- | --- | --- |
| `saheli.lang` | `i18n/index.ts` | raw string (`"hi"`) | not JSON-encoded |
| `saheli.theme.palette` | `theme.ts` | raw string (`"ocean"`) | not JSON-encoded |
| `saheli.user_phone` | `onboarding/phone.tsx` | JSON string | pre-fills the profile step |
| `saheli.user_profile` | `onboarding/profile.tsx` | `UserProfile` JSON | read by dashboard (avatar) and profile edit |
| `saheli.family_members` | `features/family/FamilyScreen.tsx` | `FamilyMember[]` JSON | seeded with 3 demo members on first read |

`clearAll()` (Delete Account) wipes **all** of the above, including language and palette.

### Data models

```ts
// src/app/onboarding/profile.tsx
interface UserProfile {
  name: string;
  phone: string;
  role: 'household_ceo' | 'individual';
  location: string;
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

## 6. UI component system

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `components/Button.tsx` | primary CTA, token-styled |
| `Card` | `components/Card.tsx` | renders `Pressable` when `onPress` is given, else `View` |
| `SectionHeader` | `components/SectionHeader.tsx` | title + subtitle pair |
| `BottomSheet` | `components/BottomSheet.tsx` | `Modal` + `Animated` + `PanResponder`; drag-to-dismiss (>120px or velocity >0.6), only when the inner scroll is at the top; `@react-native-community/blur` loaded through a `try/require` so a missing native module degrades gracefully instead of crashing |

Screens still define most of their own `StyleSheet` blocks locally. Only `Card`, `SectionHeader` and `BottomSheet` are reused across screens. Import them from `src/components/` directly — the `src/shared/components/index.ts` re-export barrel was deleted in `M1-T1` (2026-07-30).

### Signature interaction: the dashboard scroll header

`dashboard.tsx` drives four interpolations from one `Animated.Value` bound to `onScroll`:

| Interpolation | Input range | Effect |
| --- | --- | --- |
| `appbarBgOpacity` | 0 → 80 | sticky AppBar background fades in |
| `appbarPillOpacity` / `TranslateY` | 30 → 90 | compact `2 Pending · 4 Due` pills rise and fade in |
| `heroCardScale` | −50 → 100 | hero card over-scales on pull-down, shrinks on scroll |
| `heroCardOpacity` | 0 → 70 | hero card fades out |

`useNativeDriver: false` is required because `backgroundColor`/layout properties are animated. Keep that in mind before adding more animation to this screen.

---

## 7. Known gaps and technical debt

Ordered by how much they will hurt later. All are tracked in `docs/BACKLOG.md`.

1. **Auth is theatre.** `otp.tsx`'s Verify button calls `navigation.navigate('Profile')` unconditionally — no code comparison, no attempt limit, no resend timer wiring. `useAuth`/`authService` are stubs returning `{ success: true }` and are imported by nothing. There is no auth guard, so the Dashboard is reachable by back/forward navigation without any credential. (`M2`)
2. **No session lifecycle.** The idle timeout, absolute expiry, and re-auth banner described in earlier documentation were never implemented. (`M2-T3`)
3. **Theme cannot change at runtime** (§3) and there is no palette picker UI. (`M1-T3`)
4. **Auth stubs are unused.** `src/hooks/useAuth.ts` and `src/features/auth/auth.ts` are imported by nothing (`useAuth` imports `authService`, and nothing imports `useAuth`). They are deliberately kept as the scaffolding `M2-T3`/`M2-T4` will build the real session model into. The other four dead paths were deleted in `M1-T1` (2026-07-30).
5. **Family screen not localized** — breaks the 6-language promise on a shipped screen. (`M3-T1`)
6. **Fonts not bundled** — the visual design in the palette definitions is not what renders. (`M1-T4`)
7. **Two navigation typing sources** (`native-stack` navigator vs `stack` prop types). (`M1-T5`)
8. **Test coverage is one smoke test** (`__tests__/App.test.tsx`). No component, storage, or i18n tests. The harness itself was repaired in `M1-T1` (2026-07-30) — see §8. (`M9-T1`)
9. **Dashboard numbers are hardcoded** (`₹12,450`, `2 Tasks`, `4 Bills`, `4 / 4 Modules Synced`). They must become derived values before the modules that own them land. (`M4`+)
10. **Tile navigation is string-matched.** `dashboard.tsx:94` routes on `title === 'Family' || title === t('dashboard.tile_family')`. The `t()` arm means it does work in every locale today, but the match is by label rather than identity, so it breaks the moment a translation is reworded and every new route needs another string comparison. Tiles need stable IDs. (`M1-T7`)

---

## 8. Test harness

**Files:** `jest.config.js` · `jest.setup.js` · `__tests__/`

`npm test` runs jest on the `@react-native/jest-preset` preset. Two pieces of configuration are required for a test that renders `App` to run at all, both added in `M1-T1`:

- **`transformIgnorePatterns`** — the preset only lets `react-native` and `@react-native*` through babel. Every other RN-ecosystem package in this app ships untranspiled ESM, so `@react-navigation`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`, `react-native-image-picker` and `@react-native-async-storage` are added to the allowlist. **Adding a new RN dependency that ships ESM means adding it here too.**
- **`jest.setup.js`** — swaps native modules for the mocks each package ships: `react-native-gesture-handler/jestSetup`, `@react-native-async-storage/async-storage/jest`, and `react-native-safe-area-context/jest/mock`. The safe-area mock is a default-exported object while consumers use named imports, so it is unwrapped with `.default`.

The suite passes but prints a React `act()` warning: `language.tsx` bumps `localeVersion` from the async `loadSavedLanguage()` callback, outside `act`. Tracked as `M9-T7`.

---

## 9. Conventions for new code

- **Screens** go in `src/app/` (app-level flow) or `src/features/<domain>/` (domain module). A feature folder owns its screen, its types, and its storage key.
- **Register the route** in `RootStackParamList` and `_layout.tsx` in the same change.
- **Styling:** import `{ colors, fonts, radius, shadow, spacing }` from `src/theme` (never from `src/theme/`), never inline hex.
- **Strings:** add to `src/i18n/locales/en.json` first, then all five other locale files in the same commit. Namespace by screen (`dashboard.*`, `profile.*`, `family.*`).
- **Reactivity to language:** subscribe via `subscribeToLanguageChanges` and key the root view on a `localeVersion` counter.
- **Storage:** always through `src/utils/storage.ts`, always with a `saheli.` key prefix, and document the key in §5 of this file.
- **Safe area:** screens handle their own insets; the navigator has no header.
- **Before finishing:** `npx tsc --noEmit` must pass.
