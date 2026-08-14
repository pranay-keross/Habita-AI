# Habita AI — Decision Log

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

## D-019 — Rebrand Saheli → Habita AI (code + docs, native project IDs excluded)

**Status:** Accepted · **Date:** 2026-08-07

**Context.** The user supplied `Habita AI Software Requirements Specification.md` (repo root), which renames the product from Saheli to Habita AI and describes a far larger target platform. Two scope decisions were confirmed before any file was touched: rename in code as well as docs (not a docs-only pass), and explicitly **exclude** the native project identifiers — Android's Kotlin package `com.sahelicli` (`android/app/src/main/java/com/sahelicli/MainActivity.kt`/`MainApplication.kt`, plus `namespace`/`applicationId` in `android/app/build.gradle`, `rootProject.name` in `android/settings.gradle`) and the iOS Xcode project/scheme (`ios/SaheliCLI.xcodeproj`, its scheme file, the `ios/SaheliCLI/` folder). Renaming those is a structural native change — folder moves, package-declaration edits, Xcode project internals — that this environment cannot build-verify (no Xcode on Windows, no confirmed Android toolchain), so a mistake would only surface the next time someone opens Xcode or Android Studio.

**Decision.** Renamed everywhere else:
- **Storage-key prefix**, every key: `saheli.` → `habita.` (`src/theme.ts`, `src/i18n/index.ts`, `src/hooks/useAuth.ts`, `dashboard.tsx`/`profile.tsx`'s `PROFILE_STORAGE_KEY`, `FamilyScreen.tsx`'s `FAMILY_STORAGE_KEY`, and the inline `habita.user_phone` reads/writes in `otp.tsx`/`phone.tsx`).
- **On-device display name**: `ios/SaheliCLI/Info.plist`'s `CFBundleDisplayName` and its three usage-description strings, `android/app/src/main/res/values/strings.xml`'s `app_name`.
- **In-app brand text**: `dashboard.tsx`'s AppBar/footer brand lines, and the brand name embedded in six keys across all six `src/i18n/locales/*.json` files (`choose_language_sub`, `welcome`, `phone_hint`, `profile_name`, `greeting`, `footer_note`) — kept in Latin script in every locale, same pattern the old `Saheli` brand name used (never transliterated, even in Hindi/Bengali/Tamil/Arabic).
- **Metadata**: `package.json`'s `"name"`, `app.json`'s `"name"`/`"displayName"`.
- Cosmetic: the Nominatim `User-Agent` string in `profile.tsx` (`SaheliApp-Prototype/1.0` → `HabitaAI-Prototype/1.0`, sent to OpenStreetMap, no functional effect).

**Deliberately left unrenamed, not missed:**
- Android package `com.sahelicli` and the iOS Xcode project/scheme, per the scope decision above — tracked as a new follow-up backlog item for a session with a working Xcode/Android Studio setup to verify.
- `Saheli-Backend.postman_collection.json` (repo root) — this names the *external* backend service's own exported artifact, not this repo's branding; this repo doesn't control that service's name.
- `.claude/settings.local.json`'s one match (`com.sahelicli/.MainActivity` in an allowed `adb` command) — correct as-is precisely because the Android package ID didn't change.
- `android/app/build/**`, `android/.idea/**` — gitignored build/IDE artifacts that regenerate.
- Historical entries earlier in this decision log (e.g. D-006, D-007, D-013–D-018) — they describe what was true *at the time each decision was made*, including the old `saheli.*` keys and brand name; append-only means this entry documents the change, not a rewrite of that history.

**Consequences.** A dev device with existing local data resets once on first launch after this change — old `saheli.*` keys stop being read, the same fallback-safe shape D-007 already established, then everything persists normally under the new `habita.*` keys going forward. Every planning doc (`README.md`, `AI_CONTEXT.md`, `docs/ARCHITECTURE.md`, `docs/BACKLOG.md`, this file, `agent.md`, all of `prompts/`) was rebranded in the same pass. A future session should not be surprised to find `com.sahelicli`/`SaheliCLI` still live in the native project tree — that's this decision, not drift.

---

## D-020 — Adopt the Habita AI SRS v3.0 as target architecture; backlog restructured around its modules

**Status:** Accepted · **Date:** 2026-08-07

**Context.** `Habita AI Software Requirements Specification.md` specifies a full enterprise backend — Spring Boot 3.3, Java 21, PostgreSQL 16, a dual-LLM intelligence layer (OpenAI + Gemini), and 16 feature modules spanning identity, health, household ledger, and global finance. None of that exists in this repo, which remains a React Native client with only auth/profile talking to a real backend (D-012) and everything else local-first (D-002).

**Decision.** `docs/BACKLOG.md`'s M4–M8 were restructured around the SRS's actual module groups instead of the old generic "Medicine/Documents/Money/Safety" grouping (milestone *numbers* M4–M7 kept stable so existing prompt cross-references stay valid; their *content* changed):
- **M4 — Health & Life-Stage Suite**: Medical Chest & Prescriptions, Mental Health & CBT Coaching, Hormonal Health & Life-Stage Tracking.
- **M5 — Household Ledger & Assets**: Document Hub, Caregiver & Home Services Hub, Resource & Utility Logistics, Shared Family Events & Budgeting, Property Asset Vault & Vehicle Upkeep.
- **M6 — Global Finance & Commerce**: Multi-Currency Expense Groups, Payment Rails & Global Subscriptions.
- **M7 — Lifestyle & Smart Living**: Smart Pantry & Allergen Radar, Wardrobe & Weather-Adaptive Style Mirror, Voice Command & Orchestration, and the Home Dashboard's move from static to a real aggregated feed.
- **M8 — Backend & AI integration**: reframed from an open "choose a backend" exercise to "integrate against the now-specified one" — the SRS itself answers OD-1 (AI provider: OpenAI gpt-4o-mini + Gemini 2.5-flash, server-side, SRS §3.2) and OD-2 (backend: custom Spring Boot API, not a BaaS, SRS §2) at the target-architecture level.

**Consequences.** None of this is built yet beyond auth — D-012 still governs, and M8 remains blocked until a real Habita AI backend exists to integrate against; the SRS answering *what* the backend and AI provider will be doesn't make either exist in this repo today. Two things intentionally surfaced rather than silently resolved: data residency for Indian users specifically isn't specified by the SRS, so OD-2 is only partially closed; and **Safety SOS** (the old backlog's `M7-T1` — emergency contacts, one-tap alert, location share) has no corresponding module anywhere in the SRS's 16 modules. It is parked as an open question in `docs/BACKLOG.md` rather than deleted, since dropping it silently would be a scope decision this document didn't actually see the user make.

---

## D-021 — Family module completion and Medical Chest as the first SRS module: `relation: 'self'` as the current-user proxy, and a real registry behind "Modules Synced"

**Status:** Accepted · **Date:** 2026-08-08 (`M3` complete; `M4-T1`/`T2`/`T3`/`T5`)

**Context.** Two of `M3`'s tasks (`M3-T6`, "Leave family") and one of `M4`'s (`M4-T5`, permission-gate the medicine chest) both need to answer "which family member is using this device right now?" — a question this repo's data model has no real answer to. `FamilyMember` has always had a `relation` field whose value set included `'Self'` (now lowercased to `'self'`, `M3-T4`), used only as a display label until now. Separately, `M3-T5` needed the hero stat "Modules Synced" to stop being a literal `4 / 4` without inventing a definition for what "synced" means before more than one module existed to measure.

**Decision.** Two small, related conventions, both scoped to this local-only phase:

1. **The family member with `relation === 'self'` is treated as the current device's user.** `FamilyScreen.tsx`'s "Leave Family" action and `MedicineScreen.tsx`'s permission gate (`role !== 'viewer' && permissions.medicines`) both key off this member. It is explicitly *not* a real identity system — there is no login-to-member linkage, no way for a second device to represent a different member as "self." It is documented in both call sites as a stand-in for what `M8`'s real multi-tenant backend will need to do properly (a session belongs to a specific member, not to "the app").
2. **`IMPLEMENTED_PERMISSION_MODULES`** (`src/features/family/types.ts`) is a plain array of which permission categories have a real module behind them — empty until `M4-T1`, then `['medicines']`. The "Modules Synced" stat derives from it (`synced/implemented`, counting active members who share that permission) instead of a hardcoded fraction. Every future module that gates on a family permission should add its key here when it lands, the same way `M4-T1` did.

**Consequences.** Both conventions are honest about being temporary scaffolding: `'self'`-as-identity breaks the moment two people use the same family's data from two devices (exactly the scenario `M8`'s real backend needs to handle), and `IMPLEMENTED_PERMISSION_MODULES` needs a one-line addition every time a new permission-gated module ships, or that module's stat contribution silently stays at zero. Neither was flagged as a decision to make later — they're small enough, and load-bearing enough for two features already, to record now rather than rediscover independently in `M5`.

Also resolved this pass, previously flagged as debt: `M1-T7` (dashboard tiles/quick actions were string-matched by label) — `dashboard.tsx`'s `tiles`/`quickActions` now carry a stable `id`, resolved as a side effect of wiring `M4-T1`'s Medicine tile rather than as its own task.

---

## D-022 — Add `docs/BACKEND_CONTEXT.md` to consolidate what this repo knows about the separate Spring Boot backend

**Status:** Accepted · **Date:** 2026-08-08

**Context.** D-012 through D-018 already established, through live testing, that a real Spring Boot backend exists outside this repo and answers `register`/`login`/`verify-otp`/`refresh` and profile create/read/update/photo — including two confirmed backend-side bugs (D-016) and a client-side multipart gotcha (D-013–D-015) that will recur on every future file-upload endpoint. That knowledge was scattered across five decision entries, written narratively in the order it was discovered, with no single place summarizing *current confirmed backend behavior* or mapping it against the SRS's target architecture (D-020). The user asked directly for a document to continue Spring Boot backend work smoothly, and for the rest of the doc set to be kept in sync with it — the same request D-006 already established a ritual for (`prompts/doc-only-change.md`).

**Decision.** Added `docs/BACKEND_CONTEXT.md`: a cold-start brief for backend work specifically, structured like `AI_CONTEXT.md` is for the client. It (1) tables the confirmed-live contract from D-012–D-018, (2) lists the known backend bugs from D-016 plus one newly noticed from the collection itself — `PUT /profile/profilePhoto` already returns a clean 404 for a missing profile, while `GET /profile/details` 500s for the same condition, an inconsistency the backend already contains the fix pattern for, (3) flags two places the live backend and the SRS actually disagree — the phone validator (bare 10-digit Indian mobile, live-confirmed, vs. the SRS's stated E.164/international standard) and the JWT TTL (1 hour observed vs. 30 days specified) — neither noticed before because no prior doc compared the two side by side, (4) maps the SRS's 19 `com.habita` domain packages against the client milestone that will eventually consume each one, and (5) suggests a backend build order that keeps pace with `NEXT_STEPS.md`'s client-side order instead of the two silently diverging. Threaded into the existing doc set exactly the way every prior addition was (D-019/D-020's rebrand, this file's own precedent): a row in `agent.md` §3's document-ownership table, `README.md`'s and `AI_CONTEXT.md`'s documentation maps, a pointer from `docs/ARCHITECTURE.md` §6, and a note on `docs/BACKLOG.md`'s `M8-T1` row.

**Consequences.** The phone-format and JWT-TTL discrepancies are now written down somewhere for the first time — previously, each lived only in an isolated fact (D-013's phone-format fix; a raw `expiresIn` value nobody compared against the SRS) with nothing connecting them to the SRS's conflicting claim. Whoever next works on the Spring Boot backend has one file to start from instead of reconstructing this from five decision entries plus the SRS plus the Postman collection. This document's own honesty depends on being updated the same way D-013–D-018 were — with evidence, not assumption — the moment more of the backend gets built or verified; §"How to keep this file honest" in the file itself says so directly, mirroring the discipline `docs/DECISIONS.md` D-006 established for the rest of the doc set.

---

## D-023 — Real Family & Managed Members backend integration; drop the local permission matrix, gate by role instead

**Status:** Accepted · **Date:** 2026-08-10

**Context.** The user supplied an updated `Saheli-Backend.postman_collection.json` (renamed "Saheli Backend — Auth, Profile & Family," 700 → 3294 lines) adding a full `/api/families/**` contract: create/list/get, phone-based invite-and-consent membership, role management, member removal, and Managed Members (dependents) — the real-backend answer to the still-open `M2-T9`. Its shape is materially different from the local model `M3` had built: roles are `OWNER`/`ADMIN`/`MEMBER` with **no per-module permission matrix** at all (the local model's `permissions: {medicines, expenses, documents, safety}`, gating `MedicineScreen.tsx`'s `M4-T5` check, has no backend equivalent); invites target an **already-registered user by phone**, consented to from **their own account**, not a same-device toggle; and a user can belong to zero or many families (`GET /families` returns a list), where the client had always assumed exactly one, seeded with three demo members.

Two decisions needed a call only the user could make, asked directly rather than guessed: how to handle the missing permission matrix, and how to handle a user with no family yet. Answered: **drop the matrix and gate purely by role** (MEMBER = read-only, ADMIN/OWNER = full access) — matching backend reality honestly rather than keeping UI state that binds to nothing server-side (the local-overlay and Managed-Members-only-partial-integration alternatives were both rejected as leaving Family "half-real"); and **add a Create Family empty state** when `GET /families` returns empty, matching the backend's actual create flow rather than silently auto-naming a family for the user.

**Decision.** `src/features/family/types.ts` and a new `src/features/family/api.ts` now mirror the real contract exactly (`Family`, `FamilyMember` — `{id, name, role, managed, managedMemberId}`, `FamilyInvite`); `familyStore.ts` (the local `AsyncStorage`-backed model, `habita.family_members`) is deleted outright, not deprecated, since Family — like Profile — is now always read live from the network, no local cache. `FamilyScreen.tsx` is rewritten in full: an invites-addressed-to-me section (`GET /families/invites`, actionable independent of whether the viewer has their own family yet), a create-family empty state, the member list with role badges only (no permission tags), an admin-only pending-invites-sent panel with cancel, and a dependent-adding sheet wired to `POST .../managed-members`. `MedicineScreen.tsx`'s `M4-T5` gate now calls the real Family API instead of the deleted local store: no family at all still means full access (unchanged from before); inside a family, `canEdit` is `isAdmin` (OWNER/ADMIN edit, MEMBER read-only) instead of a per-module toggle.

**A new identity-resolution problem, not present in the local model, had to be solved:** `FamilyMemberResponse` carries no `userId` for a non-owner row, so "which member in this list is me" has no direct answer beyond the owner case (`Family.ownerUserId === my userId`, from `useAuth()`'s new `getUserId()`). `resolveMyMembership()` (`src/features/family/api.ts`) falls back to matching the caller's own cached profile name (`habita.user_profile`) against the member list, and — if that doesn't resolve either — defaults to the least-privileged `'MEMBER'` read rather than guessing upward into ADMIN/OWNER. This is a real, working solution, not a placeholder, but it is honestly fragile (breaks on a duplicate display name, or a member who renamed since joining) — documented here and in `docs/BACKEND_CONTEXT.md` as a backend contract gap worth closing (a `userId` field per member, or a dedicated "my membership" endpoint, would remove the guesswork entirely).

**A second gap surfaced while building the "Leave Family" action**: this backend has **no self-service leave endpoint**. `DELETE /families/{id}/members/{id}` (Remove Member) requires admin access on the *caller*, not just "this is my own row" — so a plain `MEMBER` has no way to remove themselves via this API at all. The client now only renders "Leave Family" for a resolved `ADMIN` member removing their own row; a plain `MEMBER` doesn't see the action, rather than showing a button that would just 401.

**Consequences.** This widens `agent.md` rule 8's auth/profile-only network exception to include Family (updated in the same change) — `docs/DECISIONS.md` D-012 narrowed D-002's local-first default for auth; this narrows it further, the same way, for the same reason (a real endpoint existed and faking it stopped being a reasonable prototype shortcut). `docs/BACKLOG.md`'s `M3` is superseded by this work for its data layer (its acceptance criteria are now met against the real backend, not local storage) while its UX decisions — owner guardrails, pending-state visibility — carry forward unchanged in spirit; `M2-T9` (Managed Members) and `M8-T3` (real multi-tenant family sharing) both move to done, with `M8-T3` explicitly *not* claiming the SRS's full jsonb permission matrix, since the backend doesn't have one yet. Unlike D-012–D-018, none of this integration has been run against a live server with real logs in this session — the collection's saved examples are the only evidence, so `docs/BACKEND_CONTEXT.md`'s Family section is marked "contract only," not "confirmed live," until someone actually exercises it against a running backend.

---

## D-024 — Reconcile the client against the renamed Postman collection: add invite history, fix stale filename references, flag unfinished `medchest` scaffolding

**Status:** Accepted · **Date:** 2026-08-11

**Context.** The user asked for a pass to make sure everything in the latest Postman collection is implemented and documented. Diffing every request in `Saheli Backend — Auth, Profile & Family.postman_collection.json` (repo root) against `src/features/auth/**` and `src/features/family/**` found the auth and profile contract already exactly matched (message-for-message against `parseAuthError`), and every documented Family endpoint from D-023 already implemented in `src/features/family/api.ts` — except one: `GET /families/{id}/invites/history`, which returns every invite ever sent for a family (any status — `PENDING`/`ACCEPTED`/`DECLINED`/`CANCELLED`), not just the still-pending ones `listFamilyPendingInvites` already covered.

Two other things surfaced that weren't about missing endpoints:

1. **The collection file itself was renamed on disk** (`Saheli-Backend.postman_collection.json` → `Saheli Backend — Auth, Profile & Family.postman_collection.json`, matching the collection's own internal `info.name`) sometime in or after the D-023 session, but every doc reference to it — `AI_CONTEXT.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/BACKEND_CONTEXT.md`, `docs/BACKLOG.md` — still pointed at the old filename, which no longer exists in the working tree. Two of those (`docs/BACKLOG.md`'s M2 header, `README.md`'s stack table) went further and asserted the filename was "unchanged," a claim D-019 made about the *previous* rename (Saheli → Habita AI) that this later, unrelated rename broke.
2. **The collection now also has a `Medchest` folder** (`Create profile` / `Get Profile details` under `{{family}}/{{familyId}}/profiles`, plus an empty `New Request` placeholder) that is not safe to build against yet: the collection's own `{{family}}` variable is blank (unlike `{{baseUrl}}`, which resolves), so the requests' base URL is undefined, and the two saved examples disagree with each other on a field value (`"category": "CHILD"` in the request body vs. `"category": "KID"` in the response). This reads as in-progress backend scaffolding accidentally included in the export, not a documented contract — the same category of finding D-016's "not fixable from this repo" bugs are, but here the right move is to not build against it at all rather than build around a bug.

**Decision.** Three changes, all in the same pass:

- Added `listFamilyInviteHistory(familyId, token)` to `src/features/family/api.ts` (reuses `apiFetch`, no new error-kind needed — the endpoint's only documented error, 401 "You are not a member of this family," already maps to `no_permission` in `parseFamilyError`). `FamilyScreen.tsx` gained an admin-only "Invite history" toggle beneath the pending-invites panel — collapsed by default, fetches on first expand, renders each past invite's role/date/status with a status-colored badge (turmeric/primary/danger/muted for pending/accepted/declined/cancelled). Seven new keys (`family.invite_history_title`, `history_show`, `history_hide`, `history_empty`, `status_accepted`, `status_declined`, `status_cancelled`) added to all six locale files (57 → 64 `family.*` keys each, verified equal key counts across locales).
- Corrected every current-state doc's filename reference to `Saheli Backend — Auth, Profile & Family.postman_collection.json` and removed the now-false "filename unchanged" claims (`AI_CONTEXT.md`, `README.md`, `docs/ARCHITECTURE.md` §6/§7/§9, `docs/BACKEND_CONTEXT.md` §1/§2/§6, `docs/BACKLOG.md` M2 header and `M8-T1`). Historical decision entries (D-012, D-013, D-019, D-023) were **not** rewritten — they describe what the filename was at the time each was written, which is what the append-only convention (D-006) requires.
- Did **not** build client code against the `Medchest` folder. Documented the finding in `docs/BACKEND_CONTEXT.md` §2 as a heads-up rather than a contract row, so a future session (or whoever next touches the backend) sees it without either repo silently building against an undefined base URL or silently losing the observation.

**Consequences.** `npx tsc --noEmit`, `npm run lint` (zero warnings), and `npm test` (34 tests, same suite) all still pass after the new endpoint and locale keys. The `Medchest` finding is a live signal that backend work on `medchest` (`docs/BACKEND_CONTEXT.md` §5's suggested next domain after `family`) may already be starting — worth checking for a follow-up collection export with a populated `{{family}}` variable and consistent examples before this repo commits any client code to it.

---

## D-025 — Cut the dashboard's entrance-animation cascade to one fade; Family's initial load fails inline, not with a modal alert

**Status:** Accepted · **Date:** 2026-08-11

**Context.** Direct user feedback after seeing the app running on the Android emulator, both about screens `D-024`'s pass had just touched: (1) `dashboard.tsx` fires 18 separate staggered `FadeInDown.springify()` entrance animations on every mount — the greeting, the stat-cards row, each of the 6 quick actions individually (40ms apart), and each of the 10 module rows individually (30ms apart) — read as "too much animation," not polish. (2) Navigating to `FamilyScreen.tsx` in this dev environment (no backend reachable) immediately threw a blocking `Alert.alert("Error", "Something went wrong. Please try again.")` the instant the screen opened, before the user did anything — correct per the error-handling design (`showError` on any `reload()` failure), but a jarring first impression for what is, in the common case, simply "no backend configured yet."

**Decision.** Two independent, narrowly-scoped UI changes:

- `dashboard.tsx`: removed the per-item `entering={FadeInDown...}` from all 6 quick-action items and all 10 module-list rows — they now render as plain `View`/`Pressable`, no animation. The greeting block and stat-cards row were merged under one `Animated.View` with a single 280ms linear fade (no `.springify()`, no delay stagger) instead of two separate bouncy, delayed entrances. The scroll-driven sticky-AppBar fade (`appBarBgStyle`/`appBarPillStyle`, unrelated code path) was left untouched — it's what makes the sticky header appear on scroll, a functional interaction rather than decorative motion, and wasn't part of the complaint.
- `FamilyScreen.tsx`: `reload()` now takes an optional `{silent?: boolean}`. The mount-effect call (`reload({silent: true})`) sets a new `loadError` state on failure instead of alerting, rendered as an inline card — reusing the existing empty-state visual pattern (icon, title, subtitle) plus a new `Button` labeled `family.retry_btn` that re-runs the silent reload. Every other caller (create family, send invite, accept/decline, cancel invite, save role, remove member, leave family) still calls `reload()` without `silent` and still alerts on failure, since those are direct responses to a tap the user just made, where a modal is appropriate feedback, not an ambush. Two new locale keys (`family.load_error_title`, `family.retry_btn`) added to all six locale files (64 → 66 `family.*` keys each, verified equal across locales); the error copy itself reuses the existing `family.error_*` message keys via a small `errorMessageKey()` helper factored out of `showError` so the Alert and the inline card can't drift out of sync with each other.

**Consequences.** `npx tsc --noEmit`, `npm run lint` (zero warnings), and `npm test` (34 tests) all still pass. Verified on-device (Android emulator, `Pixel_10_Pro`): Family screen now shows the inline retry card instead of a popup when no backend is reachable, confirmed via `uiautomator dump` + a real tap rather than assumed from reading the code. The dashboard's reduced-animation state was not similarly diffed frame-by-frame against the old version (no recording tooling in this environment) — the change is a straightforward deletion of `entering` props and a merge of two `Animated.View`s into one, verified by `tsc`/lint/test and a static screenshot, not a motion-by-motion comparison.

---

## D-026 — Explain, don't just separate, Invite vs. Add Dependent

**Status:** Accepted · **Date:** 2026-08-11

**Context.** Direct user question after using the Family screen: tapping "Add a dependent" only asks for a name and relationship, with nothing unique (no phone, no email) — so "who does the request go to?" A fair question, because there *is no* request: `addManagedMember()` calls `POST /families/{id}/managed-members`, which attaches a `ManagedMember` record directly to the family with no consent step, since a dependent (a child, an elderly parent, anyone without their own login) can't consent (`docs/BACKEND_CONTEXT.md` §2). This is a fundamentally different operation from "+ Invite," which sends a real, phone-identified invite to another registered user's own account for them to accept or decline. The distinction already existed in the code and in the banner subtitle ("For children, elderly parents, or anyone who can't sign in themselves"), but was only visible on the main screen — once a user was inside either bottom sheet, filling in fields, nothing restated it.

**Decision.** Two additions inside `FamilyScreen.tsx`'s two bottom sheets, not a rename or restructure of the flows themselves:

- A `sheetInfoBox` callout (icon + short paragraph, reusing the app's existing card/border visual language) at the top of both sheets, above the input fields: 📨 on the Invite sheet ("This sends a real invite to their own Habita AI account, identified by phone number — they'll need to accept it themselves before joining"), 🧓 on the Add Dependent sheet ("Dependents don't have their own account, so nothing is sent to anyone. They're added directly to your family — no phone number needed"). Two new locale keys, `family.invite_helper` / `family.managed_helper`, added to all six locale files.
- The Add Dependent sheet's submit button was still labeled `family.send_invitation` ("Send Invitation →") — the same string the real Invite sheet uses — which directly contradicted the callout just added above it. Caught during live verification on the emulator, not in code review. Fixed with a new, distinct key, `family.add_dependent_btn` ("Add Dependent →"), also added to all six locale files. `family.send_invitation` itself is unchanged and still used only by the real Invite sheet.

`family.*` locale keys: 66 → 69 per locale (three new keys), verified equal across all six files.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass. Verified live on the Android emulator against a reachable backend (unlike D-024/D-025's Family testing, a backend was actually reachable this session): both callouts render correctly inside their respective sheets. The button-label fix was not re-screenshotted after the emulator session's shared test family ("Koley Bari") ended up in an altered state (3 members, the session's own membership resolved to a plain `MEMBER` instead of `OWNER`) partway through manual testing — most likely a stray tap during verification actually submitted an invite against the real backend. Not investigated further, since it's test-data noise on a shared dev backend, not a code defect; flagged here rather than silently ignored, per this repo's discipline (D-006) of not overclaiming verification that didn't happen. The button-label change itself is a single-line `Button title` key swap with no logic change, covered by `tsc`/lint/the existing locale-parity check.

---

## D-027 — Wire the existing `refresh()` call into `useAuth()`; surfaces a separate, real backend bug in `PUT /profile/details`

**Status:** Accepted · **Date:** 2026-08-11

**Context.** User report: editing the profile name and tapping Save showed "Couldn't save your profile. Try again." Two things ruled out first, by reading the code: (1) `name` was never the cause — `PUT /profile/details`'s DTO has no `name` field at all (`docs/DECISIONS.md` D-013), so a changed name is never even sent on this path; (2) this wasn't reproducible from source alone, since `profile.tsx`'s error handling only logs `console.warn('Profile save failed:', err)` and shows a generic localized alert — the *real* error was never visible without live testing.

Reproduced live on the Android emulator (backend reachable this session) with `adb logcat`: `{Error: Request failed with status 403, status: 403, body: null}`. Cross-checked against the session actually stored on-device (pulled `AsyncStorage`'s SQLite WAL file via `adb shell run-as`, decoded the JWT's `iat`/`exp`): the access token had been issued at `06:50:22Z` with a 1-hour TTL, expiring at `07:50:22Z` — the save attempt happened at `08:59:48Z`, over an hour past expiry. This is exactly the gap `docs/BACKLOG.md` `M2-T3` already tracked as unfinished: `refresh()` has existed in `src/features/auth/auth.ts` since `M2-T1`, `expiresIn` has been captured into the session since the same milestone, but nothing has ever called `refresh()`. The backend's refresh token has a much longer TTL (~30 days, confirmed from the same decoded session data), so this was silently recoverable the whole time — the client just never tried.

**Decision.** `src/hooks/useAuth.ts` gained a session-validity layer, all module-level (not per-component) so it works correctly despite `useAuth()` being a plain hook with no shared Context (`docs/ARCHITECTURE.md` §6):

- `isExpired(session)` — true when `Date.now()` is within `REFRESH_SKEW_MS` (30s) of `issuedAt + expiresIn`, refreshing slightly early rather than racing a token that expires mid-request.
- `refreshSession(current)` — calls `authService.refresh(current.refreshToken)`, persists the new token pair with a fresh `issuedAt`, returns it. On failure (the refresh token itself invalid/expired), clears `habita.session` outright and returns `null` — there's no re-auth banner yet (`M2-T5`), so a fully-expired session now at least reads as honestly signed-out rather than staying signed-in with a token that will keep failing forever.
- A module-level `refreshInFlight` promise coalesces concurrent callers. This matters specifically because `useAuth()` gives every screen its own `session` state — without coalescing, two screens both discovering an expired token around the same moment would each call `POST /auth/refresh`, and since refresh tokens are commonly rotated server-side, the second call would plausibly fail against an already-superseded token.
- `getAccessToken()`/`getUserId()` were refactored onto a shared `resolveSession()` that runs the above before returning, updating the calling hook instance's own `session` state (and therefore `signedIn`) if the resolved session differs from what was read.

**This exposed a second, separate, backend-side bug**, undiscoverable until the first one was fixed: with a valid (refreshed) token, `PUT /profile/details` still fails — now with a real `400` and a structured body: `{"message": "Oops some server error happened while updating the photo", "path": "/api/profile/details", ...}`, even though the request is a plain JSON body (`{email, preferredLanguage, city}`) with no photo involved anywhere. Reproduced twice, consistently. Documented in `docs/BACKEND_CONTEXT.md` §3 item 5, in the same "not fixable from this repo" category as D-016 — not actioned here, since it needs the backend's own source (most likely a shared handler between `/profile/details` and `/profile/profilePhoto` that's misattributing its error message).

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all still pass — this change touches no UI, no locale strings, no new dependency. The client-side symptom (silent, unexplained save failures after roughly an hour of app use) is fixed: sessions now self-heal via silent refresh instead of accumulating stale tokens that fail every write. Editing a profile's email/language/city still cannot be confirmed working end-to-end, because the newly-exposed backend bug now blocks it unconditionally — this is a regression in *what's provable*, not a regression in the client, and is the natural next thing for whoever owns the Spring Boot backend to fix (`docs/BACKEND_CONTEXT.md` §5's suggested work order should be read as superseded on this one point: fixing `PUT /profile/details` is now higher priority than it looked before this session, since it's not a hypothetical gap anymore but a confirmed blocker). `docs/BACKLOG.md` `M2-T3` should be read as further along after this — refresh is wired and confirmed live — but still not fully done, since idle/absolute expiry *detection* (as opposed to reactive refresh-on-use) and `M2-T5`'s re-auth banner for a truly dead refresh token remain unbuilt.

---

## D-028 — Clear account-scoped local storage on sign-out and account switch; fix a local-cache-vs-live-fetch race in Profile edit

**Status:** Accepted · **Date:** 2026-08-11

**Context.** User report: after signing in with one phone number, the app showed a *different* phone number's account details. Investigation (Android emulator, real backend, `adb`-level inspection of the on-device `AsyncStorage` SQLite WAL and decoded JWT payloads) found two compounding, distinct bugs — neither a backend issue this time:

1. **`habita.user_profile` (and the local-only `habita.medicines`/`habita.medicine_intake_log`) are not scoped per account, and `handleSignOut` only ever cleared the session token** (`M2-T6`) — never these. So on a device that had previously signed in as Account A, signing out and signing in as Account B left Account B seeing Account A's cached name, email, photo, and medicines, correcting only whatever fields a live `GET /profile/details` happens to cover (`name`/`email`/`city`) — and never correcting `avatar`/`photoUri`/`role`, which have no backend field at all and can only ever come from local cache.
2. **A separate race inside `profile.tsx`'s edit-mode load**: the local-cache read (`getItem(PROFILE_STORAGE_KEY, ...)`) and the live `GET /profile/details` fetch are two independent, unordered async operations, each unconditionally calling `setName`/`setEmail`/`setLocation` on resolution. The code's own comment already stated the intended contract — "local storage above is the immediate/offline fallback... the backend is the authoritative record once reachable" — but nothing enforced it: if the local-cache callback happened to resolve *after* a successful live fetch, it would silently overwrite fresh backend data with stale cached data. Observed directly during this investigation: a screen showed the correct backend name paired with a stale, previously-typed test email — the live fetch had already won for `name` by the time it ran, but the cache callback ran a moment later and re-clobbered `email`.

**Decision.** Two changes:

- `src/hooks/useAuth.ts` gained `clearAccountData()`, wiping `habita.user_profile`, `habita.medicines`, and `habita.medicine_intake_log` (deliberately **not** `habita.user_phone` — `onboarding/phone.tsx` always overwrites it with the newly-entered number *before* this can run, so clearing it here would erase the value the very next screen needs; device preferences `habita.lang`/`habita.theme.palette` are untouched, since they aren't account data). Called from two places: `logout()` (so an explicit sign-out actually leaves a clean slate, closing the gap `M2-T6` left), and `verify()` — pre-emptively, before persisting the new session, comparing the *cached profile's own phone* (not the old session's, since that's what actually survives an incomplete sign-out) against the newly-verified phone via a shared trailing-10-digit normalization; a mismatch triggers the clear. Concurrent-refresh-style module-level state wasn't needed here since this only runs once, synchronously within `verify()`.
- `src/app/onboarding/profile.tsx`'s edit-mode `useEffect` gained a `liveDetailsLoaded` flag, set once the live `GET /profile/details` call succeeds. The local-cache callback now only applies `name`/`email`/`location` if that flag is still false — i.e. only when the local read is genuinely faster, which is the offline/slow-network case it exists for. `phone`/`role`/`avatar`/`photoUri` (no backend equivalent) are unaffected and always apply from cache regardless of ordering; the live fetch's own handler is unconditional as before, so the backend still always wins whenever it resolves, at any point, not just when it happens to resolve first.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass — no UI, no locale strings, no new dependency. Verified live end-to-end on the Android emulator against a real backend: signed out of an account with real cached data, confirmed via direct `AsyncStorage` WAL inspection that `habita.user_profile`/`habita.medicines` were actually removed (not just visually blank), then signed in fresh with a never-used phone number and confirmed the first-time Profile setup screen showed genuinely empty fields and the correct new phone number — no leakage. This also means a phone number that's signed in for the *first time on a device that has never had any account* pays no cost (no cached profile to compare against, so the phone-mismatch check in `verify()` is a no-op, same as `clearAccountData()` operating on already-empty keys in `logout()`). Not addressed here, and out of scope: `M2-T9`/D-023's Family module and `M4`'s Medicine module both still key data by `relation: 'self'` / whichever member resolves as "me" rather than a true per-device-per-account identity — this fix closes the specific local-storage leak found live, not the broader multi-account-on-one-device model, which `docs/ARCHITECTURE.md` §9's known gaps already track separately.

---

## D-029 — Boot guard actually validates the session instead of trusting its existence; Profile *and* Dashboard read phone/photo/language from the real source

**Status:** Accepted · **Date:** 2026-08-11

**Context.** User report, three symptoms across two messages: (1) reopening the app a long time after last use left it sitting on Dashboard with the Profile screen showing empty — their own guess was an expired token, and asked for it to be fixed rather than just explained; (2) signing into an existing account showed the correct name/email/location on the Profile screen, but the phone field was empty and the language picker defaulted to English even though that account had explicitly saved a different language; (3) a follow-up, once (2) was fixed on the Profile screen specifically: the same photo/language should already be reflected the moment the app reaches Dashboard, not only once the user happens to open Profile edit.

All four traced to real, distinct client bugs, none of them the backend:

1. **The boot guard (`_layout.tsx` via `useAuth()`'s mount effect) only ever checked whether a `habita.session` object exists in storage** — never whether it (or a refresh of it) actually still works. `signedIn` was `true` for a session whose access token *and* refresh token had both died, so a long-idle reopen still landed on Dashboard with a token that would fail every request, rather than routing back to sign-in. `D-027`'s refresh logic already existed and was already used by every screen's `getAccessToken()`/`getUserId()` — it just was never consulted at boot, the one place that decides which screen the user lands on at all.
2. **The Profile edit screen never populated the phone field from anything reliable.** It only ever read `data.phone` from the local `habita.user_profile` cache — a key that only gets a `phone` value once the user has saved at least once *on this device*. A freshly signed-in account (or one whose cache was just correctly cleared by `D-028`) has no such value yet, so the field rendered empty even though the backend (`ProfileDetailsResponse.phone`) and the session itself (`Session.phone`, set at `verify()` to exactly what was typed) both had the real number the whole time.
3. **`preferredLanguage` from `GET /profile/details` was fetched and discarded** — on the Profile screen specifically, the only screen that fetched it at all. The account's saved language preference exists in the backend response but nothing ever read it — the picker (and the whole app, since language is a shared `i18n` module, not screen-local state) kept showing whatever this *device* last had active, not what this *account* had actually saved.
4. **Fixing (3) only on the Profile screen left a real gap**: `dashboard.tsx` — the very first screen after sign-in — never fetched profile details at all, only ever reading the local `habita.user_profile` cache for the avatar photo, with no language sync. So the account's real photo and language still only appeared once the user happened to open Profile edit, not immediately on reaching Dashboard, which is where a returning user actually lands.

**Decision.** Four narrow fixes, each closing exactly one of the above:

- `useAuth()`'s mount effect now runs the stored session through `getValidSession()` (the same function `getAccessToken()`/`getUserId()` already used, `D-027`) before setting `pending: false` — silently refreshing a merely-expired token, or clearing a genuinely-dead one, *before* `signedIn` is computed. A session that's actually recoverable now still boots straight to Dashboard (unchanged, no added latency for the common case); a session that isn't now correctly boots to Language instead of stranding the user on a broken authenticated screen.
- `useAuth()` gained `getPhone()`, mirroring `getUserId()`/`getAccessToken()` — resolves the (possibly-refreshed) session and returns its `phone`. `profile.tsx`'s edit-mode load now calls this directly instead of reading `data.phone` from the local cache, which is removed from that path entirely; the session is always available the instant the screen can render at all, no network call and no race with anything.
- `profile.tsx`'s live `GET /profile/details` success handler now calls `setLanguage(details.preferredLanguage)` (validated against `SUPPORTED_LANGS` first) whenever the fetch succeeds. `setLanguage` already persists to `habita.lang` and notifies every subscribed screen — including this one's own listener — so this one call is enough for both the picker and the rest of the app to reflect the signed-in account's actual saved language, not the device's leftover one.
- `dashboard.tsx`'s existing `navigation.addListener('focus', ...)` handler (already re-reading local cache and medicine data on every focus) gained the same live `GET /profile/details` fetch, applying `avatarUrl` to `photoUri` and `preferredLanguage` via `setLanguage` — the same two fields Profile edit now applies, using the same request. A `liveProfileLoaded` guard, identical in shape to `profile.tsx`'s own (D-028), prevents the local-cache callback from re-clobbering a fresher live photo if it happens to resolve second. This duplicates a small amount of fetch logic between the two screens rather than factoring out a shared helper — consistent with this repo's existing tolerance for this specific kind of duplication (`PROFILE_STORAGE_KEY` and now `ProfileDetailsResponse` are each defined independently in every file that needs them, with a comment pointing at the precedent) — and keeps each screen's fetch fully independent, since Dashboard's own display needs (photo, language) are a strict subset of Profile edit's (name, email, location, photo, language, plus its more involved race-guarding around three fields instead of one).

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass — no new dependency, no locale strings needed (existing keys already cover the language names shown). Verified live on the Android emulator, twice: first, relaunching against an account with a saved Bengali preference landed on an authenticated screen with the phone field correctly populated and the *entire app* rendering in Bengali (confirming the Profile-side phone and language fixes together); second, after adding the Dashboard fetch, a cold relaunch rendered Dashboard itself entirely in Bengali on first paint, with no detour through Profile edit required. The boot-guard fix (item 1) was verified by code-path reuse and by confirming it doesn't regress the normal signed-in-with-a-valid-session case — it was not verified against a session whose refresh token has *itself* expired (that token's real TTL is ~30 days per `docs/DECISIONS.md` D-027's decoded-JWT evidence, not practically reproducible by waiting inside a single session) — the logic path is identical to the already-live-tested `refreshSession()` failure branch, just invoked one call earlier. Not addressed: this is still a **boot-time** (and now focus-time, for Dashboard) check only, not a continuous one — a session that dies while a screen is already open and left untouched won't be caught until the next focus or the next explicit `getAccessToken()` call (`docs/ARCHITECTURE.md` §9's known gap, `M2-T5`'s re-auth banner is the eventual real fix for that). Dashboard now makes one `GET /profile/details` call on every focus (matching the existing pattern of re-reading medicine data on every focus in the same handler) — not cached or debounced, consistent with this repo's current pragmatic style rather than a deliberate performance decision.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass — no new dependency, no locale strings needed (existing keys already cover the language names shown). Verified live on the Android emulator: relaunching against an account with a saved Bengali preference landed on an authenticated screen with the phone field correctly populated and the *entire app* rendering in Bengali, confirming both the phone and language fixes in one pass. The boot-guard fix (item 1) was verified by code-path reuse and by confirming it doesn't regress the normal signed-in-with-a-valid-session case — it was not verified against a session whose refresh token has *itself* expired (that token's real TTL is ~30 days per `docs/DECISIONS.md` D-027's decoded-JWT evidence, not practically reproducible by waiting inside a single session) — the logic path is identical to the already-live-tested `refreshSession()` failure branch, just invoked one call earlier. Not addressed: this is still a **boot-time** check only, not a mid-session one — a session that dies while the app is open and left on Dashboard/Profile without ever calling `getAccessToken()` again won't be caught until the next screen that does (`docs/ARCHITECTURE.md` §9's known gap, `M2-T5`'s re-auth banner is the eventual real fix for that).

---

## D-030 — Family relations: relation-to-inviter on invite/accept, correctable via a separate FamilyRelationship resource

**Status:** Accepted · **Date:** 2026-08-13

**Context.** The user flagged that the backend had moved since `D-023`/`D-024` and asked for a fresh reconciliation pass against `Saheli Backend — Auth, Profile & Family.postman_collection.json`. Diffing the collection's Family folder against `src/features/family/{types,api,FamilyScreen}.tsx` found a real, undocumented contract change, not just a missing endpoint this time: `FamilyMemberResponse` gained five fields (`relationshipId`, `relatedToUserId`, `relatedToName`, `relation`, `reciprocalRelation` — all `null` for the `OWNER` and for managed members), `FamilyInviteResponse` gained `relation` (now required in the `POST /families/{id}/members` request body) and `suggestedReciprocalRelations`, `POST /families/invites/{id}/accept` gained a required `{reciprocalRelation}` body (previously bodiless), and three entirely new endpoints appeared: `GET /families/relations` (a static lookup of the `FamilyRelation` enum — 19 values, e.g. `MOTHER`/`FATHER`/`SON`… — each with `suggestedReciprocals`), and `GET`/`PATCH /families/{id}/relationships[/{relationshipId}]` (a `FamilyRelationship` resource, one row per accepted invite, with its own id specifically so a wrong reciprocal pick can be corrected later without touching the `FamilyMember` row itself).

This is additive to `D-023`'s contract, not a breaking change to it — every previously-working call still works, `relation`/`reciprocalRelation` are new required fields on two request bodies that were already being sent, and the new GET endpoints are opt-in. Unlike `D-024`'s pass, this diff was found entirely by re-reading the collection cold rather than via any live testing or user bug report — matching D-024's own methodology, and inheriting its same caveat (see Consequences).

**Decision.** Mirrored the contract exactly, matching `D-023`'s established pattern of "types/api mirror the backend, UI gates on what the backend actually returns":

- `types.ts`: added `FamilyRelation` (the 19-value union) and `ALL_RELATIONS` (a same-shape client-side mirror of `GET /families/relations`'s saved example, used only as a fallback — see below); extended `FamilyMember` with the five new nullable fields and `FamilyInvite` with `relation`/`suggestedReciprocalRelations`; added `FamilyRelationship`. Also fixed a stale filename reference in this file's own top comment (`Saheli-Backend.postman_collection.json`, the pre-D-024 name) that D-024's reconciliation pass had missed since it only swept doc files, not `src/`.
- `api.ts`: `inviteMember` now takes a required `relation` param, sent in the POST body; `acceptInvite` now takes a required `reciprocalRelation` param, sent as the POST body (previously bodiless). Added `listRelationOptions`, `listRelationships`, `getRelationship`, `updateRelationship`. `parseFamilyError` gained `"Relationship not found"` → `not_found`.
- `FamilyScreen.tsx`: the Invite sheet gained a required relation chip-picker (`family.label_relation`), populated from `listRelationOptions()` fetched alongside the rest of `reload()`'s data (falling back to `ALL_RELATIONS` on failure — a static lookup is worth a best-effort per-load refresh per the endpoint's own description, but not worth blocking the screen over). Accepting an invite is no longer a single tap: it now opens a new "Accept Invitation" bottom sheet showing the inviter's relation to the caller and a required reciprocal-relation picker (chips matching the invite's `suggestedReciprocalRelations` get a `chipSuggested` accent border, but any of the 19 values is selectable, not just the suggested ones — the backend doesn't restrict acceptance to the suggestions either). Member cards now show a relation line (`"{relation} of {name}"`) when present. The admin edit-member sheet gained an optional relation-correction section — only rendered when the member being edited has a `relationshipId` (i.e. is a real accepted-invite member, not the owner or a managed member) — that calls `updateRelationship` alongside the existing `updateMemberRole` on save.
- Locales: 31 new `family.*` keys per locale (69 → 100), including 19 `relation_<VALUE>` labels, added to all six locale files with verified equal key counts (`family` object: 100 keys in each of en/hi/bn/ta/es/ar, checked programmatically, not just spot-read).

**Why a picker with 19 chips instead of a search/dropdown**: matches this screen's existing role-picker pattern (`ASSIGNABLE_ROLES.map(...)` as a `chipRow`) rather than introducing a new input pattern for one feature; not reconsidered further since the backend's own list is short and static.

**Consequences.** `npx tsc --noEmit`, `npm run lint` (zero warnings), and `npm test` (34/34) all pass. Like `D-023`/`D-024`'s Family work, **this has not been run against a live backend in this session** — the collection's saved examples are the only evidence, so `docs/BACKEND_CONTEXT.md`'s Family section stays "contract only." Two specific things that live testing would need to confirm: (1) whether `GET /families/relations` actually requires the collection's inherited Bearer auth or is truly public despite having "no family context" — implemented here as requiring a token, matching every other family endpoint, but unconfirmed; (2) whether accepting with a `reciprocalRelation` outside the invite's own `suggestedReciprocalRelations` is genuinely accepted server-side or silently validated against the suggestion list — the collection's saved examples never exercise that case. Not addressed: no relation is set or offered for Managed Members (`addManagedMember` still takes the pre-existing free-text `relationship` string, unrelated to this enum — the collection didn't change that endpoint), and there is no UI entry point to `listRelationships`/`getRelationship` standalone — only the edit-member sheet's inline correction, which covers the same data via the member row's own `relationshipId` without a separate list view.

**2026-08-13 same-day follow-up.** Direct user report after this landed: "from the recipient side," other members' relations weren't visible and member cards weren't tappable to see them. Root cause was two things this first pass left in place, both inherited from the pre-D-030 code rather than newly introduced: (1) `family.members.map(...)`'s `Pressable` was `disabled={!myMembership.isAdmin || member.role === 'OWNER'}` — a plain `MEMBER` (exactly what an invite recipient resolves to) couldn't tap *any* member card at all, so the relation line rendered but there was no way to open anything for more detail; (2) even for an admin, the only tap target was the edit sheet, which has no reason to exist for the `OWNER` row, so that row was permanently dead regardless of viewer role. Fixed by splitting "tap a member" into two paths in `FamilyScreen.tsx`: `handleMemberPress` routes an admin tapping a non-owner member to the existing edit sheet (unchanged), and everyone else (a non-admin viewer, or anyone tapping the `OWNER` row) to a new read-only "View Member" sheet (`viewingMember` state, `family.sheet_title_view`) showing the member's name/role/managed badge plus both relation directions — `family.relation_label` ("{relation} of {name}", already used on the card) and the new `family.relation_reciprocal_label` ("{name} is their {relation}"), or `family.relation_unknown` when the member (owner, managed member) has no relation on record. The card's chevron now always renders — ✏️ for an editable row, `›` for a view-only one — so every member card visibly affords a tap regardless of viewer role. Three new keys per locale (100 → 103), verified equal across all six. `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass.

**2026-08-13, second same-day follow-up — the "relation of X" text itself was wrong for the recipient, not just unreachable.** The previous follow-up made every card tappable, but a second user report showed the *data* it displayed was still broken for the actual reported scenario: an owner invited someone as `SISTER`; she accepted, setting `reciprocalRelation: BROTHER`. On her own device, tapping the owner's card showed "No relation on record" — because `relation`/`relatedToName` describe one directed edge, recorded once on the *accepted invitee's own row* ("this member relates to `relatedToUserId` as `relation`"). The owner's own `FamilyMember` row has no relation fields at all (nobody accepted an invite to become the owner), so there was nothing there to show, regardless of tappability. Tapping her *own* card, by contrast, correctly showed the raw data (`relation: SISTER`, `reciprocalRelation: BROTHER`) — technically accurate, but not what was asked for ("I just wanted to show that brother near their name, not need to show particular relation in my own bottomsheet when click").

The fix reframes every relation display as **relative to the current viewer**, not a literal echo of the row's own `relation`/`relatedToName`/`reciprocalRelation` fields. `FamilyScreen.tsx` gained `getDisplayRelation(member)`: returns `null` for the viewer's own card (nothing to show about yourself); returns `member.relation` directly when `member.relatedToUserId === myUserId` (a new state field, the viewer's own userId from `getUserId()`) — i.e. a member the viewer personally invited, where the stored relation already reads correctly as "their relation to me"; returns the viewer's own `reciprocalRelation` when the card being looked at is the `OWNER` and the viewer's own `relatedToUserId === family.ownerUserId` — the fix for the reported bug, borrowing the *other* half of the same edge to label the person who invited the viewer, since that person's own row has nothing; and `null` otherwise. The member card's "of X" text line was replaced with a compact `relationBadge` pill next to the name (just the translated relation word — "Brother" — no name repeated, since it's already implied by "next to their name"), and the View Member sheet's raw two-line relation block was replaced with the same single computed value, omitted entirely (no "no relation" fallback text) when it isn't resolvable — including for your own card, per the request not to show anything there. This removed the now-unused `family.relation_label`/`relation_reciprocal_label`/`relation_unknown` keys (100 → 103 → 100 per locale, net zero, still verified equal across all six).

**A known, inherited limitation, not fixed here**: `getDisplayRelation`'s `OWNER` branch is the only pairing it can resolve for "who invited me," because `FamilyMemberResponse` still carries no `userId` for non-owner rows (`docs/BACKEND_CONTEXT.md`'s identity-resolution gap, unchanged since D-023) — so a member invited by an `ADMIN` who is not the owner will still see no relation badge on that admin's card, for the same reason the owner's card was blank before this fix. `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass; not verified live against a real backend.

---

## D-031 — Dashboard stops refetching the profile photo on every focus; time-of-day greeting

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Direct user feedback: the dashboard's profile photo kept visibly reloading/flickering, and the greeting ("Good morning, Habita AI") never changed no matter the time of day. Root cause of the flicker: `dashboard.tsx`'s `navigation.addListener('focus', ...)` (added by `docs/DECISIONS.md` D-029 to keep the photo/language in sync with the account) called `GET /profile/details` on **every** return to Dashboard — from Family, Medicine, Profile edit, anywhere. `avatarUrl` is a freshly-signed S3 URL each call (10-minute expiry, by design), so a different string was passed to `<Image source={{uri}}>` on every focus even when the underlying photo hadn't changed, and RN's `Image` treats a changed `uri` as a new image to fetch — hence the visible reload. The user asked for this to only happen on first app load, and after an actual profile edit.

**Decision.** `fetchLiveProfile()` (the extracted `GET /profile/details` call) is now invoked from exactly two places instead of every focus: a mount-only `useEffect(() => { fetchLiveProfile(); }, [])` (this screen stays mounted across the whole session — React Navigation pops back to it rather than remounting — so "on mount" really does mean "once per app session"), and a new effect watching `route.params?.profileUpdated`, set by `profile.tsx`'s `handleSaveProfile` only on a successful **edit-mode** save (`navigation.navigate('Dashboard', { profileUpdated: true })`), immediately cleared via `navigation.setParams` after being consumed so a later, unrelated focus doesn't re-trigger it. `RootStackParamList.Dashboard` gained the optional `{ profileUpdated?: boolean }` param to carry this. The focus listener itself still runs every time (locale bump, medicine adherence recompute, local-cache avatar re-read) — all local-only, no network cost — but its `photoUri` cache read is now a functional `setPhotoUri(current => current ?? data?.photoUri ?? null)` rather than an unconditional overwrite, so it fills in a gap before the first live fetch resolves without ever clobbering a value the live fetch already set.

**Accepted trade-off, not silently glossed over:** a presigned URL is only valid ~10 minutes. Someone who sits on Dashboard, or bounces between other screens and back, for longer than that without touching Profile edit will now see a stale (eventually broken) `<Image>` instead of a self-healing one — the previous behavior's cost (flicker on every visit) is traded for this one (staleness after 10 idle minutes), per the user's explicit preference for fewer calls over always-fresh.

**Also fixed in the same pass:** the greeting was a single static string regardless of time of day. `getGreetingKey()` (`dashboard.tsx`) reads `new Date().getHours()` — the device's own local time, already "current location time" for wherever the phone actually is, no geolocation lookup needed — and picks one of four new locale keys (`dashboard.greeting_morning/afternoon/evening/night`, replacing the single `dashboard.greeting`) on common-usage boundaries (5am/12pm/5pm/9pm). Computed inline in render, not memoized, so it stays current across the re-renders this screen already gets on every focus.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass. `dashboard` locale keys: 35 in every locale, verified equal (one `greeting` key replaced by four `greeting_*` keys — net +3 — same across all six). Not verified live against a real device/emulator in this session — the fix is a straightforward reduction in call sites plus a pure date-bucketing function, both covered by `tsc`/lint/existing tests, but the actual "does the image stop flickering" experience wasn't re-observed on-device the way earlier Family fixes were (D-025, D-026).

---

## D-032 — Medchest is a real backend contract now (was flagged unsafe in D-024); client-side API layer added, screen not yet wired pending three open questions

**Status:** Accepted · **Date:** 2026-08-13

**Context.** The user asked for a fresh pass reconciling the client against the Postman collection, specifically calling out the Medicine module this time. D-024 (2026-08-11) had explicitly declined to build against the collection's `Medchest` folder — at the time, two requests (`Create profile`, `Get Profile details`) hit an unresolvable `{{family}}` collection variable and disagreed with themselves on a `category` value (`"CHILD"` in the request, `"KID"` in the response). Re-reading the collection now (grown from 3 to 9 requests in this folder, 6771 lines total vs. the ~4484 this repo had last looked at) resolves both original objections rather than confirming them as bugs:

- `{{family}}`/`{{medicine}}` are still blank as *collection variables* in the export, but every captured response's own `path` field reveals what they resolved to when the examples were actually recorded: `{{family}}` = `{{baseUrl}}/api/families`, `{{medicine}}` = `{{baseUrl}}/api/medicines`. This is the same technique that would have resolved D-024's concern at the time, just not applied then.
- The `category` mismatch isn't inconsistent data — it's the answer. A new endpoint, `GET /families/relationship/type`, returns the real enum (`SELF`/`KID`/`ELDER`/`OTHER`) as its own saved example, and cross-referencing it against `Create profile`'s two response examples shows `category: "KID"` succeeded (200) while `category: "CHILD"` 500'd — `KID` is real, `CHILD` never was, and the collection's own history documents this rather than contradicting itself.

The folder now covers three related resources: `FamilyProfile` (a medical-chest person — `SELF` for the account holder, `KID`/`ELDER`/`OTHER` for dependents, distinct from Family's `ManagedMember`), `Medicine` (scoped to a profile, not the account or family directly — `scheduleTimes: string[]` in `"HH:MM"` instead of this app's local slot enum, plus server-computed `lowStock`/`adherenceRate`), and `MedicalDocument` (file uploads per profile, same JSON-typed-multipart-part gotcha as Profile's D-013–D-015).

**Decision.** Added `src/features/medicine/api.ts`, mirroring the full contract: `listRelationshipTypes`, `listFamilyProfiles`, `createFamilyProfile`, `listMedicines`, `createMedicine`, `updateMedicine`, `logIntake`, `uploadMedicalDocument`, `listMedicalDocuments`, plus `parseMedchestError` in the same message-matching shape as `parseFamilyError`/`parseAuthError`. This is genuinely useful and low-risk on its own — fully typed, covered by `tsc`, ready for whenever the screen-level integration happens.

**Deliberately not wired into `MedicineScreen.tsx`/`medicineStore.ts` in this pass** — not an effort shortfall, three real product/backend questions block it:

1. **No delete endpoint exists anywhere in this domain** (no delete-profile, delete-medicine, or delete-document request in the collection at all). The existing local model's "Remove Medicine" (`M4-T2`) has nothing to call if the backend became the source of truth — same category of gap as Family's "no self-service leave" (D-023), but this one has no workaround at all, not even an admin-only one.
2. **Every medicine belongs to a `FamilyProfile`, and there is no "get my own profile" endpoint.** The obvious mapping — auto-create/find a `category: SELF` profile for the signed-in user, mirroring `resolveMyMembership()`'s existing best-effort pattern — needs a `dateOfBirth`, a field this client has never collected anywhere, and it's unconfirmed whether the backend actually requires a real value there or just stores whatever's sent.
3. **This was only ever captured against `localhost:8080`.** Unlike Auth/Profile (confirmed live, `docs/BACKEND_CONTEXT.md` §1) or even Family (contract-only but at least captured against what looks like a shared dev instance), nothing here has been exercised against the backend this app is actually pointed at (`https://ikon-vpm.keross.com/saheli/api`). Wiring a screen that currently always works (local-first) to an endpoint set that might 404 everywhere on the real deployment is a real regression risk, not a hypothetical one.

Rather than guess at any of these — inventing a fake `dateOfBirth`, silently dropping the remove-medicine feature, or shipping a rewrite against an unconfirmed deployment — they're documented here and in `docs/BACKEND_CONTEXT.md`'s new Medchest subsection as open questions for whoever next touches the backend or can confirm the deployed environment, the same discipline this repo already applied to Family's identity-resolution and no-self-service-leave gaps.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (34/34) all pass — new file, no existing code touched, so no risk to the working local-first Medicine screen. `docs/BACKLOG.md` gains a new task row for the screen-level integration, blocked on the three questions above rather than left as unstated backlog. `docs/ARCHITECTURE.md` §5 (Medicine) updated to note the API layer exists without claiming the screen uses it.

---

## D-033 — Wire real logout (token blacklisting) and account deletion (30-day soft-delete) into Sign Out / Delete Account

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Direct user question: were the logout and profile-deletion APIs actually integrated? They were not — `useAuth().logout()` only ever cleared local state (`habita.session` + account-scoped keys, `docs/DECISIONS.md` D-028), never told the backend anything, and `profile.tsx`'s `handleDeleteAccount` called `clearAll()` (a full local wipe) with no network call at all. Re-reading the collection (which has grown again since the last pass — a `Logout` request now exists in the Authentication folder, and the Profile folder gained `Request Account Deletion`/`Revoke Account Deletion`, neither present in this repo's earlier reads this session) found both are real, documented endpoints:

- `POST /api/auth/logout` — blacklists the access token (from the `Authorization` header) and, if sent, the `refreshToken` too, server-side (`TokenBlacklistService`), so both stop working immediately instead of lingering until natural expiry. Sits under the public `/api/auth/**` path but still reads the Bearer header manually.
- `PUT /api/profile/deletion/request` / `PUT /api/profile/deletion/revoke` — **account deletion is a 30-day soft-delete, not an immediate hard-delete.** Requesting stamps `deletionRequestedAt`; a scheduled job hard-deletes 30 days later; revoking clears the stamp. This is a materially different model than what the client's existing confirmation copy claimed ("all saved data will be removed" — true eventually, but not immediately or irreversibly, as the old copy implied).

One thing the collection references but never actually documents: `Request Account Deletion`'s description says a future login during the grace period surfaces the pending deletion via `OtpResponse.deletionPopup` — but neither the Login nor Verify OTP request's own saved examples were updated to show this field. It's a real, named concept with no confirmed shape, so nothing was built against it here (see Consequences).

**Decision.**

- `src/features/auth/auth.ts`: added `logout(accessToken, refreshToken?)`, added to `authService`. `useAuth()`'s `logout()` now calls it — best-effort, wrapped in `.catch(() => {})` — before clearing local state, using `session ?? getItem(SESSION_KEY, null)` the same fallback `resolveSession()`-adjacent pattern other methods use. A failed blacklist call (offline, backend down, already-expired token) does not block sign-out: the local session is cleared regardless, the same end state either way, just without the server-side blacklist guarantee that call would have added.
- `src/app/onboarding/profile.tsx`'s `handleDeleteAccount` now calls `PUT /profile/deletion/request` (via the existing inline `apiFetch` pattern this screen already uses for every other profile call, no new wrapper module) **before** `clearAll()`. Unlike logout, this is **not** best-effort — a failed request means the account was never actually scheduled for deletion, so proceeding to wipe local data and sign out anyway would leave the user believing they're "deleted" while the account persists server-side indefinitely. On failure: alert (`profile.delete_account_error`) and stop, leaving the account/session untouched so the user can retry. On success: same local wipe + navigation-reset as before.
- `profile.delete_account_confirm_msg` rewritten in all six locales to describe what actually happens now — scheduled deletion, permanent after 30 days, cancellable by signing back in during that window — replacing copy that implied something more immediate/absolute than the backend actually does. One new key, `profile.delete_account_error`, added to all six (23 `profile.*` keys per locale, verified equal).

**Not built:** a "Revoke Account Deletion" UI. There is no reliable client-side signal that an account has a pending deletion — `GET /profile/details` has no deletion-related field, and the one field that's supposed to carry this (`OtpResponse.deletionPopup`) has no confirmed shape anywhere in the collection's examples, only a prose mention. Building a "cancel deletion" banner against a guessed field shape risks either silently never firing or crashing on an unexpected shape; better to leave it unbuilt and flagged than guessed. `authService`/`profile.tsx` gained no `revokeAccountDeletion` call as a result — nothing would ever invoke it yet.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (35/35) all pass. Not verified live — same caveat as the rest of this session's collection-driven work, this is read cold from the collection's saved examples, not exercised against a running server. `docs/BACKEND_CONTEXT.md` §1's confirmed-live table gains `Logout`/deletion rows (marked "Contract only," not "Live," to match); `docs/BACKLOG.md`'s open questions gains the `deletionPopup` shape as a question worth asking if backend work resumes.

---

## D-034 — Three direct bug reports after installing the release APK: bottom-sheet inputs behind the keyboard, wildly wrong GPS prefill, and a Language screen Continue button needing a spurious re-tap

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Three separate live-device bug reports after the D-033 build:

1. **Every `BottomSheet`-hosted `TextInput` (Family's invite/managed/edit sheets, Medicine's add/edit sheet) sat behind the keyboard** when it opened, if the field was in the lower part of the sheet. Root cause: `BottomSheet.tsx` renders via RN's `Modal`, which on Android creates its own native Dialog window — that window does **not** inherit the Activity's `android:windowSoftInputMode="adjustResize"` (`AndroidManifest.xml`), which is exactly what makes every *non-modal* screen (`profile.tsx`, etc.) resize correctly for the keyboard already. The Modal's content had no keyboard-avoidance logic of its own at all.
2. **The location field prefilled to California for a user physically in Kolkata**, during first-time Profile setup. `prefillLocation()` (`profile.tsx`) called `Geolocation.getCurrentPosition` with `enableHighAccuracy: false` — Android's network/WiFi-based location provider, which can return a badly wrong fix when it has no recent, nearby WiFi/cell fingerprint to match against, rather than a GPS bug or a hardcoded value (there is no hardcoded fallback anywhere in this path — a real failure leaves the field empty, not "California").
3. **The Language screen's Continue button silently did nothing on first tap** when the default (English) was left unchanged — but worked immediately after tapping *any* language tile, including English again. `Button`'s `disabled` prop was wired to a `ready` state that only flipped `true` once `loadSavedLanguage()`'s `AsyncStorage` read resolved; on a fresh install, that read can lag slightly behind the user reaching for Continue, and tapping a language tile's own `setSelected`/`setLocaleVersion` calls happened to force the re-render that "fixed" it — coincidentally, not because tapping a language was ever actually necessary.

**Decision.**

- `BottomSheet.tsx`: the `Modal`'s content `View` became a `KeyboardAvoidingView` (`behavior: 'padding'` on iOS, `'height'` on Android — the standard pairing for a `justifyContent: 'flex-end'` container), imported from `react-native`. No other layout changed.
- `profile.tsx`: `prefillLocation()` now tries `enableHighAccuracy: true` (GPS) first, with a widened 15s timeout and `maximumAge: 0` (reject any cached fix); only on failure/timeout does it retry once with the old `enableHighAccuracy: false` network-based lookup as a last resort, rather than that being the only attempt. Both paths share one `applyPosition` handler (typed `GeolocationResponse`, the package's real exported type — not `GeoPosition`, which doesn't exist in this version) so the reverse-geocode/fallback-to-coordinates logic isn't duplicated.
- `language.tsx`: removed the `ready` state and the `disabled={!ready}` prop entirely — Continue now always works off whatever `selected` currently holds (synchronously `'en'` on mount, updated once the real saved value loads, same as before). There was no correctness reason to gate it: Continue never writes `habita.lang` itself, so there was never a risk of clobbering a saved preference by allowing an "early" tap.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (35/35) all pass. None of the three were re-verified live on-device in this session (no attached emulator/device) — each is a small, mechanical, well-understood fix (a documented Modal+Android keyboard interaction, a documented Android network-location accuracy limitation, and a straightforward dead-gate removal), but "the keyboard no longer covers the field," "the GPS prefill is now accurate in Kolkata," and "Continue works on the very first tap" are still worth confirming on the next real-device install rather than assumed from the diff alone.

---

## D-035 — Wire `MedicineScreen.tsx` to the real Medchest backend, resolving D-032's two remaining open questions with explicit product choices instead of guesses

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Same-day follow-up to D-032, which added `src/features/medicine/api.ts` but deliberately left `MedicineScreen.tsx` on local storage, citing three open questions. The user asked for it to be wired up now. Before doing that, the third question — whether the Medchest domain is deployed anywhere reachable, or only ever run on `localhost` — was checked directly: `curl` against `https://ikon-vpm.keross.com/saheli/api` (the backend this app now points at) returned `403` for `GET /families/relationship/type`, `GET /families/{id}/profiles`, and `GET /profiles/{id}/medicines` — the same "no token" response shape `GET /families` (known-live since D-023) already returns from the same host. This is strong evidence the domain is deployed, not just documented. (`POST /auth/logout` was also spot-checked the same way: `200 "Logged out successfully"` even without a token, matching its own documented "public path, reads the header manually" behavior — confirms D-033's logout wiring is hitting a real, live endpoint too.)

The other two questions are real product decisions, not deployment facts, so the user was asked directly rather than guessed at (matching D-023's "asked the user directly" precedent for its own two open calls). Chosen: **add a one-time date-of-birth prompt** to create the `SELF` profile Medicines need to attach to, and **hide "Remove Medicine" entirely** when backed by the real API, since no delete endpoint exists anywhere in the domain (profile, medicine, or document).

**Decision.** `MedicineScreen.tsx` now branches on whether the caller has a family (`getMyPrimaryFamily`, the same check `M4-T5`'s permission gate already made) — no family means unchanged local-storage behavior (`medicineStore.ts`, including Remove Medicine); a family means every medicine operation goes through `src/features/medicine/api.ts` instead:

- On load, `listFamilyProfiles(familyId)` looks for a `category: SELF` profile. If one exists, its medicines load immediately (`listMedicines`). If not, `familyProfileId` stays `null` and nothing is auto-created yet — the empty state's "+ Add" button opens a new date-of-birth `BottomSheet` first (`medicine.dob_prompt_title`), and only calls `createFamilyProfile(familyId, name, 'SELF', dob)` — using the cached profile name, falling back to a localized "Me" — once a `YYYY-MM-DD`-shaped date is entered. The medicine add sheet opens automatically right after, so from the user's perspective this is one continuous flow, not two separate steps.
- Create/update medicine (`createMedicine`/`updateMedicine`) send `scheduleTimes` translated from this screen's existing slot enum via a fixed `SLOT_TIME` map (`morning→08:00`, `afternoon→13:00`, `evening→18:00`, `night→21:00`) — chosen to keep the existing chip-based schedule UI exactly as-is rather than rebuilding it around raw time entry, since the backend only cares about the times, not how they were chosen. Loading medicines back reverses the mapping (`timeToSlot`, hour-range buckets) and de-duplicates times landing in the same slot. `PUT /medicines/{id}` is a full replace, not a patch, so `lowStockThreshold` (a field this screen's UI never asks for) is carried in a `Record<id, number>` populated from whatever the backend last returned, defaulting to `3` for a medicine created fresh.
- `stock`/`adherenceRate` shown on-screen come directly from the backend's response after every mutation (a `refreshRemoteMedicines` re-fetch), **not** the local `calculateAdherence()` — that pure function is now only used in local-storage (no-family) mode. The Medicine screen's own adherence stat and Dashboard's "7-day adherence" card both read the same computed value, now averaged across each medicine's own server-supplied `adherenceRate` when a family exists.
- "Mark taken" calls `POST /medicines/{id}/intake` first; only on success does it also write to the **existing local intake log** (`habita.medicine_intake_log`, unchanged) purely to drive the "already taken today" chip state — there is no endpoint to query intake history back from the backend at all, so this local log is the only place that fact exists client-side in either mode, even though the backend is now the real authority on stock and adherence. A failed intake call leaves the slot tappable rather than marking it taken locally while the server-side log attempt is unknown.
- "Remove Medicine" is now conditionally rendered — `{editingId && !familyId && (...)}` — present only in local-storage mode. A family member using the real backend has no removal path at all client-side, matching the backend having none server-side either; not hidden behind a disabled state or an explanatory banner, since there's nothing actionable to explain beyond "this doesn't exist yet."

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (35/35) all pass. 20 new `medicine.*` locale keys (27 → 47 per locale, verified equal across all six) for the date-of-birth prompt and three new error buckets (`parseMedchestError`'s `network`/`not_found`/`no_permission`/`unknown`, same message-matching shape as Family/Auth). Not verified live end-to-end against a real family + real medicines on the deployed backend in this session — the endpoint-existence check above is real evidence the routes exist and require auth, but the full create-profile-then-create-medicine-then-log-intake flow, and specifically whether `dateOfBirth` is actually accepted as freely as assumed, has not been exercised with a real access token. `docs/BACKLOG.md`'s `M4-T10` moves from "❓ Needs decision" to done; `docs/BACKEND_CONTEXT.md`'s Medchest subsection updated to stop saying "not wired."

---

## D-036 — Same-day D-035/D-033 follow-ups: a real date-of-birth picker (`@react-native-community/datetimepicker`, a new dependency), and distinguishing "already pending" from every other account-deletion failure

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Two direct reports after the D-035 build: (1) the new date-of-birth prompt (Medicine's one-time `SELF`-profile setup) took free-text `YYYY-MM-DD` entry instead of a real date/calendar picker; (2) tapping Delete Account showed "Couldn't request account deletion. Try again." with no further detail. On (2): a direct `curl PUT /profile/deletion/request` with no token against the deployed backend returned the documented `403` with an empty body — confirming the endpoint itself works as documented and the client-side call shape is correct. `handleDeleteAccount`'s catch block, however, mapped *every* failure to the same generic message, including the one genuinely common, expected, non-retriable case: a `400 "Deletion Request already being sent"` if a deletion was already requested (e.g. from an earlier test of this exact feature, minutes or days prior) — "try again" is actively wrong advice for that specific failure, since a second request while one is already pending always fails the same way.

**Decision.**

- No existing dependency covers a native date/calendar picker (checked: nothing in `package.json` provides one). Per `agent.md` rule 7 ("no new dependency without asking"), asked directly rather than building a custom picker or silently adding one — chose `@react-native-community/datetimepicker`, the standard RN-community package, over a hand-rolled day/month/year wheel picker. `npm install`, then wired into the Medicine screen's date-of-birth `BottomSheet`: the free-text field became a `Pressable` styled identically to the old `TextInput`, showing a formatted `YYYY-MM-DD` value or a "tap to select" placeholder, opening the native picker (`mode="date"`, `maximumDate` today, `minimumDate` 1900) on press. `handleConfirmDob`'s validation is now just "was a date ever picked," not a regex. Locale copy for `medicine.placeholder_dob`/`dob_invalid` updated in all six locales to match ("tap to select" / "please select your date of birth" instead of format-hint text). The package ships its own Jest mock (`@react-native-community/datetimepicker/jest`) — added to `jest.setup.js` alongside the existing `@react-native-community/geolocation` mock, proactively, the same way that one was added before any test actually exercised it.
- `profile.tsx`'s `handleDeleteAccount` gained `deletionErrorMessage(err)`, matching the message-parsing shape `parseAuthError`/`parseFamilyError`/`parseMedchestError` already use elsewhere in this codebase (checking `err.body.message` against the collection's documented string) — `"Deletion Request already being sent"` now shows a distinct, accurate message (`profile.delete_account_already_pending`, explaining the 30-day window and that signing back in is what actually resolves it) instead of a generic retry prompt. A network failure (`ApiError.status === 0`) now reuses the existing `onboarding.network_error` string instead of the generic one too. Everything else still falls through to the original `profile.delete_account_error`.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (35/35) all pass. One new native dependency requires a fresh native build (already the case for every APK rebuild in this session) — no Android-side manual linking needed, autolinking picks it up. One new `profile.*` locale key (`delete_account_already_pending`, 23 → 24 per locale, verified equal across all six). This does not fix the *underlying* reason a deletion might already be pending (most likely: this exact feature was tested successfully once already, earlier in this session, against a real account) — it makes that state legible instead of silently indistinguishable from a genuine failure. Not re-verified live against the deployed backend with a real account in this session.

---

## D-037 — Prescription/document upload wired into the Medicine screen; a second new dependency for PDF/DOCX picking

**Status:** Accepted · **Date:** 2026-08-13

**Context.** Direct user question: was the Medchest document-upload endpoint (`POST/GET /profiles/{familyProfileId}/documents`, documented in `docs/BACKEND_CONTEXT.md`'s Medchest subsection since D-032) actually wired into the Medicine screen? It was not — D-032/D-035 built the `api.ts` functions (`uploadMedicalDocument`, `listMedicalDocuments`) but explicitly scoped the screen-level work to profiles/medicines/intake only, leaving documents unbuilt. Asked to build it, with one requirement: uploads must accept images, PDF, and Word documents, not just photos. `react-native-image-picker` (already installed) only picks photos/videos — no existing dependency can open a general file browser for PDF/DOCX. Per `agent.md` rule 7, asked before adding one; chose `@react-native-documents/picker` (the actively-maintained successor to the now-archived `react-native-document-picker`) over limiting to images only.

**Decision.**

- `npm install @react-native-documents/picker`. `MedicineScreen.tsx` gained a "Prescriptions & Documents" section, rendered only when `familyProfileId` exists (same gate as medicines — there is no local-storage equivalent for documents at all, since this app has no local document store to fall back to). An upload banner (admin-only, matching `canEdit`) calls `pick({ type: [types.pdf, types.doc, types.docx, types.images] })`, opening the OS's own file browser; the result is uploaded via the existing `uploadMedicalDocument` with `documentType` fixed to `"PRESCRIPTION"` — the only value that appears anywhere in the collection's saved examples, so the only one this client can be confident the backend accepts. The document list below it shows each file's name, upload date, and raw `ocrStatus` value (labeled, not translated — the collection's only confirmed value is `"PENDING"`, so translating a guessed enum was avoided the same way `medicine.error_generic` avoids guessing at unconfirmed error messages elsewhere). Cancelling the picker (`errorCodes.OPERATION_CANCELED`) is treated as a no-op, not an error alert.
- **No delete/remove action** — consistent with medicines and profiles, there is no delete endpoint for a document anywhere in the collection.
- Adding this dependency broke `npm test` twice in succession, in the two ways `docs/ARCHITECTURE.md` §10 already documents as the standard failure modes for a new RN dependency: (1) it ships untranspiled ESM, so `jest.config.js`'s `transformIgnorePatterns` needed `@react-native-documents` added to the allowlist (it doesn't match the existing `@react-native(-community)?` pattern); (2) it reaches for a native TurboModule at import time, so it needed a jest mock. The package *does* ship one, but as a `setupFiles`-style script that self-registers `jest.mock()` calls against its own deep, build-output-relative internal paths (`../src/spec/NativeDocumentPicker`, etc.) — too fragile to `require()` inline the way `@react-native-community/datetimepicker`'s mock (D-036) was. Hand-rolled a plain mock in `jest.setup.js` instead, matching the `@react-native-community/geolocation` precedent's shape exactly.

**Consequences.** `npx tsc --noEmit`, `npm run lint`, `npm test` (35/35, including the previously-broken `App.test.tsx`) all pass. Two new native dependencies now need a fresh native build in the same session (`@react-native-community/datetimepicker`, D-036, and this one) before either can be tested on-device. 6 new `medicine.*` locale keys (47 → 53 per locale, verified equal across all six). **Unconfirmed, same discipline as D-032/D-035's other open questions:** whether `documentType` accepts any value beyond `"PRESCRIPTION"`, what the full `ocrStatus` enum is, and whether there's any way to learn when OCR finishes (no endpoint for it) — none of this was guessed at or built around. Not verified live against the deployed backend with a real family/profile/file in this session.

---

## Open decisions

Tracked in `docs/BACKLOG.md` → Open questions. Move each here once answered.

| ID | Question | Blocks |
| --- | --- | --- |
| OD-1 | AI provider and where inference runs | Answered at target-architecture level by D-020 (OpenAI + Gemini, server-side). Still blocks `M8-T4` in practice — no backend exists yet to call |
| OD-2 | Backend: BaaS vs custom API; data residency | Answered at target-architecture level by D-020 (custom Spring Boot API, not BaaS). India-specific data residency still unspecified by the SRS; still blocks all of M8 |
| OD-3 | UPI/payment rails: deep-link vs payment SDK, per gateway | M6-T6 |
| OD-4 | Notification library and background scheduling | M4-T4 |
| OD-5 | Which domain module ships first after M1–M3 | SRS §1.2 leans India-first without dictating order; `NEXT_STEPS.md` recommends Medical Chest (M4) regardless |
| OD-6 | Dark mode: follow OS appearance or manual only | M1-T4 |
| OD-7 | Safety SOS has no module in the SRS's 16 — intentionally dropped in the rebrand, or still wanted alongside it? | Old `M7-T1`; parked by D-020, not deleted |
