# Saheli — Agent Working Agreement

How AI agents work in this repository. Product context is in `AI_CONTEXT.md`; this file is about *process*.

**Last updated:** 2026-08-05

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

---

## 2. What the agent is responsible for

- **Keeping the project legible across sessions.** No session should need the user to re-explain Saheli. If `AI_CONTEXT.md` was not enough to start, fix `AI_CONTEXT.md`.
- **Executing tracked tasks, not adjacent ones.** Work comes from `docs/BACKLOG.md`. Discovered work becomes new backlog rows, not scope creep.
- **Reporting honestly.** If a check fails, show the output. If a criterion is unmet, say so. If something is unverified, call it unverified.
- **Keeping docs and code in the same commit.** A feature that ships without its doc update is unfinished.

---

## 3. Document ownership

Each document has one job. Do not duplicate content between them — cross-reference.

| Document | Owns | Never contains |
| --- | --- | --- |
| `README.md` | Product story, verified current state, setup | Aspirational features in the feature list |
| `AI_CONTEXT.md` | Cold-start brief, active patterns, traps | Long-form architecture detail |
| `docs/ARCHITECTURE.md` | Structure, contracts, known gaps | Task planning |
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
5. **Storage discipline.** `saheli.` prefix, access via `src/utils/storage.ts`, key documented in `docs/ARCHITECTURE.md` §5.
6. **Routes are registered in pairs** — `RootStackParamList` and `_layout.tsx`, same change.
7. **No new dependency without asking**, including what already-installed package was ruled out and why.
8. **No backend or network calls, except auth/profile** (`docs/DECISIONS.md` D-002, narrowed by D-012). `src/features/auth/api.ts` and `src/features/auth/auth.ts` are the one place this is allowed — everything else (family, dashboard, documents, money, …) is still device-local only. Needs remote data outside auth/profile? Define the interface, stub it, add an M8 backlog row.
9. **Never mark a doc claim done without pointing at the implementing code.**
10. **One task per run.** If it turns out to be bigger than a session, stop, report, and propose a split into new backlog rows.

---

## 5. Current state at a glance

Full detail in `docs/BACKLOG.md`; this table is the summary.

| Area | Status |
| --- | --- |
| Onboarding — language, phone, OTP, profile | ✅ Built, real backend auth (`M2-T1`/`M2-T4`/`M2-T6`, D-012) — resend timer, idle/absolute expiry, re-auth banner still missing |
| Home dashboard with scroll-driven sticky header | ✅ Built (static data) |
| Family groups — members, roles, permission toggles, bottom sheet | ✅ Built (English-only, local storage) |
| Design system — 3 palettes, tokens, 4 shared components, `lucide-react-native` icons | ✅ Built (live switching + picker in Profile → Appearance; fonts still not bundled) |
| Localization — 6 locales, live switching | ✅ Built (Family screen not covered) |
| Documentation & prompt library | ✅ M0 complete, 2026-07-30 |
| Session lifecycle (idle/absolute expiry, resend timer, re-auth banner) | ❌ Not built — M2-T2, M2-T3's remaining half, M2-T5 |
| Medicine, Documents, Money/UPI, Safety, Wellness, Style, Events, Vehicles | ❌ Not built — M4–M7 |
| Backend beyond auth/profile, real invites, AI/OCR | ❌ Not built — M8, decisions open |

---

## 6. Escalate to the user when

- A task is 🔒 blocked or ❓ needs-decision in `docs/BACKLOG.md`.
- The work would contradict an accepted decision in `docs/DECISIONS.md`.
- A refactor would touch every screen — show the pattern on one screen and get agreement first.
- Docs and code disagree in a way that changes what should be built.
- A translation is a guess rather than a translation.
- The task needs a new dependency, a native module, or a platform permission.
