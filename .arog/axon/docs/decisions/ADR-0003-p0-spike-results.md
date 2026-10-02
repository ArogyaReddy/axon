# ADR-0003: P0 spike results on Claude Code 2.1.197

- Status: accepted (P0, 2026-09-30)
- Method: a throwaway plugin loaded per session with `--plugin-dir` (nothing installed), headless `claude -p --model sonnet`,
  user settings excluded (`--setting-sources project`). A settings key counts as accepted when a marker output style in the same
  `--settings` JSON still applies; an invalid key makes Claude Code skip the whole settings file, which removes the marker.
  Total cost of all spikes: about $0.95.

| # | Question | Result | Consequence for axon |
|---|---|---|---|
| S1 | Can a plugin skill be typed by its short name? | Yes. `/hello` and `/spike:hello` both ran the skill | Skills can be typed short (`/understand`) when unique; docs use the full name |
| S2 | How is a plugin output style named in `outputStyle`? | Only with the plugin prefix: `spike:spike-style` applied, `spike-style` silently fell back to Default | `outputStyle: "axon-learn:brief"` (a plain `brief` would have silently done nothing) |
| S3 | Do plugin hooks run and block in headless runs? | Yes. SessionStart wrote its marker; PreToolUse exit 2 blocked the command and the model reported the hook's reason | Guard hooks work as designed in `-p` and CI runs |
| S4a | `attribution.sessionUrl` on 2.1.197? | Accepted | May be used |
| S4b | `statusLine.refreshInterval` on 2.1.197? | Accepted | May be used |
| S4c | `attribution: false` on 2.1.197? | Rejected: the whole settings file was skipped | Keep `{"commit": "", "pr": ""}`; never emit `false` below 2.1.281 |
| S5 | Does `Bash(node *)` allow `FOO=1 node --version`? | No (denied) | ADP test commands need an explicit rule |
| S5b | Does `Bash(FOO=* node *)` allow it? | Yes | Rule added: `Bash(TEST_BUSINESS_DOMAIN=* npx jest *)` |
| S5c | Does a leading wildcard `Bash(* node *)` work? | Yes | Leading wildcards are valid, so the deny rule `Bash(* --profile PROD*)` is valid. Not used for allow rules (too broad) |

Still open after P0 (not testable here):
- Whether interactive workspace trust gates plugin hooks (`-p` skips the trust dialog). Checked in P2 with a live session.
- `--bare` with `--plugin-dir`: `--bare` reads only `ANTHROPIC_API_KEY`/`apiKeyHelper` or Bedrock credentials, not OAuth, so it
  cannot run on this Mac's OAuth login. Checked in CI setup (P5).
- Sandbox trial: moved to P3, where the personal profile actually enables the sandbox.
