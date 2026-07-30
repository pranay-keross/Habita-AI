# Prompt — Start development of a task from the backlog

Use after `session-start-context-load.md`, once you have picked a task ID from `docs/BACKLOG.md`.

---

## Prompt

```
Implement {{TASK_ID}} from docs/BACKLOG.md.

## Step 1 — Restate before you build
Read the task row in docs/BACKLOG.md and tell me:
- What the task is, in your words, and its acceptance criteria
- Which files you expect to create or modify
- Any blocker or dependency listed on the task that is not yet done
- Anything ambiguous in the task that would change your approach

If a dependency is unmet or the task is marked 🔒 or ❓, stop and tell me instead of
working around it.

## Step 2 — Plan
Give me a short implementation plan (5–10 bullets). Wait for my go-ahead before editing.

## Step 3 — Implement
Follow the conventions in docs/ARCHITECTURE.md §9:
- Styling from src/theme.ts tokens only — never src/theme/, never inline hex
- New user-facing strings go into all six locale files under src/i18n/locales/,
  namespaced by screen
- New screens: register in RootStackParamList and src/app/_layout.tsx in the same change
- New storage keys: prefix `saheli.`, access through src/utils/storage.ts, and document
  the key in docs/ARCHITECTURE.md §5
- Screens own their safe-area insets; the navigator has no header
- Keep the back arrow top-left in every language

## Step 4 — Verify
Run and report the actual output of:
- npx tsc --noEmit
- npm run lint
- npm test

Then walk each acceptance criterion from the backlog row and state whether it is met.
If something is not met, say so plainly rather than reframing the criterion.

## Step 5 — Record
- Update the task row in docs/BACKLOG.md (✅ with today's date, or 🚧 with a one-line
  note on where it stopped)
- Update docs/ARCHITECTURE.md if the structure, storage contract, or a known gap changed
- If the work resolved an open question, move it into docs/DECISIONS.md as a new entry
- Add any newly discovered work to docs/BACKLOG.md as new task rows — never as prose

## Guardrails
- Do not start adjacent tasks because they seem easy. One task per run.
- Do not delete or rewrite unrelated code.
- Do not add a dependency without telling me what it is and why nothing already
  installed will do.
- If a task turns out to be bigger than one session, stop, report, and propose how to
  split it into new backlog rows.
```

---

## Variants

**Bug fix instead of a backlog task:**

```
Fix this bug: {{DESCRIPTION}}

Before changing anything, reproduce or trace it to a specific line and explain the root
cause. Then follow Steps 2–5 above. Add the fix as a new ✅ row in the relevant milestone
in docs/BACKLOG.md so the work is traceable.
```

**Exploration before committing to an approach:**

```
{{TASK_ID}} has more than one reasonable implementation. Before writing code, give me
2–3 approaches with trade-offs against this codebase specifically (see
docs/ARCHITECTURE.md), and a recommendation. Do not modify files yet.
```
