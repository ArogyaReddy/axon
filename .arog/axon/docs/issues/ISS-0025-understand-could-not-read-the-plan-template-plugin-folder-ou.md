---
id: ISS-0025
title: understand could not read the plan template (plugin folder outside project): no plan written
status: fixed
severity: high
type: bug
feature: core-skills
found: 2026-10-01
found_in: test
found_by: P1b live run: 8 permission denials on templates/plan.md
files: plugins/axon-core/skills/understand/SKILL.md, plugins/axon-core/bin/axon-plan-new, global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: test axon-plan-new; live understand rerun: complete plan, Stop hook enforced sections 5-11
related: 
---

# ISS-0025: understand could not read the plan template (plugin folder outside project): no plan written

## What happened

In the first live run of `understand`, Claude could not read `templates/plan.md` inside the plugin folder (8 permission denials) and wrote no plan.

## How it was found

P1b live run: result asked for 'template access'; permission_denials listed Read and cat of the template path.

## Root cause

The skill told Claude to read a file inside the plugin folder, which is outside the project; headless runs deny it and interactive runs would prompt every time. Writing to ~/.claude/docs/plans (outside the project) had the same problem.

## Impact

High: the core planning skill could not produce its plan without prompts or denials.

## Fix

New `axon-plan-new <slug>` (plugins/axon-core/bin) copies the template into the plans folder and prints the path, so Claude never reads plugin files. base.json allows `Bash(axon-plan-new *)`, `Edit(~/.claude/docs/**)`, `Write(~/.claude/docs/**)`. understand and plan-feature use it.

## Verification

Test `axon-plan-new creates a plan from the template...` (failed first); live rerun: plan written, axon-plan-check OK; Claude reported 'The Stop hook required the full 11-section doc, so I completed sections 5-11'.

## Lessons

Skills must not depend on reading their own plugin files; ship a command that produces what the model needs.
