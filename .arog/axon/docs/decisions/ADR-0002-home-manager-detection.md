# ADR-0002: Detect home-manager by every symlink hop, and write through symlinks

- Status: accepted (P0, 2026-09-30)
- Context: on this Mac `~/.claude/settings.json` is a two-hop link:
  `~/.claude/settings.json -> /nix/store/...-home-manager-files/.claude/settings.json -> ~/dotfiles/dotfiles/home/.claude/settings.json`
  (a home-manager out-of-store symlink). The first detector checked only the final target, which is outside `/nix/store`, so it
  reported "writable". A real install would have replaced the home-manager symlink with a plain file. Found by running
  `axon doctor` on the real machine (read-only); nothing was written.
- Decision: a file is home-manager managed if ANY hop of its symlink chain is inside the nix store. For managed files the installer
  writes nothing and prints the merged JSON plus the real source path (the dotfiles file). For any other symlinked settings file,
  writes go to the real target so the link survives.
- Evidence: tests `out-of-store home-manager link ... is detected as managed` and `a plain (non-nix) symlinked settings file is
  written through` (both failed before the fix, pass after); `axon doctor` on this Mac now reports the dotfiles source path.
