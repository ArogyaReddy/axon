---
paths: ["runner/**/*.py", "scripts/**"]
---

# Python engine (PACER)

- `subprocess` with `shell=False` and a regex allowlist for any user input (the `playwell_plotter.py` pattern).
- Never add a file at the repo root: scripts go in `scripts/`, documents in `docs/`, code in its domain folder.
- Never start a second terminal command while a live PACER run or `npm run flow` is running (it can SIGINT the run).
- Offline checks: `cd runner && python -m pytest tests/unit/ -q`. Integration tests are live (FIT and Arize, about 14
  minutes) and API sweeps touch FIT: say so and wait for a yes.
- `skills/` and `agents/` in this repo are the shipped product, not instructions for working on the repo.
