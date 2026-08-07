# Saheli — Backlog Tracker

**Source of truth for what to build next.** Updated 2026-08-07 against branch `initial-static`, after `M2-T1`/`M2-T4`/`M2-T6`–`M2-T8` (`docs/DECISIONS.md` D-013–D-018).

Every task is sized to be completed in one focused session and is executable with a reusable prompt from `prompts/`. Start any task with `prompts/backlog-task-kickoff.md`, passing the task ID.

## Status legend

| Marker | Meaning |
| --- | --- |
| ✅ Done | Implemented and verified in code |
| 🚧 In progress | Started, not complete |
| ⏳ Ready | Specified, unblocked, can be picked up now |
| 🔒 Blocked | Waiting on a dependency listed in the task |
| ❓ Needs decision | Requires a product/technical answer before work starts |

## Milestone overview

| # | Milestone | Status | Tasks | Theme |
| --- | --- | --- | --- | --- |
| M0 | Documentation & working agreements | ✅ Done | 4 / 4 | Docs, prompts, decision log |
| M1 | Foundation hardening | 🚧 In progress | 11 / 15 | Theme, dead code, fonts, typing |
| M2 | Auth & session (make it real) | 🚧 In progress | 4 / 8 | OTP, session lifecycle, guards |
| M3 | Family module completion | ⏳ Ready | 0 / 6 | i18n, invite lifecycle, guardrails |
| M4 | Medicine & health | ⏳ Ready | 0 / 5 | First new domain module |
| M5 | Documents hub | ⏳ Ready | 0 / 5 | Vault, tags, OCR hook-point |
| M6 | Money — expenses & UPI | ⏳ Ready | 0 / 6 | Spend tracking, payments |
| M7 | Safety, wellness, style, events | ⏳ Ready | 0 / 5 | Remaining dashboard tiles |
| M8 | Backend & AI integration | ❓ Needs decision | 0 / 6 | API, sync, model provider |
| M9 | Quality & release | 🚧 In progress | 1 / 9 | Tests, a11y, CI, store builds |

Recommended order: **M1 → M2 → M3**, then pick domain modules (M4–M7) by product priority. M8 unblocks nothing in M1–M3 but should be decided before M4 grows real data. M9 runs continuously and gates any release.

---

## M0 — Documentation & working agreements ✅

Goal: an agent or a new developer can open this repo cold and be productive without re-explaining the project.

| ID | Task | Status |
| --- | --- | --- |
| M0-T1 | Rewrite `README.md` to match verified code state; separate vision from what ships | ✅ 2026-07-30 |
| M0-T2 | Write `docs/ARCHITECTURE.md` — layers, navigation, theming, i18n, storage keys, known gaps | ✅ 2026-07-30 |
| M0-T3 | Write `docs/BACKLOG.md` (this file) and `docs/DECISIONS.md` | ✅ 2026-07-30 |
| M0-T4 | Add `prompts/` with session-start, task-kickoff, and doc-sync prompts | ✅ 2026-07-30 |

---

## M1 — Foundation hardening ⏳

Goal: remove the traps that will otherwise cost every future session. No new user-facing features.
**Prompt:** `prompts/tech-debt-cleanup.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M1-T1 | Delete shadowed and unused code: `src/theme/`, `src/styles/onboarding.ts`, `src/shared/components/index.ts`, `src/features/family/index.ts` | Files removed; `tsc --noEmit`, `npm run lint`, `npm test` all pass; nothing imported them beforehand (verify with grep) | ✅ 2026-07-30 |
| M1-T2 | Route `saheli.lang` and `saheli.theme.palette` through `src/utils/storage.ts` instead of raw `AsyncStorage`, or document why they stay raw strings | One storage access path; `docs/ARCHITECTURE.md` §5 updated | ✅ 2026-07-30 |
| M1-T3a | Runtime theme switching mechanism: `subscribeToThemeChanges` observer, `useThemedStyles(factory)` hook, fix `useTheme`'s no-op `setState`; migrate `dashboard.tsx` as the pilot | A mounted component restyles when the palette changes, proven by a test that switches palette without unmounting | ✅ 2026-07-30 |
| M1-T3b | Migrate the remaining nine files to the `useThemedStyles(makeStyles)` factory pattern: `language/phone/otp/profile.tsx`, `FamilyScreen.tsx`, `BottomSheet/Button/Card/SectionHeader.tsx` | No module-scope `StyleSheet.create` reads `colors` anywhere; every screen restyles on palette change | ✅ 2026-07-31 |
| M1-T4 | Add a palette picker to the profile edit screen (Terracotta / Ocean / Midnight with swatches) | Selection persists, applies live, survives restart | ✅ 2026-07-31 — `profile.tsx` edit mode, under "Appearance"; names/descriptions localized in all 6 locales under `theme.*` |
| M1-T5 | Bundle Fraunces + DM Sans fonts, or replace `theme.fonts` with the platform stack | Text renders in the intended typeface on both platforms, or the token honestly names what renders | ⏳ |
| M1-T6 | Unify navigation typing on `NativeStackScreenProps` from `@react-navigation/native-stack`; drop `@react-navigation/stack` if unused | Single nav package in `package.json` deps; `tsc` green | ⏳ |
| M1-T7 | Give dashboard tiles and quick actions stable IDs; route on ID, not translated label | Family tile still navigates when the app is in Hindi; adding a route needs no string matching | ⏳ |
| M1-T8 | Replace the `key={localeVersion}` remount pattern with a proper i18n hook/Context (`useTranslation()`) | Language switch re-renders without remounting subtrees; state is not lost on switch | ⏳ |
| M1-T9 | Add a `textOnPrimary` role to `PaletteColors` and all three palettes; replace the three inline `{ color: '#FFF' }` in `language.tsx:83` and `profile.tsx:256,262` | No inline hex left in any screen; the active-card label stays legible in Midnight, where `surfaceElevated` is `#2A2440` and is *not* a valid substitute | ✅ 2026-07-31 — done with `M1-T11`; six roles added, not one (see that row) |
| M1-T10 | Wire `shadow.soft`/`shadow.medium` to each palette's `shadowColor` instead of hardcoding `#C96B5D`/`#7D3F3F`, so Midnight casts a black shadow | `shadow` follows the active palette; no hardcoded hex in the shadow tokens | ✅ 2026-07-30 |
| M1-T11 | Replace the 38 hardcoded hex values still inside the migrated style blocks with palette roles — 12 are `backgroundColor: '#FFF'` on cards, inputs and chips (`language`, `phone`, `otp`, `profile`, `FamilyScreen`), which now stay white while everything around them turns dark in Midnight; the rest are light-on-primary text (`#FFF`, `#F8ECE4`, `#FFE8A3`) and the danger-zone pair (`#FDE8E8`/`#F8B4B4`). Surfaced by `M1-T3b`: before it, nothing restyled, so nothing looked wrong | `grep "'#"` returns nothing in `src/**/*.tsx`; Midnight has no white cards or unreadable labels. Overlaps `M1-T9`, which adds the `textOnPrimary` role this needs — do `M1-T9` first | ✅ 2026-07-31 — six roles added (`textOnPrimary`, `textOnPrimaryMuted`, `textOnPrimaryAccent`, `turmericSoft`, `dangerSoft`, `dangerBorder`); `PaletteColors` is now 21 roles; `npm run lint` is warning-free for the first time |
| M1-T12 | Dashboard visual polish, direct user feedback (not a pre-planned task): (1) quick-action card shadows were invisible — the horizontal `ScrollView` clipped to card height with no padding, cutting off `shadow.soft`; (2) hero badge/stat chips used bright hardcoded `rgba(255,255,255,…)` fills, read as "not mature/professional"; (3) hero card opacity faded to 20% by just 70px of scroll, making its content briefly illegible | Quick-action shadows visible in all three palettes; hero/stat chips use palette tokens, not raw `rgba`; hero card dims but stays legible while scrolling | ✅ 2026-08-05 — `dashboard.tsx`: `horizontalScroll` gained padding; `badgeItem`/`statsCard` moved to a transparent+`textOnPrimaryMuted`-border outline treatment; `actionCard` moved to an outline treatment (`colors.background` fill, `borderStrong` border, smaller shortcut emoji); `heroCardContainer` gained a `primaryDark` border and dropped to `radius.xl`; `heroCardOpacity` widened to `0 → 160` and floored at `0.55` instead of `0.2`. Icon-only tiles/quick-actions still render as raw emoji, not a vector icon set — the largest remaining lever for a "professional" look, but out of scope here since it needs a new dependency (agent.md rule 7) |
| M1-T13 | Replace `dashboard.tsx`'s emoji glyphs (tiles + quick actions) with a real icon set — direct user follow-up to `M1-T12`, approved as a new dependency (`docs/DECISIONS.md` D-010) | Icons render as vector strokes tinted with `colors.primary` in all three palettes; `tsc`/lint/tests stay green; no raw emoji left in `dashboard.tsx`'s icon slots | ✅ 2026-08-05 — added `lucide-react-native` + `react-native-svg`; per-icon subpath imports (`lucide-react-native/icons/<name>`) keep the bundle to the ~15 icons actually used instead of the whole set; `jest.config.js` needed both `transformIgnorePatterns` (existing pattern) and an expanded `transform` regex, since the preset's default only matches `.js/.ts/.tsx` and lucide's package `exports` resolve to `.mjs`. Only `dashboard.tsx` is migrated — `FamilyScreen.tsx`'s role/permission icons and any future screens still use emoji or none |
| M1-T14 | Dashboard restructure — `M1-T12`/`M1-T13` were token/icon swaps on the same layout, and the user was explicit that wasn't enough ("you have kept the design and position same, i want to have different looking"). Rebuilt the section shape, not just its colors: see `docs/DECISIONS.md` D-011 | Hero card removed; quick actions and module tiles read as structurally different sections, not a re-skinned version of the old ones; `tsc`/lint/tests stay green | ✅ 2026-08-05 — `dashboard.tsx`: the `primary`-filled hero card is gone, replaced by a plain-background greeting + a muted status line + two neutral bordered stat cards (`statCard`, reusing `Card`'s visual language inline); quick actions moved from a horizontal `Card`-in-`ScrollView` strip to a wrapping 3-column grid of icon-in-circle `Pressable`s (`blush`-tinted circle, no card chrome); the tile grid became a single-column bordered list group (`moduleList`) with a divider between rows and a `ChevronRight` — a settings-list pattern instead of a 3×3 icon grid. The scroll-driven `heroCardScale`/`heroCardOpacity` animations (`M1-T3a`, tuned in `M1-T12`) no longer apply and were deleted, not just adjusted; `docs/ARCHITECTURE.md` §6 updated to match |

---

## M2 — Auth & session 🚧

Goal: the login flow actually gates the app. **No longer local/demo** — `M2-T1` (2026-08-05, `docs/DECISIONS.md` D-012) wired onboarding to the real backend (`Saheli-Backend.postman_collection.json`, repo root). What's left is session *lifecycle* polish, not the auth calls themselves.
**Prompt:** `prompts/backlog-task-kickoff.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M2-T1 | Implement real OTP verification in `otp.tsx` against the backend's `POST /auth/verify-otp`, show an inline error on mismatch, disable Verify until 6 digits are entered | Wrong code never advances; error is localized in all 6 locales | ✅ 2026-08-05 — superseded its own original spec (demo code `123456`) once the real backend from the Postman collection made that unnecessary; also wired `phone.tsx` to `login`/`register` and `profile.tsx` to `POST /profile/create` / `PUT /profile/details`. See `docs/ARCHITECTURE.md` §6. **2026-08-06 follow-up** (`docs/DECISIONS.md` D-013): the user supplied a richer collection with full saved examples, which caught real bugs in the first pass — the phone format sent to the backend (was the full display string, backend wants bare 10 digits), `parseAuthError`'s status-only mapping (every 4xx is a 400, not 404), and `PUT /profile/details` incorrectly including `name`. Also added: `GET /profile/details` (edit-mode load), `PUT /profile/profilePhoto` (edit-mode photo changes), `devOtp` prefill, `expiresIn`/`userId` capture. **2026-08-07 follow-ups, same day** (`docs/DECISIONS.md` D-014, D-015): live-tested profile creation twice against a real backend, with real server logs both times. First (D-014): the `D-013` Content-Type object broke it, reverted to a plain string — but that revert was itself then disproven by a backend log showing the plain string arrives as `Content-Type: application/octet-stream` and gets a 415. Second (D-015): re-applied the Content-Type object, since the theory that justified reverting it was never actually confirmed by evidence, unlike the plain string's failure — **confirmed working** by a third live test the same day: backend log shows the JSON part parsed correctly, the photo uploaded to S3, and "profile saved successfully." That same test then hit an unrelated backend-side bug (D-016, not fixed here — re-creating a profile for a user that already has one 500s on a DB constraint instead of updating or returning a clean conflict) |
| M2-T2 | Add resend timer (`onboarding.resend_in` / `onboarding.resend` strings already exist) and a "Change number" link back to the phone step | Countdown runs, resend re-enables at 0, both strings used | ⏳ |
| M2-T3 | Build a real session model: persisted issued-at timestamp (done), 15-minute idle expiry, 24-hour absolute expiry, silent refresh via the now-existing `refresh()` call on an expired token | Unit-testable pure functions; timestamps in `saheli.session`; documented in `ARCHITECTURE.md` §6 | 🚧 2026-08-05 — session persistence landed as part of `M2-T1` (`saheli.session`: `{accessToken, refreshToken, issuedAt, phone}`); `refresh()` exists in `src/features/auth/auth.ts` but nothing calls it yet; no idle/absolute expiry logic at all — a persisted token is trusted until the backend itself rejects it |
| M2-T4 | Wire `useAuth` to the session model and add an auth gate: app boots into Dashboard when the session is valid, into Language/Phone when it is not | Cold start with a valid session skips onboarding; expired session lands on phone entry | 🚧 2026-08-05 — cold-start guard landed in `_layout.tsx` (`initialRouteName` picked from `useAuth().signedIn` after the boot check); the "expired session" half needs `M2-T3`'s expiry logic first, since nothing currently detects expiry |
| M2-T5 | Re-auth UX: pre-fill the phone number and show the amber "Session expired" banner when the user is bounced out | Banner localized; phone pre-filled from `saheli.user_phone` | 🔒 needs M2-T3/M2-T4's expiry detection |
| M2-T6 | Make Sign Out clear session state (not just reset navigation), and confirm Delete Account clears every `saheli.*` key | Signing out and relaunching cannot reach Dashboard | ✅ 2026-08-05 — `handleSignOut` now calls `useAuth().logout()` (clears `saheli.session`) before resetting navigation; `clearAll()` (Delete Account) already wiped it since it clears every key |
| M2-T7 | Direct user bug report after live device testing (not pre-planned): (1) a returning user (login, not register) landed on Profile setup after OTP instead of Dashboard, since `otp.tsx` always navigated to `'Profile'`; (2) the `devOtp` prefill (`M2-T1`) was explicitly unwanted — "keep it empty"; (3) the hand-rolled 6-`TextInput` OTP box couldn't be cleanly cleared/edited once filled | Returning users land on Dashboard, new users on Profile; OTP field starts empty; OTP input is easy to correct after a wrong code | ✅ 2026-08-07 — `docs/DECISIONS.md` D-017. `loginOrRegister` now returns `{isNewUser}` (login succeeded → `false`, fell back to register → `true`), threaded through `navigation.navigate('Otp', {isNewUser})` and read in `otp.tsx` to pick `Profile` vs `Dashboard` after a successful verify. `devOtp` removed end-to-end — `register`/`login` are back to `Promise<void>`, nothing OTP-related is inferred from their response. Replaced the custom digit-box `TextInput` array with `react-native-otp-entry`'s `OtpInput` (pure JS, no native rebuild) — one real backing input instead of six, so normal text editing/backspace works; a wrong code now auto-clears and refocuses instead of leaving 6 filled boxes to delete by hand |
| M2-T8 | More direct user feedback: (1) Role picker (Household CEO / Individual) showing during first-time Profile setup wasn't wanted there; (2) the GPS-prefilled location field showed raw `"lat, lng"` instead of a real place name — the reverse-geocoding gap `M2-T1`/D-012 had explicitly deferred | Role picker absent from onboarding, still available from Profile edit; location prefills with a real city/state name, falling back gracefully | ✅ 2026-08-07 — `docs/DECISIONS.md` D-018. Role section wrapped in `isEditing`; state/default/persistence unchanged, only the picker UI is conditional. Added `reverseGeocode()` (`profile.tsx`) using OpenStreetMap's Nominatim via plain `fetch` — no API key, no new dependency; falls back city → state-qualified city → Nominatim's `display_name` → raw coordinates if the lookup itself fails |

**No longer deferred to M8** (superseded by `M2-T1`): server-side OTP verification and refresh tokens are real now — see `docs/ARCHITECTURE.md` §6 for the exact contract and what's still unverified against a live backend. **Still deferred to M8:** anything beyond auth/profile (family, dashboard, documents, money, …) — see `docs/DECISIONS.md` D-012.

---

## M3 — Family module completion ⏳

Goal: bring the one built domain module up to the standard every later module must meet.
**Prompt:** `prompts/i18n-localization-pass.md` for T1, `prompts/backlog-task-kickoff.md` for the rest.

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M3-T1 | Localize `FamilyScreen.tsx` — move every hardcoded string to a `family.*` namespace in all 6 locale files | No literal user-facing English left in the file; screen reads correctly in Hindi and Arabic | ⏳ |
| M3-T2 | Owner guardrails: the owner cannot be demoted, removed, or stripped of permissions; removal requires typed/explicit confirmation | Attempting either is blocked with a localized explanation | ⏳ |
| M3-T3 | Invite lifecycle states: `pending` / `accepted` / `declined` on `FamilyMember`, with pending members visually distinct and an accept/decline affordance in demo mode | State persists; member counts exclude pending | ⏳ |
| M3-T4 | Consolidate the two `FamilyMember` definitions into `src/features/family/types.ts`; move storage access into `src/features/family/familyStore.ts` | Screen imports types and store; no duplicate interface | ⏳ |
| M3-T5 | Align the permission set with the modules that actually exist, and derive the "Modules Synced" stat instead of hardcoding `4 / 4` | Stat reflects real permission counts | ⏳ |
| M3-T6 | "Leave family" action for non-owner members | Localized confirmation; member removed from local store | ⏳ |

---

## M4 — Medicine & health ⏳

Goal: first module built end-to-end on the hardened foundation. Use it as the template for M5–M7.
**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M4-T1 | `src/features/medicine/` scaffold: screen, types, store, route registration, dashboard tile wiring | Tile navigates; screen matches design-system tokens | ⏳ |
| M4-T2 | Medicine list + add/edit bottom sheet (name, dosage, schedule, stock count) | CRUD persists to `saheli.medicines`; key documented | 🔒 needs M4-T1 |
| M4-T3 | Daily "take medicine" log and 7-day adherence calculation | Dashboard adherence stat reads from real data instead of `3 Active` | 🔒 needs M4-T2 |
| M4-T4 | Local notification reminders for scheduled doses | ❓ Needs decision on notification library | ❓ |
| M4-T5 | Respect the family `medicines` permission when viewing another member's chest | Viewer role cannot edit | 🔒 needs M3-T5 |

---

## M5 — Documents hub ⏳

**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M5-T1 | `src/features/documents/` scaffold + dashboard tile wiring | Tile navigates | ⏳ |
| M5-T2 | Document capture via `react-native-image-picker` (already a dependency) and local file references | Documents persist with title, category, date, URI | 🔒 needs M5-T1 |
| M5-T3 | Categories, tags, and search over stored documents | Filtering works offline | 🔒 needs M5-T2 |
| M5-T4 | Expiry reminders for documents with an expiry date (insurance, licence, passport) | Due items surface as dashboard "Due" count | 🔒 needs M5-T2 |
| M5-T5 | Define the OCR hook-point: an interface the AI provider will implement, with a manual-entry fallback | Interface exists and is called; no provider required to ship | 🔒 needs M8-T1 for the real implementation |

---

## M6 — Money: expenses & UPI ⏳

**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M6-T1 | `src/features/expenses/` scaffold + tile wiring | Tile navigates | ⏳ |
| M6-T2 | Expense entry (amount, category, date, payer, note) with local persistence | CRUD persists; key documented | 🔒 needs M6-T1 |
| M6-T3 | 30-day spend rollup that replaces the hardcoded `₹12,450` on the dashboard | Dashboard reads derived total | 🔒 needs M6-T2 |
| M6-T4 | Shared expense groups with per-member split, honouring family `expenses` permission | Splits computed and displayed | 🔒 needs M6-T2, M3-T5 |
| M6-T5 | Bill scan entry point that routes to the OCR hook-point from M5-T5 | Scan → prefilled expense form | 🔒 needs M5-T5 |
| M6-T6 | UPI payment flow | ❓ Needs decision: deep-link to UPI apps vs a payment SDK; compliance review required | ❓ |

---

## M7 — Safety, wellness, style, events ⏳

**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M7-T1 | Safety SOS: emergency contact list, one-tap alert, location share | ❓ Needs decision on location/SMS permissions strategy | ❓ |
| M7-T2 | Wellness module scaffold and first tracked metric | Tile navigates; data persists | ⏳ |
| M7-T3 | Style module scaffold | Tile navigates | ⏳ |
| M7-T4 | Events module: household calendar entries feeding the dashboard "Pending" count | Dashboard pending count derived | ⏳ |
| M7-T5 | Vehicles & fuel log (the "Add fuel" quick action currently goes nowhere) | Quick action wired to a real screen | ⏳ |

---

## M8 — Backend & AI integration ❓

Goal: replace device-local storage with a real service, and add the AI features the product promises. **Nothing here should start before the open decisions below are answered** — see `docs/DECISIONS.md` (D-005, D-006).

| ID | Task | Blocking question | Status |
| --- | --- | --- | --- |
| M8-T1 | Choose the AI provider and integration surface for OCR / bill parsing / assistant | Which provider, on-device vs server-side, who holds the API key? | ❓ |
| M8-T2 | Choose the backend: BaaS (Supabase/Firebase) vs custom API | Data residency for Indian users, multi-tenant model | ❓ |
| M8-T3 | Introduce an API/repository layer so screens stop reading `AsyncStorage` directly | Depends on M8-T2 | 🔒 |
| M8-T4 | Real multi-tenant family sharing with server-enforced permissions | Depends on M8-T2 | 🔒 |
| M8-T5 | Real SMS OTP delivery and server-side verification | Depends on M8-T2 | 🔒 |
| M8-T6 | Offline-first sync and conflict handling | Depends on M8-T3 | 🔒 |

---

## M9 — Quality & release ⏳

Runs alongside every other milestone; gates any store release.

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M9-T1 | Add React Native Testing Library; component tests for OTP input, BottomSheet, and Card | Tests run in `npm test` | ⏳ partially covered: `__tests__/themedScreens.test.tsx` (`M1-T3b`) mounts Card, Button, SectionHeader and `otp.tsx` with `react-test-renderer`, but only asserts theming — no interaction coverage, and RNTL is still not installed |
| M9-T2 | Unit tests for `utils/storage`, `i18n` language switching, and the M2-T3 session functions | Pure logic covered | 🔒 needs M2-T3 |
| M9-T9 | Native-speaker review of the `theme.*` strings added in `M1-T4` (palette names and descriptions in hi, bn, ta, es, ar). The palette *names* are transliterations of English marketing names — confirm that is wanted rather than a translated equivalent | A native speaker has signed off on each locale, or the string is changed | ⏳ |
| M9-T3 | Locale completeness check — a script that fails when a key exists in `en.json` but is missing elsewhere | Runs in `npm test` or as a lint step | ⏳ |
| M9-T4 | CI workflow: install, `tsc --noEmit`, lint, test on every push | Green pipeline required to merge | ⏳ |
| M9-T5 | Accessibility pass: labels on icon-only buttons, contrast check across all three palettes, dynamic type sanity | Screen reader can navigate onboarding and dashboard | ⏳ |
| M9-T6 | Release prep: app icons, splash, versioning, signed Android/iOS builds | Installable build produced | ⏳ |
| M9-T7 | Repair the jest harness: install the missing `@react-native/jest-preset`, widen `transformIgnorePatterns` for the RN-ecosystem ESM packages, and mock gesture-handler / async-storage / safe-area-context | `npm test` runs and passes; documented in `ARCHITECTURE.md` §8 | ✅ 2026-07-30 |
| M9-T8 | Clean up the smoke test: (a) the React `act()` warning — `language.tsx` bumps `localeVersion` from the async `loadSavedLanguage()` callback, outside `act`; (b) the test never unmounts, so `@react-navigation/native`'s `useLinking` `setTimeout` stays pending and jest reports "did not exit" (surfaced by `M1-T2`'s extra async hop; exit code is still 0, but it will hang CI in `M9-T4`) | `npm test` passes with no console warnings and no open-handle notice | ⏳ (a) did not reproduce on 2026-07-31 — checked against a stashed-clean tree, so it is timing-dependent, not fixed; (b) still reproduces on every run |

---

## Open questions

Answer these before the milestones that depend on them; record answers in `docs/DECISIONS.md`.

1. **AI provider** (blocks M8-T1, M5-T5, M6-T5) — which model provider for OCR and parsing, and does inference run server-side?
2. **Backend** (blocks all of M8) — BaaS or custom API? Where does data live for Indian users?
3. **UPI** (blocks M6-T6) — deep-link into existing UPI apps, or integrate a payment SDK with the compliance work that implies?
4. **Notifications** (blocks M4-T4) — which library, and is a background scheduler needed?
5. **Product priority for M4–M7** — which domain module ships first after the foundation work?
6. **Dark mode trigger** — `M1-T4` shipped the picker as **manual-only**, which does not close this: should Midnight *also* follow the OS appearance setting (`useColorScheme`), and if so, does an explicit pick override it permanently or until the OS flips again?

---

## How to update this file

At the end of every session, run `prompts/session-close-doc-sync.md`. It will:

1. Flip completed task rows to ✅ with the date.
2. Move anything half-finished to 🚧 with a one-line note on where it stopped.
3. Add newly discovered work as new task rows (never as loose prose).
4. Recompute the milestone overview counts.
5. Move any answered open question into `docs/DECISIONS.md`.
