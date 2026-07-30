# Prompt — Build a new domain module

For milestones M4–M7, where a new module lands under `src/features/`. The Family module (`src/features/family/`) is the closest existing example — including its mistakes, which this prompt avoids repeating.

---

## Prompt

```
Build the {{MODULE_NAME}} module for Saheli — backlog task {{TASK_ID}}.

Read docs/ARCHITECTURE.md first, especially §5 (storage contract), §6 (components) and
§9 (conventions).

## Structure to create

src/features/{{module}}/
  {{Module}}Screen.tsx   — the screen; header bar with top-left back arrow, own safe-area insets
  types.ts               — exported interfaces for this domain
  {{module}}Store.ts     — all AsyncStorage access for this module, via src/utils/storage.ts

Do NOT repeat these mistakes from the Family module:
- Do not define the same interface in two files
- Do not read/write AsyncStorage directly from the screen
- Do not hardcode user-facing English strings

## Requirements

1. Types and storage: define the domain interface in types.ts; put every read/write in
   {{module}}Store.ts behind named functions; use one `saheli.{{module}}` storage key and
   add it to the table in docs/ARCHITECTURE.md §5.

2. Routing: add the route to RootStackParamList and src/app/_layout.tsx. Wire the matching
   dashboard tile — route on a stable tile ID, not on the translated label.

3. Localization: every user-facing string goes through t() in a `{{module}}.*` namespace,
   added to all six files in src/i18n/locales/. Subscribe to language changes with the
   pattern documented in docs/ARCHITECTURE.md §4.

4. Design system: tokens from src/theme.ts only. Reuse Button, Card, SectionHeader and
   BottomSheet rather than building new primitives. Add/edit flows use BottomSheet, matching
   the Family screen's interaction model.

5. Family permissions: if this module appears in the FamilyMember permission set, respect it
   — viewers see read-only. If it does not, tell me whether it should be added.

6. Dashboard data: if this module owns a number currently hardcoded on the dashboard
   (spend total, adherence, pending, due), replace the hardcoded value with a derived one.

## Verify
Run npx tsc --noEmit, npm run lint, npm test and report the real output. Confirm the screen
renders correctly in English, Hindi and Arabic (LTR layout is enforced — the back arrow stays
top-left in all three).

## Record
Update docs/BACKLOG.md, docs/ARCHITECTURE.md (§5 storage table, structure), and README.md's
"What works today" section.

## Guardrails
- No new dependency without asking first.
- No backend or network calls — this phase is local-only (docs/DECISIONS.md D-002). If the
  module needs remote data, define the interface and stub it, and add the real integration
  as an M8 backlog row.
- One module per run.
```
