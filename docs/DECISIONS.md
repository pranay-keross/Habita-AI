# Saheli — Decision Log

Decisions already made, why, and what they imply. Add a new entry rather than editing history; if a decision is reversed, mark the old one **Superseded** and link forward.

Format: `D-NNN — Title` · Status · Date · Context → Decision → Consequences.

---

## D-001 — React Native CLI, not Expo

**Status:** Accepted · **Date:** 2026-07 (initial commit)

**Context.** The app needs real camera and gallery access, and later SMS, notifications, location, and possibly a UPI SDK — several of which historically need native module control.

**Decision.** Bare React Native 0.86 via the community CLI. Native iOS (CocoaPods) and Android (Gradle) projects are checked in.

**Consequences.** Full native control and no Expo Go escape hatch. Native dependency changes require `pod install` and a rebuild — this is why `profile.tsx` wraps `launchCamera`/`launchImageLibrary` in try/catch with a "rebuild the native app" alert. Contributors need a full Android Studio / Xcode setup.

---

## D-002 — Static-design phase before any backend

**Status:** Accepted · **Date:** 2026-07 (commit `3646fcf`, "Static design completed until Family section")

**Context.** The product surface is wide — finance, health, home, safety, style, payments. Committing to a data layer before the UX is settled would lock in the wrong schema.

**Decision.** Build the screens first with device-local `AsyncStorage` and demo data. No API client, no state container, no auth backend until the shape of the app is proven.

**Consequences.** Screens read and write storage directly; there is no service layer to test. Every domain module built during this phase will need a repository refactor when M8 lands (`M8-T3`). Documentation must be explicit that the app is a prototype so nobody plans a launch around it — hence the "What does not work yet" section in `README.md`.

---

## D-003 — Force LTR layout in every language, including Arabic

**Status:** Accepted · **Date:** 2026-07

**Context.** `I18nManager.forceRTL(true)` mirrors the entire layout and requires a native app restart to take effect. Mid-session language switching then either looks broken or forces a relaunch, and back buttons jump sides between languages.

**Decision.** `src/i18n/index.ts` calls `I18nManager.allowRTL(false)` and `forceRTL(false)` on every language change. Arabic renders with translated text in an LTR layout. `RTL_LANGS` is declared for future use but not acted on.

**Consequences.** Language switching is instant and never needs a restart; the back arrow is always top-left. The trade-off is that Arabic does not get a natively mirrored layout, which is a real accessibility and quality compromise for Arabic readers. Revisit if Arabic becomes a priority market — that would mean accepting a restart-on-switch flow.

---

## D-004 — Mutable singleton palette instead of a theme Context

**Status:** Accepted · **Date:** 2026-07 · the limitation described below was resolved by **D-008**, which keeps this decision intact

**Context.** Three palettes (Terracotta, Ocean, Midnight) needed to be readable from `StyleSheet.create` blocks at the top of every screen file without threading a provider through the tree.

**Decision.** `src/theme.ts` exports a mutable `colors` object; `applyPalette()` mutates it in place with `Object.assign` so existing references stay valid.

**Consequences.** Simple imports and no provider boilerplate — but `StyleSheet.create` snapshots values at module load, so a palette change does not restyle mounted screens. Switching effectively requires an app restart, and there is deliberately no palette-picker UI yet. `M1-T3` and `M1-T4` address this; expect them to touch every screen's style block.

---

## D-005 — Six languages from day one

**Status:** Accepted · **Date:** 2026-07

**Context.** The target user is an Indian household manager; English-only would exclude much of the audience. Spanish and Arabic were included to prove the localization architecture generalizes beyond Indic scripts.

**Decision.** English, Hindi, Bengali, Tamil, Spanish, Arabic — all six locale files are maintained together, with English as the fallback.

**Consequences.** Every user-facing string costs six edits, and a partially localized screen is a visible defect (`FamilyScreen` is currently the one offender, `M3-T1`). A locale-completeness check is queued as `M9-T3`.

---

## D-006 — Documentation is a first-class deliverable, kept in sync by prompt

**Status:** Accepted · **Date:** 2026-07-30

**Context.** Work happens across many AI-assisted sessions with no shared memory between them. Earlier docs drifted from the code — `README.md` claimed a 15-minute idle logout, forced OTP verification, and multi-tenant isolation, none of which existed. Docs that overclaim are worse than no docs, because an agent will build on top of features that are not there.

**Decision.** Four documents with distinct jobs — `README.md` (product + verified state), `AI_CONTEXT.md` (session cold-start brief), `docs/ARCHITECTURE.md` (how it is built), `docs/BACKLOG.md` (what is next) — plus `agent.md` for the working agreement and `prompts/` for the repeatable session rituals. Claims in docs must be verifiable against source; anything aspirational goes in the backlog, not the feature list.

**Consequences.** Every session ends with `prompts/session-close-doc-sync.md`. Docs and code change together in the same commit. Reading `AI_CONTEXT.md` plus `docs/BACKLOG.md` should be enough to start work cold.

---

## D-007 — One storage path, everything JSON-encoded

**Status:** Accepted · **Date:** 2026-07-30 (`M1-T2`)

**Context.** `src/utils/storage.ts` JSON-serializes every value, but `src/theme.ts` and `src/i18n/index.ts` bypassed it and wrote `saheli.lang` and `saheli.theme.palette` as bare strings. Two access paths meant two error-handling styles and a storage contract with exceptions in it — and any future audit of "what is on disk" had to know which keys were special.

**Decision.** Both modules go through `getItem`/`setItem`. `src/utils/storage.ts` is now the only module in the app that imports `AsyncStorage`, and every persisted value is JSON. Both reads validate the loaded value against the known set (`SUPPORTED_LANGS`, `palettes`) and fall back to the default.

The alternative — a compatibility shim that reads a legacy bare string when `JSON.parse` fails — was **rejected**. It protects users who do not exist (the app has never shipped, D-002) at the cost of migration code that would have to be found and deleted later.

**Consequences.** On a device that already has the app, `saheli.lang` and `saheli.theme.palette` stop parsing once. This fails safely — `getItem` catches the `JSON.parse` throw and returns the fallback — so the effect is that **language resets to English and palette to Terracotta exactly once**, on dev devices only. Callers no longer need their own try/catch, since the helpers never throw. Any new persisted value must go through the helper; a raw `AsyncStorage` import outside `src/utils/storage.ts` is now a defect.

---

## D-008 — Style factories + `useSyncExternalStore`, not a theme Context

**Status:** Accepted · **Date:** 2026-07-30 (`M1-T3a`)

**Context.** D-004's mutable `colors` singleton could not restyle mounted screens, because `StyleSheet.create` at module scope reads the palette once at module load. The `key={localeVersion}` remount trick used for i18n (D-003, §4) does **not** transfer: remounting re-runs the render, not module scope, so the frozen style object survives. Styles had to move into the render path.

**Decision.** Keep the mutable singleton. Add an observer to `theme.ts` (`subscribeToThemeChanges`), and a `useThemedStyles(factory)` hook built on `useSyncExternalStore` keyed on the palette key, memoising the built StyleSheet. Screens wrap their existing style block in a factory whose destructured parameter shadows the module imports, so the block body is untouched.

A React Context Provider was **rejected**: it would mean threading a provider through the tree and rewriting every token reference, for no behaviour the observer does not already give. `useSyncExternalStore` exists precisely for an external mutable store, which is what D-004 chose to have.

**Consequences.** Migration is ~3 lines per file no matter how large the style block — important, since `FamilyScreen.tsx` and `profile.tsx` carry ~365 and ~276 lines of styles. A **new screen must use the factory form**; a module-scope `StyleSheet.create` reading `colors` is now a defect, and one that is invisible until someone switches palette. Only `dashboard.tsx` is migrated (`M1-T3a`); the rest is `M1-T3b`, and until it lands the app restyles inconsistently. Two bugs were fixed on the way: `useTheme` re-set state to the same object identity so it never re-rendered, and `shadow` hardcoded terracotta colours while every `Palette.shadowColor` went unread (`M1-T10`).

**Update — 2026-07-31 (`M1-T3b`).** All ten style-owning files are migrated; the estimate held (~3 lines each, no style-block bodies edited). Two refinements the pilot did not surface: colours needed as *props* rather than styles (`placeholderTextColor`, `ActivityIndicator color`) are declared as ordinary factory entries and read back as `styles.placeholder.color`, and a source-scan test (`__tests__/themedScreens.test.tsx`) now enforces the "no module-scope `StyleSheet.create`" rule that this decision made a defect — a rule neither `tsc` nor eslint can see. Consequence discovered on landing: with everything else following the palette, the 38 hardcoded hex values inside the style blocks became visible as white cards in Midnight (`M1-T9`, `M1-T11`).

---

## D-009 — On-primary text is a palette role, not white

**Status:** Accepted · **Date:** 2026-07-31 (`M1-T9`, `M1-T11`)

**Context.** 38 hardcoded hex values sat inside the style blocks. Most encoded the assumption "a filled `primary` surface is dark, so its label is white" — true for Terracotta and Ocean, false for Midnight, whose `primary` is a light lavender `#A78BFA`. `M1-T3b` made this visible: once everything else followed the palette, the literals stood still, leaving white cards on a dark page and white labels on a light one.

**Decision.** Six new roles on `PaletteColors`, taking it from 15 to 21: `textOnPrimary`, `textOnPrimaryMuted`, `textOnPrimaryAccent`, `turmericSoft`, `dangerSoft`, `dangerBorder`. Midnight resolves the on-primary trio to **dark** ink and the soft tints to **dark** tints, inverting the light-mode assumption instead of approximating it. Every literal in `src/**/*.tsx` is now a role.

Reusing an existing role was **rejected** in two places that looked tempting: `surfaceElevated` for on-primary text (it is `#2A2440` in Midnight — a background, not a legible label colour) and `blush` for the muted on-primary line (it is a dark tint in Midnight, unreadable on light lavender).

**Consequences.** A palette is more expensive to add — 21 values, and six of them require thinking about contrast *against another role in the same palette* rather than against the background. In exchange, a screen can no longer be written correctly-for-Terracotta-only: there is no white to reach for. Contrast across all three palettes is checked by eye, not by tooling; `M9-T5` should add a real contrast pass.

---

## D-010 — `lucide-react-native` for icons, not `react-native-vector-icons` or Expo icons

**Status:** Accepted · **Date:** 2026-08-05 (`M1-T13`)

**Context.** `dashboard.tsx`'s tiles and quick actions used literal emoji (`🔍`, `💳`, `👪`, …) as icons. User feedback (`M1-T12`) flagged the home screen as not looking "professional," and emoji rendering — platform font, uncontrollable color/weight, inconsistent baseline across Android/iOS — was identified as the largest remaining lever. Fixing it needs a real icon library, which `agent.md` rule 7 requires asking about before adding.

**Decision.** Added `lucide-react-native` (stroke icons, SVG-based) and its peer dependency `react-native-svg`. Icons are imported per-subpath (`lucide-react-native/icons/pill`, not the barrel `lucide-react-native` export) so Metro only bundles the ~15 icons actually used, not the full set.

Two alternatives were considered and rejected:
- **`react-native-vector-icons`** — the long-standing default, but its icon fonts need manual native linking (`Info.plist` `UIAppFonts` on iOS, copying font files into `android/app/src/main/assets/fonts` on Android) on top of the usual autolink + rebuild. `react-native-svg`'s native module is autolinked with no manual font step.
- **`@expo/vector-icons`** — rejected outright: this is a bare React Native CLI project, not Expo (`docs/DECISIONS.md` D-001), and the package assumes an Expo/Metro asset pipeline this project doesn't have.

Lucide's stroke-icon style was also a fit for the "muted, outline-first" direction already chosen for `M1-T12`'s cards and badges, rather than a filled/glyph style that would have clashed.

**Consequences.** `react-native-svg` is native code — `pod install` and a fresh native build are required after pulling this change (documented in `README.md`), same caveat as every other native dependency under D-001. The `@react-native/jest-preset`'s default `transform` only matches `.js/.ts/.tsx`, but lucide's package `exports` resolve subpath imports to `.mjs` files; `jest.config.js` now declares its own `transform` map (in addition to the existing `transformIgnorePatterns` override) to include `.mjs`, or the untransformed `import` syntax throws inside Jest. Only `dashboard.tsx` is migrated — `FamilyScreen.tsx` and any new screens still need their own emoji-to-icon pass.

---

## D-011 — Remove the dashboard hero card; greeting + stat cards + a module list instead

**Status:** Accepted · **Date:** 2026-08-05 (`M1-T14`)

**Context.** `M1-T12` and `M1-T13` iterated on the dashboard by changing colors, borders, and icons within the *existing* shape: a `primary`-filled hero card holding the greeting, pending/due badges, and two stat chips; a horizontal-scroll strip of quick-action cards; a 3×3 grid of tile cards. The user's response was explicit: "you have kept the design and position same, i want to have different looking" — token-level polish wasn't what was being asked for, and repeating it a third time would have produced the same result.

**Decision.** Restructured the section, not just its styling:
- The hero card is gone. The greeting (`heroTitle`/`heroSubtitle`) is now plain text on `colors.background`, with pending/due reduced to a single muted status line (dot + text) instead of two colored badges.
- What the hero card's stat chips showed (30-day spend, medicine adherence) is now two neutral bordered cards (`statCard`) sitting directly on the page, the same visual language as any other card in the app rather than a special on-primary treatment.
- Quick actions moved from horizontal-scroll `Card`s to a wrapping grid of bare icon-in-circle `Pressable`s (`blush`-tinted circle + label, no border/shadow chrome) — lighter-weight, and it reuses the same circle motif as the AppBar's profile avatar button instead of introducing another card shape.
- The tile grid became a single bordered list group (`moduleList`) — icon circle, title, `ChevronRight` — with a divider between rows, closer to a settings/module list than an icon grid.

**Consequences.** `dashboard.tsx` no longer uses the `textOnPrimary`/`textOnPrimaryMuted`/`textOnPrimaryAccent` trio (`D-009`) at all — it was built specifically for text on a `primary`-filled surface, and there is no longer one on this screen. Those roles are still load-bearing elsewhere (`FamilyScreen.tsx`, `profile.tsx`, `language.tsx`); this decision does not deprecate them. The scroll-driven `heroCardScale`/`heroCardOpacity` animations introduced in `M1-T3a` as the *pilot* for the whole runtime-theming migration, and re-tuned in `M1-T12`, no longer apply to anything and were deleted rather than kept dormant — `docs/ARCHITECTURE.md` §6's "Signature interaction" table shrank from four rows to two. The AppBar's own fade-in ranges were tightened to match a shorter section above it. `M4`+ (dashboard numbers going live) and `M1-T7` (tile routing by ID) both still land against this new shape without further layout change.

---

## D-012 — Real backend auth (narrows D-002's scope, does not replace it)

**Status:** Accepted · **Date:** 2026-08-05 (`M2-T1`, `M2-T4`, `M2-T6`)

**Context.** D-002 committed the whole app to device-local `AsyncStorage` with no backend until the UX was proven, precisely so nobody would plan a launch around a prototype (`README.md`'s "What does not work yet"). The user then supplied `Saheli-Backend.postman_collection.json` (repo root) — a working backend already exists, with `register`/`login`/`verify-otp`/`refresh` under `/api/auth` and profile-creation endpoints under `/api/profile`. Continuing to fake OTP verification (`otp.tsx` previously navigated on any 6 digits, no check at all) stopped being a reasonable prototype shortcut once a real endpoint that does the actual check was sitting right there in a file in the repo.

**Decision.** Wire onboarding (Phone → OTP → Profile) to the real backend: `src/features/auth/api.ts` (thin `fetch` wrapper) and `src/features/auth/auth.ts` (`register`/`login`/`verifyOtp`/`refresh`), session persisted to a new `saheli.session` `AsyncStorage` key exactly like every other persisted value (D-007 — no `react-native-keychain`, that was explicitly considered and rejected for this stage), and a cold-start auth guard in `_layout.tsx`. `src/config.ts` holds one exported `API_BASE_URL` constant rather than adding an env-var loading dependency — the Postman collection's `http://localhost:8080` only resolves on the machine running the backend itself, not from a device or emulator, so this needed to be a single edit point regardless.

This is a **narrowing of D-002's scope**, not a reversal of it: D-002 still governs every other domain (family, dashboard, documents, money, …) — none of them gained a network call here, and D-002's own text is left as the historical record of why the app started backend-free. `agent.md`'s hard rule 8 ("no backend or network calls in this phase") is amended in the same change to name auth/profile as the one exception, so a future session reads the rule correctly instead of either violating it silently or refusing legitimate auth work.

Two things were deliberately deferred rather than solved here: **reverse geocoding** for the new location-prefill field (`profile.tsx` now offers to prefill `location` from device GPS, a direct user request alongside the auth work) — it ships as raw `"lat, lng"` instead of a place name, because picking a geocoding provider is its own decision (a paid Google API key, or free-but-rate-limited Nominatim) that didn't need to block shipping the rest of this. And **the backend's actual error-response shapes** — `Saheli-Backend.postman_collection.json` saves no example responses for any endpoint, so `parseAuthError` (`src/features/auth/api.ts`) maps HTTP status codes to meaning by informed guess (404 → not registered, 400/401 → invalid code), isolated in that one function specifically so a wrong guess is a one-function fix once this runs against a live backend instead of a re-thread through every screen.

**Consequences.** The app is no longer fully offline — onboarding requires a reachable backend, a real behavior change from every prior session (`README.md`'s Getting Started section now says so). `docs/BACKLOG.md` M2-T1 and M2-T6 are done; M2-T3 and M2-T4 are partially done (session persistence and the cold-start guard landed; idle/absolute expiry and a true mid-session guard did not — see `docs/ARCHITECTURE.md` §8, known gap #1); M2-T2 (resend countdown) and M2-T5 (re-auth banner) are untouched. `docs/ARCHITECTURE.md` gained a new §6 "Authentication" documenting the full contract and its unverified assumptions in one place.

---

## D-013 — Auth contract corrected against a richer Postman collection

**Status:** Accepted · **Date:** 2026-08-06

**Context.** `D-012`/`M2-T1` wired onboarding against `Saheli App Backend.postman_collection.json`, which saved **no example responses for any endpoint** — every error-status mapping in `parseAuthError` was a guess. The user then replaced it with `Saheli-Backend.postman_collection.json`, which ships full request/response examples (2xx and every documented error) for every endpoint. Diffing the implementation against these examples surfaced real bugs, not just gaps:

- **Every 4xx on `register`/`login`/`verify-otp` is a 400**, never a 404 — `parseAuthError`'s status-code-only mapping could not have worked; "phone not registered" (login) and "phone already registered" (register) are both 400 with different `message` strings, so the fallback logic in `loginOrRegister` needed message-based matching to function at all.
- **The backend validates a bare 10-digit Indian mobile number, no country code.** The client was sending the full display-formatted string (e.g. `"+919876543210"` after stripping punctuation) — every single submission would have failed backend validation. This is the most consequential fix in this pass.
- **`PUT /profile/details`'s DTO has no `name` field** — only `email`/`preferredLanguage`/`city`. The original implementation sent `name` there too, copying the `create` shape without checking whether `update` matched it.
- **`profileRequest`'s multipart part needs an explicit `Content-Type: application/json` header**, which RN's public `FormData.append(name, string)` API cannot set (traced through `Libraries/Network/FormData.js` — a plain string part gets no Content-Type at all). Fixed by passing `{string: json, type: 'application/json'}` instead of a raw string, a technique found by reading RN's source, not from any documented API.

**Decision.** Fix all four in place rather than filing them as follow-up backlog rows — they're bugs in already-shipped code, not new scope. Also captured what the richer collection revealed beyond bug fixes, since it would have been wasteful to leave known: `expiresIn`/`userId` on the token response (stored in `saheli.session`, not yet acted on — still `M2-T3`), `GET /profile/details` (wired into `profile.tsx`'s edit-mode load, backend as source of truth with local storage as the offline fallback), `PUT /profile/profilePhoto` (wired in for edit-mode photo changes, detected via a local-vs-`https://` URI check), and `devOtp` (the backend's dev-mode echo of the real OTP — prefills, but does not auto-submit, the code boxes in `otp.tsx`; absent and inert in a real deployment).

**Consequences.** `docs/ARCHITECTURE.md` §6 now states the contract as matched-against-saved-examples rather than guessed — a meaningfully stronger claim, but still not the same as having run it against a live server, which remains the one thing no amount of reading the collection can substitute for. The multipart content-type fix in particular is flagged as the single riskiest unverified piece, since it rests on reading RN's own source rather than on any documented behavior or a real request/response round-trip.

---

## D-014 — Revert the multipart Content-Type workaround; it broke profile creation

**Status:** Superseded by D-015 · **Date:** 2026-08-07 (`M2-T1` follow-up)

**Context.** `D-013` fixed `profileRequest`'s multipart part to carry an explicit `Content-Type: application/json` header, using `form.append('profileRequest', {string: json, type: 'application/json'})` — reasoning, from reading RN's `Libraries/Network/FormData.js`, that an object value still goes through the same string-content code path as a plain string while its `.type` sets the part's Content-Type header. That reasoning covered the JS layer only. The user then tested profile creation against a real running backend and got a save-failed error on every attempt, only reachable now that `D-013`'s phone-format and error-parsing fixes let onboarding get that far for the first time.

**Decision.** Revert to a plain string part: `form.append('profileRequest', JSON.stringify(profileRequest))` — no explicit Content-Type, but a request that reaches the server intact. The leading theory for why the previous version broke: RN's *native* multipart body builder (Android/iOS — not visible from the JS source alone) most likely decides "this part is a file, go read its `uri`" based on the presence of a `type` key, not a `uri` key. A part shaped `{string, type, ...}` has a `type` but no `uri`, which plausibly produced a malformed request client-side, before the backend ever saw it. This is a theory, not a confirmed root cause — nothing in `FormData.js` proves it, and the native builder's actual logic wasn't available to read.

The alternative considered — write the JSON to a real temporary file and send it as a genuine file part with `uri`+`type`+`name` — would need a filesystem-write dependency (e.g. `react-native-fs`), which is a new native dependency requiring the same ask-first step as every other one in this project (`agent.md` rule 7, `docs/DECISIONS.md` D-010). Given the plain-string revert unblocks the core onboarding flow immediately without any new dependency, it was chosen over investigating the file-part route further in this pass.

**Consequences.** Superseded within the hour — see D-015. The plain-string part turned out to fail too, and with better evidence than the theory that justified this revert in the first place.

---

## D-015 — The plain-string revert was also wrong; real backend logs point back to the Content-Type object

**Status:** Accepted · **Date:** 2026-08-07 (`M2-T1` follow-up to D-014, same day)

**Context.** D-014's revert to a plain string `profileRequest` part was itself tested against the real backend within the hour. The backend's own log gave a full stack trace: `org.springframework.web.HttpMediaTypeNotSupportedException: Content-Type 'application/octet-stream' is not supported`, thrown from `RequestPartMethodArgumentResolver.resolveArgument`. This proves two things D-014 could only guess at:

1. **A plain-string `FormData` part is sent as `Content-Type: application/octet-stream`**, not empty and not `text/plain` — a concrete, RN-native default that neither this project's code nor `Libraries/Network/FormData.js` documents; it only becomes visible from the server side.
2. **D-014's stated reason for reverting the `{string, type}` object approach was never actually confirmed.** That revert was based on a theory — "adding a `type` key with no `uri` makes RN's native layer treat the part as a malformed file part" — reasoned from the JS source alone, with no request/response evidence either way, because the first attempt's failure (2026-08-06) only ever surfaced as a generic client-side alert with no backend log to inspect.

With hard evidence that the plain-string path is *definitely* wrong, and no equivalent evidence that the object-with-`type` path is wrong — only a plausible-sounding but unconfirmed theory — the balance of evidence flipped.

**Decision.** Re-apply the `{string: JSON.stringify(profileRequest), type: 'application/json'}` object part (`src/app/onboarding/profile.tsx`), reverting D-014. This is a re-test backed by the same debugging tool that just disproved the alternative — `console.warn` logging plus the user's access to the backend's own terminal — not a repeat of the original guess.

**Consequences.** **Confirmed working the same day.** A follow-up live test's backend log shows `ProfileService` logging `"Updating the email and name for user..."`, then a successful S3 upload of `profile.jpg`, then `"profile of user ... saved successfully"` — Spring correctly bound `profileRequest` to the DTO and read the photo part. D-014's file-detection theory is now moot: the `{string, type}` object part works correctly against this backend. The same test then hit an unrelated, purely backend-side bug — see D-016. The fallback discussed above (a real temp file with a genuine `uri`) turned out to be unnecessary.

---

## D-016 — Not fixing: `POST /profile/create`'s duplicate-profile 500 is a backend bug, out of this repo's reach

**Status:** Accepted (documented, not actioned) · **Date:** 2026-08-07

**Context.** The same live test that confirmed D-015 (the client-side multipart fix works) then failed with a full backend stack trace: `DataIntegrityViolationException` / Postgres `duplicate key value violates unique constraint "uq_user_profiles_user_id"`, thrown from an `INSERT INTO user_profiles` in `ProfileService`, surfaced to the client as an unhandled 500. The cause is entirely server-side: the test user already had a `user_profiles` row (from an earlier attempt earlier in this same debugging session — repeated Create Profile calls against a backend whose create endpoint isn't idempotent), and `createProfile` does a plain insert with no existence check, so a second call for the same user fails at the database constraint instead of failing cleanly (e.g. `409 Conflict`) or succeeding as an update.

**Decision.** Do not attempt a client-side workaround. There is no way for `profile.tsx` to detect "this user already has a profile" before calling `create` — that information doesn't exist on the client (`GET /profile/details` failing with a 500 is currently the *only* signal a profile doesn't exist yet, per the collection's documented "500 — profile not created yet" example, which is itself the same class of bug: a missing-row case surfacing as an unhandled exception instead of a clean 404/empty response). Fixing this requires backend changes (idempotent create, or a clean conflict/not-found response) that are out of this repository's scope.

**Consequences.** Documented here so a future session doesn't mistake this for a client bug and go looking for one. Practical workaround for continued client-side testing: use a phone number that has never completed profile creation, since retrying the same user will keep hitting this. Flagged as a fact to raise with whoever owns `Saheli-Backend` — not a `docs/BACKLOG.md` row, since this repo has no code to change for it.

---

## D-017 — Route returning users past Profile setup; drop `devOtp`; replace the hand-rolled OTP boxes with `react-native-otp-entry`

**Status:** Accepted · **Date:** 2026-08-07 (`M2-T7`)

**Context.** Direct user testing on a real device, after profile creation was confirmed working (D-015/D-016), surfaced three problems in the onboarding flow itself:

1. **A returning user (an already-registered phone, `login` succeeds) landed on Profile setup after OTP, not Dashboard.** `otp.tsx` always called `navigation.navigate('Profile')` on a successful verify, regardless of whether `phone.tsx` had gone through `login` (existing user) or `register` (first-time user) — the two cases were never distinguished past that point.
2. **The `devOtp` prefill (`M2-T1`) was explicitly unwanted.** The user's words: "why automatically it fills with 123456? keep it empty." What was meant as a demo-mode convenience read as broken/confusing behavior instead.
3. **The OTP input couldn't be cleanly edited once filled.** The hand-rolled implementation used six separate `TextInput`s, one per digit, with custom focus-management and backspace-handling logic. Clearing a fully-filled set of boxes to retry required manually backspacing through each one — exactly the friction the `devOtp` prefill was making people hit immediately on every screen visit.

**Decision.** Three changes, all in the same pass since they compound on the same screens:

- `loginOrRegister` (`src/features/auth/auth.ts`) now returns `{isNewUser: boolean}` — `false` when `login` succeeded directly, `true` when it fell back to `register`. Threaded through `phone.tsx`'s `navigation.navigate('Otp', {isNewUser})` and read in `otp.tsx` after a successful verify to pick `'Dashboard'` (returning user) vs `'Profile'` (new user, needs setup). Missing/undefined defaults to `true` (Profile) — the safe side, since it costs an extra screen rather than stranding someone who actually needed to set up a profile.
- `devOtp` removed end-to-end. `register`/`login` are back to `Promise<void>` — nothing about OTP verification is inferred from, or influenced by, their response body. Verification is unconditionally a real call to `verifyOtp`, which was already true; the prefill never bypassed it, but removing it removes any appearance that it might have.
- Replaced the six-`TextInput` array with `react-native-otp-entry`'s `OtpInput` component (chosen over `react-native-confirmation-code-field`: comparable popularity, simpler API for this exact single-numeric-code use case; both are pure JS, no native module, no rebuild required). One real backing `TextInput` under the hood instead of six coordinated ones, so normal text-editing behavior (select, backspace, retype) works without custom key-press plumbing. A wrong-code error now also calls the library's `ref.clear()` + `ref.focus()` so the user lands back on an empty, focused input automatically instead of needing to clear it by hand.

**Consequences.** New dependency `react-native-otp-entry` (`agent.md` rule 7 — flagged here as the ask, since the user directly requested "a different otp package" rather than this being a unilateral addition). `otp.tsx`'s visual styling is now expressed through the library's `theme` prop (mapped to the same `makeStyles`-factory tokens every other screen uses — no inline hex, no exception to that rule) rather than a local `StyleSheet` array merge, which changes how a future palette tweak to this screen needs to be made, but not the underlying token discipline. `RootStackParamList.Otp` gained a required-shape param (`{isNewUser: boolean} | undefined`) that `_layout.tsx`, `phone.tsx`, and `otp.tsx` all now agree on.

---

## D-018 — Reverse geocode the location prefill; ask for role only when editing

**Status:** Accepted · **Date:** 2026-08-07 (`M2-T8`)

**Context.** Two more pieces of direct user feedback on the onboarding flow: the location field prefilled from GPS was showing raw coordinates ("lat, lng") instead of a place name, which D-012 had flagged and deliberately deferred ("picking a geocoding provider is its own decision"); and the Role picker (Household CEO / Individual) was being asked during first-time profile setup even though — per `GET /profile/details`'s confirmed response shape (§6) — the backend has no field for it at all, making it a purely local, changeable-later concept that didn't need to gate onboarding.

**Decision.** Reverse geocoding: OpenStreetMap's Nominatim (`reverseGeocode()` in `profile.tsx`) via a plain `fetch` call — no API key, no new npm dependency. Chosen over Google's Geocoding API specifically because it needs no billing/key setup, which matters for a prototype with no deployment infrastructure of its own yet. Falls back through city → state-qualified city → Nominatim's full `display_name` → raw coordinates, in that order, so a sparse or failed lookup never leaves the field worse than it was.

Role: moved the picker behind `isEditing`, so it's absent from first-time setup and still available from Profile → edit. The state and its default (`'household_ceo'`) are unchanged — `handleSaveProfile` still persists whatever `role` holds either way; only the UI that lets the user change it is now conditional.

**Consequences.** Nominatim's usage policy caps free-tier usage around 1 request/second and expects a descriptive `User-Agent` (set: `SaheliApp-Prototype/1.0`) — fine at "one lookup per profile setup" volume, a real constraint the moment this app has enough users to matter, at which point it's a provider decision to revisit deliberately, not something to silently outgrow. Role being edit-only means a first-time user's profile is created with the default role until they visit Profile edit — acceptable since role has no backend effect today; revisit if a later module (e.g. Family permissions) starts reading it and needs it set correctly from day one.

---

## Open decisions

Tracked in `docs/BACKLOG.md` → Open questions. Move each here once answered.

| ID | Question | Blocks |
| --- | --- | --- |
| OD-1 | AI provider and where inference runs | M5-T5, M6-T5, M8-T1 |
| OD-2 | Backend: BaaS vs custom API; data residency | all of M8 |
| OD-3 | UPI: deep-link vs payment SDK | M6-T6 |
| OD-4 | Notification library and background scheduling | M4-T4 |
| OD-5 | Which domain module ships first after M1–M3 | M4–M7 ordering |
| OD-6 | Dark mode: follow OS appearance or manual only | M1-T4 |
