# Habita AI vs. A Wise Home — Feature Gap Analysis & Implementation Plan

**Written:** 2026-09-08 · **Last updated:** 2026-09-09 (§0, §1, §4, §5 — after the P0 build)
**Reference app:** A Wise Home (AWH) — https://www.awisehome.app/
**Compared against:** this repo at branch `Biswajitupgrade` (`b4282f3` plus the P0 change recorded in §4)
**Method:** AWH's public feature copy captured verbatim, then matched point-by-point
against *actual source* in `src/` (stores, API clients, screens, `RootStackParamList`,
`src/i18n/locales/en.json`) — not against `README.md` or `docs/BACKLOG.md`, both of which
lag the code.

> **Source note.** The Google Drive link
> (`drive.google.com/file/d/1XV8KiF1BqOLflPPr93DE5g-0yA5AMsjP/view`) returned **HTTP 401** on
> 2026-09-08 and was supplied directly on 2026-09-09 as `habitai-satus-report.pdf`. It is not
> an AWH document — it is Habita AI's own **Full Codebase Feature Audit & Business
> Assessment**. It has now been read and reconciled: see **§E**. Two things came out of it —
> it independently recommends the exact two features built in §C, and **it is materially out
> of date about the codebase**, in ways worth knowing before anyone quotes it.

---

## How to read this

**Sections A–E are the answers.** Sections 1–5 are the evidence behind them.

| Section | Answers |
| --- | --- |
| **A** | Which **APIs** need to be implemented |
| **B** | Which **new features** to add to the app |
| **C** | Which features were **integrated into your app** |
| **D** | **Extra features** worth taking from competitors other than AWH |
| **E** | Reconciling your own `habitai-satus-report.pdf` codebase audit |
| 0–5 | Full evidence: per-feature comparison, endpoint bodies, file references |

**Colour key, used throughout:** 🟢 done / live · 🟡 partial · 🔴 not started · ⚫ blocked

---

## 0. Executive summary

| | At first audit (2026-09-08) | Now (2026-09-09) |
| --- | --- | --- |
| AWH capabilities catalogued | 42 | 42 |
| Present at parity or better | 18 | **22** |
| Present but **partial** (module exists, capability missing) | 11 | **9** |
| **Completely absent** — no code, no route, no types | 13 | **11** |

Five capabilities moved in the P0 build (§4): gaps **1.5, 3.2, 3.3 and 3.7** closed
outright, and **3.4** went from absent to partial — its reminder half is built, its
expense-filing half still needs the backend. Every other row is unchanged. **§5 is the
point-by-point list of what is left to do.**

Habita AI is *ahead* of AWH on health (Medical Chest, Mind & Mood/CBT, Cycle & Life Stage),
on multi-currency expense splitting, on wardrobe/pantry, and on localisation (6 locales vs
AWH's English-only).

It remains *behind* AWH on four whole modules — **Tasks**, **Shared Calendar**, **Location &
Geofencing**, **Budget/Autobudget** — none of which exist here in any form. The depth gaps in
**Documents** and **Staff** were the two the P0 build closed; what is left in those two modules
is narrower: Documents still has no OCR auto-fill, no folder tree and no per-member access
control, and Staff still has no vendors, no UPI payout and no expense filing.

The two items called out in the request were both real gaps, and both were the highest
leverage available — in each case the surrounding infrastructure already existed and only the
last mile was missing. **Both are now built.** See §4 for exactly what changed:

- **Document expiry alerts as push notifications** (gap 1.5) — `ExpirationAlertsScreen`
  computed expiry *in-app only*; the FCM pipeline was fully built but had no `DOCUMENT_*`
  payload type. ✅ Closed.
- **Staff ongoing management/payroll** (gaps 3.2, 3.3, 3.4, 3.7) — `StaffScreen` computed
  payable as `rate + extras`, ignoring absences, half-days, overtime and hourly rates
  entirely. ✅ Closed, except the "file a paid salary into the expense ledger" half of 3.4,
  which needs the backend.

---

## Section A — APIs that need to be implemented

🟢 built & live · 🟡 exists, needs extending · 🔴 not built · ⚫ blocked on another decision

Full request/response bodies for every row are in **§3**. The client for A1 and A2 is already
written and calling these paths — they fail with a network error until the server answers.

### A1 · Document expiry reminders — client 🟢 · server 🔴

| | Method & path | Note |
| --- | --- | --- |
| 🔴 | `GET /vault/documents/expiring?withinDays={n}` | Server-computed list, so every device agrees |
| 🔴 | `GET /vault/reminder-settings` | Lead days + quiet hours |
| 🔴 | `PUT /vault/reminder-settings` | |
| 🔴 | `POST /vault/documents/{id}/snooze` | Client already stores `snoozedUntil` in this shape |
| 🔴 | *Daily scheduler job* (no client route) | Emits the FCM payloads in §3.1.2 |
| 🔴 | `GET/POST/PUT/DELETE /vault/documents` | The vault CRUD itself — client written, never deployed (`docs/VAULT_API_SPEC.md`) |

### A2 · Staff payroll — client 🟢 · server 🔴

| | Method & path | Note |
| --- | --- | --- |
| 🟡 | `POST /staff/{id}/attendance` | **Exists.** Add `hoursWorked` and `overtimeHours` to the body |
| 🔴 | `GET /staff/{id}/attendance?month=YYYY-MM` | Per-day, so a payslip can be audited |
| 🔴 | `GET /staff/{id}/payroll?month=YYYY-MM` | The payslip. **Must match `payroll.ts` exactly** |
| 🔴 | `GET /families/{fid}/payroll?month=YYYY-MM` | Whole household |
| 🔴 | `POST /staff/{id}/payments` | Records a salary payment; `fileAsExpense` posts it to the ledger |
| 🔴 | `GET /staff/{id}/payments` | Payment history |
| 🔴 | `GET /families/{fid}/staff/{id}` | Single read — only the list exists today |
| 🔴 | `PUT /families/{fid}/staff/{id}` | **Edit a staff member — missing entirely.** The app can only create |
| 🔴 | `DELETE /families/{fid}/staff/{id}` | Soft delete; past payslips must stay readable |
| 🔴 | `POST /staff/{id}/adjustments` | Bonus / advance / deduction |

### A3 · Tasks 🔴 · A4 · Calendar 🔴 · A5 · Budget 🔴

| | Group | Endpoints | Note |
| --- | --- | --- | --- |
| 🔴 | Tasks | `C1`–`C6` (§3.3) | Includes `GET /tasks/templates` — AWH's "70+ predefined tasks" |
| 🔴 | Calendar | `D1`–`D3` (§3.4) | **D1 is the important one**: aggregates dates the app already holds |
| 🔴 | Budget | `E1`–`E5` (§3.5) | `E4` is AWH's "budget in under 1 minute" generator |

### A6 · Everything else

| | Endpoint | Note |
| --- | --- | --- |
| ⚫ | `POST /ocr/receipt`, `POST /ocr/document` (F1, F2) | Blocked on the AI layer (M8) |
| 🔴 | `GET/POST/PUT/DELETE /families/{fid}/vendors` (F3) | |
| 🔴 | Location consent, ping, geofences (F4–F6) | Build consent (F4) before tracking (F5) |
| 🔴 | Account export / delete / plan (F7–F9) | DPDP parity with AWH |

**Count: 1 endpoint needs extending, 33 need building, 2 are blocked.**

---

## Section B — New features to add to the app

🔴 not started · ⚫ blocked · sized as **S** (days) / **M** (1–2 weeks) / **L** (a milestone)

### B1 · From the AWH gap — build in this order

| | # | Feature | Why it is next | Size |
| --- | --- | --- | --- | --- |
| 🔴 | 1 | **Finish A1 + A2 server-side** | Reminders and payslips work on-device; the server makes them shared and auditable. Client already written | S |
| 🔴 | 2 | **Tasks** — assign, complete, notify | The single largest absence. Family sharing already exists to hang it on | L |
| 🔴 | 3 | **Shared family calendar** | **Best value for the work.** The dates already exist across 8 modules — expiries, bills, salaries, doses, cycles, events, insurance, warranties. Mostly aggregation | L |
| 🔴 | 4 | **Autobudget + overspend alerts** | AWH's headline finance feature. `categoryBreakdown` already computes the input | L |
| 🔴 | 5 | **Vendors** alongside staff | Payroll, attendance and reminders all generalise. A vendor is a payee you do not employ | S |
| 🔴 | 6 | **File a paid salary as an expense** | Otherwise every salary is entered twice | S |
| 🔴 | 7 | **Document folders + per-member ACL** | ⚠️ `memberName` is free text, not a member reference — that migration comes first | M |
| 🔴 | 8 | **Broader document + bill types** | PAN, Aadhaar, voter ID, rent agreement, salary slip, FASTag; mobile, credit card, loan bills | S |
| 🔴 | 9 | **Location + geofencing** | Dependency already installed and imported nowhere. Consent first | M |
| 🔴 | 10 | **Export / delete account / plan quotas** | Table stakes for the DPDP positioning AWH markets on | M |
| ⚫ | 11 | **Receipt + document OCR** | The one place to *beat* AWH, not match it — see D3 | L |
| ⚫ | 12 | **UPI payouts for staff** | Blocked on OD-3 (deep link vs SDK), unanswered | M |
| ⚫ | 13 | **Voice as a real assistant** | No speech recognition, no NLU today. Either build it or rename it | L |

### B2 · From your own codebase audit — still valid, not yet done

| | Feature | Note | Size |
| --- | --- | --- | --- |
| 🔴 | **Consolidate the wardrobe modules** | The audit says two exist. **There are three**: `money/style_wardrobe`, `money/style_pantry`, `features/style_pantry`. Fix before extending any of them | S |
| 🔴 | **Fix the README contradiction** | "What works today" still contradicts "What does NOT work yet" three paragraphs later | S |
| 🔴 | **Stop calling non-AI features AI** | `generateAIOutfit` is tag-matching + `Math.random()`; Smart Pantry's scans are `setTimeout` + a lookup table. Rename, or wire them up, before any demo | S |
| 🔴 | **Fix the documented backend bugs** | D-016 (profile re-creation 500s), D-027 (photo-unrelated 400), D-021 (`relation:'self'` multi-device) — these block the modules that *are* wired to a backend | S |

---

## Section C — Features integrated into your app (2026-09-09)

🟢 all built, typechecked, linted and tested. Detail and file references in **§4**.
Decision log: **D-061**.

### C1 · Document expiry alerts as push notifications — closes gap 1.5

| | What was added |
| --- | --- |
| 🟢 | Alerts at **60 / 30 / 14 / 7 / 1 days** before expiry, plus one on the lapse day |
| 🟢 | Two push types `DOCUMENT_EXPIRING_SOON` / `DOCUMENT_EXPIRED`, own inbox section |
| 🟢 | **They actually fire with no backend** — notifee timestamp triggers, rescheduled on every Doc Hub load |
| 🟢 | On/off toggle + count of pending reminders on the alerts screen |
| 🟢 | Per-document snooze until a date |
| 🟢 | Alerts survive a swipe-away — shown in-app with mark-as-read |
| 🟢 | Tapping the notification opens the alerts screen, cold start included |
| 🟢 | All copy in **six locales**, with separate wording for "today" / "tomorrow" |

### C2 · Staff payroll — closes gaps 3.2, 3.3, 3.7 and half of 3.4

| | What was added |
| --- | --- |
| 🟢 | **Itemised payslip**: gross, deductions, overtime, extras, net, paid, outstanding, status |
| 🟢 | Half-day pay deducted per half day |
| 🟢 | **Overtime as a quantity on the attendance entry**, not a fifth status — so it works on a half day |
| 🟢 | Hourly members paid `rate × hours`, deducted nothing for absence |
| 🟢 | **Paid-leave allowance** (2 days/month) consumed before leave turns unpaid; absence never covered |
| 🟢 | `STAFF_SALARY_DUE` before month end, `STAFF_SALARY_OVERDUE` after — carrying the **outstanding** amount |
| 🟢 | Salary payments with method (UPI / cash / bank), date, reference, per month |
| 🟢 | Client for the whole §3.2 backend contract, ready for when it exists |
| 🟢 | All copy in six locales |

### C3 · Fixed along the way

| | What |
| --- | --- |
| 🟢 | **Real routing defect**: a document alert carrying `OPEN_DOSAGE_SCREEN` opened the *Medicine* screen. The parser now checks the action belongs to the type. Caught by a new test |
| 🟢 | **Two test suites that could not run at all** — `react-native-pdf` blew up at import. Now mocked; `App.test.tsx` passes again |
| 🟡 | That unmasked a **real pre-existing** style violation in `DocViewerScreen.tsx`. It looks deliberate (a black media viewer), so it was **left alone** and tracked as `M5-T13` — this is the one failing test in the suite |

**Verification:** `tsc` clean · ESLint clean on every touched file · **332 tests passing**,
including 26 new payroll cases and 52 new alert cases.

---

## Section D — Extra features worth adding, from apps other than AWH

Your audit named these competitors. This is what is worth taking from each — none of it is
in the app today.

| | From | What they do well | What to add here | Size |
| --- | --- | --- | --- | --- |
| 🟡 | **Medisafe** | Medication adherence + "Medfriend" caregiver alerts | Dose reminders already ship (`DOSAGE_REMINDER`). **Missing: a caregiver-visible adherence view** — Family sharing already exists to build it on | S |
| ⚫ | **Splitwise** | Best-in-class bill-splitting UX | Expense Groups already beat it on multi-currency and debt simplification. Gap is *receipt capture* — see below | — |
| ⚫ | **Acloset / Whering** | Real AI auto-tagging and outfit generation | Replace `generateAIOutfit`'s `Math.random()` with a real model call, or rename it | L |
| ⚫ | **Origin, SuperMoney, Richify** | AI finance copilots — the "AI CFO" pattern | The orchestration layer the SRS describes and nothing implements. Needs M8 first | L |
| 🔴 | **Cozi, FamilyWall, Quicken LifeHub** | Shared calendar + lists + task splitting | Confirms B1-2 and B1-3 (Tasks, Calendar) are the right next two — this is the whole category's table stakes | L |
| 🔴 | **Snabbit, Broomees, Didi** | On-demand staff *booking* | They do not do **ongoing management/payroll** — which you now do (§C2). Widen the moat with vendors (B1-5) and UPI payout (B1-12) | M |

### D3 · The one feature that would genuinely differentiate

🔴 **One receipt photo → both the pantry and the expense ledger.**

Splitwise has no pantry link. Pantry apps have no expense link. AWH has neither. You already
have both modules built and both stores real — the only missing piece is the OCR call (A6 F1).
This is the highest-value item in this whole document, and it is blocked only on M8.

---

## Section E — Reconciling your codebase audit (`habitai-satus-report.pdf`)

Read 2026-09-09. Two conclusions.

### E1 · It independently validates the work in §C 🟢

Its "New features to add value" list recommends, unprompted:

- **#3 Domestic staff attendance + payroll** — *"the single highest-differentiation module
  against AWH… a real India-market gap worth prioritizing"* → 🟢 **built** (§C2)
- **#5 Document expiry alerts as push notifications** — *"not just an in-app Expiration Alerts
  screen… the notification/reminder layer is where retention gets won"* → 🟢 **built** (§C1)
- **#2 Medication adherence notifications** → 🟡 dose reminders ship; caregiver view still open (§D)

Two independent analyses picked the same two items. That is the strongest signal in this
document that the priority was right.

### E2 · ⚠️ It is materially out of date about the codebase — do not quote it as current

Verified against `src/` on 2026-09-09:

| | Audit claim | Reality now |
| --- | --- | --- |
| ❌ | "16 SRS-planned modules not yet started", incl. Mental Health/CBT, Hormonal/Life-Stage, Caregiver & Home Services, Resource/Utility, Shared Events, Property/Vehicle Vault | **All six exist**: `wellness/` (5 files), `cycle/`, `staff/`, `resources/`, `events/`, `assets/` |
| ❌ | "There is currently no working AI/LLM integration anywhere in the stack" | `wellness/api.ts` makes **15 real calls** to a live backend including `/wellness/cbt/chat`, `/cbt/recommendation`, `/cbt/uplift` |
| ❌ | "Document Hub — real, local-only" | Real backend client with multipart upload and presigned URLs (`document_hub/api.ts`); backend spec'd but not deployed |
| ❌ | "no local notification reminders for medicine" | Full FCM pipeline live — dosage, low stock, bill due, and now document + salary alerts |
| ⚠️ | "Two overlapping wardrobe modules" | **Three**: `money/style_wardrobe`, `money/style_pantry`, `features/style_pantry` |
| ✅ | Voice Assistant is mostly dummy | Still true (B1-13) |
| ✅ | README contradicts itself | Still true (B2) |
| ✅ | Fake "AI" in `generateAIOutfit` and Smart Pantry scans | Still true (B2) |

**The business assessment in §3 of that report still holds** — crowded category, AWH is a real
near-clone, differentiation must come from AI depth and cross-module connections rather than
breadth. But its *implementation status* section describes a repo several milestones behind
this one, and its headline "pre-seed/prototype, two backend-verified modules" understates
what is now wired to a backend (auth, profile, family, medicine, wellness, staff, resources).

---

## 1. Point-by-point comparison

Legend — ✅ at parity or better · 🟡 partial · ❌ absent

### 1.1 Documents

| # | AWH capability (verbatim) | Habita AI today | Status |
| --- | --- | --- | --- |
| 1.1 | Stores PAN, Aadhaar, insurance, school records, voter ID, driving licence, passport, college IDs, utility bills, rent agreements, salary slips, FASTag receipts | 7 categories only: `passport, visa, license, insurance, warranty, property, tax` (`document_hub/types.ts`) — no PAN, Aadhaar, voter ID, school/college records, rent agreement, salary slip, FASTag | 🟡 |
| 1.2 | "AI Document manager" OCR that "reads Indian documents the way you do" | None. No OCR anywhere in the vault path | ❌ |
| 1.3 | "Automatic file naming and folder identification for storage" | Manual title entry only (`AddDocScreen`, `DocTemplateFormScreen`) | ❌ |
| 1.4 | "Predefined two-level folder structure with 100+ folders" | Flat list keyed by `category`; no folder entity | ❌ |
| 1.5 | "Auto creates reminders for due dates/expiry dates in the document" | ~~`getDocStatus()` computed expiry in-app only — no reminder, no notification, no schedule~~ → **CLOSED 2026-09-09.** Reminders fire at 60/30/14/7/1 days and on the lapse day, with an on/off toggle and per-document snooze (§4.1) | ✅ **← request item #5** |
| 1.6 | "Granular access controls for family members, yet easily shareable" | `memberName` is a free-text string, not a member reference. No ACL | ❌ |
| 1.7 | Searchable by name or date | Search exists in `DocHubScreen` | ✅ |
| 1.8 | File storage + viewer | Real multipart upload + presigned `fileUrl` + PDF/image viewer (`api.ts`, `DocViewerScreen`) — better than AWH's public claim | ✅ |

### 1.2 Money — budget, expenses, bills

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 2.1 | **Autobudget** — "family budget creation and savings target in under 1 minute", proprietary budgeting algorithm | No budget entity at all. `events/` has a per-event budget (`FamilyEventBudget`) — a different thing | ❌ |
| 2.2 | Expense capture, auto-categorised, family-wide | Full group expense CRUD, 7 categories, backend-verified (`money/expenses/api.ts`) | ✅ |
| 2.3 | "Expense details autofilled from bills, messages or screenshots" | `receiptUri` is stored but never parsed. No OCR, no SMS reader | ❌ |
| 2.4 | "Monthly cashflow — expenses, investments, savings in one view" | `SpendSummaryResponse` gives rolling-30-day spend only. No investments, no savings | 🟡 |
| 2.5 | Need-want-desire breakdown, family inflation | `categoryBreakdown` only | ❌ |
| 2.6 | "Proactive overspend alerts by category" | No budget to breach, so no alert | ❌ |
| 2.7 | Bill payments — electricity, mobile, internet, credit cards, loans, FASTag | `resources/` covers electricity, gas, internet, water, waste. Missing mobile, credit cards, loans, FASTag | 🟡 |
| 2.8 | Bill reminders | `UTILITY_DUE_SOON` / `UTILITY_DUE_TODAY` push, live | ✅ |
| 2.9 | Splitting / settle-up | Multi-currency splits, debt simplification, UPI/cash/bank settlement — AWH has no equivalent | ✅ better |

### 1.3 Staff & Vendors

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 3.1 | Roster of maids, cooks, drivers, nannies, milkmen, carwashers | `/staff/services/list` catalogue + `createStaff` | ✅ |
| 3.2 | "Attendance, including half-days and overtime, hourly rates" | ~~Overtime was neither a status nor a quantity; hourly `rateType` was stored but never used in any calculation~~ → **CLOSED 2026-09-09.** Overtime and hours-worked are captured on the attendance entry, and both rate types drive the payslip (§4.2) | ✅ |
| 3.3 | "Monthly payment calculation with unpaid leaves factored" | ~~`rate + extras` — a flat figure; absences, leave and half-days changed nothing~~ → **CLOSED 2026-09-09.** `features/staff/payroll.ts` computes an itemised payslip with a paid-leave allowance consumed before leave turns unpaid (§4.2) | ✅ **← request item** |
| 3.4 | "Automated reminders and expense filing for staff and vendor payments" | **Reminders CLOSED 2026-09-09** — `STAFF_SALARY_DUE` before month end and `STAFF_SALARY_OVERDUE` after, carrying the *outstanding* amount (§4.2). **Expense filing still open** — needs the backend's `fileAsExpense` (§3.2 B5), and vendors do not exist at all (gap 3.6) | 🟡 |
| 3.5 | "UPI payouts built in" | UPI exists only as a settlement *method label* in expenses. No payout for staff | ❌ |
| 3.6 | **Vendors** (as distinct from staff) | No vendor entity. `vendor` appears only as a label in `HouseholdOperationsScreen` | ❌ |
| 3.7 | Payment history per staff member | ~~`CaregiverTransaction` recorded ad-hoc extras only~~ → **CLOSED 2026-09-09.** `SalaryPayment` records amount, method (UPI/cash/bank), date and reference per payroll month, driving paid/outstanding and the payslip status (§4.2) | ✅ |

### 1.4 Tasks

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 4.1 | "70+ predefined tasks to choose from" | **No task module exists.** `grep -r "Task" src` returns nothing | ❌ |
| 4.2 | Assign tasks to family members, notify on completion | none | ❌ |
| 4.3 | Create tasks by speaking to an AI chat assistant | `voice_assistant/` is UI chrome with a hardcoded command history | ❌ |
| 4.4 | Automated reminders + follow-up task suggestions | none | ❌ |

### 1.5 Calendar

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 5.1 | Shared family calendar (birthdays, holidays, staff leave, service visits, trips) | **No calendar module.** `Calendar` in the codebase is only the lucide *icon* | ❌ |
| 5.2 | Due dates / deadlines / reminders auto-populated onto it | none | ❌ |
| 5.3 | Import calendars from other accounts | none | ❌ |

### 1.6 Location

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 6.1 | Consent-based live location tracking | `@react-native-community/geolocation@3.4.0` **is installed but never imported anywhere** | ❌ |
| 6.2 | Geofencing notifications, arrival/departure alerts | none | ❌ |
| 6.3 | Battery-level visibility | none | ❌ |
| 6.4 | One-tap consent revoke | none | ❌ |

### 1.7 AI

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 7.1 | "Wayfinder AI chat" — operate the app without tapping | `VoiceScreen` has no speech recognition and no NLU | ❌ |
| 7.2 | Proactive next-step suggestions | none | ❌ |
| 7.3 | CBT/mental-health AI assistant | Live `/api/wellness/cbt/**` backend, 14 verified routes — AWH has nothing comparable | ✅ better |

### 1.8 Platform, security, family

| # | AWH capability | Habita AI today | Status |
| --- | --- | --- | --- |
| 8.1 | Free tier: 8 members, 10 GB | No plan/quota concept | ❌ |
| 8.2 | AES-256 at rest, TLS 1.3 in transit | Backend concern; not asserted anywhere in this repo | 🟡 |
| 8.3 | Indian data residency, DPDP Act 2023 | Not documented | 🟡 |
| 8.4 | Export or delete anything (PDF/CSV) | No export path | ❌ |
| 8.5 | Account deletion within 30 days | No delete-account flow | ❌ |
| 8.6 | Granular family access, revoke with one tap | Role-based family membership, invite + consent, dependents — richer than AWH's public description, but no per-module permission matrix | ✅ / 🟡 |
| 8.7 | English only | 6 locales (en, hi, bn, ta, es, ar), live switching | ✅ better |
| 8.8 | Push notifications | FCM + notifee, foreground/background/cold-start, dedupe inbox — Android live, iOS on no-op transport | ✅ |

### 1.9 Habita AI capabilities AWH does not have

Worth stating, because these are the differentiators to defend: Medical Chest with dosage
scheduling, stock and 7-day adherence · prescription upload with server-side OCR fields ·
Mind & Mood with CBT chat and exercise library · Cycle & Life-Stage tracking across 5 life
stages · Smart Pantry with expiry radar and zero-waste recipes · Style Pantry / wardrobe and
outfit planning · multi-currency expense splitting with debt simplification · Vehicles and
household asset warranty tracking · Event budgets · 6-language support.

---

## 2. Prioritised gap list — status

The whole backlog on one screen. **§4** records what was built; **§5** is the point-by-point
detail of everything still open, in this order.

| # | Item | Gaps | API | Status |
| --- | --- | --- | --- | --- |
| **P0** | **Document expiry alerts as push notifications** | 1.5 | §3.1 | ✅ **Done** 2026-09-09 (client-side; server job still §5 item 1) |
| **P0** | **Staff payroll — attendance-driven pay, overtime, hourly rates, salary reminders, payment history** | 3.2, 3.3, 3.4, 3.7 | §3.2 | ✅ **Done** 2026-09-09 (client-side; endpoints still §5 item 1) |
| P1-1 | Finish both P0 features server-side | 1.5, 3.3 | §3.1, §3.2 | ⬜ Not started — `M5-T14` |
| P1-2 | Tasks module with assignment and completion notifications | 4.1, 4.2, 4.4 | §3.3 | ⬜ Not started |
| P1-3 | Shared family calendar aggregating every date the app already holds | 5.1, 5.2 | §3.4 | ⬜ Not started |
| P1-4 | Autobudget and category overspend alerts | 2.1, 2.6 | §3.5 | ⬜ Not started |
| P1-5 | Vendors as a first-class entity alongside staff | 3.6 | §3.6 F3 | ⬜ Not started — `M5-T15` |
| P1-6 | File a paid salary into the expense ledger | 3.4 (half) | §3.2 B5 | ⬜ Not started |
| P2-7 | Receipt and document OCR feeding expenses and pantry | 1.2, 1.3, 2.3 | §3.6 F1, F2 | ⬜ Blocked on M8 |
| P2-8 | Document folder tree and per-member ACL | 1.4, 1.6 | — | ⬜ Not started |
| P2-9 | Broader document categories and bill types | 1.1, 2.7 | — | ⬜ Not started |
| P2-10 | Location and geofencing | 6.1–6.4 | §3.6 F4–F6 | ⬜ Not started |
| P2-11 | Data export, account deletion, plan quotas | 8.1, 8.4, 8.5 | §3.6 F7–F9 | ⬜ Not started |
| P2-12 | UPI payouts for staff | 3.5 | — | ⬜ Blocked on OD-3 |
| P2-13 | Voice as a real assistant | 4.3, 7.1, 7.2 | — | ⬜ Blocked on M8 |

---

## 3. APIs that need to be created

Conventions taken from the existing surface: base `${API_BASE_URL}` = `.../api`, bearer
auth on everything, family-scoped resources under `/families/{familyId}/…`, paged responses
as `{content, totalElements, totalPages, page, size}`, errors as `{code, message}` parsed by
each module's `parse*Error`.

### 3.1 Document expiry reminders — P0

| # | Method & path | Purpose |
| --- | --- | --- |
| A1 | `GET /vault/documents/expiring?withinDays={n}` | Server-computed expiring/expired list, so the reminder set is identical on every device |
| A2 | `GET /vault/reminder-settings` | Read the household's lead-time and quiet-hours config |
| A3 | `PUT /vault/reminder-settings` | Update it |
| A4 | `POST /vault/documents/{id}/snooze` | Suppress one document's alerts until a date |
| A5 | *(scheduler, no client route)* | Daily server job emitting the FCM payloads in §3.1.2 |

**A1 response**

```json
{ "content": [ { "id": "...", "title": "Indian Passport (Animesh)", "category": "passport",
    "memberName": "Animesh Manna", "expiryDate": "2026-10-14", "daysLeft": 36,
    "status": "EXPIRING", "snoozedUntil": null } ],
  "totalElements": 3, "totalPages": 1, "page": 0, "size": 20 }
```

`status` is one of `VALID | EXPIRING | EXPIRED`.

**A2 / A3 body**

```json
{ "enabled": true, "leadDays": [60, 30, 14, 7, 1], "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00", "timeZone": "Asia/Kolkata" }
```

`leadDays` must be a descending list of positive integers; the server fires one alert per
document per lead-day threshold crossed, never more than one per document per day.

**A4 body** `{ "snoozedUntil": "2026-10-01" }` returning `204`.

#### 3.1.2 New FCM payload types (the client half is built — see §4.1)

```
type             = DOCUMENT_EXPIRING_SOON | DOCUMENT_EXPIRED
click_action     = OPEN_DOCUMENT_ALERTS_SCREEN
documentId       = <uuid>
documentTitle    = "Indian Passport (Animesh)"
documentCategory = passport | visa | license | insurance | warranty | property | tax
expiryDate       = 2026-10-14        (YYYY-MM-DD, calendar day, never a timestamp)
daysLeft         = "36"              (FCM sends every value as a string)
```

`daysLeft` is omitted for `DOCUMENT_EXPIRED`. The client tolerates its absence.

**Error codes:** `DOCUMENT_NOT_FOUND`, `NO_FAMILY`, `NOT_FAMILY_MEMBER`, `INVALID_LEAD_DAYS`,
`INVALID_SNOOZE_DATE`.

### 3.2 Staff payroll — P0

| # | Method & path | Purpose |
| --- | --- | --- |
| B1 | `GET /staff/{staffId}/attendance?month=YYYY-MM` | Per-day attendance for one member, so payroll is auditable rather than a total |
| B2 | `POST /staff/{staffId}/attendance` *(exists)* | Extend body with `hoursWorked` and `overtimeHours` |
| B3 | `GET /families/{familyId}/payroll?month=YYYY-MM` | Server-computed payslip for every staff member |
| B4 | `GET /staff/{staffId}/payroll?month=YYYY-MM` | One payslip, itemised |
| B5 | `POST /staff/{staffId}/payments` | Record a salary payment (and optionally file it as an expense) |
| B6 | `GET /staff/{staffId}/payments?page=&size=` | Payment history |
| B7 | `GET /families/{familyId}/staff/{staffId}` | Single staff read — currently only the list exists |
| B8 | `PUT /families/{familyId}/staff/{staffId}` | Edit a staff member — **currently missing entirely**, the client can only create |
| B9 | `DELETE /families/{familyId}/staff/{staffId}` | Deactivate |
| B10 | `POST /staff/{staffId}/adjustments` | Bonus / advance / deduction, replacing the local-only `CaregiverTransaction` |
| B11 | `GET/POST/PUT/DELETE /families/{familyId}/vendors` | Vendor entity (P1) |

**B2 extended body**

```json
{ "date": "2026-09-08", "status": "PRESENT", "hoursWorked": 8.0,
  "overtimeHours": 2.0, "note": "stayed late for the party" }
```

**B4 response — the payslip contract**

```json
{ "staffId": "...", "name": "Kamala Devi", "month": "2026-09",
  "rateType": "MONTHLY", "baseRate": 12000, "currency": "INR",
  "payableDays": 30, "presentDays": 24, "halfDays": 2, "leaveDays": 2,
  "paidLeaveAllowance": 2, "unpaidLeaveDays": 2, "absentDays": 2,
  "overtimeHours": 6, "overtimeRate": 100,
  "grossPay": 12000, "deductions": 800, "overtimePay": 600,
  "adjustments": [ { "id": "...", "kind": "BONUS", "amount": 500, "reason": "Puja bonus" } ],
  "netPayable": 12300, "paidAmount": 0, "outstanding": 12300,
  "dueDate": "2026-09-30", "status": "UNPAID" }
```

`status` is one of `UNPAID | PARTIALLY_PAID | PAID`; `kind` is one of
`BONUS | ADVANCE | DEDUCTION | OTHER`.

**Payroll rules the server must implement** — mirrored client-side by
`features/staff/payroll.ts` so the app is correct offline and the two agree:

- Monthly: `perDay = baseRate / payableDays`; `deductions = perDay × (unpaidLeaveDays +
  absentDays) + perDay × 0.5 × halfDays`.
- Paid-leave allowance is consumed before any leave becomes unpaid.
- Hourly: `grossPay = hourlyRate × hoursWorked`; absences deduct nothing, because unworked
  hours were never earned.
- Overtime is always additive: `overtimePay = overtimeRate × overtimeHours`, defaulting
  `overtimeRate` to `perDay / 8` (monthly) or the hourly rate itself (hourly).
- Unmarked days are **not** assumed present — they are excluded from `presentDays` and
  reported separately so the household can see the roster is incomplete.

**B5 body**

```json
{ "month": "2026-09", "amount": 12300, "method": "UPI",
  "paidOn": "2026-09-30", "reference": "UPI/429183...", "fileAsExpense": true,
  "expenseGroupId": "..." }
```

`fileAsExpense: true` makes the backend post a matching row into the family expense ledger —
this is AWH's "expense filing for staff and vendor payments".

#### 3.2.1 New FCM payload types for staff

```
type         = STAFF_SALARY_DUE | STAFF_SALARY_OVERDUE | STAFF_ATTENDANCE_UNMARKED
click_action = OPEN_STAFF_SCREEN
staffId, staffName, month (YYYY-MM), amount, dueDate
```

**Error codes:** `STAFF_NOT_FOUND`, `NO_FAMILY`, `NOT_FAMILY_MEMBER`, `INVALID_MONTH`,
`INVALID_ATTENDANCE_STATUS`, `DUPLICATE_ATTENDANCE`, `PAYMENT_EXCEEDS_OUTSTANDING`.

### 3.3 Tasks — P1

| # | Method & path |
| --- | --- |
| C1 | `GET /families/{familyId}/tasks?status=&assigneeId=&page=&size=` |
| C2 | `POST /families/{familyId}/tasks` |
| C3 | `PUT /tasks/{taskId}` |
| C4 | `PATCH /tasks/{taskId}/status` — body `{"status":"DONE"}` |
| C5 | `DELETE /tasks/{taskId}` |
| C6 | `GET /tasks/templates` — the "70+ predefined tasks" catalogue |

Task body: `{title, description, assigneeMemberId, dueDate, dueTime, priority, recurrence,
category, templateId}`, where `recurrence` is one of `NONE | DAILY | WEEKLY | MONTHLY |
YEARLY`. New push types: `TASK_ASSIGNED`, `TASK_DUE_SOON`, `TASK_COMPLETED`, `TASK_OVERDUE`.

### 3.4 Calendar — P1

| # | Method & path |
| --- | --- |
| D1 | `GET /families/{familyId}/calendar?from=&to=` — aggregated feed |
| D2 | `POST /families/{familyId}/calendar/events` (plus `PUT` / `DELETE`) for manual entries |
| D3 | `POST /families/{familyId}/calendar/import` — ICS / Google import |

D1 must merge, server-side, the dates the product already holds: document expiries, utility
bill due dates, staff salary due dates and leave, medicine schedules, cycle predictions,
event budgets, vehicle insurance and asset warranty expiries, task due dates. Each row:
`{id, source, sourceId, title, date, time, allDay, category, memberId, deepLink}` where
`source` is one of `MANUAL | DOCUMENT | UTILITY | STAFF | MEDICINE | CYCLE | EVENT | ASSET |
TASK`.

### 3.5 Budget — P1

| # | Method & path |
| --- | --- |
| E1 | `GET /families/{familyId}/budgets?month=YYYY-MM` |
| E2 | `POST /families/{familyId}/budgets` — `{month, totalIncome, savingsTarget, categoryLimits:{}}` |
| E3 | `PUT /budgets/{budgetId}` |
| E4 | `POST /families/{familyId}/budgets/auto` — the "under 1 minute" generator: takes income + savings target, returns proposed `categoryLimits` derived from the family's own trailing spend |
| E5 | `GET /families/{familyId}/budgets/{budgetId}/progress` — spent vs limit per category |

New push types: `BUDGET_CATEGORY_EXCEEDED`, `BUDGET_MONTH_SUMMARY`.

### 3.6 Vendors, OCR, location, account — P1 / P2

| # | Method & path | Notes |
| --- | --- | --- |
| F1 | `POST /ocr/receipt` (multipart) | Returns `{merchant, date, total, currency, lineItems[], suggestedCategory}` — feeds both Expenses and Smart Pantry |
| F2 | `POST /ocr/document` (multipart) | Returns `{documentType, number, issueDate, expiryDate, holderName, suggestedTitle, suggestedFolder}` — AWH's "AI Document manager" |
| F3 | `GET/POST/PUT/DELETE /families/{familyId}/vendors` | Vendor roster |
| F4 | `POST /families/{familyId}/location/consent`, `DELETE .../consent/{memberId}` | Consent-first, revocable |
| F5 | `POST /location/ping`, `GET /families/{familyId}/location/latest` | Live location + battery level |
| F6 | `GET/POST/DELETE /families/{familyId}/geofences` | Arrival / departure alerts |
| F7 | `POST /account/export` then `GET /account/export/{jobId}` | PDF/CSV export (DPDP parity) |
| F8 | `DELETE /account` | 30-day deletion with email confirmation |
| F9 | `GET /families/{familyId}/plan` | Member cap + storage quota |

---

## 4. What was built — record of the P0 change (2026-09-09)

Written after the fact, not as a plan. Every claim points at the code that implements it, per
`agent.md` rule 9. Decision log entry: **D-061**.

### 4.1 Document expiry reminders — closes gap 1.5

| # | What AWH does | What was added | Where |
| --- | --- | --- | --- |
| a | Reminders before a document's expiry | Alerts at **60 / 30 / 14 / 7 / 1 days** before expiry, plus one on the lapse day itself | `document_hub/reminders.ts` `buildDocumentAlerts` |
| b | — | Two push types `DOCUMENT_EXPIRING_SOON` / `DOCUMENT_EXPIRED`, click action `OPEN_DOCUMENT_ALERTS_SCREEN`, `documents` inbox section | `notifications/types.ts`, `parse.ts` |
| c | — | Alerts actually fire with no backend: notifee timestamp triggers, group-replaced on every sync so repeat calls converge instead of stacking duplicates | `notifications/localScheduler.ts` |
| d | — | On/off toggle plus a count of pending reminders | `ExpirationAlertsScreen.tsx` |
| e | — | Per-document snooze until a date, mirroring the API's `snoozedUntil` | `reminders.ts` `snoozeDocument` |
| f | — | Received alerts survive a swipe-away, shown in-screen with mark-as-read | `AlertsCard` on Doc Hub + alerts screen |
| g | — | Tapping a notification opens the alerts screen, cold start included | `parse.ts` `routeFor`, `_layout.tsx` |
| h | — | All copy in **six locales** (en, hi, bn, ta, es, ar), with distinct wording for "today" and "tomorrow" instead of "in 0 days" | `src/i18n/locales/*.json` |

Settings persist under `habita.doc_reminders`. Reminders re-sync on every Document Hub load and
pull-to-refresh, so renewing a passport stops the nagging with no separate invalidation path to
forget.

### 4.2 Staff payroll — closes gaps 3.2, 3.3, 3.7 and half of 3.4

| # | What AWH does | What was added | Where |
| --- | --- | --- | --- |
| a | "Monthly payment calculation with unpaid leaves factored" | Itemised payslip: gross, deductions, overtime, adjustments, net, paid, outstanding, status | `staff/payroll.ts` `buildPayslip` |
| b | "including half-days" | Half a day's pay deducted per half day | same |
| c | "and overtime" | Overtime as a **quantity on the attendance entry**, not a fifth status — so it can be logged on a half day too | `staff/types.ts`, `StaffScreen` overtime sheet |
| d | "hourly rates" | Hourly members paid `rate x hours worked`, and deducted nothing for absence — unworked hours were never earned, so deducting would charge them twice | `payroll.ts` |
| e | "unpaid leaves factored" | A paid-leave allowance (2 days/month, configurable) consumed before leave turns unpaid; an absence is never covered by it | `payroll.ts`, `PayrollSettings` |
| f | "Automated reminders ... for staff payments" | `STAFF_SALARY_DUE` before month end, `STAFF_SALARY_OVERDUE` after — carrying the **outstanding** amount, never the base salary | `staff/reminders.ts` |
| g | Payment history (gap 3.7) | `SalaryPayment` with amount, method (UPI / cash / bank), date, reference, per payroll month | `staff/types.ts`, `staffStore.ts` |
| h | — | Client for the whole §3.2 backend contract (B1, B3-B10), ready for when it exists | `staff/api.ts` |
| i | — | All copy in six locales | `src/i18n/locales/*.json` |

**Judgement calls worth knowing about**, because they decide what a person is paid:

- **Unmarked days are neither present nor absent.** A monthly member is paid in full — nothing
  is *known* to have been missed — and the payslip says `N days not marked yet`. Deducting would
  accuse someone of not turning up because the household forgot to tap.
- **`netPayable` is floored at zero.** A large advance can mathematically exceed gross, but a
  payslip must never read "you owe your cook -800".
- **Money is rounded at each boundary.** 12000/31 is a repeating decimal; an unrounded chain
  owes 11,612.903225806451.
- **A re-marked day counts once.** The attendance store appends rather than replaces, so a day
  changed from present to absent leaves both rows behind; only the latest is counted.

### 4.3 A defect this surfaced, and fixed

`readClickAction` validated that a `click_action` was *known* but not that it belonged to the
message's `type`. Harmless with two sections; with four it meant a `DOCUMENT_EXPIRING_SOON`
carrying `OPEN_DOSAGE_SCREEN` parsed cleanly and opened the **Medicine screen from a
notification about a passport**. `parse.ts` now checks the pairing against an `ALLOWED_ACTIONS`
map. Caught by a test written for the new payloads, not by review.

### 4.4 Verification

- `npx tsc --noEmit` — clean.
- ESLint — no errors in any file touched by this change.
- `npx jest` — **332 passing**, including 26 new payroll cases and 52 new alert cases
  (`__tests__/payroll.test.ts`, `__tests__/expiryAndSalaryAlerts.test.ts`).
- The round trip `parsePushPayload(toPushData(p)) === p` is pinned for **every** payload type.
  That assertion is what keeps §5 item 1 a one-line migration rather than a rewrite.

### 4.5 Two things changed that are not part of this feature

1. `jest.setup.js` now mocks `react-native-pdf` and `react-native-blob-util`. `DocViewerScreen`
   imports the former, which builds a `NativeEventEmitter` over a null native module at import
   time — so `App.test.tsx` and `themedScreens.test.tsx` had both been failing to *run at all*.
2. With those mocks in place, `themedScreens.test.tsx` reaches its assertions and reports a
   **real, pre-existing** violation of `agent.md` rule 3: `DocViewerScreen.tsx` builds a
   module-scope `StyleSheet.create` with hardcoded `#000000` / `#FFFFFF`. It looks deliberate —
   a fullscreen black media viewer — so restyling it is a product call and it was **left
   alone**, tracked as `M5-T13`. This is the one failing test in the suite, and it predates
   this change.

---

## 5. What remains to do — point by point

Ordered by value. Each item names the gap it closes (§1), the API it needs (§3), and its size.
Nothing in this section is started.

### P1 — the modules AWH has and Habita AI does not

**1. Finish the two P0 features server-side.** *Gaps 1.5, 3.3 · APIs §3.1 A1-A5, §3.2 B1-B10 ·
Backend work, small client work.*
Reminders and payslips are computed on-device today. Build the daily expiry job and the payroll
endpoints, and the client swaps over by deleting its `sync*` call sites — payload shapes and the
payslip contract already match. The payroll rules in §3.2 must be implemented **identically**,
or the number moves under the user. Tracked as `M5-T14`.

**2. Tasks.** *Gaps 4.1, 4.2, 4.4 · API §3.3 C1-C6 · New module, about one milestone.*
The single largest absence. Needs a task entity with assignee, due date, priority and
recurrence; the "70+ predefined tasks" catalogue; assignment to family members; four new push
types (`TASK_ASSIGNED`, `TASK_DUE_SOON`, `TASK_COMPLETED`, `TASK_OVERDUE`); a screen and route
pair; six locales. Family sharing already exists to hang it on.

**3. Shared family calendar.** *Gaps 5.1, 5.2 · API §3.4 D1-D3 · New module, about one milestone.*
Highest leverage per unit of work, because **the dates already exist** — document expiries, bill
due dates, salary due dates, medicine schedules, cycle predictions, event budgets, vehicle
insurance, warranty expiries. D1 aggregates them server-side into one feed; the client renders a
month view and a manual-entry sheet. Do this *after* Tasks so task due dates land on it too.

**4. Autobudget and overspend alerts.** *Gaps 2.1, 2.6 · API §3.5 E1-E5 · New module, about one
milestone.*
AWH's "budget in under 1 minute". E4 generates category limits from the family's own trailing
spend, which Habita AI already computes as `categoryBreakdown`. Adds `BUDGET_CATEGORY_EXCEEDED`
— the alert that makes setting a budget worth doing.

**5. Vendors.** *Gap 3.6 · API §3.6 F3 · Small — extends the staff module.*
AWH bills the module as "Staff **and Vendors**". The payroll engine, attendance and reminder
machinery all generalise; a vendor is a payee you do not employ. Tracked as `M5-T15`.

**6. File a paid salary into the expense ledger.** *Remaining half of gap 3.4 · API §3.2 B5
`fileAsExpense` · Small, backend-side.*
Without it the household enters every salary twice — once as a payment, once as an expense.

### P2 — differentiating, heavier

**7. Receipt and document OCR.** *Gaps 1.2, 1.3, 2.3 · API §3.6 F1, F2 · Blocked on the AI layer
(M8).*
The one place to beat AWH rather than match it: F1 feeds **both** Expenses and Smart Pantry from
a single photo — Splitwise has no pantry link, pantry apps have no expense link. F2 is AWH's "AI
Document manager". `M5-T5` already defines the OCR hook-point to implement against.

**8. Document folders and per-member access control.** *Gaps 1.4, 1.6 · Medium.*
AWH's "100+ folder" tree and granular sharing. Note that `memberName` on a document is currently
a **free-text string, not a member reference** — that has to change first, and it is a data
migration, not a field rename.

**9. Broaden document categories and bill types.** *Gaps 1.1, 2.7 · Small.*
Add PAN, Aadhaar, voter ID, school and college records, rent agreement, salary slip, FASTag; add
mobile, credit cards, loans and FASTag to utilities. Mostly type-and-locale work.

**10. Location and geofencing.** *Gaps 6.1-6.4 · API §3.6 F4-F6 · Medium, privacy-sensitive.*
`@react-native-community/geolocation` **is already a dependency and imported nowhere**. Consent
must come first and be revocable in one tap — build F4 before F5.

**11. Data export, account deletion, plan quotas.** *Gaps 8.1, 8.4, 8.5 · API §3.6 F7-F9 ·
Medium.*
Table stakes for the DPDP positioning AWH markets on. Also settles the free-tier shape — AWH
publishes 8 members and 10 GB.

**12. UPI payouts for staff.** *Gap 3.5 · Blocked on OD-3, still unanswered.*
AWH claims "UPI payouts built in". Habita AI records UPI as a *method label* only. Needs the
deep-link-versus-SDK decision in `docs/DECISIONS.md` before any code.

**13. Voice as a real assistant.** *Gaps 4.3, 7.1, 7.2 · Blocked on M8.*
AWH's "Wayfinder AI chat". `VoiceScreen` has no speech recognition and no NLU. Either wire a real
speech-to-text library to a command parser, or rename it so the label matches what it does.

### Deliberately not on this list

**Matching AWH breadth for its own sake.** Habita AI already has capabilities AWH does not
(§1.9) — Medical Chest with adherence tracking, CBT coaching on a live backend, cycle and
life-stage tracking, multi-currency splitting with debt simplification, pantry, wardrobe, six
locales against AWH's English-only. The win is depth where data connects across modules — items
3 and 7 above — not another static screen.
