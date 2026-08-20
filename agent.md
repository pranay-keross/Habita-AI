# Habita AI — Agent Working Agreement

How AI agents work in this repository. Product context is in `AI_CONTEXT.md`; this file is about *process*.

**Last updated:** 2026-08-20 — Wellness/CBT and Cycle tracking built in one pass (D-030), closing all of M4 except `M4-T4`; note that this deliberately broke rule 10 below, at the user's explicit request

---

## 1. The session ritual

Every session has three phases, each backed by a prompt in `prompts/`:

| Phase | Prompt | Purpose |
| --- | --- | --- |
| Start | `prompts/session-start-context-load.md` | Load context, verify docs against code, report the next ready tasks |
| Work | `prompts/backlog-task-kickoff.md` (once per task) | Execute one tracked task to its acceptance criteria |
| Close | `prompts/session-close-doc-sync.md` | Make the docs true again before committing |

Skipping the close phase is what caused the documentation drift recorded in `docs/DECISIONS.md` D-006. Do not skip it.

Specialised prompts: `new-feature-module.md` (M4–M7), `i18n-localization-pass.md`, `tech-debt-cleanup.md` (M1), `doc-only-change.md`.

For the short version of what to build next — instead of the full milestone tracker — read `NEXT_STEPS.md` before picking a task.

---

## 2. What the agent is responsible for

- **Keeping the project legible across sessions.** No session should need the user to re-explain Habita AI. If `AI_CONTEXT.md` was not enough to start, fix `AI_CONTEXT.md`.
- **Executing tracked tasks, not adjacent ones.** Work comes from `docs/BACKLOG.md`. Discovered work becomes new backlog rows, not scope creep.
- **Reporting honestly.** If a check fails, show the output. If a criterion is unmet, say so. If something is unverified, call it unverified.
- **Keeping docs and code in the same commit.** A feature that ships without its doc update is unfinished.

---

## 3. Document ownership

Each document has one job. Do not duplicate content between them — cross-reference.

| Document | Owns | Never contains |
| --- | --- | --- |
| `README.md` | Product story, verified current state, setup | Aspirational features in the feature list |
| `Habita AI Software Requirements Specification.md` | Target vision — the full product/backend this repo is building toward | Claims about current state — the client doesn't implement most of it yet |
| `NEXT_STEPS.md` | Short, ordered "what to build next" | Full task detail — that's `docs/BACKLOG.md`'s job |
| `AI_CONTEXT.md` | Cold-start brief, active patterns, traps | Long-form architecture detail |
| `docs/ARCHITECTURE.md` | Structure, contracts, known gaps | Task planning |
| `docs/BACKEND_CONTEXT.md` | Confirmed backend contract, known backend bugs, target API surface — for continuing the separate Spring Boot backend | Client application code or status |
| `docs/BACKLOG.md` | Milestones, tasks, status, open questions | Prose status updates |
| `docs/DECISIONS.md` | Append-only decision log | Rewritten history — supersede instead |
| `agent.md` | This working agreement | Product or architecture content |
| `prompts/` | Repeatable session rituals | One-off instructions |

---

## 4. Hard rules

These apply to every change. An agent should stop and ask rather than break one.

1. **`npx tsc --noEmit` must pass** before a task is called done. Run `npm run lint` and `npm test` too, and report the real output.
2. **Six locales or none.** Any new user-facing string is added to all of `en, hi, bn, ta, es, ar`, namespaced by screen. A partly localized screen is a defect.
3. **Design tokens only.** Style blocks are factories called through `useThemedStyles`; screens import `ThemeTokens` as a type, never the token values, and never inline hex. See `docs/ARCHITECTURE.md` §3.
4. **LTR everywhere.** Layout direction stays left-to-right in all languages including Arabic; the back arrow is a top-left `Pressable` on every screen. See `docs/DECISIONS.md` D-003.
5. **Storage discipline.** `habita.` prefix (changed from `saheli.` in the rebrand, D-019), access via `src/utils/storage.ts`, key documented in `docs/ARCHITECTURE.md` §5.
6. **Routes are registered in pairs** — `RootStackParamList` and `_layout.tsx`, same change.
7. **No new dependency without asking**, including what already-installed package was ruled out and why.
8. **No backend or network calls, except auth/profile/family** (`docs/DECISIONS.md` D-002, narrowed by D-012, widened by D-023, D-029). `src/features/auth/api.ts` (`apiFetch`/`postMultipart`) and `src/features/auth/auth.ts` own the auth domain's calls; `src/features/family/api.ts` owns family's. Profile calls (`GET`/`PUT /profile/details`, `POST /profile/create`, `PUT /profile/profilePhoto`) are made directly via `apiFetch`/`postMultipart` from whichever screen needs them — `onboarding/profile.tsx` and, since D-029, `dashboard.tsx`'s focus handler (to keep the header photo and active language in sync with the signed-in account) — rather than through a dedicated profile module. Everything else (medicine's own CRUD, documents, money, …) is still device-local only; medicine's *permission check* is the one exception that reads real Family data without owning any network code itself (`docs/DECISIONS.md` D-023). The SRS's target backend does not exist in this repo — see `docs/BACKLOG.md` M8. Needs remote data outside auth/profile/family? Define the interface, stub it, add an M8 backlog row.
9. **Never mark a doc claim done without pointing at the implementing code.**
10. **One task per run.** If it turns out to be bigger than a session, stop, report, and propose a split into new backlog rows.
11. **Native project identifiers stay as-is unless a task explicitly says otherwise.** Android's `com.sahelicli` package and the iOS `SaheliCLI.xcodeproj` were deliberately left unrenamed in D-019 — this environment can't build-verify a native rename. Don't casually rename them as a side effect of unrelated work.

---

## 5. Current state at a glance

Full detail in `docs/BACKLOG.md`; this table is the summary.

| Area | Status |
| --- | --- |
| Onboarding — language, phone, OTP, profile | ✅ Built, real backend auth (`M2-T1`/`M2-T4`/`M2-T6`, D-012) — resend timer built (`M2-T2`); idle/absolute expiry, re-auth banner still missing |
| Home dashboard with scroll-driven sticky header | ✅ Built — tiles/quick actions route on stable IDs (`M1-T7`); medicine adherence stat is real (`M4-T3`), spend stat still static |
| Family & Managed Members — real backend (`M8-T3`, `M2-T9`, D-023/D-024): create/list/get, phone-invite-and-consent, role management, dependents, admin invite history | ✅ Built against every endpoint in the real `/api/families/**` contract, all 6 locales — role-based access only, no permission matrix (backend doesn't have one) |
| Medical Chest — CRUD, schedule, stock, daily intake log, 7-day adherence, permission gate | ✅ Built (`M4-T1`/`T2`/`T3`/`T5`) — own data still local-only; the *permission gate* now reads the real Family backend (D-023). Notification reminders (`M4-T4`) still need a library decision |
| Design system — 3 palettes, tokens, 4 shared components, `lucide-react-native` icons | ✅ Built (live switching + picker in Profile → Appearance; fonts still not bundled) |
| Localization — 6 locales, live switching | ✅ Built — Family and Medicine both fully covered now |
| Documentation & prompt library | ✅ M0 complete, 2026-07-30; rebranded to Habita AI 2026-08-07 |
| Session lifecycle (idle/absolute expiry, re-auth banner) | ❌ Not built — M2-T3's remaining half, M2-T5 |
| Managed Members (dependents) | ❌ Not built — M2-T9, new since the SRS adoption |
| Mind & Mood — mood logging, offline CBT coach behind a `CbtCoach` interface, 4 guided meditations | ✅ Built (`M4-T6`/`M4-T7`, D-030) — device-private, deliberately *not* family-shared |
| Cycle & Life Stage — period logging, pure prediction, 5 life stages with tailored guidance | ✅ Built (`M4-T8`/`M4-T9`, D-030) — device-private; reminders computed but not scheduled (`M4-T4`/`OD-4`) |
| Responsive layout — `useResponsive()` hook, window-derived scales/columns/max-width | ✅ Built (D-030) — used by the Wellness and Cycle screens only; every earlier screen is still fixed-width |
| Documents, Staff, Resources, Events, Vehicles (M5) · Expenses, Payments (M6) · Pantry, Wardrobe, Voice (M7) | ❌ Not built — see `NEXT_STEPS.md` for build order |
| Backend beyond auth/profile, real invites, AI/OCR | ❌ Not built — M8, decisions open |

---

## 6. Escalate to the user when

- A task is 🔒 blocked or ❓ needs-decision in `docs/BACKLOG.md`.
- The work would contradict an accepted decision in `docs/DECISIONS.md`.
- A refactor would touch every screen — show the pattern on one screen and get agreement first.
- Docs and code disagree in a way that changes what should be built.
- A translation is a guess rather than a translation.
- The task needs a new dependency, a native module, or a platform permission.
- The task would rename or restructure the Android package / iOS Xcode project — that was deliberately deferred in D-019, not an oversight to quietly fix.
