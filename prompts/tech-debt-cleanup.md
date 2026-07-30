# Prompt — Foundation / technical-debt work

For milestone M1 tasks and any refactor with no user-facing change. These tasks touch many files at once, so the emphasis is on proving nothing broke.

---

## Prompt

```
Work on {{TASK_ID}} from docs/BACKLOG.md — foundation hardening, no user-facing change.

Read docs/ARCHITECTURE.md §7 (known gaps) for why this debt exists, and
docs/DECISIONS.md for the decision that created it — some debt is a deliberate trade-off,
not an accident. If the task contradicts an accepted decision, stop and tell me.

## Step 1 — Establish the blast radius
Before editing:
- grep for every import of the code you are about to change or delete, and list the call
  sites
- State explicitly what could break and how you will know if it did
- Capture the current baseline: run npx tsc --noEmit, npm run lint, npm test and record the
  output so you can compare afterwards

For deletions specifically: prove nothing imports the file. Metro and TypeScript both
resolve `../theme` to the file src/theme.ts before the directory src/theme/index.ts — that
kind of shadowing is why dead code survived here. Check resolution, not just filenames.

## Step 2 — Change in reviewable steps
Make one logical change at a time. After each, re-run the type check. Do not mix an
unrelated cleanup into the same change — put it in docs/BACKLOG.md instead.

## Step 3 — Prove equivalence
Behaviour must be identical unless the task says otherwise. Report:
- npx tsc --noEmit, npm run lint, npm test — actual output, compared to the baseline
- Which screens you exercised and what you checked on each
- Anything that changed visually or behaviourally, even slightly

If you cannot verify a screen without running the app, say so rather than assuming.

## Step 4 — Record
- Update docs/BACKLOG.md (✅ with date, or 🚧 with where it stopped)
- Remove the resolved item from docs/ARCHITECTURE.md §7, or update it if only partly fixed
- Update the structure/conventions sections of docs/ARCHITECTURE.md and README.md if paths
  changed
- Add a docs/DECISIONS.md entry if this changed an architectural approach (e.g. replacing
  the mutable-singleton theme supersedes D-004)

## Guardrails
- No feature work, no UI redesign, no new dependency.
- Do not "improve" code outside the task's scope — file it in the backlog.
- If a refactor turns out to require touching every screen, stop after the first screen,
  show me the pattern, and get agreement before continuing.
```
