I ran the analysis on tasks.md and wrote the plan. Nothing has been built and ~/.claude hasn't been changed; building waits for your GO.

Files written:

01-getting-started-with-projects.md (tasks 1-3): your role, your projects (adp-e-product, the agentic workspace, adp-e-automation, PACER), your tech stack and process, what is in ~/.claude today, and the health problems below.
02-getting-started-with-resources.md (tasks 4-5): for each of the 5 resource repos, what to reuse, what to skip, what it needs installed, and where they overlap.
arog-platform-build-2026-09-30.plan.md (tasks 6-11): the full plan, with folder layout, design decisions, workflows, before/after tests, risks, an 11-phase tracker and 12 open questions.
Problems in your current setup (checked on this Mac):

Most of your framework isn't running here. settings.json and CLAUDE.md are managed by home-manager, so the only active hook is lavish-axi. None of the AROG enforcement hooks run.

Paths from another machine. 8 files hardcode /Users/gadea. settings-me.json points to a hooks/pre-tool-use.sh that doesn't exist.

Missing files that skills rely on:

scripts/ar-verify.sh
rules/adp-e-product/mandatory.md (only 8 of its 12 rules are written down anywhere)
the gold-standard review doc
Because of this, /ar-verify and /ar-understand can't run as designed.

Things that fail without an error:

ar-verify calls an agent named ar-verify-done, which is a different verifier from the one its name suggests.
A template file is misspelled UNDERSTAND-TEMPATE.md.
Secrets in a shared file. ar-config.yaml holds internal endpoints, client IDs and Cognito pool IDs, so it must stay out of any folder you copy or share.

Missing tools. uv, just, bun and playwright-cli aren't installed, and Python is 3.9. The resource repos expect those tools.

Safety prompt turned off. settings-me.json sets skipDangerousModePermissionPrompt.

A lot of duplication: 6+ ways to plan, 7 reviewers, 4 verifiers and 3 status lines.

The plan: build AROG as one portable folder at ~/.claude/.arog/AROG/:

Plugins: 8 now (core, guard, qa, adp, explain, meta, session, observe), with factory added later.
Global layer: one CLAUDE.md, base settings plus work and personal versions, and one status line.
Config: 3 layers, so secrets stay out of the shared folder.
Installer: backs up first, supports a dry run, and detects home-manager.
Extras: a generator for Copilot files, and node --test test suites.
Main recommendations:

Package AROG as a local plugin marketplace plus a small installer, so its names don't clash with the 12 ADP plugins.
Write hooks in Node with no dependencies.
Turn any check that can be a script into a script instead of an agent prompt.
Keep one review chain: verify script, then validator, reviewer and security review.
Add agent monitoring to your existing dashboard at 127.0.0.1:47301 instead of adding Bun/Vue.
Use no external APIs by default.
~/.claude and the resource repos stay untouched until you approve the migration separately.

Questions to answer before building (section 14 of the plan has a suggested default for each):

Will AROG run on both this Mac and the ADP work Mac, and what can be installed on the work one?
Should home-manager manage the global layer, or should the installer write to ~/.claude directly?
Plugin marketplace or plain file copy?
Hooks in Node or Python/uv?
Which models are allowed at work (for example, Sonnet-only via Bedrock)?
Are any external APIs allowed?
Which dashboard should hold agent monitoring?
Which Copilot features does your team use?
Can you copy the missing originals from the work Mac (mandatory.md, ~/.claude/scripts/*, pre-tool-use.sh, the review doc)?
Is AROG just for you, or shared with your team?
Include the SSSF factory now or later?
Once AROG works, retire the old ~/.claude copies (after a backup)?
Reply GO to start building, EDIT <section> to change part of the plan, or STOP to cancel. You can also answer the questions first; for any you skip, I'll use the plan's suggested default.


---

The revised plan is ready: axon-framework-build-2026-09-30.plan.md, 1,293 lines. The old AROG plan is deleted, and the two getting-started docs moved to .arog/axon/ with the new naming. I checked the files: all the new sections are there and none of the three files contains an em dash. Nothing has been built and nothing else in ~/.claude changed.

What's new

Section	What it covers
§4 Naming	"axon" only as a technical label; about 45 old-to-new name mappings; renames where a short name would clash with a built-in (/plan becomes plan-feature, /review becomes review-changes, concise becomes results-first)
§8 Hooks	Where hooks live (plugin hooks/hooks.json, not settings.json); every hook event with used/not used and why; input, exit codes and output; a speed budget per hook; one fully worked hook with its test; keep/merge/drop against hooks-mastery and your current hooks
§9 Status line	Settings entry, input fields, 12 segments with sources, caching, work vs personal versions. A plugin can't set the status line, so the installer or home-manager has to
§10 Output styles	Format, locations, switching, 6 styles each with a short spec. Copilot has no equivalent
§11 settings.json	Which settings win when they conflict, the actual proposed base JSON plus work/personal profiles, a merge that doesn't overwrite your values, exact restore on uninstall, and handling of the home-manager-managed file on this Mac
§12 Playwright CLI	Bowser uses @playwright/cli (playwright-cli), not npx playwright; covers sessions, screenshots and evidence, reusing a saved Cognito login, parallel stories, CI
§13 Playwright browser	Browser choice, and which tool does what: playwright-cli for QA, chrome-devtools-axi for single-page debugging, Claude in Chrome for personal tasks, lavish-axi for review pages only, no Playwright MCP
§14 Gap review	28 factors, each marked covered, added now or deferred with a reason
Findings from the official docs that changed the design:

Blocking a tool call needs exit code 2. Exit code 1 and a hook timeout don't block anything, so hard limits also go in permissions.deny.
Plugin agents ignore hooks, mcpServers and permissionMode in their own definition, so checks on those agents have to run from plugin-level hooks.
Your installed Claude Code (v2.1.197) is too old for some settings. "attribution": false needs 2.1.281, and an older version skips the entire settings file if it sees it. The plan uses a compatible form and sets a minimum version, so upgrading should be the first step.
Auto mode isn't available at work, because Sonnet 4.6 on Bedrock doesn't support it.
Copilot can't read anything inside Claude plugins, so Copilot support becomes an axon export --copilot step.
Questions that most affect the build (the full list of 25 is in §22, and §23 lists 12 things the agent couldn't verify):

13: Which Claude Code version is on the work Mac, and can both Macs upgrade?
9: Can you copy the missing files from the work Mac (mandatory.md, the scripts, pre-tool-use.sh)?
20: Can @playwright/cli and its browser be installed at work?
15: Which Bedrock models are approved?
2: Should home-manager or the installer own the global settings?
Reply GO to start building (every phase starts by writing its tests), EDIT <section> to change something, or answer the questions first. For any you skip, I'll use the plan's suggested default.

---