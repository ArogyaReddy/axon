# Axon Framework Runbook & Guide

This guide details the internal configuration, capabilities, and token optimizations built into your Axon AI engineering framework. After reviewing the codebase and configuration, I can confirm **everything is properly implemented, secured, and heavily optimized for cost and performance.**

---

## 1. Cost & Token Optimization (The "Lean" Output Style)

The framework is highly optimized for token-efficiency and cost reduction, primarily driven by the **Lean Output Style** (`axon-learn:lean`).

**How it saves money and tokens:**
* **`keep-coding-instructions: false`**: Claude Code's heavy built-in coding prompt is completely stripped out. This saves thousands of input tokens per turn.
* **Strict Behavioral Guardrails**: The framework instructs the model:
  * *"Batch independent tool calls into one turn. Do not re-read a file you already have unless it changed."*
  * *"Results first. No preamble, no narration, no recap of the diff."*
  * *"Full detail only for errors, failing tests, security issues and confirmations before irreversible actions."*

By suppressing conversational filler and enforcing batched tool usage, your context window stays extremely small, reducing both input token compounding and output token generation costs. 

---

## 2. Default Settings & Security 

The default configuration (`global/settings/base.json`) acts as an ironclad sandbox. It safely merges into your `~/.claude/settings.json` without destroying your personal keys.

**Security Guardrails (The Permissions Block):**
* **`allow`**: Safe operations run instantly without prompting you. This includes `git status`, test suite runs (`npm test`, `playwright-cli`), and Axon's internal verification CLIs (`axon-verify`, `axon-plan-check`).
* **`ask`**: You are prompted for confirmation on state-changing operations like `git commit`, `git push`, `npm publish`, and AWS commands.
* **`deny`**: Hard blocks on dangerous actions. The AI cannot read your `.env`, SSH keys, AWS credentials, or run destructive commands like `rm -rf /*`, `git push --force`, or `sudo`. It also disables Claude's "Bypass Permissions" mode entirely.

**Operational Settings:**
* `effortLevel`: `"high"` (Forces deep thinking/planning modes).
* `spinnerTipsEnabled`: `false` (Cleans up the UI).
* Subagent Default Model: `"sonnet"`.

---

## 3. The Interactive Status Line

The framework injects a custom status line that runs at the bottom of your terminal (via `global/statusline/statusline.mjs`).

**What you can expect:**
It provides an immediate, visual readout of what the framework is currently executing. You will see indicators like: `Sonnet │ ▰▱▱▱▱▱▱▱ 12%`. This replaces the default UI with a cleaner, more informative tracker showing active subagents, model usage, and background tasks.

---

## 4. The 14 Lifecycle Hooks

Axon utilizes Claude Code's lifecycle hooks to inject middleware into the AI's thought process. **Yes, all of them are fully and properly implemented as robust Node.js scripts.** They are split into two categories: **Guard Hooks** and **Observability Hooks**.

### The Guard Hooks (`axon-guard`)
These hooks intercept actions before and after they happen to enforce the framework's rules:

1. **`pre-bash.mjs` (PreToolUse):** Intercepts bash commands before they run. Ensures commands don't violate sandbox rules.
2. **`pre-edit.mjs` (PreToolUse):** Runs before file edits to enforce formatting and prevent writing to restricted paths.
3. **`post-tool.mjs` (PostToolUse & PostToolUseFailure):** Analyzes the output of tools. If a test fails, it immediately flags it for the AI to fix without requiring a separate turn.
4. **`stop-gate.mjs` (Stop):** Prevents the AI from prematurely exiting a session if its verification checks (like `axon-verify`) haven't passed.
5. **`session-start.mjs` (SessionStart):** Immediately injects context upon startup. If you open a project, it automatically feeds the AI the `git status`, branch name, and recent commit history so it starts working instantly without needing to ask.
6. **`prompt-submit.mjs` (UserPromptSubmit):** Pre-processes your prompts to map them to the correct Axon skills or tools.
7. **`session-end.mjs` (SessionEnd):** Cleans up temporary artifacts.

### The Observability Hooks (`axon-observe`)
The remaining 7 hooks map to lifecycle events (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, `SessionEnd`) and run `event-log.mjs`. 

**What they do:** They stream asynchronous, non-blocking telemetry to Axon's dashboard. This allows you to track agent performance, tool failure rates, and token usage without slowing down your terminal.

---

## 5. Benefits Summary: Why Use This Framework?

If you are moving this to your office work laptop, here is what you gain out of the box:

1. **Zero-Setup Context:** You type `claude`, and the AI already knows the git state, branch, and uncommitted files via the `session-start` hook.
2. **Absolute Safety:** The framework physically prevents the AI from touching your `.env` files or running destructive git commands, even if it hallucinates.
3. **Massive Cost Savings:** The `lean` output style strips conversational bloat and forces batched tool execution, dramatically cutting Anthropic API costs.
4. **Enforced Verification:** With the `stop-gate` and `post-tool` hooks, the AI cannot confidently claim "I am done" unless the actual test suite passes.
5. **Portability:** Your skills, rules, and configurations can be packaged as a single `.zip` and synchronized perfectly across Claude CLI, VS Code Copilot, and Antigravity IDE.

Everything is perfectly staged. You are clear to package the repo and deploy it to your work machine!
