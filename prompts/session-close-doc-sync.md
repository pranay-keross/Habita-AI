# Prompt — Close the session and sync all documentation

Run this as the **last message** of every session, before committing. It makes the docs true again so the next session can trust them.

---

## Prompt

```
We are closing this session. Sync all project documentation to the actual current state
of the code. Do not change any application code — documentation files only.

## Step 1 — Establish what actually changed
- `git status` and `git diff --stat` for uncommitted work
- `git log --oneline` for anything committed this session
- List the behaviour that changed from a user's point of view, and the structural changes
  (new files, new routes, new storage keys, new dependencies)

## Step 2 — Verify before you write
Do not document anything you have not confirmed in the source. For every feature you are
about to mark as done, point to the file and line that implements it. If a feature is
half-built — the UI exists but the logic does not — say so explicitly rather than marking
it complete.

Run `npx tsc --noEmit`, `npm run lint` and `npm test` and record the real results.

## Step 3 — Update each document for its own job
- README.md — product story, "What works today" (verified only), "What does not work yet".
  Move anything that became true out of the second list into the first.
- AI_CONTEXT.md — the cold-start brief: current state, file map, active patterns,
  what an agent must not assume. Keep it short enough to be read in full.
- docs/ARCHITECTURE.md — layers, navigation, theming, i18n, §5 storage key table,
  §7 known gaps. Remove gaps that were fixed; add ones discovered.
- docs/BACKLOG.md — flip finished rows to ✅ with today's date; mark partial work 🚧 with
  a one-line note on exactly where it stopped and what unblocks it; add discovered work as
  new rows; recompute the milestone overview counts.
- docs/DECISIONS.md — add an entry for any real decision made this session (why, and what
  it costs). Mark superseded decisions rather than editing them. Move answered open
  questions out of the backlog's Open questions list.
- agent.md — only if the working agreement itself changed.
- prompts/ — only if a prompt is now wrong or a new repeatable ritual emerged.

## Step 4 — Consistency check across documents
Confirm these do not contradict each other:
- Feature status in README.md vs docs/BACKLOG.md vs AI_CONTEXT.md
- The file/directory map in README.md vs AI_CONTEXT.md vs the real tree
- The storage key table in docs/ARCHITECTURE.md vs every `habita.` key in the source
  (grep for it)
- Task IDs referenced in prompts and docs actually exist in docs/BACKLOG.md

## Step 5 — Report
Give me:
- A summary of what changed in the docs and why
- Any claim you removed because it was not backed by code
- Anything left in a half-finished state that the next session must pick up first
- A suggested commit message covering both the code and the doc changes

## Guardrails
- Never mark something ✅ that you did not verify in the source.
- Never delete history from docs/DECISIONS.md — supersede it.
- Aspirational features belong in docs/BACKLOG.md, never in README.md's feature list.
- Documentation only in this run: no application code changes.
```

---

## Why this exists

`docs/DECISIONS.md` D-006: earlier documentation claimed a 15-minute idle logout, forced OTP verification, and multi-tenant isolation — none of which had been built. An agent starting cold would have built features on top of things that did not exist. This prompt is the safeguard against that repeating.
