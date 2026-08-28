# Habita AI

**Habita AI** ("Home & Life Operating System") is an AI-powered life assistant for households — one app for finance, health, home, staff, style, and payments. The product was renamed from **Saheli** to **Habita AI**; see `Habita AI Software Requirements Specification.md` (repo root) for the full target vision and `docs/DECISIONS.md` D-019/D-020 for what the rename touched and why.

This repository is the React Native 0.86 client. It is mostly still a **static, front-end-only prototype** — theming, localization, dashboard are all device-local — but **onboarding calls a real backend for auth and profile creation** (`M2-T1`, 2026-08-05; see `docs/DECISIONS.md` D-012 for why), and **Family & Managed Members now calls the same backend** (`docs/DECISIONS.md` D-023, 2026-08-10). Everything else still lives in `AsyncStorage` on the device, and none of the SRS's other AI/backend features exist in this repo yet — see `NEXT_STEPS.md` for what to build next.

| | |
| --- | --- |
| Stack | React Native 0.86 (CLI, not Expo) · React 19.2 · TypeScript 5.8 |
| Navigation | React Navigation v7 (native stack) |
| Persistence | `@react-native-async-storage/async-storage` |
| Localization | `i18n-js` — 6 languages |
| Icons | `lucide-react-native` (`react-native-svg`) — replaced the emoji-glyph icons `M1-T13` |
| OTP input | `react-native-otp-entry` — replaced a hand-rolled 6-`TextInput` array `M2-T7` |
| Backend | `Saheli Backend — Auth, Profile & Family.postman_collection.json` (repo root) — see "Getting started" below, the app needs it reachable to get past onboarding and to use Family. It's an external service's own exported artifact, not this repo's branding (`docs/DECISIONS.md` D-019); it was itself renamed on disk 2026-08-10 when the Family folder was added (D-024) |
| Branch | `initial-static` |
| Last verified | 2026-08-11 (`npx tsc --noEmit` passes; `npm test` — 3 suites, 34 tests) |

---

## Documentation map

| Document | Purpose |
| --- | --- |
| `README.md` (this file) | Product story, what actually works today, how to run |
| `Habita AI Software Requirements Specification.md` | Target vision — the full enterprise backend and 16-module product this repo is building toward. Not the current state; cross-referenced, not duplicated |
| `NEXT_STEPS.md` | Short, ordered "what to build next" — start here after reading this file |
| `AI_CONTEXT.md` | Single-source context brief for AI agents starting a session |
| `docs/ARCHITECTURE.md` | Layers, navigation, theming, i18n, storage contracts, known gaps |
| `docs/BACKEND_CONTEXT.md` | Continuing the Spring Boot backend (separate project) — confirmed-live contract, known backend bugs, target API surface |
| `docs/EXPENSES_API_SPEC.md` | Multi-Currency Expense Groups backend specification, REST contracts, Flyway DDL migration, greedy debt minimization algorithm, and client integration guide |
| `docs/BACKLOG.md` | Milestone-based backlog tracker — the source of truth for what to build next, in full detail |
| `docs/DECISIONS.md` | Decision log (why things are the way they are) |
| `agent.md` | How the AI agent works in this repo: workflow, guardrails, doc-sync duties |
| `prompts/` | Reusable prompts — session start, task kickoff, session-close doc sync |

---

## What works today (verified against source)

### Onboarding flow — now backed by a real server (`M2-T1`, 2026-08-05)
- **Language picker** (`src/app/onboarding/language.tsx`) — 6 languages (English, Hindi, Bengali, Tamil, Spanish, Arabic); selection persists to `habita.lang` and switches the UI live.
- **Phone entry** (`src/app/onboarding/phone.tsx`) — country code pre-filled from the chosen language (`+91` for en/hi/bn/ta, `+34` for es, `+966` for ar); submitting calls the backend's `login`, falling back to `register` for a first-time number, before saving the number and moving on.
- **OTP screen** (`src/app/onboarding/otp.tsx`) — 6-digit input (`react-native-otp-entry`, `M2-T7`) with auto-advance and paste support; Verify calls the backend's `verify-otp` and shows a real inline error on a wrong code (auto-clearing the input so it's easy to retry) instead of always advancing. A returning user lands on the Dashboard after verifying; a first-time user goes to Profile setup — distinguished by whether `login` or `register` fired on the Phone screen.
- **Profile setup / edit** (`src/app/onboarding/profile.tsx`) — one screen in two modes (`isEditing`): name, phone, email, location (pre-filled from device GPS and reverse-geocoded to a real city/state name via OpenStreetMap Nominatim, `M2-T8` — still editable), emoji avatar or real photo via camera/gallery (`react-native-image-picker`). First-time setup posts to the backend's create endpoint; editing loads from and saves to the backend's details endpoint (local storage is the offline fallback while that loads), with a separate call for photo changes. Edit mode additionally shows the role picker (Household CEO / Individual — asked only here, not during first-time setup, since it has no backend field), the language grid, Sign Out (now actually clears the session), and Delete Account.
- **Session** persists to `habita.session`; a valid session on cold start skips onboarding straight to the dashboard (`src/app/_layout.tsx`'s auth guard). No idle/absolute expiry yet — see `docs/ARCHITECTURE.md` §6.

### Home dashboard
`src/app/dashboard.tsx` — an ultra-modern glassmorphic home experience matching futuristic mobile design standards (`D-044`):
- **Sticky Glassmorphic Header:** Brand title with live status indicator dot, dynamic scroll-driven compact pill ("2 Pending · 4 Due"), quick AI Voice trigger, and glowing profile avatar.
- **Search & AI Capsule:** Quick search bar and voice assistant copilot shortcut ("Ask Habita AI anything or search...").
- **Hero Data Insights Card:** Frosted translucent glass container with interactive SVG sine wave chart (`StatWaveChart`), tab selector (`Adherence`, `Spend`, `Activity`), weekly metric curves, and bottom stat cards.
- **Quick Action Grid:** Squircle glass tiles (`QuickActionTile`) with glowing icon backgrounds for common tasks (Scan Bill, UPI Pay, Medicine, Mood, Cycle, Expenses, Smart Life, Fuel, Wardrobe).
- **Quick Resources Delivery Tap:** Interactive quick-tap counters for immediate logging (+ Milk, + Water, + Gas).
- **Core Modules Explorer:** Glassmorphic module list with status indicators and chevron navigators.
- **Floating Modern Bottom Navigation Dock (`ModernBottomNav`):** Floating dock with 5 core actions (Home, Life OS, floating elevated Center AI Assistant button with glowing gradient, Health, and Vault).
- **Responsive Architecture:** Auto-centers (`maxWidth: 640`) on tablets and wide screens with dynamic column calculation via `useResponsive()`.

### Household Operations overview

`src/features/household/HouseholdOperationsScreen.tsx` (`M5-T0`) — a fully localized, static design overview for Caregiver & Home Services, Resource & Utility Logistics, Shared Family Events & Budgeting, and Property Asset Vault & Vehicle Upkeep. It intentionally stores no data and makes no network calls; the individual M5 module tasks own the later local functionality and any OCR/calendar integration.

### Family & sharing — now backed by a real server (`docs/DECISIONS.md` D-023, 2026-08-10)
`src/features/family/FamilyScreen.tsx` — fully localized (all 6 locales), calling the real `/api/families/**` contract (`src/features/family/api.ts`), not local storage. Create a family, invite an already-registered user by phone (they accept/decline from their own account), manage roles (`OWNER`/`ADMIN`/`MEMBER` — no per-module permission matrix, since the backend doesn't have one), add/remove Managed Members (dependents with no login of their own — children, elderly parents), see invites addressed to you across every family you're not yet in, and (for an admin) view a full invite history — every invite ever sent for the family, any status, not just the still-pending ones (`docs/DECISIONS.md` D-024). A plain `MEMBER` gets a read-only view; only `ADMIN`/`OWNER` can invite, change roles, remove members, or manage dependents. This superseded `M3`'s local-only model outright (`familyStore.ts` and `habita.family_members` are gone, not deprecated) and closed the previously-open Managed Members backlog item (`M2-T9`). See `docs/ARCHITECTURE.md` §7 for the full contract, including two real backend limitations worth knowing before you extend this screen: there's no reliable way to identify "which member is me" beyond the family owner, and a plain member has no self-service way to leave a family.

### Medicine Chest
`src/features/medicine/MedicineScreen.tsx` (`M4-T1`–`M4-T3`, `M4-T5`) — the first SRS-mapped domain module, built as the template for the rest. Add/edit medicines (name, dosage, a multi-select morning/afternoon/evening/night schedule, stock count) via a bottom sheet; mark a scheduled dose "taken" for the day, which decrements stock and logs to `habita.medicine_intake_log`. A pure `calculateAdherence()` function drives both the screen's own stat and the dashboard's "7-day adherence" card. Its own data is still local-only; the permission gate now reads the real Family backend — a plain `MEMBER` gets read-only access, `ADMIN`/`OWNER` get full access, and having no family at all still means full access. Local notification reminders (`M4-T4`) are still undecided — needs a library choice.

### Mind & Mood — mental health and CBT coaching (`M4-T6`, `M4-T7`, 2026-08-20)
`src/features/wellness/WellnessScreen.tsx` — real-time mood check-ins: tap one of five faces and the log sheet opens with that level pre-selected, then optionally attach what's behind it (work, family, sleep, health, money, yourself) and a note. The screen derives a 7-day average, a check-in streak that survives midnight without shaming you, a per-day trend bar, and the factors you've mentioned most — all pure functions in `wellnessStore.ts`. The **CBT assistant** picks one of four techniques (reframe, grounding, breathing, gratitude) from your last check-in and walks three concrete steps, with an empathetic opening that reads a neutral day after a rough week differently from one after a good week; it regulates before it reframes when the mood is at its lowest, and every reply carries a disclaimer pointing at real help. It is deterministic, offline, and returns **i18n keys rather than text**, so all six locales are covered by construction — real AI coaching swaps in behind the same `CbtCoach` interface at `M8-T4`. Four **guided meditations** (box breathing, body scan, evening wind-down, three-minute reset) open as step-by-step sheets, no audio or connection needed.

### Cycle & Life Stage — hormonal health tracking (`M4-T8`, `M4-T9`, 2026-08-20)
`src/features/cycle/CycleScreen.tsx` — log a period (first day, optional last day, flow, symptoms, note) and get a prediction: next start, estimated ovulation, fertile window, current phase and day-of-cycle, with an honest `low`/`medium`/`high` confidence based on how many completed cycles it had to work from. `predictNextCycle()` is pure and unit-tested; it returns nothing rather than inventing a forecast when there's no history, and it drops implausible gaps (a mis-typed date) instead of letting them drag the average. **Life stage is not a label** — `cycling`, `fertility`, `postpartum`, `perimenopause` and `menopause` each change what is predicted (menopause switches prediction off entirely), what is shown, how confident the estimate is allowed to be, and which nutrition and movement guidance appears. Reminders are computed and listed in-app; actual phone notifications still wait on `M4-T4`'s library decision.

**Both screens are device-private**: mood and cycle data are deliberately *not* shared with or gated by the Family module, unlike the Medicine Chest — see `docs/DECISIONS.md` D-030, which is explicit that this is a product call worth revisiting rather than a technical limit. Both are also the first screens built responsively, via `useResponsive()` (`docs/ARCHITECTURE.md` §8).
### Expense Groups & Money (`src/features/money/`)
A complete 4-screen expense sharing, multi-currency conversion, and debt settlement system designed in accordance with CRED-grade high-contrast minimalism and Habita AI design tokens, fully wired against the 15-endpoint Spring Boot REST backend (`Saheli Backend — Auth, Profile & Family.postman_collection.json` folder `Expense Groups & Multi-Currency Splitting`, D-052) with Bearer token authentication and resilient `AsyncStorage` offline caching. Full Spring Boot DDL & API specification lives in `docs/EXPENSES_API_SPEC.md`. Tapping **"Money"** or **"Add expense"** on the Dashboard routes directly to:
1. **Expense Groups (`ExpenseGroupsScreen.tsx`)**: Group list, live net balance summary cards ("You owe" vs "You get back"), group creation modal with emoji icon selection and member management.
2. **Group Details (`GroupDetailsScreen.tsx`)**: Segmented tabs for **Expenses** (itemized logs), **Balances** (simplified pairwise debt matrix: who owes whom), and **Summary** (category spend breakdown analytics), backed by live `/api/expense-groups/{id}/sync`.
3. **Add / Split Expense (`AddSplitExpenseScreen.tsx`)**: Form with multi-currency support (INR ₹, USD $, EUR €, AED, GBP) with live exchange rate conversion, category tags, paid-by selector, and 3 interactive split modes:
   - **Equal**: Automatic equal division among members.
   - **Percentage (%)**: Custom percentage input per member with real-time validation (must sum to 100%).
   - **Shares**: Weighted multiplier shares (e.g. 1 share, 2 shares).
4. **Expense Details / Settle Up (`ExpenseDetailsSettleUpScreen.tsx`)**: Detailed itemized share view for existing expenses, and a full **Settle Up** mode (select Payer/Payee, payment method: UPI 💳, Cash 💵, Bank 🏦, and record settlement to automatically recalculate balances), backed by a persistent settlement history log.

### Ambient Voice AI Engine & Voice Settings (`src/features/voice/`)
A high-fidelity natural language voice command interface and configuration suite designed for multi-domain orchestration (money, health, inventory, reminders):
1. **Voice Command Screen (`VoiceScreen.tsx`)**:
   - **Interactive Listening Banner**: Deep teal hero banner with animated concentric glowing rings and real-time audio wave graphic overlays.
   - **Quick Suggestion Chips**: Tap-to-speak voice prompt presets:
     - `"Add ₹150 for dinner in Goa Trip"`
     - `"What's the balance in Home Rent & Bills?"`
     - `"Remind me to pay electricity bill"`
   - **Recent Spoken Commands Log**: Detailed card history displaying query intent, timestamp, module tag, and execution status (`✔`).
   - **What You Can Ask Grid**: Quick action cards covering **Groups & Balances**, **Add Expense**, **Spending Summary**, **Bills & Reminders**, **Inventory & Stock**, and **Contacts**.
   - **Bottom Voice Input Bar**: Floating microphone button (`#054E63`) flanked by animated audio wave bars.
2. **Voice Settings Screen (`VoiceSettingsScreen.tsx`)**:
   - Tapped via the top-right settings gear icon (`⚙`) on `VoiceScreen.tsx`.
   - **Language Selection**: Switch speech recognition locale between English 🇬🇧, Hindi 🇮🇳, Bengali 🇮🇳, Tamil 🇮🇳, Spanish 🇪🇸, and Arabic 🇸🇦.
   - **Recognition Engine Mode**: Choose between Dual-LLM Cloud AI Engine and On-Device Offline Recognition.
   - **Audio & Controls**: Toggle chimes/sound feedback, auto-submitting after 2s silence, and ambient noise cancellation.
   - **Hands-Free & Privacy**: Enable `"Hey Habita"` wake word detection, command history logging, or wipe all stored voice logs with `clearVoiceHistory()`.

### Document Hub (`src/features/dochub/`)
A complete 5-page digital vault, document management, and expiration alerting system:
1. **Document Hub (`DocHubScreen.tsx`)**: Main repository list, category filter chips (Passports 📘, Visas 🛂, Licenses 🪪, Insurance 🏥, Warranties 🏷️, Property 🏠, Tax 🧾), real-time search bar, and warning banner.
2. **Document Details (`DocDetailsScreen.tsx`)**: Full document detail view with owner attribution, masked document number with toggle reveal (`👁️`), validity status pill, and encrypted file attachment view.
3. **Add Document (`AddDocScreen.tsx`)**: Template choice hub to pick pre-built document templates or perform custom file uploads.
4. **Document Template / Form (`DocTemplateFormScreen.tsx`)**: Tailored form fields for **Passport**, **Visa**, **Driver's License**, and **Health Insurance** with attachment picker (`@react-native-documents/picker`).
5. **Expiration & Alerts (`ExpirationAlertsScreen.tsx`)**: Warning center categorizing **Expired** (red alert) and **Expiring Soon** (within 60 days, orange alert) documents with 1-tap expiry date renewal modals.

### Design system
- Three palettes in `src/theme.ts`: Terracotta (default), Ocean Breeze, Midnight (dark).
- Shared tokens: `colors`, `spacing`, `radius`, `fonts`, `shadow`.
- Reusable components: `Button`, `Card`, `SectionHeader`, and a draggable `BottomSheet` with optional backdrop blur.
- **Palette picker** in Profile → Appearance (edit mode): tap a swatch card and the whole app restyles instantly — no restart, no remount, and the choice survives relaunch (`habita.theme.palette`).
- **Icons** are `lucide-react-native` stroke icons tinted with palette tokens, not emoji glyphs (`M1-T13`, 2026-08-05) — `dashboard.tsx`'s tiles and quick actions plus the Wellness and Cycle screens are migrated; Family and Medicine still use emoji or plain glyphs.
- **Responsive layout** via `useResponsive()` (`M4-T6`/`M4-T8`): scales, column counts and a content max-width derived from the live window size, so a 320dp phone and a tablet both get a sensible layout. Only the two newest screens use it — earlier screens are still fixed-width.

---

## What does **not** work yet

These are intentionally listed so nobody plans around them. Each is tracked in `docs/BACKLOG.md`.

- **No session expiry.** A persisted token is trusted forever — no idle timeout, no absolute expiry, and `refresh()` exists but nothing calls it yet.
- **No re-auth banner.** (Resend-OTP countdown and a "Change number" link now exist, `M2-T2`.)
- **No mid-session auth guard.** The guard in `_layout.tsx` only runs once, at cold start.
- **No backend or API layer outside auth/profile/family.** Everything else is still device-local `AsyncStorage` — see `docs/DECISIONS.md` D-012/D-023 for why those two are the exceptions.
- **Most of auth still hasn't been run against a live backend.** Profile creation has, and is confirmed working end-to-end including the photo upload (`docs/DECISIONS.md` D-015, after two wrong turns — D-013, D-014 — that real backend logs each disproved). `register`/`login`/`verify-otp`/`refresh` and the profile-edit path still only match `Saheli Backend — Auth, Profile & Family.postman_collection.json`'s saved examples, not a live server — see `docs/ARCHITECTURE.md` §6. Separately, a **backend-side bug** (D-016, not fixable in this repo): re-creating a profile for a user that already has one 500s instead of updating or returning a clean conflict — test with a fresh phone number.
- **Family is entirely unverified against a live server too.** Wired against the Postman collection's saved examples only (`docs/DECISIONS.md` D-023) — nobody has run it against a running backend yet, unlike the auth/profile paths D-013–D-018 confirmed live.
- **No reliable "which family member is me."** The backend doesn't return a `userId` for a non-owner member, so the client falls back to a best-effort name match — wrong if two members share a display name. See `docs/ARCHITECTURE.md` §7.
- **No self-service "leave family" for a plain member.** Only a resolved `ADMIN` can leave via the current API; a plain `MEMBER` has no in-app way to do it, since the backend's Remove Member endpoint requires admin access on the caller.
- **No multi-family switcher.** The backend supports belonging to several families; the client only ever shows the first one.
- **Family, Medical Chest, Mind & Mood and Cycle are the SRS modules built so far** — all of Module Group 2 except its notification piece. Pantry, Wardrobe, Staff/Caregiver Hub, Resources, Events, Vehicles, Expense Groups, Payments, Document Hub, and Voice Command engine are all still unbuilt. `docs/BACKLOG.md` M4–M7 tracks these; `NEXT_STEPS.md` gives the recommended build order.
- **No local notification reminders at all** — not for medicine doses, and not for cycle reminders either. `M4-T4` needs a library decision first (`OD-4`). The cycle screen computes exactly what *would* be scheduled and lists it in-app, so that task is "schedule these", not "work out what to schedule".
- **The CBT assistant is not AI.** It is a deterministic local coach behind the interface a real model will implement at `M8-T4` — helpful and genuinely multi-language, but it does not read your note or generate a reply.
- **Neither screen has been run on a device or emulator yet.** Wellness and Cycle pass the type checker, lint, 38 new unit tests and a full i18n key-coverage check, but nobody has watched them render. The non-English health copy also warrants a native-speaker review before release.
- **The SRS's enterprise backend (Spring Boot/PostgreSQL, multi-LLM engine) does not exist in this repo.** Auth/Profile/Family are the only domains it actually serves so far; it's the target architecture the client will eventually integrate against in full (`docs/ARCHITECTURE.md`'s "Target platform vision"), gated behind `docs/BACKLOG.md` M8.
- **No real SMS delivery for invites.** A pending invite is real server-side state now, requiring the invitee's own account to accept — but there's still no actual SMS notifying them; they only see it if they open the app.
- **Custom fonts are not bundled.** `theme.fonts` names Fraunces/DM Sans, but no font files are linked, so text renders in the platform default.
- **Midnight does not follow the OS.** Dark mode is whatever you picked; the system appearance setting is ignored (open question 6 in `docs/BACKLOG.md`).

---

## Getting started

Requires Node ≥ 22.11, and the standard React Native CLI environment (Android Studio / Xcode).

```sh
npm install                 # install JS dependencies
cd ios && pod install && cd ..   # iOS only, first run and after native dep changes

npm start                   # Metro bundler
npm run android             # build & run on Android
npm run ios                 # build & run on iOS
```

`react-native-svg` (pulled in by `lucide-react-native`, `M1-T13`) and `@react-native-community/geolocation` (`M2-T1`, profile location prefill) both have native code — if either was added after your last build, `pod install` and a fresh `npm run android`/`npm run ios` are required; a Metro reload alone will not pick it up.

**Onboarding, and now Family, need the backend reachable** (`M2-T1`, `docs/DECISIONS.md` D-023). `src/config.ts`'s `API_BASE_URL` defaults to `http://10.0.2.2:8080/api` (Android-emulator-only — that address resolves to the emulator host machine). Run the backend (`Saheli Backend — Auth, Profile & Family.postman_collection.json`'s target — not part of this repo) yourself, then point `API_BASE_URL` at wherever it's actually reachable from your device: an iOS simulator can use `http://localhost:8080/api` directly, a physical device needs your machine's LAN IP, and a real deployed server needs its actual URL.

**If you have the app installed from before this rebrand:** the storage-key prefix changed from `saheli.` to `habita.` (`docs/DECISIONS.md` D-019) — on first launch after updating, language/theme/session/profile/family data resets once (old keys stop being read, same fallback-safe behavior as `docs/DECISIONS.md` D-007), then persists normally under the new keys.

Checks:

```sh
npx tsc --noEmit            # type check — must pass before any commit
npm run lint                # eslint
npm test                    # jest — 3 suites, 34 tests (app smoke test + theming)
```

---

## Source layout

```
App.tsx                     # root, wraps AppLayout in GestureHandlerRootView
index.js                    # AppRegistry entry
src/
  app/
    _layout.tsx             # NavigationContainer + native stack, RootStackParamList, auth guard
    dashboard.tsx            # home dashboard
    onboarding/
      language.tsx  phone.tsx  otp.tsx  profile.tsx   # phone/otp/profile call the real backend
  components/               # Button, Card, SectionHeader, BottomSheet
  config.ts                 # API_BASE_URL — the one place the backend URL lives (M2-T1)
  features/
    auth/
      auth.ts                # register/login/verifyOtp/refresh — real backend calls (M2-T1)
      api.ts                 # fetch wrapper, ApiError, parseAuthError (M2-T1)
    family/                 # FamilyScreen.tsx, types.ts, api.ts — real backend calls (D-023), no storage
    medicine/                # MedicineScreen.tsx, types.ts, medicineStore.ts (M4-T1)
  hooks/
    useTheme.ts             # used by _layout
    useThemedStyles.ts      # style factory hook — how screens read the palette
    useAuth.ts              # session hook: signedIn/pending/login/verify/logout/getAccessToken/getUserId
  i18n/
    index.ts                # i18n-js setup, language listeners, LTR enforcement
    locales/{en,hi,bn,ta,es,ar}.json
  theme.ts                  # the only theme source: palettes + tokens
  utils/storage.ts          # AsyncStorage JSON helpers
__tests__/                  # App smoke test, theme mechanism, themed screens
```

The `theme/`, `styles/`, `shared/` and `family/index.ts` paths this file used to list were deleted in `M1-T1` (2026-07-30). `useAuth.ts`/`features/auth/*` were unwired stubs through `M1`; `M2-T1` (2026-08-05) made them real — see `docs/ARCHITECTURE.md` §6.

**Native project identifiers are unchanged by the rebrand** — Android's package `com.sahelicli` and the iOS Xcode project `ios/SaheliCLI.xcodeproj`/scheme still use the old name (`docs/DECISIONS.md` D-019). This is deliberate, not a miss: renaming them is a structural native change that needs Xcode/Android Studio to verify, tracked as a follow-up backlog row rather than risked blind.

---

## Working in this repo

1. Read `NEXT_STEPS.md` for the short version of what to build next.
2. Start a session with `prompts/session-start-context-load.md`.
3. Pick the next task from `docs/BACKLOG.md` and kick it off with `prompts/backlog-task-kickoff.md`.
4. Close the session with `prompts/session-close-doc-sync.md` so the docs match the code.

Rules that apply to every change:

- Keep `npx tsc --noEmit` green.
- Add every new user-facing string to all six locale files.
- Use tokens from `src/theme.ts` — no hardcoded hex values in screens.
- Keep navigation LTR (back arrow top-left) in all languages, including Arabic.
- Update `docs/BACKLOG.md` status and the relevant docs in the same change as the code.
