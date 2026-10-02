---
paths: ["runner/flow/**"]
---

# Flow contracts (PACER)

- `runner/flow/*.yaml` is PACER's assertion model and the source of truth for PlayWell. When a real FIT run disagrees,
  decide whether the YAML (wrong assertion) or the engine (a bug) is wrong, and say which with the evidence. Never
  edit YAML to hide a real engine bug.
- Author and repair with Plotter (`pacer_plotter.py`); validate with `python yaml_validator.py <flow>` and check
  runnable scenarios with `python testdata_loader.py --check`.
