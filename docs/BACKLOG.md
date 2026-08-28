# Habita AI — Backlog Tracker

**Source of truth for what to build next.** Updated 2026-08-18 against branch `initial-static`, after `M2-T1`/`M2-T4`/`M2-T6`–`M2-T8` (`docs/DECISIONS.md` D-013–D-018), the Saheli → Habita AI rebrand (D-019, D-020), real Family & Managed Members backend integration (D-023 — supersedes `M3`'s local model, closes `M2-T9`, and partially closes `M8-T1`/`M8-T3`), a Postman-collection reconciliation pass (D-024 — adds the collection's `invites/history` endpoint, fixes stale filename references across the doc set, flags unfinished `medchest` scaffolding spotted in the collection), a second reconciliation pass against the same collection (D-030 — the backend added relation tracking to Family members: `relation`/`reciprocalRelation` on invite/accept, a `GET /families/relations` lookup, and a correctable `FamilyRelationship` resource; all now mirrored client-side), the multi-profile Medchest switcher (D-038, 2026-08-17), and **D-039 (2026-08-18)** — Family's role model collapsed from `OWNER/ADMIN/MEMBER/VIEWER` to `OWNER` (creator) / `MEMBER`, Medicine's unsecured delete endpoint fixed and wired up, and the prescription-upload pipeline's `ocrStatus`/duplicate-name/feedback gaps closed.

**M4–M8 were restructured this pass** to map onto `Habita AI Software Requirements Specification.md`'s actual module groups instead of the old generic "Medicine/Documents/Money/Safety" grouping — see D-020. Milestone *numbering* (M4–M7) is unchanged so existing prompt cross-references stay correct; the *content* under each number changed. For the short version of what to build next instead of this full tracker, read `NEXT_STEPS.md`.

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
| M1 | Foundation hardening | 🚧 In progress | 12 / 15 | Theme, dead code, fonts, typing |
| M2 | Auth & session (make it real) | 🚧 In progress | 6 / 9 | OTP, session lifecycle, guards, dependents (`M2-T9` done via D-023) |
| M3 | Family module completion | ✅ Done, superseded | 6 / 6 | Data layer replaced by the real backend (`M8-T3`, D-023) — UX decisions carry forward |
| M4 | Health & Life-Stage Suite | 🚧 In progress | 8 / 9 | Medical Chest, Wellness/CBT and Cycle tracking all done; only M4-T4 (notifications) left, blocked on OD-4 |
| M5 | Household Ledger & Assets | ⏳ Ready | 0 / 12 | Documents, Staff/Caregivers, Resources, Events, Vehicles |
| M4 | Health & Life-Stage Suite | 🚧 In progress | 5 / 10 | Medical Chest done, now backend-integrated when a family exists (`M4-T10`); Wellness/CBT, Cycle tracking next |
| M5 | Household Ledger & Assets | 🚧 In progress | 2 / 12 | Documents, Staff/Caregivers, Resources, Events, Vehicles |
| M6 | Global Finance & Commerce | 🚧 In progress | 4 / 6 | Multi-currency expenses, settlement engine, 30-day spend rollup, API client |
| M7 | Lifestyle & Smart Living | ⏳ Ready | 0 / 6 | Pantry, Wardrobe, Voice, live dashboard |
| M8 | Backend & AI integration | 🚧 In progress | 1 / 6 | Family sharing real (`M8-T3`); everything else still needs the backend reached (`M8-T1`) |
| M9 | Quality & release | 🚧 In progress | 1 / 9 | Tests, a11y, CI, store builds |

Recommended order: **M1 → M2 → M3**, then **one** domain module built end-to-end as a template before fanning out across M4–M7 — see `NEXT_STEPS.md` for the specific recommendation and reasoning. M8 unblocks nothing in M1–M3 but should be decided before M4+ grows real data it will need to migrate later. M9 runs continuously and gates any release.

**`M3` and `M8` overlap as of 2026-08-10 (D-023):** the real Family backend replaced `M3`'s local data layer outright — `M3`'s task rows stay ✅ (the UX they describe — owner guardrails, pending-invite visibility, localization — carries forward, now against real data) but the acceptance criteria are met by `M8-T3`'s work, not `M3-T4`'s `familyStore.ts`, which no longer exists. Read `M3`'s rows as "what UX shipped," not "what's implementing it today."

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
| M1-T2 | Route `habita.lang` and `habita.theme.palette` through `src/utils/storage.ts` instead of raw `AsyncStorage`, or document why they stay raw strings | One storage access path; `docs/ARCHITECTURE.md` §5 updated | ✅ 2026-07-30 |
| M1-T3a | Runtime theme switching mechanism: `subscribeToThemeChanges` observer, `useThemedStyles(factory)` hook, fix `useTheme`'s no-op `setState`; migrate `dashboard.tsx` as the pilot | A mounted component restyles when the palette changes, proven by a test that switches palette without unmounting | ✅ 2026-07-30 |
| M1-T3b | Migrate the remaining nine files to the `useThemedStyles(makeStyles)` factory pattern: `language/phone/otp/profile.tsx`, `FamilyScreen.tsx`, `BottomSheet/Button/Card/SectionHeader.tsx` | No module-scope `StyleSheet.create` reads `colors` anywhere; every screen restyles on palette change | ✅ 2026-07-31 |
| M1-T4 | Add a palette picker to the profile edit screen (Terracotta / Ocean / Midnight with swatches) | Selection persists, applies live, survives restart | ✅ 2026-07-31 — `profile.tsx` edit mode, under "Appearance"; names/descriptions localized in all 6 locales under `theme.*` |
| M1-T5 | Bundle Fraunces + DM Sans fonts, or replace `theme.fonts` with the platform stack | Text renders in the intended typeface on both platforms, or the token honestly names what renders | ⏳ |
| M1-T6 | Unify navigation typing on `NativeStackScreenProps` from `@react-navigation/native-stack`; drop `@react-navigation/stack` if unused | Single nav package in `package.json` deps; `tsc` green | ⏳ |
| M1-T7 | Give dashboard tiles and quick actions stable IDs; route on ID, not translated label | Family tile still navigates when the app is in Hindi; adding a route needs no string matching | ✅ 2026-08-08 — resolved as a side effect of `M4-T1`'s dashboard wiring: `tiles`/`quickActions` in `dashboard.tsx` now carry a stable `id` (`TileId`/`ActionId`), and `handleTilePress`/`handleActionPress` route on it, not `tile.title` |
| M1-T8 | Replace the `key={localeVersion}` remount pattern with a proper i18n hook/Context (`useTranslation()`) | Language switch re-renders without remounting subtrees; state is not lost on switch | ⏳ |
| M1-T9 | Add a `textOnPrimary` role to `PaletteColors` and all three palettes; replace the three inline `{ color: '#FFF' }` in `language.tsx:83` and `profile.tsx:256,262` | No inline hex left in any screen; the active-card label stays legible in Midnight, where `surfaceElevated` is `#2A2440` and is *not* a valid substitute | ✅ 2026-07-31 — done with `M1-T11`; six roles added, not one (see that row) |
| M1-T10 | Wire `shadow.soft`/`shadow.medium` to each palette's `shadowColor` instead of hardcoding `#C96B5D`/`#7D3F3F`, so Midnight casts a black shadow | `shadow` follows the active palette; no hardcoded hex in the shadow tokens | ✅ 2026-07-30 |
| M1-T11 | Replace the 38 hardcoded hex values still inside the migrated style blocks with palette roles — 12 are `backgroundColor: '#FFF'` on cards, inputs and chips (`language`, `phone`, `otp`, `profile`, `FamilyScreen`), which now stay white while everything around them turns dark in Midnight; the rest are light-on-primary text (`#FFF`, `#F8ECE4`, `#FFE8A3`) and the danger-zone pair (`#FDE8E8`/`#F8B4B4`). Surfaced by `M1-T3b`: before it, nothing restyled, so nothing looked wrong | `grep "'#"` returns nothing in `src/**/*.tsx`; Midnight has no white cards or unreadable labels. Overlaps `M1-T9`, which adds the `textOnPrimary` role this needs — do `M1-T9` first | ✅ 2026-07-31 — six roles added (`textOnPrimary`, `textOnPrimaryMuted`, `textOnPrimaryAccent`, `turmericSoft`, `dangerSoft`, `dangerBorder`); `PaletteColors` is now 21 roles; `npm run lint` is warning-free for the first time |
| M1-T12 | Dashboard visual polish, direct user feedback (not a pre-planned task): (1) quick-action card shadows were invisible — the horizontal `ScrollView` clipped to card height with no padding, cutting off `shadow.soft`; (2) hero badge/stat chips used bright hardcoded `rgba(255,255,255,…)` fills, read as "not mature/professional"; (3) hero card opacity faded to 20% by just 70px of scroll, making its content briefly illegible | Quick-action shadows visible in all three palettes; hero/stat chips use palette tokens, not raw `rgba`; hero card dims but stays legible while scrolling | ✅ 2026-08-05 — `dashboard.tsx`: `horizontalScroll` gained padding; `badgeItem`/`statsCard` moved to a transparent+`textOnPrimaryMuted`-border outline treatment; `actionCard` moved to an outline treatment (`colors.background` fill, `borderStrong` border, smaller shortcut emoji); `heroCardContainer` gained a `primaryDark` border and dropped to `radius.xl`; `heroCardOpacity` widened to `0 → 160` and floored at `0.55` instead of `0.2`. Icon-only tiles/quick-actions still render as raw emoji, not a vector icon set — the largest remaining lever for a "professional" look, but out of scope here since it needs a new dependency (agent.md rule 7) |
| M1-T13 | Replace `dashboard.tsx`'s emoji glyphs (tiles + quick actions) with a real icon set — direct user follow-up to `M1-T12`, approved as a new dependency (`docs/DECISIONS.md` D-010) | Icons render as vector strokes tinted with `colors.primary` in all three palettes; `tsc`/lint/tests stay green; no raw emoji left in `dashboard.tsx`'s icon slots | ✅ 2026-08-05 — added `lucide-react-native` + `react-native-svg`; per-icon subpath imports (`lucide-react-native/icons/<name>`) keep the bundle to the ~15 icons actually used instead of the whole set; `jest.config.js` needed both `transformIgnorePatterns` (existing pattern) and an expanded `transform` regex, since the preset's default only matches `.js/.ts/.tsx` and lucide's package `exports` resolve to `.mjs`. Only `dashboard.tsx` is migrated — `FamilyScreen.tsx`'s role/permission icons and any future screens still use emoji or none |
| M1-T14 | Dashboard restructure — `M1-T12`/`M1-T13` were token/icon swaps on the same layout, and the user was explicit that wasn't enough ("you have kept the design and position same, i want to have different looking"). Rebuilt the section shape, not just its colors: see `docs/DECISIONS.md` D-011 | Hero card removed; quick actions and module tiles read as structurally different sections, not a re-skinned version of the old ones; `tsc`/lint/tests stay green | ✅ 2026-08-05 — `dashboard.tsx`: the `primary`-filled hero card is gone, replaced by a plain-background greeting + a muted status line + two neutral bordered stat cards (`statCard`, reusing `Card`'s visual language inline); quick actions moved from a horizontal `Card`-in-`ScrollView` strip to a wrapping 3-column grid of icon-in-circle `Pressable`s (`blush`-tinted circle, no card chrome); the tile grid became a single-column bordered list group (`moduleList`) with a divider between rows and a `ChevronRight` — a settings-list pattern instead of a 3×3 icon grid. The scroll-driven `heroCardScale`/`heroCardOpacity` animations (`M1-T3a`, tuned in `M1-T12`) no longer apply and were deleted, not just adjusted; `docs/ARCHITECTURE.md` §6 updated to match |
| M1-T15 | Modern Glassmorphic UI Overhaul, Floating Bottom Navbar Dock & Responsive Layout Suite (D-044) | Transformed UI to high-tech glassmorphism matching modern reference: `ModernBottomNav` floating pill dock with center glowing action button, `GlassCard` with variants, `StatWaveChart` with SVG cubic bezier spline and interactive node tracking, `QuickActionTile` with squircle glow, `SearchPill` with AI mic prompt, `ResponsiveContainer` and `useResponsive` tablet scaling (`maxWidth: 640`), 6-locale strings in lockstep, all 166 tests pass | ✅ 2026-08-23 — D-044 |

---

## M2 — Auth & session 🚧

Goal: the login flow actually gates the app. **No longer local/demo** — `M2-T1` (2026-08-05, `docs/DECISIONS.md` D-012) wired onboarding to the real backend (`Saheli Backend — Auth, Profile & Family.postman_collection.json`, repo root — this filename itself changed on disk 2026-08-10, D-024). What's left is session *lifecycle* polish and the SRS's Managed Members concept, not the auth calls themselves.
**Prompt:** `prompts/backlog-task-kickoff.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M2-T1 | Implement real OTP verification in `otp.tsx` against the backend's `POST /auth/verify-otp`, show an inline error on mismatch, disable Verify until 6 digits are entered | Wrong code never advances; error is localized in all 6 locales | ✅ 2026-08-05 — superseded its own original spec (demo code `123456`) once the real backend from the Postman collection made that unnecessary; also wired `phone.tsx` to `login`/`register` and `profile.tsx` to `POST /profile/create` / `PUT /profile/details`. See `docs/ARCHITECTURE.md` §6. **2026-08-06 follow-up** (`docs/DECISIONS.md` D-013): the user supplied a richer collection with full saved examples, which caught real bugs in the first pass — the phone format sent to the backend (was the full display string, backend wants bare 10 digits), `parseAuthError`'s status-only mapping (every 4xx is a 400, not 404), and `PUT /profile/details` incorrectly including `name`. Also added: `GET /profile/details` (edit-mode load), `PUT /profile/profilePhoto` (edit-mode photo changes), `devOtp` prefill, `expiresIn`/`userId` capture. **2026-08-07 follow-ups, same day** (`docs/DECISIONS.md` D-014, D-015): live-tested profile creation twice against a real backend, with real server logs both times. First (D-014): the `D-013` Content-Type object broke it, reverted to a plain string — but that revert was itself then disproven by a backend log showing the plain string arrives as `Content-Type: application/octet-stream` and gets a 415. Second (D-015): re-applied the Content-Type object, since the theory that justified reverting it was never actually confirmed by evidence, unlike the plain string's failure — **confirmed working** by a third live test the same day: backend log shows the JSON part parsed correctly, the photo uploaded to S3, and "profile saved successfully." That same test then hit an unrelated backend-side bug (D-016, not fixed here — re-creating a profile for a user that already has one 500s on a DB constraint instead of updating or returning a clean conflict) |
| M2-T2 | Add resend timer (`onboarding.resend_in` / `onboarding.resend` strings already exist) and a "Change number" link back to the phone step | Countdown runs, resend re-enables at 0, both strings used | ✅ 2026-08-08 — `otp.tsx`: a 30s self-rescheduling `setTimeout` countdown (`RESEND_COOLDOWN_SECONDS`) gates a "Resend" link that calls the same `useAuth().login()` (`loginOrRegister`) the Phone screen uses; "Change number" calls `navigation.goBack()`. Both existing locale strings used as-is, no new strings needed. `docs/ARCHITECTURE.md` §6/§9/§10 updated — §10 in particular, since this made `otp.tsx` no longer mount-effect-free (still a safe test-mount target, since the smoke test unmounts inside `act()`) |
| M2-T3 | Build a real session model: persisted issued-at timestamp (done), 15-minute idle expiry, 24-hour absolute expiry, silent refresh via the now-existing `refresh()` call on an expired token | Unit-testable pure functions; timestamps in `habita.session`; documented in `ARCHITECTURE.md` §6 | 🚧 2026-08-11 — silent refresh done (`docs/DECISIONS.md` D-027): `useAuth()`'s `getAccessToken`/`getUserId` now transparently call `refresh()` when the access token has expired (or is about to), confirmed live against a real backend; a fully-expired refresh token clears the session outright. Still missing: idle timeout and absolute expiry as *proactive* checks (today's refresh is reactive — triggered by the next `getAccessToken()` call, not a timer) — a session left completely untouched past its refresh token's own life isn't detected until something tries to use it |
| M2-T4 | Wire `useAuth` to the session model and add an auth gate: app boots into Dashboard when the session is valid, into Language/Phone when it is not | Cold start with a valid session skips onboarding; expired session lands on phone entry | 🚧 2026-08-05 — cold-start guard landed in `_layout.tsx` (`initialRouteName` picked from `useAuth().signedIn` after the boot check); the "expired session" half needs `M2-T3`'s expiry logic first, since nothing currently detects expiry |
| M2-T5 | Re-auth UX: pre-fill the phone number and show the amber "Session expired" banner when the user is bounced out | Banner localized; phone pre-filled from `habita.user_phone` | 🔒 needs M2-T3/M2-T4's expiry detection |
| M2-T6 | Make Sign Out clear session state (not just reset navigation), and confirm Delete Account clears every `habita.*` key | Signing out and relaunching cannot reach Dashboard | ✅ 2026-08-05 — `handleSignOut` now calls `useAuth().logout()` (clears `habita.session`) before resetting navigation; `clearAll()` (Delete Account) already wiped it since it clears every key |
| M2-T7 | Direct user bug report after live device testing (not pre-planned): (1) a returning user (login, not register) landed on Profile setup after OTP instead of Dashboard, since `otp.tsx` always navigated to `'Profile'`; (2) the `devOtp` prefill (`M2-T1`) was explicitly unwanted — "keep it empty"; (3) the hand-rolled 6-`TextInput` OTP box couldn't be cleanly cleared/edited once filled | Returning users land on Dashboard, new users on Profile; OTP field starts empty; OTP input is easy to correct after a wrong code | ✅ 2026-08-07 — `docs/DECISIONS.md` D-017. `loginOrRegister` now returns `{isNewUser}` (login succeeded → `false`, fell back to register → `true`), threaded through `navigation.navigate('Otp', {isNewUser})` and read in `otp.tsx` to pick `Profile` vs `Dashboard` after a successful verify. `devOtp` removed end-to-end — `register`/`login` are back to `Promise<void>`, nothing OTP-related is inferred from their response. Replaced the custom digit-box `TextInput` array with `react-native-otp-entry`'s `OtpInput` (pure JS, no native rebuild) — one real backing input instead of six, so normal text editing/backspace works; a wrong code now auto-clears and refocuses instead of leaving 6 filled boxes to delete by hand |
| M2-T8 | More direct user feedback: (1) Role picker (Household CEO / Individual) showing during first-time Profile setup wasn't wanted there; (2) the GPS-prefilled location field showed raw `"lat, lng"` instead of a real place name — the reverse-geocoding gap `M2-T1`/D-012 had explicitly deferred | Role picker absent from onboarding, still available from Profile edit; location prefills with a real city/state name, falling back gracefully | ✅ 2026-08-07 — `docs/DECISIONS.md` D-018. Role section wrapped in `isEditing`; state/default/persistence unchanged, only the picker UI is conditional. Added `reverseGeocode()` (`profile.tsx`) using OpenStreetMap's Nominatim via plain `fetch` — no API key, no new dependency; falls back city → state-qualified city → Nominatim's `display_name` → raw coordinates if the lookup itself fails |
| M2-T9 | Model `ManagedMember` — the SRS's non-autonomous dependents concept (children, elderly family members, pets) tied to the primary account holder (SRS Module Group 1, item 1) | A dependent can be added/edited/removed from the Family screen | ✅ 2026-08-10 — closed by the real backend integration (`docs/DECISIONS.md` D-023), not the local-first plan this row originally specified: `POST/DELETE /families/{id}/managed-members`, wired into `FamilyScreen.tsx`'s "Add a dependent" sheet. No `habita.managed_members` key — dependents live server-side, same as the rest of Family (`docs/ARCHITECTURE.md` §7) |

**No longer deferred to M8** (superseded by `M2-T1`): server-side OTP verification and refresh tokens are real now — see `docs/ARCHITECTURE.md` §6 for the exact contract and what's still unverified against a live backend. **Also no longer deferred** (superseded by `M8-T3`, `docs/DECISIONS.md` D-023): Family sharing — see `docs/ARCHITECTURE.md` §7. **Still deferred to M8:** anything beyond auth/profile/family (dashboard, documents, money, …) — see `docs/DECISIONS.md` D-012/D-023.

---

## M3 — Family module completion ✅ (data layer superseded 2026-08-10, D-023)

Goal (as of 2026-08-08): bring the one built domain module up to the standard every later module must meet. This is also SRS Module Group 1, item 2 (Multi-Tenant Family Sharing) — the jsonb-shaped permission matrix the SRS describes was already roughly how `FamilyMember.permissions` was stored locally, so this milestone stayed aligned with the target architecture, not just internal cleanup.

**Superseded 2026-08-10:** the real Family backend (`M8-T3`, `docs/DECISIONS.md` D-023) replaced everything below's data layer — `familyStore.ts` and `habita.family_members` no longer exist. The task rows stay ✅ because the UX they shipped (localization, owner guardrails, pending-invite visibility, a distinct leave-vs-remove action) carries forward against the real backend; read "acceptance criteria" below as history, not as what the code does today. One piece did **not** carry forward: the granular `permissions` matrix (`medicines`/`expenses`/`documents`/`safety` toggles, `M3-T5`'s derived "Modules Synced" stat) has no backend equivalent and was deleted, not ported — see `docs/ARCHITECTURE.md` §7.
**Prompt:** `prompts/i18n-localization-pass.md` for T1, `prompts/backlog-task-kickoff.md` for the rest.

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M3-T1 | Localize `FamilyScreen.tsx` — move every hardcoded string to a `family.*` namespace in all 6 locale files | No literal user-facing English left in the file; screen reads correctly in Hindi and Arabic | ✅ 2026-08-08 — 61 keys added under `family.*` in all six locale files (verified: identical key set across locales); screen subscribes to `subscribeToLanguageChanges` and keys its root view on `localeVersion`, same pattern as every other localized screen |
| M3-T2 | Owner guardrails: the owner cannot be demoted, removed, or stripped of permissions; removal requires typed/explicit confirmation | Attempting either is blocked with a localized explanation | ✅ 2026-08-08 — editing the owner hides the role/permission controls entirely (replaced with `family.owner_locked_note`) rather than just discouraging the change; `handleSaveMember` also enforces this server-side-of-the-form (an owner's `role`/`permissions` are never touched on save, even defensively); `handleRemoveMember` blocks with `family.owner_remove_blocked_title/msg` if somehow invoked against the owner, though the Remove button is no longer rendered for them at all |
| M3-T3 | Invite lifecycle states: `pending` / `accepted` / `declined` on `FamilyMember`, with pending members visually distinct and an accept/decline affordance in demo mode | State persists; member counts exclude pending | ✅ 2026-08-08 — `status: 'pending' \| 'accepted' \| 'declined'` added to `FamilyMember` (`src/features/family/types.ts`); new invites start `pending`; pending cards get a dashed `turmeric` border and a "Pending" badge, with Accept/Decline buttons in place of the permission tags; `activeMembers` (status !== 'pending') is what the Members/Editors stats and the permission-sync derivation (M3-T5) read from |
| M3-T4 | Consolidate the two `FamilyMember` definitions into `src/features/family/types.ts`; move storage access into `src/features/family/familyStore.ts` | Screen imports types and store; no duplicate interface | ✅ 2026-08-08 — `FamilyMember` now defined once, in `src/features/family/types.ts`; `FamilyScreen.tsx` re-exports the type for any external import rather than redefining it. Storage (`FAMILY_STORAGE_KEY`, `DEFAULT_MEMBERS`, `loadFamilyMembers`, `saveFamilyMembers`) moved to `src/features/family/familyStore.ts` |
| M3-T5 | Align the permission set with the modules that actually exist, and derive the "Modules Synced" stat instead of hardcoding `4 / 4` | Stat reflects real permission counts | ✅ 2026-08-08 — `IMPLEMENTED_PERMISSION_MODULES` (`types.ts`) is a real registry of which permission categories have a built module behind them, starting empty; the hero stat renders `${synced}/${implemented}` (members with that permission enabled, out of active members, for each implemented module) instead of a literal `4 / 4`. Reads `0 / 0` until `M4-T1` adds `'medicines'` to the registry — an honest empty state, not a bug |
| M3-T6 | "Leave family" action for non-owner members | Localized confirmation; member removed from local store | ✅ 2026-08-08 — a distinct "Leave Family" text action (separate from "Remove Member from Group") in the edit sheet for any non-owner member, own confirmation copy (`family.leave_confirm_*`). Note: this repo has no concept of "which member is the current device's user" (single local list, owner's-eye view) — true self-service leave, initiated from the leaving member's own device, needs the multi-tenant backend from `M8`; this is the local-first interface for it, same pattern as `M2-T1`'s invites |

---

## M4 — Health & Life-Stage Suite 🚧

Goal: the first modules built on the hardened foundation, covering SRS Module Group 2 — Medical Chest & Prescriptions (`medchest`), Mental Health & CBT Coaching (`wellness`), and Hormonal Health & Life-Stage Tracking (`cycle`). Medical Chest was the recommended first build — see `NEXT_STEPS.md` for why — and it's done; its task shape (scaffold → CRUD → derived dashboard stat → permission gate) is the template for the rest of M4 and for M5–M7.
**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M4-T1 | `src/features/medicine/` scaffold (Medical Chest): screen, types, store, route registration, dashboard tile wiring | Tile navigates; screen matches design-system tokens | ✅ 2026-08-08 — `src/features/medicine/{types,medicineStore,MedicineScreen}.tsx`; route registered in `_layout.tsx`; new "Medicine" dashboard tile plus the previously no-op "Take medicine" quick action both navigate there. Wiring this used stable tile/action IDs instead of matching on the translated label — see `M1-T7`, resolved as a side effect |
| M4-T2 | Medicine list + add/edit bottom sheet (name, dosage, schedule, stock count) | CRUD persists to `habita.medicines`; key documented | ✅ 2026-08-08 — full add/edit/remove via `BottomSheet`; schedule is a multi-select of `morning/afternoon/evening/night` slots (chips, same pattern as `FamilyScreen`'s relationship picker); documented in `docs/ARCHITECTURE.md` §5 |
| M4-T3 | Daily "take medicine" log and 7-day adherence calculation | Dashboard adherence stat reads from real data instead of `3 Active` | ✅ 2026-08-08 — each scheduled slot on a medicine card is a "mark taken" pill for today (locks once taken, decrements `stock`); entries persist to `habita.medicine_intake_log`; `calculateAdherence()` (`medicineStore.ts`) is a pure function — expected doses over the trailing 7 days vs. logged intake — read by both the Medicine screen's own stat chip and the dashboard's "7-day adherence" card, which now shows a real percentage (or `—` with zero medicines) instead of the hardcoded `3 Active` |
| M4-T4 | Local notification reminders for scheduled doses | ❓ Needs decision on notification library | ❓ |
| M4-T5 | Respect the family `medicines` permission when viewing another member's chest | Viewer role cannot edit | ✅ 2026-08-08 — the family member flagged `relation: 'self'` (same convention `FamilyScreen.tsx` uses to mean "the current device's user") is checked on load; if their role is `viewer` or their `medicines` permission is off, the screen renders read-only (no Add button, no edit-on-tap, no "mark taken"), with a localized banner explaining why. Same caveat as `M3-T6`: true per-device "which member is using this app" identity needs the multi-tenant backend from `M8` |
| M4-T6 | `src/features/wellness/` scaffold: mood entry logging (SRS Mental Health & CBT Coaching) | Mood entries persist to `habita.mood_entries`; tile navigates | ✅ 2026-08-20 — `src/features/wellness/{types,wellnessStore,cbtCoach,WellnessScreen}`; the dashboard's previously no-op "Wellness" tile now routes, plus a new "Log mood" quick action. A `MoodEntry` carries a 1–5 level, attributed factors (`work/family/sleep/health/money/self`) and a note; the 5-face strip pre-selects a level and opens the sheet, so a real-time check-in is two taps. Derived stats (7-day average, check-in streak, per-day trend, top factors) are pure functions in `wellnessStore.ts`, unit-tested in `__tests__/healthModules.test.ts` |
| M4-T7 | Static, localized guided-meditation content list — real AI CBT coaching waits on M8's LLM integration (`M8-T4`) | Content renders and is selectable in all six locales; no network call | ✅ 2026-08-20 — four guided meditations (`box_breath`, `body_scan`, `wind_down`, `focus_reset`), each with a category, duration and four steps, opened in a `BottomSheet`. The CBT assistant ships as `LocalCbtCoach` behind a `CbtCoach` interface (`cbtCoach.ts`): deterministic, offline, and returning **i18n keys rather than text**, so all six locales are covered by construction — see `docs/DECISIONS.md` D-030 for why it regulates before it reframes at mood 1–2, and how `M8-T4` swaps it out without touching the screen |
| M4-T8 | `src/features/cycle/` scaffold: period-date logging and a local next-cycle prediction (SRS Hormonal Health & Life-Stage Tracking) | Cycle entries persist to `habita.cycle_log`; prediction is a pure, unit-tested function | ✅ 2026-08-20 — `src/features/cycle/{types,cycleStore,CycleScreen}`; new "Cycle" dashboard tile plus a "Log period" quick action. `predictNextCycle()` is pure with `today` injected — next start, ovulation, fertile window, current phase, day-of-cycle and a `low/medium/high` confidence derived from how many completed cycles back it — and returns `null` rather than inventing a forecast with no history or in the menopause stage. Implausible gaps (<21 or >45 days, i.e. a mis-typed date) are excluded from the average rather than clamped into it. Settings live in `habita.cycle_settings` |
| M4-T9 | Life-stage tailored content — fertility planning, postpartum recovery, perimenopause, menopause guidance, static and local | Content selectable by life stage, localized in all six locales | ✅ 2026-08-20 — five stages (`cycling`, `fertility`, `postpartum`, `perimenopause`, `menopause`), each with a description plus three nutrition and three movement items, all localized. The stage is not cosmetic: it changes what is predicted (menopause switches prediction off; postpartum and perimenopause hide the ovulation/fertile-window rows), caps confidence at `medium` for perimenopause, and gates the fertile-window reminder to the stages it is meaningful for. `upcomingReminders()` derives what *would* be notified; real OS notifications still need `M4-T4`/`OD-4` |
| M4-T10 | Wire `MedicineScreen.tsx`/`medicineStore.ts` to the real Medchest backend (`docs/BACKEND_CONTEXT.md`'s Medchest subsection, `docs/DECISIONS.md` D-032/D-035) — the API layer (`src/features/medicine/api.ts`) already exists | Medicine CRUD, intake logging, adherence, and prescription management read from real backend when a family exists | ✅ 2026-08-13 — D-035: deployment confirmed live via a direct `curl` check; "Remove Medicine" wired D-039 via secured `DELETE /api/medicine/{id}`. Multi-profile switcher and Add Profile sheet (D-038). Prescription document picker & OCR pipeline (D-037/D-039), picker i18n & full processing (D-040), document options bottom sheet & fullscreen viewer (D-041), document deletion via `DELETE /api/profiles/{id}/documents` (D-042), and medicine creation/update payload normalization & profile creation empty state flow (D-043) |

---

## M5 — Household Ledger & Assets ⏳

Goal: covers SRS Module Group 3 in full — Household Document Hub (`dochub`), Caregiver & Home Services Hub (`staff`), Resource & Utility Logistics (`resources`), Shared Family Events & Budgeting (`events`), and Property Asset Vault & Vehicle Upkeep (`vehicles`).
**Prompt:** `prompts/new-feature-module.md`

**Not the same thing as `M4-T10`'s prescription upload** (D-037, 2026-08-13): that one uploads to `POST /profiles/{familyProfileId}/documents`, a Medchest-specific, medical-only document store scoped to one `FamilyProfile`. This module's Document Hub (`M5-T1`–`M5-T5`) is the general-purpose household document vault the SRS describes — insurance, licences, passports — a different domain, different backend surface (none exists yet for this one), and a different `src/features/documents/` module, not to be confused or merged with Medchest's.

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M5-T0 | Static `Household Operations` overview route and dashboard tile | One localized, token-based screen presents the four Module Group 3 domains without implying unfinished integrations work | ✅ 2026-08-17 |
| M5-T1 | `src/features/documents/` scaffold + dashboard tile wiring (Document Hub) | Tile navigates | ⏳ |
| M5-T2 | Document capture via `react-native-image-picker` (already a dependency) and local file references | Documents persist with title, category, date, URI | 🔒 needs M5-T1 |
| M5-T3 | Categories, tags, and search over stored documents | Filtering works offline | 🔒 needs M5-T2 |
| M5-T4 | Expiry reminders for documents with an expiry date (insurance, licence, passport, visa) | Due items surface as dashboard "Due" count | 🔒 needs M5-T2 |
| M5-T5 | Define the OCR hook-point: an interface the AI provider will implement, with a manual-entry fallback | Interface exists and is called; no provider required to ship | 🔒 needs M8-T1 for the real implementation |
| M5-T6 | `src/features/staff/` scaffold: caregiver/domestic-staff profiles (SRS Caregiver & Home Services Hub) | Tile navigates; CRUD persists to `habita.caregivers` | ✅ 2026-08-17 |
| M5-T7 | Attendance logging and hourly/monthly rate capture per caregiver | Attendance entries persist and are attributable to a caregiver | 🔒 needs M5-T6 |
| M5-T8 | Local wage ledger — advances, tips, and a formatted summary view (no real money movement until `M8`) | Ledger totals compute correctly; summary matches entries | 🔒 needs M5-T7 |
| M5-T9 | `src/features/resources/` scaffold: recurring-delivery quick-tap counters (SRS Resource & Utility Logistics) | Tile navigates; taps persist to `habita.resource_log` | ✅ 2026-08-17 |
| M5-T10 | Utility bill capture routed through the OCR hook-point from M5-T5 | Capture → prefilled resource entry | 🔒 needs M5-T5, M5-T9 |
| M5-T11 | `src/features/events/` scaffold: event folders and budget line items, feeding the dashboard "Pending" count | Dashboard pending count derived from real events | ⏳ |
| M5-T12 | `src/features/vehicles/` scaffold: vehicle records plus a general property asset vault (appliance warranties, manuals, maintenance tasks) | The "Add fuel" quick action (currently goes nowhere) routes to a real screen; asset entries persist | ⏳ |

---

## M6 — Global Finance & Commerce ⏳

Goal: SRS Module Group 4's finance pair — Multi-Currency Expense Groups and Payment Rails & Global Subscriptions. Wider scope than the old backlog's India-only framing: every entry needs a currency field, and the payment-rail decision spans three gateways, not one.
**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M6-T1 | `src/features/money/` scaffold + tile wiring, with a currency field on every entry (SRS Multi-Currency Expense Groups) | Tile navigates; currency field present and defaults sensibly per locale (`INR`, `USD`, `EUR`, `AED`, `GBP`) | ✅ Done (2026-08-27, D-052) |
| M6-T2 | Expense entry (amount, currency, category, date, payer, note, dynamic split types EQUAL/PERCENTAGE/SHARES) with local persistence and backend API client (`POST /api/expense-groups/{id}/expenses`) | CRUD persists; key documented; wired to backend with offline fallback | ✅ Done (2026-08-27, D-052) |
| M6-T3 | 30-day spend rollup that replaces the hardcoded `₹12,450` on the dashboard (`GET /api/expenses/summary/30-day`) | Dashboard reads derived total converted to base display currency with fallback to `loadExpenses()` | ✅ Done (2026-08-27, D-052) |
| M6-T4 | Shared expense groups with per-member split, greedy debt minimization, settlement logging (`POST /api/expense-groups/{id}/settlements`), full sync endpoint (`GET /api/expense-groups/{id}/sync`), and unit tests | Splits computed and displayed correctly across currencies; full sync and offline fallback active | ✅ Done (2026-08-27, D-052) |
| M6-T5 | Bill scan entry point that routes to the OCR hook-point from M5-T5 | Scan → prefilled expense form | 🔒 needs M5-T5 |
| M6-T6 | Payment rails: Razorpay (India UPI) plus Stripe and PayPal (global), per SRS §Module 12 | ❓ Needs decision: deep-link vs SDK per gateway; compliance review required for each | ❓ |


---

## M7 — Lifestyle & Smart Living ⏳

Goal: the remaining SRS Module Group 4 items — Smart Pantry & Allergen Radar, Wardrobe & Weather-Adaptive Style Mirror, and Voice Command & Orchestration — plus taking the Home Dashboard from a static shell to the SRS's real aggregated feed.
**Prompt:** `prompts/new-feature-module.md`

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| M7-T1 | `src/features/pantry/` scaffold: grocery inventory with an Allergen Radar tag set (Gluten-Free, Vegan, Halal, Kosher, Nut Allergies) — barcode/receipt scanning routes through the M5-T5 OCR hook-point (SRS Smart Pantry & Allergen Radar) | Tile navigates; items persist to `habita.pantry_items` with allergen tags; matching items are flagged | ⏳ |
| M7-T2 | Expiry Engine — alerts before food spoils, surfaces on the dashboard "Due" count | Expiring items flagged and counted correctly | 🔒 needs M7-T1 |
| M7-T3 | `src/features/wardrobe/` scaffold: digital closet with secure photo storage (SRS Wardrobe & Weather-Adaptive Style Mirror) | Tile navigates; items persist with photos | ⏳ |
| M7-T4 | Weather-adaptive outfit suggestions — a local rule-based version now; the real AI "Style Mirror" waits on `M8-T4`'s LLM integration | Suggestion logic is a pure, testable function taking weather + calendar as input | 🔒 needs M7-T3 |
| M7-T5 | Voice command entry point: a local intent parser for the most common actions (open a module, log medicine, add an expense), routing to existing screens — real NLP waits on `M8-T4` | Entry point exists, reachable from a mic affordance on the dashboard; falls back to "not understood" gracefully instead of crashing | 🔒 needs M8-T1 for the real implementation |
| M7-T6 | Home Dashboard goes from static to a real aggregated feed — replace every remaining hardcoded stat/pending/due number as its owning module ships (SRS §Module 16, Home Dashboard) | Every dashboard number matches its source module's real data | 🔒 needs the modules above, incrementally |

---

## M8 — Backend & AI integration ❓

Goal: replace device-local storage with the SRS's real backend, and add the AI features the product promises. **The SRS answers *what* the backend and AI provider will be** — custom Spring Boot 3.3/Java 21/PostgreSQL 16, dual-LLM via OpenAI gpt-4o-mini + Google Gemini 2.5-flash, server-side (`Habita AI Software Requirements Specification.md` §2–3, `docs/DECISIONS.md` D-020) — but **none of it exists yet**. This milestone is this client's integration work once that backend is reachable, not a from-scratch backend-selection exercise the way it was before the SRS.

| ID | Task | Blocking question | Status |
| --- | --- | --- | --- |
| M8-T1 | Gain access to a reachable Habita AI backend instance and its full API contract, in the same documented shape `Saheli Backend — Auth, Profile & Family.postman_collection.json` provides today for auth | Building the Spring Boot backend itself is outside this repo's scope — this task is "get one to integrate against," not "build one." `docs/BACKEND_CONTEXT.md` tracks what's confirmed live so far and the suggested build order, so backend progress and this repo's M4–M7 don't silently diverge | 🚧 2026-08-13 — reachable and integrated for auth, profile, and family, including invite history and relation tracking (`docs/DECISIONS.md` D-012, D-023, D-024, D-030); the collection also shows early, not-yet-usable `medchest` scaffolding (`docs/BACKEND_CONTEXT.md` §2) — the other 15 SRS domains still have no backend to integrate against |
| M8-T2 | Introduce an API/repository layer so screens stop reading `AsyncStorage` directly, generalizing the pattern `src/features/auth/api.ts` already established for auth/profile | Depends on M8-T1 | 🔒 |
| M8-T3 | Real multi-tenant family sharing with server-enforced permissions (SRS §2.3's cascading deletes and jsonb permission matrix) | Depends on M8-T1 | ✅ 2026-08-10 — `docs/DECISIONS.md` D-023: real create/invite-and-consent/role-management/Managed-Members against `/api/families/**`, server-enforced (every mutating endpoint requires `OWNER`/`ADMIN`, checked server-side). **Does not** claim the SRS's jsonb permission matrix specifically — the deployed backend has no per-module permission concept at all, only the three roles; the client's old local permission matrix was deleted rather than kept as client-side-only fake state. **2026-08-13 follow-up** (D-030): the backend added relation tracking — who a member is to the family's other members (`MOTHER`/`SON`/…), set at invite/accept time and correctable afterward via a separate `FamilyRelationship` resource — now mirrored in `FamilyScreen.tsx`'s invite/accept/edit flows and all six locales. **2026-08-18 follow-up** (D-039): the `OWNER`/`ADMIN`/`MEMBER` role set itself was replaced with a simpler creator/member split (`OWNER`/`MEMBER`) at the user's direct request — add actions (invite, managed-member, viewing pending invites/history, correcting a relationship) are now open to any member; only removing another member stays creator-gated; any non-creator member can now leave on their own, closing a real self-service-leave gap this row didn't originally have visibility into |
| M8-T4 | Wire every AI hook-point defined along the way — OCR (`M5-T5`), voice (`M7-T5`), style suggestions (`M7-T4`), CBT coaching content (`M4-T7`) — to the backend's `LlmClientService` | Depends on M8-T1; each hook-point's manual/local fallback must keep working if the AI call fails | 🔒 |
| M8-T5 | Real SMS OTP delivery and server-side verification hardened for production scale (already partially real per `M2-T1`; this is the production-hardening pass) | Depends on M8-T1 | 🔒 |
| M8-T6 | Offline-first sync and conflict handling once every module is server-backed | Depends on M8-T2 | 🔒 |

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
| M9-T7 | Repair the jest harness: install the missing `@react-native/jest-preset`, widen `transformIgnorePatterns` for the RN-ecosystem ESM packages, and mock gesture-handler / async-storage / safe-area-context | `npm test` runs and passes; documented in `ARCHITECTURE.md` §10 | ✅ 2026-07-30 |
| M9-T8 | Clean up the smoke test: (a) the React `act()` warning — `language.tsx` bumps `localeVersion` from the async `loadSavedLanguage()` callback, outside `act`; (b) the test never unmounts, so `@react-navigation/native`'s `useLinking` `setTimeout` stays pending and jest reports "did not exit" (surfaced by `M1-T2`'s extra async hop; exit code is still 0, but it will hang CI in `M9-T4`) | `npm test` passes with no console warnings and no open-handle notice | ⏳ (a) did not reproduce on 2026-07-31 — checked against a stashed-clean tree, so it is timing-dependent, not fixed; (b) still reproduces on every run |

---

## Open questions

Answer these before the milestones that depend on them; record answers in `docs/DECISIONS.md`.

1. **AI provider** — answered at the *target-architecture* level by the SRS: OpenAI gpt-4o-mini + Google Gemini 2.5-flash, server-side, dual-provider (`docs/DECISIONS.md` D-020). Still blocks `M8-T4` in practice, since no backend exists yet to call.
2. **Backend** — answered at the target-architecture level: a custom Spring Boot/PostgreSQL API, not a BaaS (D-020). Still open at the deployment-detail level — data residency for Indian users specifically isn't specified by the SRS — and blocks `M8-T1` either way, since this repo has no such backend to integrate against yet.
3. **UPI / payment rails** (blocks M6-T6) — deep-link into existing apps vs. integrate a payment SDK, and separately for each of Razorpay/Stripe/PayPal, with the compliance work each implies?
4. **Notifications** (blocks M4-T4) — which library, and is a background scheduler needed?
5. **Product priority for M4–M7** — the SRS's §1.2 market strategy leans India-first on hyper-local features (staff payroll, UPI, event planning) without fully dictating build order. `NEXT_STEPS.md` recommends Medical Chest (`M4`) as the first end-to-end module regardless, since it's self-contained and doesn't depend on the payments decision above.
6. **Dark mode trigger** — `M1-T4` shipped the picker as **manual-only**, which does not close this: should Midnight *also* follow the OS appearance setting (`useColorScheme`), and if so, does an explicit pick override it permanently or until the OS flips again?
7. **Safety SOS has no home in the SRS.** The old backlog's `M7-T1` (emergency contacts, one-tap alert, location share) doesn't correspond to any of the SRS's 16 modules — it simply isn't mentioned. Was it intentionally dropped when the product was rescoped to Habita AI, or should it stay planned alongside the SRS's modules? This needs an explicit answer, not a silent assumption either way.
8. **Medchest backend confirmation** — no longer blocks `M4-T10` (D-035 shipped a working client-side answer either way: a date-of-birth prompt, and hiding Remove Medicine), but two backend-side facts are still genuinely unconfirmed: is there really no delete endpoint for a profile/medicine/document, or was one just not captured in the collection? Is `dateOfBirth` actually required on Create Profile, and is a `category: SELF` profile meant to be auto-created one-per-family (this client's assumption), or manually added like any dependent? Deployment itself is now confirmed live (`curl` check, D-035). See `docs/BACKEND_CONTEXT.md`'s Medchest subsection and `docs/DECISIONS.md` D-032/D-035.
9. **`OtpResponse.deletionPopup`'s actual shape** — referenced by `Request Account Deletion`'s description as how a future login surfaces a pending account deletion, but no saved Login/Verify OTP example in the collection shows this field. Blocks building any "cancel my pending deletion" UI (`docs/DECISIONS.md` D-033, `docs/BACKEND_CONTEXT.md` §1).

---

## How to update this file

At the end of every session, run `prompts/session-close-doc-sync.md`. It will:

1. Flip completed task rows to ✅ with the date.
2. Move anything half-finished to 🚧 with a one-line note on where it stopped.
3. Add newly discovered work as new task rows (never as loose prose).
4. Recompute the milestone overview counts.
5. Move any answered open question into `docs/DECISIONS.md`.
