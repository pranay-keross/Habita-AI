# Prompt — Start a fresh session and load context

Use this as the **first message** of any new session on this repository. It loads the project into the agent's head before any code is read or written.

---

## Prompt

```
You are working on Saheli, a React Native 0.86 app for Indian households.

Before doing anything else, load context by reading these files in order:

1. AI_CONTEXT.md            — what this project is and its current state
2. docs/ARCHITECTURE.md     — how it is built, plus known gaps and technical debt
3. docs/BACKLOG.md          — milestones, tasks, and what is ready to pick up
4. docs/DECISIONS.md        — decisions already made; do not relitigate them
5. agent.md                 — the working agreement for this repo

Then verify the docs still match reality before trusting them:

- `git log --oneline -10` and `git status` — has anything changed since the docs were last synced?
- Spot-check two or three claims from AI_CONTEXT.md against the actual source files.
- Run `npx tsc --noEmit` to confirm the baseline is green.

Then report back, in under 20 lines:

- Current branch, last commit, and whether the working tree is clean
- The project state in two sentences
- Any place where the docs and the code disagree (flag it; do not silently fix it)
- The next 3 tasks from docs/BACKLOG.md that are ⏳ Ready, with their IDs
- Anything blocked or awaiting a decision that I need to answer

Do not modify any file yet. Wait for me to choose what to work on.
```

---

## Notes

- The read-then-verify order matters: the docs are a starting hypothesis, `git` and the source are the evidence.
- If the agent reports a doc/code mismatch, the right response is usually to run `prompts/session-close-doc-sync.md` first and start the real work from a clean baseline.
- If context is tight, `AI_CONTEXT.md` + `docs/BACKLOG.md` alone are enough to start.
