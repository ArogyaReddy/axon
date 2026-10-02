# ADR-0006: Global layer - rules, status line, output style, sandbox

Date: 2026-10-01. Status: accepted. Evidence: `08-p3-acceptance.md`.

## Decisions

1. **Global rules are a user-level rules folder, not an edit to CLAUDE.md.** `axon install` links
   `~/.claude/rules/axon -> <axon>/global/rules`. User-level rules load in every project without an approval dialog
   (docs), and a symlinked rules file and directory both load on 2.1.197 (proven live with canaries, then removed).
   Your CLAUDE.md is never touched, so this works the same whether or not home-manager owns it; uninstall removes one
   link. The plan's `global/CLAUDE.md` + `rules/core.md` became one file, `global/rules/axon.md`; more rule files can be
   added to that folder without reinstalling.
2. **Rules hold facts and non-negotiables; the `lean` style holds voice and format.** Legacy content that hooks now
   enforce (test approval sentinels, bug-hunt sentinels, `/ar-verify` + `/ar-review` on every done) is stated once, as
   the axon equivalent. Not ported: STATE-SNAPSHOT.md (replaced by session-brief and handoff), the always-loaded flags
   registry (prompt-flags injects only when a flag is used), the CodeLens block (auto-managed by its extension), the
   "scaffold then Edit for files over 100 lines" rule (no evidence it saves cost). Rule 6 "no guessing" keeps its core
   (never guess a fact, `{NOT SURE}` stops the work) but asks only what the code cannot answer, per your feedback in this
   project that deciding beats asking.
3. **The one axon output style is `lean`, not `brief`.** A first A/B showed `brief` cost more than the default
   ($0.33/$0.22 vs $0.15/$0.19); the user ruled that no axon feature may cost more than plain Claude Code. Token
   breakdown: the style text is about 2% of a 24K-token prompt; cost is driven by behaviour (turns, output tokens).
   `lean` replaces the built-in coding instructions with a compact version (`keep-coding-instructions: false`,
   -749 prompt tokens per turn) and adds cost-aware behaviour: prove edge cases in the test being written, batch tool
   calls, no throwaway scripts, no recap. Measured on the POC task (hidden tests), 3 runs each, warm cache, alternating:
   lean $0.267 avg (0.264-0.269) vs default $0.278 (0.249-0.298), both 7/7 hidden tests, lean -11% output tokens,
   56 s vs 66 s, half the reply length, 0 em dashes vs 4. The 4% saving is within noise; lean is not costlier and is
   more consistent. A first run of this A/B was invalid (ISS-0031). Watch item: the dropped built-in instructions also
   cover habits the hidden tests do not exercise (commit protocol); `git-push` covers commits.
4. **Status line drop order puts cost last** among droppable segments (ISS-0030): lines, style, worktree, PR, rate,
   flags, cost. One line, never two. `refreshInterval: 30` keeps git and AWS expiry fresh while idle.
5. **No keybindings file.** The useful actions already have defaults (Ctrl+G external editor, Ctrl+J newline, Ctrl+S
   stash); without a binding you asked for, a file adds upkeep only.
6. **Personal profile: sandbox on with the default escape hatch.** Live: tests and git work; `~/.ssh` read, writes
   outside the project and network are blocked. Strict mode (`allowUnsandboxedCommands: false`) would block npm install
   and push too, so leaving the sandbox stays possible but always asks you. `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips
   cloud credentials from subprocesses. Work profile: no sandbox until tried on the work Mac (aws, e-cli, make).

## Still open

- H-Q1 (plugin hooks vs workspace trust): needs a real terminal. Check at install: open `claude` in a new folder,
  accept trust, and ask "what did the session brief say?".
- The status line shows only in the terminal; the VS Code extension does not render custom status lines `{NOT SURE}`.
