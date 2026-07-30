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

**Status:** Accepted, but **known-limited** · **Date:** 2026-07

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
