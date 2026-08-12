# Next steps

The short, ordered version of "what to build next." For full task detail, acceptance criteria, and every other milestone, see `docs/BACKLOG.md` — this file exists so a session can get oriented in under a minute instead of reading that whole tracker.

---

## Where things stand

The product was renamed Saheli → Habita AI (`docs/DECISIONS.md` D-019, D-020); `Habita AI Software Requirements Specification.md` (repo root) is the full target vision — a 16-module product on an enterprise Spring Boot/PostgreSQL backend. **Most of that backend still doesn't exist in this repo's reach — but a real slice of it does.** What actually exists: a React Native client where onboarding (phone → OTP → profile) calls a real auth backend, and **Family & Managed Members now call the same backend for real** (`docs/DECISIONS.md` D-023, 2026-08-10 — create/invite-and-consent/roles/dependents against `/api/families/**`, superseding `M3`'s local model and closing `M2-T9`); **Medical Chest is built** (`M4-T1`/`T2`/`T3`/`T5` — CRUD, schedule, stock, daily intake log, real 7-day adherence feeding the dashboard, now permission-gated against the real Family backend instead of a local one) as the first of the SRS's 16 feature modules and the template for the rest; theming/localization/dashboard and Medicine's own data are otherwise local-first. Everything else — Pantry, Wardrobe, Cycle tracking, Wellness/CBT, Staff/Caregiver Hub, Resources, Events, Vehicles, Expense Groups, Payments, Document Hub, Voice Command — is still unbuilt, with no backend behind it either.

## What changed since this file was last written

The previous version of this file recommended finishing session lifecycle (`M2-T3`/`T5`) and Managed Members (`M2-T9`) before anything else, a recommendation the user redirected past twice now: first to build Family and Medicine UI locally (`M3`, `M4`), then to integrate a newly-supplied Family backend (D-023) rather than build Managed Members locally as this file had suggested — it landed for free as part of that integration instead. `M2-T3`/`M2-T5` are still open and still the biggest gap in what's built. Anyone picking up from here should treat session lifecycle as still-owed, not skipped for a reason.

## Recommended order from here

1. **Session lifecycle is still the biggest gap, now the *only* piece of auth left undone.** `M2-T3` (15-minute idle / 24-hour absolute expiry, wire the existing `refresh()` call) and `M2-T5` (re-auth banner + phone prefill on bounce-out) were deferred again this session, not resolved. Every module built since (Family, Medicine) reads `useAuth()` the same way everything before it did, so nothing about this got harder to fix — but it also didn't get easier, and it's worth closing before more screens accumulate the same assumption that a session never expires.
2. **The Family backend integration surfaced two real backend gaps worth flagging back to whoever owns it, not building around.** No `userId` per non-owner family member (so "which member is me" needs a name-match heuristic — `docs/ARCHITECTURE.md` §7) and no self-service leave-family endpoint for a plain `MEMBER`. Both are documented in `docs/BACKEND_CONTEXT.md`; neither blocks client work, but both make Family's edges fragile until fixed server-side.
3. **Continue M4, or move to M5 — either is reasonable now that the template exists.** Medical Chest proved the shape: scaffold → CRUD → derived dashboard stat → permission gate, each as its own file trio (`types.ts`, `*Store.ts`, `*Screen.tsx`). Two options, both fine:
   - Finish M4's remaining sub-modules — Wellness/CBT (`M4-T6`/`T7`, mood logging + static meditation content) and Cycle tracking (`M4-T8`/`T9`, period logging + local prediction) — since they're smaller and round out the milestone.
   - Start M5 (Household Ledger & Assets) — Document Hub, Staff/Caregiver Hub, Resources, Events, or Vehicles — any of which follows the same template and doesn't depend on M4's remaining pieces.
4. **Everything that needs the real backend still gets a local-first UI now, not a wait — Family is the proof this works.** OCR (document/pantry/resource capture), voice commands, AI style suggestions, real CBT coaching content all have a defined hook-point pattern in `docs/BACKLOG.md` (`M5-T5`, `M7-T4`, `M7-T5`, `M4-T7`): build the manual/local fallback now, following the precedent D-002/D-012/Family/Medicine already set, then re-plumb to the backend once it exists for that domain (`M8-T1`). Family went from local-first placeholder to real integration in one pass once the backend showed up — the same path is open for any other module. Don't block UI work on the backend or payments decisions.

## Literal next action

Pick `M2-T3` from `docs/BACKLOG.md` and run it through `prompts/backlog-task-kickoff.md` — or, if the user redirects again (as has now happened twice), whatever they ask for takes priority over this recommendation. This file describes a default, not a lock.

## Open questions that could reorder this

Tracked in `docs/BACKLOG.md` → Open questions, shouldn't be assumed either way:

- **OD-5** — is there an actual product priority for which module ships next, overriding the M4-vs-M5 choice above?
- **OD-7** — Safety SOS (the old backlog's `M7-T1`) has no module in the SRS at all. If it's still wanted, it needs to be re-added to the backlog explicitly rather than assumed dropped.
- **`M4-T4`** — notification reminders for scheduled doses need a library decision before they can be built at all.
