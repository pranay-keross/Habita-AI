# Prompt — Localization pass

For adding strings across all six locales, or retrofitting a screen that was built with hardcoded English (currently: `FamilyScreen.tsx`, backlog `M3-T1`).

---

## Prompt

```
Do a localization pass on {{TARGET — e.g. src/features/family/FamilyScreen.tsx}}.

Saheli ships six languages: en, hi, bn, ta, es, ar. English is the fallback. A screen that
is only partly localized is a visible defect (docs/DECISIONS.md D-005).

## Step 1 — Inventory
List every user-facing string in the target: visible text, placeholders, Alert titles and
bodies, button labels, accessibility labels. Group them into a proposed `{{namespace}}.*`
key structure following the existing naming style in src/i18n/locales/en.json
(snake_case keys, grouped by screen).

Show me the proposed key list before editing anything.

## Step 2 — Add keys
Add every key to all six files in src/i18n/locales/ in the same key order as en.json.
Translate rather than copying English into the other five. For anything you are not
confident translating, mark it in your report so a native speaker can review — do not
silently ship a guess.

## Step 3 — Wire the screen
- Replace literals with t('{{namespace}}.key')
- Use interpolation for dynamic values — t('key', { name }) with {{name}} in the JSON —
  rather than string concatenation, since word order differs by language
- Subscribe to language changes using the pattern in docs/ARCHITECTURE.md §4 so the screen
  re-renders on switch
- Leave developer-facing strings (console.warn, code comments) in English

## Step 4 — Verify
- npx tsc --noEmit, npm run lint, npm test
- Confirm no user-facing English literal remains in the target file
- Confirm en.json and the other five files have the same key set (no missing keys, no
  orphans)
- Check the screen in Hindi and Arabic: layout stays LTR, back arrow top-left, no text
  clipped by fixed-width containers

## Step 5 — Record
Update docs/BACKLOG.md, and README.md if a localization gap listed there is now closed.

## Guardrails
- Do not change layout, behaviour, or styling in this pass — strings only. If a string does
  not fit its container in another language, report it and add a backlog row.
- Do not remove keys that other screens use — grep before deleting anything.
```
