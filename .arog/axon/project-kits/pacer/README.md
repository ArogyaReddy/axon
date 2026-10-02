# PACER project kit

Installed with `axon install --project <path to pacer> --kit pacer`. Existing files are never overwritten; the command
lists what it skipped.

| File | Purpose |
|---|---|
| `.axon/config.json` | `axon-verify` runs the local CI gate (`bash runner/scripts/ci-check.sh`, the same checks as GitHub Actions and Jenkinsfile.smoke); reminder to restart `server.py` |
| `.claude/rules/flows.md` | flow YAML is the assertion model: never edited to hide an engine bug; Plotter and the validator |
| `.claude/rules/e2e.md` | `{ exact: true }` in e2e specs; what vitest and e2e each cover |
| `.claude/rules/python.md` | `shell=False` + allowlist, nothing at the repo root, one terminal command at a time during live runs, live tests ask first |
| `.claude/rules/data.md` | Data Bridge and Arize: read-only, ClientID-scoped, active rows, gate, retry once |
| `.claude/settings.local.json` | your local permissions (not committed): live runs, sweeps, destructive API flags and integration tests ask first; validators and unit tests are allowed |

Rules load only when Claude works on matching files, so they cost nothing otherwise.

The repo's CLAUDE.md still has an `AR-VERIFY-FIX` block pointing at the legacy AROG gate (`.arog/bin/ar-start` ...).
With axon, `tdd` / `go-until-done` / `verify` and the axon-guard hooks do that job; removing the block is your call.

Built from the repo's CLAUDE.md on 2026-10-01; not yet run against a real checkout (work Mac).
