# Reusable Prompts

Copy-paste prompts for working on Habita AI with an AI coding agent. They exist so that every session starts with the same context, every task is executed against the same standards, and the documentation never drifts from the code.

## The session ritual

```
1. START    →  prompts/session-start-context-load.md
2. WORK     →  prompts/backlog-task-kickoff.md   (once per task)
3. CLOSE    →  prompts/session-close-doc-sync.md
```

Steps 1 and 3 are not optional. Step 1 is what stops the agent from re-deriving the project from scratch; step 3 is what keeps step 1 accurate next time.

## Index

| Prompt | Use when |
| --- | --- |
| `session-start-context-load.md` | Beginning any session — loads project context before touching code |
| `backlog-task-kickoff.md` | Starting a specific task from `docs/BACKLOG.md` |
| `session-close-doc-sync.md` | Ending a session — syncs all docs to the real state of the code |
| `new-feature-module.md` | Building a new domain module under `src/features/` (M4–M7) |
| `i18n-localization-pass.md` | Adding strings or localizing an existing screen across all 6 locales |
| `tech-debt-cleanup.md` | Foundation/refactor work with no user-facing change (M1) |
| `doc-only-change.md` | Changing documentation without touching code |

## Conventions used in these prompts

- `{{PLACEHOLDER}}` — replace before sending.
- Anything in a **Guardrails** section is a hard constraint; the agent should stop and ask rather than violate it.
- Prompts reference `docs/BACKLOG.md` task IDs (`M2-T3`) so a session can be traced back to a tracked item.
