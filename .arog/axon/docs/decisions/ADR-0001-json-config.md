# ADR-0001: Config files are JSON, not YAML

- Status: accepted (P0, 2026-09-30)
- Context: the plan named `config/axon.config.yaml` and `~/.axon/local.yaml`. axon is zero-dependency Node, and Node has no
  built-in YAML parser. A homemade YAML parser is a source of subtle bugs; a YAML library adds a dependency to every install.
- Decision: every axon config file is JSON (`config/axon.config.json`, `~/.axon/local.json`, `<repo>/.axon/config.json`),
  parsed with `JSON.parse`, validated by tests.
- Consequences: no comments inside config files (documentation lives next to them); same format as Claude Code's own settings,
  so one mental model and one validator.
