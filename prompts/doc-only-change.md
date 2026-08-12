# Prompt — Documentation-only change

For updating docs without touching application code — a mid-project doc audit, adding an architecture doc, or correcting drift found during a session.

---

## Prompt

```
Documentation-only change: {{WHAT}}. Do not modify any application code, configuration, or
dependencies.

## Step 1 — Verify against source, not against other docs
Documentation can be confidently wrong. Before writing:
- Read the actual source files for anything you are about to describe
- Check git log and git status for recent changes
- Where a doc claims a feature exists, find the implementation. If you cannot find it, the
  claim is wrong — say so and correct it rather than preserving it

Report every doc/code mismatch you find before you start editing.

## Step 2 — Respect each document's job
- README.md — product story, verified current state, how to run. No aspirational features
  in the feature list.
- AI_CONTEXT.md — cold-start brief for an agent. Short, factual, points elsewhere for depth.
- docs/ARCHITECTURE.md — how it is built and why, plus known gaps.
- docs/BACKLOG.md — milestones and tasks. Everything not-yet-built belongs here.
- docs/DECISIONS.md — append-only decision log; supersede, never rewrite.
- agent.md — the working agreement.
- prompts/ — repeatable session rituals.

Do not duplicate content between documents; cross-reference instead. If the same fact
appears in two places, one of them is the owner and the other should link to it.

## Step 3 — Write
Be specific and verifiable. Prefer "otp.tsx line 85 navigates unconditionally — there is no
code check" over "OTP verification is incomplete". State what does not work as plainly as
what does.

## Step 4 — Consistency check
- Feature status agrees across README.md, AI_CONTEXT.md and docs/BACKLOG.md
- File maps match the real tree
- Storage keys in docs/ARCHITECTURE.md §5 match a grep for `habita.` in src/
- Task IDs referenced anywhere exist in docs/BACKLOG.md

## Step 5 — Report
What changed, what claims you removed as unverified, and a suggested commit message.

## Guardrails
- Zero code changes. If you find a bug, add it to docs/BACKLOG.md and tell me — do not fix it.
- Do not invent status. If you cannot tell whether something works, say it is unverified.
```
