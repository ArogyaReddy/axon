Built. The plugin lives at /Users/arog/.claude/dev-mods/ea87ce7b-9d22-47a0-8c4f-25c19dbf6d9c/prompt-upgrade/ (.claude-plugin/plugin.json, hooks/hooks.json, hooks/register.tsx, types/index.d.ts, hooks/register.test.ts).

Tooling gap found, not hidden: claude plugin validate on this machine (Claude Code 2.1.197) rejects the manifest shape this skill's function-hooks engine requires (hooks: Invalid input: expected record, received undefined — it still expects the old settings-hooks format), and claude plugin test isn't even a recognized subcommand here (error: unknown command 'test'). The skill's own type declarations are stamped from build 2.1.287 — newer than what's installed globally. So I could not run either required check, and couldn't execute register.test.ts at all. This is a version gap in the installed CLI, not something fixable by editing the plugin.

How it works: /better <prompt> upgrades that text now; /better alone opens a box to type one; /better on//better off toggles automatic interception; /better history shows the last 20. The 4-step tracker, Q&A chips with "Other"/"Skip", the review screen (word-count line, Run/Edit/Copy/Cancel above the before/after cards), and resuming a reload mid-step are all implemented per spec.

Choices made for you:

Questions/rewrite use the haiku model at low effort (cheap, fast, matches "a fast model").
Automatic mode defaults off and is session-only (resets each new session) — I didn't want it silently intercepting prompts in a future session you forgot you'd left it on in. History persists across sessions/restarts via the plugin's own $.store, capped at 20.
Buttons can't take arbitrary hex colors (the element API only offers variant: primary/secondary, plain, dimColor) — I mapped gold-main→primary, slate→default/secondary, muted Cancel→plain dimColor, and used your exact hex palette everywhere Text/Box colors are actually settable (title rule, headings, tracker, cards).
Skipped the "three-row box-drawing digit" styling for the review numbers line, since that step's own spec explicitly says "one line of numbers" — treated as the more specific instruction overriding the general look note.
Escape or ctrl+x x now also restores your original prompt and resets state, same as the Cancel button, so dismissing the pane any other way never silently loses your text.
/better's command.run awaits $.ui.open directly (the skill's own canonical pattern) rather than literal fire-and-forget, since that call resolves almost instantly with just a placement decision.
Could not verify: everything above, since neither validate nor test would run here. The test file covers the interception/pass-through matrix and the on/off switch with high confidence (I confirmed the exact event-input shapes by reading the type declarations directly). I deliberately did not write UI-driven tests for pressing Run/Edit/Copy/Cancel or reading the live-rendered questions/rewrite — those need nested layout types (SiteScroll/SiteView) I couldn't look up with confidence and had no way to execute against. I also haven't seen confirmation that this session accepted the "Enable hot reloading?" prompt the engine should have raised when I wrote the first file — until that's accepted, the mod isn't actually loaded.

To use it on a build that does support this engine from the CLI directly: claude --plugin-dir /Users/arog/.claude/dev-mods/ea87ce7b-9d22-47a0-8c4f-25c19dbf6d9c/prompt-upgrade.

---

Clean View is built. Here's the full status.

What I built — a function-hook plugin at /Users/arog/.claude/dev-mods/cb592248-016e-4535-bf16-c33b3e66c2b1/clean-view/:

.claude-plugin/plugin.json, hooks/hooks.json, hooks/register.tsx, hooks/clean-view.tsx (the real logic), types/index.d.ts (the $.state contract), hooks/clean-view.test.ts (the 6 required tests).
It implements everything from the spec against this build's documented API: plan_steps/report_progress tools, the plan-first gate on the main loop only, TodoWrite folded into the checklist, the header's five states (Working/Needs you/Stuck/Stopped/Done) driven by turn.start/turn.complete/classic.Notification/classic.PermissionDenied/classic.StopFailure, the name cleaner, the 250ms tick that only runs while a job is active, ToolUse/ToolResult/ToolGroup hidden and ToolProgress's hint blanked while Clean View is on, the always-visible toggle button, /simple on|off, and persistence through $.store.

One real problem, found not guessed: the claude CLI actually installed on this machine (Homebrew, 2.1.197) doesn't support this plugin kind yet — claude plugin validate checks against the older command-hooks schema and flags my hooks.json/plugin.json as wrong, and claude plugin test doesn't exist as a subcommand at all (error: unknown command 'test'). The function-hooks API the plugin-authoring skill handed me is from a newer release (its types file says "Written by Claude Code 2.1.287") than what's on PATH. So I could not mechanically run the 6 required tests — I wrote clean-view.test.ts to the documented testing-kit shape, but it's unverified until claude plugin test exists here. I also had no tsc available to type-check independently. I did consolidate what would have been 4 separate tool.call registrations into 1, specifically because the docs don't define ordering when one plugin registers the same event twice — that was a real risk I removed rather than guessed around.

What you need to do next: writing into the mods folder should have triggered a "Enable hot reloading for this session?" prompt for you right when I wrote the first file — if you see it, accept it so Clean View actually loads here. That's the one path I can confirm works on this machine right now, since it uses the live session's engine, not the outdated CLI binary.

Turn it on/off: /simple on or /simple off (no argument flips it), or click the "● Clean View: ON/OFF" button at the right of the band — a toast confirms the change, and the setting survives restarts via $.store.

Install on another computer: copy the whole clean-view folder, then either run claude --plugin-dir /path/to/clean-view for a one-off session, or drop the folder at ~/.claude/skills/clean-view/ so it auto-loads every session, or set CLAUDE_CODE_PLUGIN_DIRS=/path/to/clean-view in their shell profile for persistent loading with no flag. Note: that machine needs a Claude Code build that actually supports function-hook plugins — worth running claude --version there first given what I found here. I'd also suggest brew upgrade claude on this machine so claude plugin test/validate can actually check this plugin kind going forward.


---

Before you start: read this entire prompt yourself and make sure you understand it. Then, before you do anything else, tell me in plain language what this prompt is going to do, every file you will create, overwrite or delete, every script you will run on my machine, and anything that costs money or is hard to undo. Ask me to confirm I have read and understood it, and wait for my yes before you begin.

Build me a Claude Code mod called **Clean View**. It makes Claude Code feel calm and friendly for people who aren't technical. While Claude works, the tool calls, file diffs and command output are hidden, and one simple checklist sits above the prompt so I can always see the plan, what's happening now and how far along it is.

Before you write any code, load the `plugin-authoring` skill and follow it. Build this as a function-hook plugin that hot-reloads in this session. Don't use a shell-script hook or an MCP server.

## What I should see

While Claude works, this sits just above the prompt:

```
Build my landing page · 1m 12s                     [ ● Clean View: ON ]
✓ Read your brand notes            ██████████  Done
▶ Build the pricing section        ██████░░░░  60%
○ Add the contact form             ░░░░░░░░░░  Next
○ Polish the footer                ░░░░░░░░░░  Up next
```

- **Header:** the job's name in 2 to 6 plain words, then how long it has been running.
- **Done steps:** a green check, a dimmed name, a full meter and "Done".
- **Current step:** a ▶, the name in bold and a meter that fills to the reported percent. If there's no percent yet, the meter shows a moving sweep and the label says "Working".
- **Upcoming steps:** dimmed. The first one says "Next" and the rest say "Up next".
- **The button** sits at the right of the header row on every screen, even when nothing is running. One click turns Clean View on or off and shows a short toast.

The header changes with the state of the job:

| State | Header shows |
|---|---|
| Working | Job name · time running |
| Needs you | Highlighted **Needs you** badge and the reason, e.g. "Claude needs your OK to continue". The current step's ▶ becomes ‖ |
| Stuck | ⚠ Stuck: the reason, in one plain sentence |
| Stopped | ■ Stopped · job name · you pressed Esc |
| Done | ✓ All done · job name · took 2m 14s. After 5 seconds it shrinks to one line |

## How it works

**1. Two tools Claude calls (register them with `$.tool.register` at session start)**
- `plan_steps({ steps: string[] })`: Claude lays out every step of the job up front, 2 to 8 short names in order. The first step starts right away. Return "Planned N steps. The first one has started."
- `report_progress({ task: string, percent: number })`: Claude reports progress on the current step. Clamp the percent to 0 to 100. When a planned step is reported, every step before it is checked off. When a step reaches 100, it's checked off and the next one starts automatically. A name that isn't in the plan becomes a new step. Return "Progress noted: N%."

**2. Make Claude use them (`prompt.compose`)**
While Clean View is on, add a system-prompt section that says:
- Write every step name in plain English a non-technical person understands. Keep it under 40 characters and start it with a verb, like "Build the pricing section".
- Never put file paths, file names, commands, code or tool names in a step name.
- For every request, even a quick question, call `plan_steps` first. Load it with ToolSearch if it's deferred. Then call `report_progress` as real progress happens, and with 100 the moment a step finishes.
- If the session has TodoWrite or TaskCreate, Claude can use its to-do list as the plan instead.

**3. Plan first (gate in `tool.call`)**
Until a real plan exists, deny every other tool with a message telling Claude to call `plan_steps` first. Always allow ToolSearch, TodoWrite, TaskCreate, TaskUpdate and AskUserQuestion. Only gate the main agent, never subagents.

**4. Fill the checklist from what Claude already does**
- **On `turn.start`:** a real prompt (not a slash command) sent while nothing is running starts a new job. Show placeholder steps right away ("Understand your request", "Plan the steps") until the real plan arrives. In the background, ask Haiku with low effort for a 2 to 6 word name that starts with a verb, and swap it into the header. Ignore the answer if a newer job has started.
- **TodoWrite, TaskCreate and TaskUpdate:** turn these into checklist rows.
- **Permission prompts and questions** (`classic.Notification`, AskUserQuestion): switch to **Needs you**. Clear it once the next tool runs or I reply.
- **Failures:** if I said no to a permission, show "Stuck: you said no to a step, so Claude paused". After 3 failed tool calls in a row, show "Stuck: a step keeps failing, Claude is trying another way". A success clears the Stuck state.
- **On `turn.complete`:**
  - An API error becomes one calm sentence. Rate limits: "you hit your usage limit, try again a little later". Overloaded: "Claude's servers are busy, try again in a minute". Context too long: "type /compact and try again". Network: "the internet connection dropped". Auth: "type /login".
  - A refusal becomes "Claude couldn't help with that request".
  - Esc becomes Stopped.
  - If steps are left unfinished, show Needs you with "Claude is waiting for your reply".
  - Otherwise show All done and collapse it after 5 seconds.

**5. Hide the technical rows**
While Clean View is on, render `ToolUse`, `ToolResult` and `ToolGroup` as hidden, and blank out the `ToolProgress` hint. Claude's normal written replies stay visible.

**6. Turn it on and off**
- Use the button described above, plus a `/simple on|off` command. With no argument, the command flips the setting.
- Keep the setting in plugin state and save it with `$.store` so it survives restarts.
- Clean View starts on.
- When it's off, every hidden row comes back, the rest of the band renders as normal and only the button stays.

## Details that matter

- **Plain names, always.** Every name passes through one cleaner. It strips backtick code, anything with a slash and file names with a code extension, collapses whitespace and capitalises the first letter. Names longer than 40 characters are trimmed at a word boundary and get "…". If nothing is left, use "Working on it".
- **Animation.** A 250ms clock advances a frame counter only while a job is working or waiting on me. No timers run while idle.
- **Narrow terminals.** Size the name column from `bodyColumns` so rows never wrap. The meter is always 10 cells.
- **Surveys.** If the band is showing a survey (`hasSurvey`), stay out of the way.
- **Shared state.** Keep state under the plugin's own key, typed in `types/index.d.ts`, so future mods can read the checklist: `cleanViewEnabled`, `checklist` (title, phase, tasks of `{ id, name, status: done|active|upcoming, percent, hasReported }`, needsYouReason, stuckReason, startedAt, finishedAt, isCollapsed) and `tick`.
- **Structure.** Use one `register.tsx` that calls `registerCleanView(on)` from `clean-view.tsx`, so more mods can be added next to it later.

## Tests (run with `claude plugin test`)

1. A name like "Build the pricing section in \`src/Pricing.tsx\`" cleans up to "Build the pricing section in". A path disappears from the middle of a sentence. An 80-character name trims to 40 or less.
2. A to-do list plus a 60% report renders ✓ / ▶ 60% / Next / Up next rows, on both the terminal and desktop surfaces.
3. A permission prompt shows **Needs you**.
4. `/simple off` hides the band.
5. `plan_steps` followed by `report_progress` at 100 checks off step one and starts step two.
6. Any tool is denied before a plan exists and allowed after.

## Done means

- I send any request, and the plan appears within a second or two, with no tool rows showing.
- The meter moves as the work happens. When the job finishes I see "✓ All done · took …", and 5 seconds later it shrinks to one line.
- A permission prompt turns the header into **Needs you** right away.
- One click on the button shows every hidden row again. The choice is remembered after a restart.
- All the tests pass.

When you're done, tell me in plain English how to turn it on, how to turn it off and how to install it on another computer.


---


Before you start: read this entire prompt yourself and make sure you understand it. Then, before you do anything else, tell me in plain language what this prompt is going to do, every file you will create, overwrite or delete, every script you will run on my machine, and anything that costs money or is hard to undo. Ask me to confirm I have read and understood it, and wait for my yes before you begin.

Build me a Claude Code mod. Use your plugin-authoring skill and follow it exactly: read the types it points you to before you write anything, put the mod in its own folder, and write at least one test. Do not ask me questions. Make sensible choices and list them for me at the end.

WHAT TO BUILD: PROMPT UPGRADE
A mod that turns a rough prompt into a great one before it is sent. It opens a pane, asks up to three quick multiple-choice questions, rewrites the prompt, and shows the original and the upgrade side by side. Nothing runs until I press Run.

HOW IT STARTS
- `/better <my rough prompt>` upgrades that prompt. `/better` alone opens a box to type one. `/better on` and `/better off` flip the automatic mode. `/better history` shows my last 20 upgrades.
- When automatic mode is on, a prompt I type in the prompt box goes to the pane first instead of being sent.
- Let these go straight through untouched: slash commands, prompts with files or images attached, messages sent while Claude is working, short replies like "yes" or "keep going", and anything starting with ">" (strip the ">" before sending).
- The upgraded prompt is sent by the mod, so make sure it can never loop back into the pane.
- If the pane cannot open because the window is too narrow, put my words back in the prompt box and say so in one line.

THE FOUR STEPS, SHOWN AS A TRACKER ACROSS THE TOP
Your prompt, Questions, Rewrite, Review. Finished steps get a green check, the current one is gold, the rest are muted.

1. Reading. Show my prompt in a framed card with a line that says what is happening.
2. Questions. Ask a fast model for up to three multiple-choice questions that would most improve the result, each with two to four short options. Draw each question with a gold number badge that becomes a green check when answered. Options are chips. Add an "Other (type it)" chip and a quiet "Skip". Show how many are answered and a "Skip the rest, upgrade now" button. If no question would help, go straight to the rewrite.
3. Rewrite. Ask the model for the upgraded prompt and a short list of what it added.
4. Review. One line of numbers at the top (words before, words after, how many details were added). Then the buttons: Run it, Edit, Copy, Cancel. Then a "what I added" list. Then two cards side by side, my prompt on the left and the upgrade on the right with a gold outline. Keep the buttons above the cards so a long rewrite never pushes them off screen.

RULES FOR THE REWRITE
- Keep exactly what I meant. Add a clear goal, who it is for, the format, and what "done" looks like.
- Use what I answered. Leave out what I skipped.
- Never invent facts, names, numbers or prices. Where something is unknown, leave a [placeholder] in square brackets.
- Write it as one request I could have typed myself, in plain language.

OTHER BEHAVIOR
- Cancel closes the pane and puts my original prompt back in the prompt box so nothing is lost.
- Edit lets me change the upgraded text, and Enter runs it.
- If a model call fails, show a calm error card that says my prompt is safe, with Try again, Send my original, and Cancel.
- Keep the last 20 upgrades. Clicking one in the history reopens its review.
- If the mod is reloaded mid-step, pick the step back up instead of leaving the pane stuck.

TESTS TO WRITE
Which prompts are intercepted and which pass through, reading the questions, reading the rewrite, the full flow from /better to Run, Cancel restoring the prompt, and the on and off switch.

THE LOOK
Dark, calm and premium. No emoji, nothing that blinks, nothing blurry.
- Title in bold capitals on the left. Under it, a short gold rule (#F2C46D) the width of the title that continues as a dim hairline (#262B33) to the edge.
- Section headings in small muted capitals (#7D8590) followed by a hairline.
- Main text in #E6EDF3. Good news in green (#3DD68C). Warnings in amber (#E3B341).
- The main button on a screen is a gold chip with dark bold text. Other buttons are slate chips (#262B33) with light text. Cancel is plain muted text.
- Big numbers are drawn three rows tall with heavy box-drawing characters, inside rounded tiles.
- Size every row to the width of the pane so nothing wraps. Check it at a narrow width and a wide one.

RULES THAT SAVE YOU TIME
- A draw must not save or change anything. Read while drawing. Change state only from a button press, a command or another event.
- A slash command must answer right away. If it opens a pane, return the text first and open the pane in the background.
- Never name a variable h in a .tsx file. It breaks drawing and the pane comes up blank.
- Keep saved data in the mod's own store. Do not write files inside the mod's folder.
- No pop-ups for routine actions. Only tell me something when it needs me.
- Wrap every command in a catch so a failure returns a plain sentence instead of nothing.

BEFORE YOU SAY IT IS DONE
Run `claude plugin validate` and `claude plugin test` on the mod and fix everything they report. Then tell me, in plain words: how to turn it on, the commands it adds, the choices you made for me, and anything you could not verify.

---


Before you start: read this entire prompt yourself and make sure you understand it. Then, before you do anything else, tell me in plain language what this prompt is going to do, every file you will create, overwrite or delete, every script you will run on my machine, and anything that costs money or is hard to undo. Ask me to confirm I have read and understood it, and wait for my yes before you begin.

Build me a Claude Code mod. Use your plugin-authoring skill and follow it exactly: read the types it points you to before you write anything, put the mod in its own folder, and write at least one test. Do not ask me questions. Make sensible choices and list them for me at the end.

WHAT TO BUILD: WORK REPORT
A pane that shows what Claude has done for me: how many tasks it finished, an estimate of the hours that saved me, and what that time is worth. It has four tabs: Today, Week, Month and Year.

WHAT TO RECORD
- Count one task each time a prompt I typed finishes with an answer. Do not count helper agents, tool steps, cancelled turns or slash commands. One typed request is one task.
- Sort each task into one kind by the tools it used: Emails (any mail tool), Images and video (image or video tools, or image and video files), Documents (document, slide or spreadsheet tools, or writing a document file), Research (web search, page reading, transcripts), and Other.
- Record which model did it.
- Save one small record per calendar day in the mod's store: the count of each kind and the count per model.

THE ESTIMATE
- Minutes saved per task: Emails 10, Documents 30, Images and video 20, Research 25, Other 10.
- Hourly rate: 50.
- `/report settings` lists these. `/report settings rate 75` and `/report settings emails 15` change them.
- Always label hours and dollars as an estimate.

THE PANE
- Four tabs across the top as chips: Today, Week, Month, Year. The chosen one is gold with dark text. Clicking a tab redraws everything for that stretch.
  - Today: today only.
  - Week: the last 7 days.
  - Month: the last 30 days.
  - Year: the current calendar year, January 1 through today.
- Title bar with the stretch on the left and its dates on the right.
- Three tiles with big numerals: hours saved, tasks done, and dollars' worth. If a number is too wide for big numerals, show it as plain bold text in the tile.
- "Where the time went": one row per kind with a colored bar, the count and the hours.
- "Who did the work": one row per model with a bar and the count.
- A chart three rows tall. Today and Week show the last seven days by weekday. Month shows thirty daily bars. Year shows January through December, with the current month in gold and future months empty.
- One summary line under the chart: the streak of days in a row for Today and Week, and the best day or month plus the number of active days for Month and Year.
- A clean empty state: "Nothing finished yet today. Your first finished task shows up here."
- Fewer tiles when the pane is narrow: three, then two, then one.

HOW IT OPENS
- `/report` opens the pane. Also add one status bar button that opens it.
- Step through days at local noon so the dates stay right when the clocks change.

TESTS TO WRITE
Sorting a task by its tools, counting only typed prompts, the streak, adding days together, the day of the year, each tab drawing its own title and chart, the empty state, and a narrow width.

THE LOOK
Dark, calm and premium. No emoji, nothing that blinks, nothing blurry.
- Title in bold capitals on the left. Under it, a short gold rule (#F2C46D) the width of the title that continues as a dim hairline (#262B33) to the edge.
- Section headings in small muted capitals (#7D8590) followed by a hairline.
- Main text in #E6EDF3. Good news in green (#3DD68C). Warnings in amber (#E3B341).
- The main button on a screen is a gold chip with dark bold text. Other buttons are slate chips (#262B33) with light text. Cancel is plain muted text.
- Big numbers are drawn three rows tall with heavy box-drawing characters, inside rounded tiles.
- Size every row to the width of the pane so nothing wraps. Check it at a narrow width and a wide one.

RULES THAT SAVE YOU TIME
- A draw must not save or change anything. Read while drawing. Change state only from a button press, a command or another event.
- A slash command must answer right away. If it opens a pane, return the text first and open the pane in the background.
- Never name a variable h in a .tsx file. It breaks drawing and the pane comes up blank.
- Keep saved data in the mod's own store. Do not write files inside the mod's folder.
- No pop-ups for routine actions. Only tell me something when it needs me.
- Wrap every command in a catch so a failure returns a plain sentence instead of nothing.

BEFORE YOU SAY IT IS DONE
Run `claude plugin validate` and `claude plugin test` on the mod and fix everything they report. Then tell me, in plain words: how to turn it on, the commands it adds, the choices you made for me, and anything you could not verify.


---

claude plugin validate and claude plugin test both pass clean (20/20 tests). Here's the summary.

The mod: /Users/arog/.claude/dev-mods/d2c4b2a9-5e6e-43aa-a6df-95ca2e0e1dbe/work-report/ — manifest, hooks module, state contract, pure logic (hooks/lib.ts), and tests (hooks/lib.test.ts, 20 passing).

Turning it on: writing files into this session's dev-mods folder should have raised a one-time "Enable hot reloading for this session?" prompt in your editor (I can't see or answer it myself — it's outside my transcript). Click "Enable for this session" there and it loads right away, no restart. If you don't see it, tell me and I'll touch the file again to re-raise it, or you can run claude --plugin-dir "/Users/arog/.claude/dev-mods/d2c4b2a9-5e6e-43aa-a6df-95ca2e0e1dbe/work-report" in a terminal.

Commands it adds: /report (opens the pane), /report settings (lists the rate and the minutes-per-task assumptions), /report settings rate 75, /report settings emails 15 (and likewise for documents/images/research/other). Also a "Work Report" button in the band above the prompt (hotkey w).

Choices I made for you:

When a task touched tools of more than one kind, it's sorted Emails > Documents > Images/video > Research > Other (first match wins).
Classification is by keyword in the tool's name (mail/gmail → Emails; doc/pdf/sheet/notion → Documents; image/video → Images; websearch/browser/research → Research), falling back to the file extension of any file it touched, else Other. Can't be perfect for every possible MCP tool name you might install later.
"A prompt I typed" = your own Enter (terminal or the Remote Control bridge), starting a fresh turn, not starting with "/". Notifications, peers, schedules, and other plugins' own prompts never count.
Days are kept by local calendar date, stepped at local noon, so a clock change can't shift a task into the wrong day.
The hours/dollars estimate always uses today's settings — changing the rate or a kind's minutes reshapes every day's estimate, past included, rather than freezing old days to whatever the settings were then.
"Fewer tiles when narrow" reflows the three tiles into 2 then 1 per row; it never hides a number.
The four tab chips can't get a literal gold background in this component API (a Button only has variant: primary/secondary, no custom colors) — the selected tab uses variant="primary" instead of the literal gold-chip/dark-text styling you described.
The chart is hand-drawn with block characters (Box/Text), not the Raster element the plugin skill recommends for sparklines — Raster only exists on the terminal surface in this build, and this session is running inside the VS Code extension, which doesn't have it. This keeps the chart identical everywhere at the cost of true pixel resolution.
Month's 30-bar chart can get clipped, not resampled, in a very narrow pane.
Couldn't verify: no local tsc was available in this sandbox (would have needed a network fetch I didn't make), so I relied on claude plugin validate, which does its own full type resolution and reported back every hook/call/state read and write correctly — strong evidence, but not identical to a tsc -p run. Also whether the dev-mods folder is meant to be permanent or just a hot-reload scratch space for this session isn't stated anywhere I could find — if you want it surviving future sessions untouched, worth asking separately before relying on it long-term.


---
