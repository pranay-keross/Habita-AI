# Saheli — AI Context Brief

> **Read this first.** It is the cold-start brief for any AI agent working on this repo — enough to be productive without the user re-explaining the project. Depth lives elsewhere; this file points you there.
>
> **Last synced:** 2026-07-30 · branch `initial-static` · commit `3646fcf` · `npx tsc --noEmit` passes.

---

## 1. What this is

**Saheli** ("friend" in Hindi) is an AI life assistant for Indian households — finance, health, home, safety, style, and payments in one app. The audience is the household manager, with family sharing built in and six-language support from day one.

This repository is the React Native 0.86 client (CLI, not Expo). React 19.2, TypeScript 5.8, React Navigation v7 native stack, `i18n-js`, `AsyncStorage`.

## 2. What state it is in — read this before planning anything

It is a **static, front-end-only prototype**. Screens, navigation, theming, and localization are real. There is **no backend, no working authentication, and no AI integration**.

Specifically, do not assume these exist — they do not:

- **OTP verification.** `src/app/onboarding/otp.tsx:85` — Verify calls `navigation.navigate('Profile')` unconditionally. No code check, no attempt limit.
- **Session lifecycle.** No idle timeout, no expiry, no auth guard. `src/hooks/useAuth.ts` and `src/features/auth/auth.ts` are stubs imported by nothing.
- **Any API layer.** Screens read and write `AsyncStorage` directly.
- **AI / OCR / assistant features.** None.
- **Invite lifecycle.** "Send invitation" writes a local record and shows an alert.

Earlier versions of this document claimed several of these were done. They were not. Verify before you build on top of anything.

## 3. Document map

| File | Answers |
| --- | --- |
| `README.md` | What the product is, what works today, how to run it |
| `docs/ARCHITECTURE.md` | How it is built — navigation, theming, i18n, storage contract, **known gaps (§7)** |
| `docs/BACKLOG.md` | What to build next — milestones M0–M9 with task IDs |
| `docs/DECISIONS.md` | Why things are the way they are; do not relitigate |
| `agent.md` | The working agreement for AI sessions in this repo |
| `prompts/` | Session start · task kickoff · doc sync, plus module/i18n/refactor prompts |

## 4. File map

```
App.tsx · index.js               entry
src/app/_layout.tsx              NavigationContainer + native stack + RootStackParamList
src/app/dashboard.tsx            home dashboard (scroll-driven sticky header)
src/app/onboarding/              language · phone · otp · profile
src/features/family/FamilyScreen.tsx   family members, roles, permissions, bottom sheet
src/components/                  Button · Card · SectionHeader · BottomSheet
src/i18n/index.ts + locales/     6 locales, LTR enforced, manual change listeners
src/theme.ts                     design tokens — 3 palettes (the only theme source)
src/utils/storage.ts             AsyncStorage JSON helpers
jest.config.js · jest.setup.js   test harness — transform allowlist + native mocks
```

**Unused, but deliberately kept:** `src/hooks/useAuth.ts` and `src/features/auth/auth.ts` are stubs imported by nothing. Do not extend them ad hoc — they are the scaffolding `M2-T3`/`M2-T4` will build the real session model into.

`M1-T1` (2026-07-30) deleted the four genuinely dead paths — `src/theme/`, `src/styles/`, `src/shared/`, `src/features/family/index.ts`. If a doc still mentions them, that doc is stale.

## 5. Patterns you must follow

**Theme.** `colors` and `shadow` are mutable singletons mutated by `applyPalette()`. Because `StyleSheet.create` snapshots values at module load, a style block written at module scope will **not** restyle when the palette changes. Write it as a factory instead and call it from the render (D-004, D-008):

```ts
const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({ /* body unchanged — the params shadow the imports */ });

const styles = useThemedStyles(makeStyles);   // src/hooks/useThemedStyles.ts
```

Only `dashboard.tsx` is migrated so far; the other nine files are `M1-T3b`. Follow the factory pattern in any **new** screen. Never hardcode hex in a screen.

**i18n.** Six locales: en, hi, bn, ta, es, ar. Every new user-facing string goes into **all six** files, namespaced by screen. `i18n-js` is not reactive, so screens call `subscribeToLanguageChanges()`, bump a `localeVersion` counter, and pass `key={localeVersion}` to their root view. Translated arrays are built inside the render body, not at module scope.

**Layout direction is pinned to LTR in every language, including Arabic** (`I18nManager.forceRTL(false)` on every switch). The back arrow is always a custom top-left `Pressable`. This is deliberate — `docs/DECISIONS.md` D-003.

**Navigation.** Native stack, `headerShown: false` — every screen draws its own header and handles its own `useSafeAreaInsets()`. Register new routes in `RootStackParamList` and `_layout.tsx` together. Destructive flows use `navigation.reset` to `Language`, not `goBack`.

**Storage.** Prefix `saheli.`, go through `src/utils/storage.ts`, and document the key in `docs/ARCHITECTURE.md` §5. Everything on disk is JSON, and `storage.ts` is the only module that may import `AsyncStorage` (D-007) — the helpers swallow errors and return your fallback, so callers need no try/catch. Current keys: `saheli.lang`, `saheli.theme.palette`, `saheli.user_phone`, `saheli.user_profile`, `saheli.family_members`.

**Bottom sheets, not modals.** Add/edit flows use `src/components/BottomSheet.tsx` (drag-to-dismiss, optional blur backdrop), matching the Family screen.

## 6. Data models

```ts
// src/app/onboarding/profile.tsx — stored at saheli.user_profile
interface UserProfile {
  name: string; phone: string;
  role: 'household_ceo' | 'individual';
  location: string; avatar: string; photoUri: string | null;
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
