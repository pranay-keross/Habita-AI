# Saheli — Backlog Tracker

**Source of truth for what to build next.** Updated 2026-07-30 against branch `initial-static`, after `M1-T1`.

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
| M1 | Foundation hardening | 🚧 In progress | 2 / 9 | Theme, dead code, fonts, typing |
| M2 | Auth & session (make it real) | ⏳ Ready | 0 / 6 | OTP, session lifecycle, guards |
| M3 | Family module completion | ⏳ Ready | 0 / 6 | i18n, invite lifecycle, guardrails |
| M4 | Medicine & health | ⏳ Ready | 0 / 5 | First new domain module |
| M5 | Documents hub | ⏳ Ready | 0 / 5 | Vault, tags, OCR hook-point |
| M6 | Money — expenses & UPI | ⏳ Ready | 0 / 6 | Spend tracking, payments |
| M7 | Safety, wellness, style, events | ⏳ Ready | 0 / 5 | Remaining dashboard tiles |
| M8 | Backend & AI integration | ❓ Needs decision | 0 / 6 | API, sync, model provider |
| M9 | Quality & release | 🚧 In progress | 1 / 8 | Tests, a11y, CI, store builds |

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
| M1-T3 | Make theme switching work at runtime: theme Context or `useThemedStyles(fn)` hook; styles resolve per render | Changing palette restyles mounted screens with no restart; all screens migrated off module-scope `StyleSheet.create` reads of `colors` | ⏳ |
| M1-T4 | Add a palette picker to the profile edit screen (Terracotta / Ocean / Midnight with swatches) | Selection persists, applies live, survives restart | 🔒 needs M1-T3 |
| M1-T5 | Bundle Fraunces + DM Sans fonts, or replace `theme.fonts` with the platform stack | Text renders in the intended typeface on both platforms, or the token honestly names what renders | ⏳ |
| M1-T6 | Unify navigation typing on `NativeStackScreenProps` from `@react-navigation/native-stack`; drop `@react-navigation/stack` if unused | Single nav package in `package.json` deps; `tsc` green | ⏳ |
| M1-T7 | Give dashboard tiles and quick actions stable IDs; route on ID, not translated label | Family tile still navigates when the app is in Hindi; adding a route needs no string matching | ⏳ |
| M1-T8 | Replace the `key={localeVersion}` remount pattern with a proper i18n hook/Context (`useTranslation()`) | Language switch re-renders without remounting subtrees; state is not lost on switch | ⏳ |
| M1-T9 | Add a `textOnPrimary` role to `PaletteColors` and all three palettes; replace the three inline `{ color: '#FFF' }` in `language.tsx:83` and `profile.tsx:256,262` | No inline hex left in any screen; the active-card label stays legible in Midnight, where `surfaceElevated` is `#2A2440` and is *not* a valid substitute | ⏳ |

---

## M2 — Auth & session ⏳

Goal: the login flow actually gates the app. Still no backend — verification is local/demo, but the *lifecycle* is real and swappable.
**Prompt:** `prompts/backlog-task-kickoff.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M2-T1 | Implement OTP verification in `otp.tsx`: compare against the demo code `123456`, show an inline error on mismatch, disable Verify until 6 digits are entered | Wrong code never advances; error is localized in all 6 locales | ⏳ |
| M2-T2 | Add resend timer (`onboarding.resend_in` / `onboarding.resend` strings already exist) and a "Change number" link back to the phone step | Countdown runs, resend re-enables at 0, both strings used | ⏳ |
| M2-T3 | Build a real session model in `src/features/auth/`: `signIn`, `signOut`, `isSessionValid`, 15-minute idle expiry, 24-hour absolute expiry, persisted issued-at / last-active timestamps | Unit-testable pure functions; timestamps in `saheli.session`; documented in `ARCHITECTURE.md` §5 | ⏳ |
| M2-T4 | Wire `useAuth` to the session model and add an auth gate: app boots into Dashboard when the session is valid, into Language/Phone when it is not | Cold start with a valid session skips onboarding; expired session lands on phone entry | 🔒 needs M2-T3 |
| M2-T5 | Re-auth UX: pre-fill the phone number and show the amber "Session expired" banner when the user is bounced out | Banner localized; phone pre-filled from `saheli.user_phone` | 🔒 needs M2-T4 |
| M2-T6 | Make Sign Out clear session state (not just reset navigation), and confirm Delete Account clears every `saheli.*` key | Signing out and relaunching cannot reach Dashboard | 🔒 needs M2-T3 |

**Deferred to M8:** real SMS OTP delivery, server-side verification, refresh tokens.

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
| M9-T1 | Add React Native Testing Library; component tests for OTP input, BottomSheet, and Card | Tests run in `npm test` | ⏳ |
| M9-T2 | Unit tests for `utils/storage`, `i18n` language switching, and the M2-T3 session functions | Pure logic covered | 🔒 needs M2-T3 |
| M9-T3 | Locale completeness check — a script that fails when a key exists in `en.json` but is missing elsewhere | Runs in `npm test` or as a lint step | ⏳ |
| M9-T4 | CI workflow: install, `tsc --noEmit`, lint, test on every push | Green pipeline required to merge | ⏳ |
| M9-T5 | Accessibility pass: labels on icon-only buttons, contrast check across all three palettes, dynamic type sanity | Screen reader can navigate onboarding and dashboard | ⏳ |
| M9-T6 | Release prep: app icons, splash, versioning, signed Android/iOS builds | Installable build produced | ⏳ |
| M9-T7 | Repair the jest harness: install the missing `@react-native/jest-preset`, widen `transformIgnorePatterns` for the RN-ecosystem ESM packages, and mock gesture-handler / async-storage / safe-area-context | `npm test` runs and passes; documented in `ARCHITECTURE.md` §8 | ✅ 2026-07-30 |
| M9-T8 | Clean up the smoke test: (a) the React `act()` warning — `language.tsx` bumps `localeVersion` from the async `loadSavedLanguage()` callback, outside `act`; (b) the test never unmounts, so `@react-navigation/native`'s `useLinking` `setTimeout` stays pending and jest reports "did not exit" (surfaced by `M1-T2`'s extra async hop; exit code is still 0, but it will hang CI in `M9-T4`) | `npm test` passes with no console warnings and no open-handle notice | ⏳ |

---

## Open questions

Answer these before the milestones that depend on them; record answers in `docs/DECISIONS.md`.

1. **AI provider** (blocks M8-T1, M5-T5, M6-T5) — which model provider for OCR and parsing, and does inference run server-side?
2. **Backend** (blocks all of M8) — BaaS or custom API? Where does data live for Indian users?
3. **UPI** (blocks M6-T6) — deep-link into existing UPI apps, or integrate a payment SDK with the compliance work that implies?
4. **Notifications** (blocks M4-T4) — which library, and is a background scheduler needed?
5. **Product priority for M4–M7** — which domain module ships first after the foundation work?
6. **Dark mode trigger** — should Midnight follow the OS appearance setting, or stay manual-only?

---

## How to update this file

At the end of every session, run `prompts/session-close-doc-sync.md`. It will:

1. Flip completed task rows to ✅ with the date.
2. Move anything half-finished to 🚧 with a one-line note on where it stopped.
3. Add newly discovered work as new task rows (never as loose prose).
4. Recompute the milestone overview counts.
5. Move any answered open question into `docs/DECISIONS.md`.
