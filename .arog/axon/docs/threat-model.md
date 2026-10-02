# axon threat model

What axon protects against, how, and what it does not cover. Each mitigation names the file or setting that
implements it. Reviewed 2026-10-01 against the installed setup (P9).

## Boundaries

- **Hard boundary:** Claude Code permissions (`permissions.deny`, `ask`) and, on the personal profile, the OS sandbox
  for shell commands. These hold even if a hook has a bug.
- **Soft boundary:** axon's hooks (`axon-guard`). They catch mistakes and explain why, but they are regular programs:
  a hook bug fails open (allows, logs to `~/.axon/logs/`), by design, so a broken guard never blocks all work.
- **Out of scope:** a compromised machine, a malicious Claude Code binary, a hostile user.

## Threats and mitigations

| Threat | Example | Mitigation | Where |
|---|---|---|---|
| Destructive commands | `git reset --hard`, `git push --force`, `rm -rf ~`, `sudo`, a PROD AWS profile | deny rules, plus `guard-bash` for variants deny rules miss; `git commit`/`push`, `aws`, `npm install` ask first | `global/settings/base.json`, `plugins/axon-guard/lib/rules.mjs` |
| Writing secrets or generated files | Agent edits `.env`, `*.pem`, `CHANGELOG.md`, lock files | `guard-files`; deny rules for CHANGELOG.md | `rules.mjs` `fileVerdict` |
| Reading credentials | `cat ~/.aws/credentials`, `~/.ssh`, `~/.axon/secrets` | `Read` deny rules; sandbox `denyRead` (personal) | `base.json`, `profiles/personal.json` |
| Secrets in the shell environment | A command prints tokens from env | `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` (personal) | `profiles/personal.json` |
| Bypass mode | `claude --dangerously-skip-permissions` | `disableBypassPermissionsMode: "disable"`; `axon doctor` flags unsafe settings | `base.json`, `installer/doctor.mjs` |
| Prompt injection | A web page, ticket, PR or MCP result tells the agent to run commands or leak data | external text is data (global rules); permissions and sandbox hold regardless; hook context never copies repository text (ISS-0029); QA agent limited to `Bash(playwright-cli *)` | `global/rules/axon.md`, `session-start.mjs`, `axon-qa` |
| Skipping the process | "Done" without tests; editing a test to make it pass | `tdd-gate`, `test-lock` (unlock asks you), `stop-gate` | `plugins/axon-guard` |
| Supply chain | `@playwright/cli` 0.x or markmap changing under you | exact pins in `config/tools.json`, installed into `~/.axon/tools`, `axon doctor` reports drift; plugins installed from the local checkout only | `config/tools.json`, `installer/plugins.mjs` |
| Unreviewed axon changes reaching sessions | Claude Code loads axon in place from the checkout, so any edit there (even uncommitted) runs in the next session, hooks included | develop axon on a branch or worktree; in other projects the sandbox blocks writes to the checkout and file edits outside the project ask first | ADR-0010 |
| Repository-supplied config in scripted runs | A cloned repo's `.claude/settings.json` hooks run under `claude -p` | axon's nested calls (`axon-council`, `axon-qa`) load the settings of the repo you run them in: review an untrusted repo's `.claude/` first, and use `claude --bare` for your own scripted runs on it | ADR-0007 |
| Logs and transcripts holding secrets | Tokens in commands, prompts | decision log and event log redact tokens, keys, passwords and emails; the event log never stores prompt text; `cleanupPeriodDays: 30` | `plugins/axon-guard/lib/log.mjs`, `plugins/axon-observe/lib/events.mjs` |
| Copilot running axon hooks | A hook error in Copilot denies every tool call (Copilot fails closed) | the adapter always exits 0 with valid JSON | `copilot/hook.mjs` (ADR-0009) |
| Model and data policy | Client data sent to an unapproved provider | no external APIs; Bedrock only on the work profile | `profiles/work.json` |

## Sandbox (personal profile)

Shell commands run under macOS Seatbelt. Writable: the working folder, temp, and axon's own
folders `~/.axon/{docs,state,logs,events,cache}`. Never writable, whatever the settings: Claude Code's own configuration in
`~/.claude`. Unreadable: `~/.aws/credentials`, `~/.ssh`, `~/.axon/secrets`, `.env` files, keys. Local servers on
127.0.0.1 are allowed (test suites). `playwright-cli` and `axon-qa` run outside the sandbox because Chrome cannot start
under Seatbelt; permission rules still apply to them (ISS-0039).

## Known gaps

- Regex guards can be bypassed by obfuscation; the deny rules and sandbox are the backstop.
- The work profile has no sandbox until it is tried on the work Mac (P6 checklist).
- `excludedCommands` entries run unsandboxed: keep the list to axon's pinned tools.
- Your dotfiles alias `cc` uses `--dangerously-skip-permissions`; with axon installed it is refused (ISS-0020 open:
  your decision).
