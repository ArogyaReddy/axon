# VS Code Terminal Appearance Templates

This collection preserves the current appearance as Template 1 and provides nineteen alternatives. All twenty templates use the same terminal behavior, Meslo font fallback chain, compact workbench layout, right sidebar, right-side terminal tabs, zsh profile, and integrated shell behavior. They differ mainly in colors and visual mood.

## Templates

| Template | File | Character |
| --- | --- | --- |
| 1 | [template-1-neutral-charcoal.jsonc](../vscode-settings-templates/templates/template-1-neutral-charcoal.jsonc) | Current saved look: neutral charcoal, Monokai syntax, restrained blue accents |
| 2 | [template-2-midnight-blue.jsonc](../vscode-settings-templates/templates/template-2-midnight-blue.jsonc) | Cool midnight blue with brighter blue focus and selection accents |
| 3 | [template-3-forest-green.jsonc](../vscode-settings-templates/templates/template-3-forest-green.jsonc) | Deep forest green with calm green highlights |
| 4 | [template-4-warm-ember.jsonc](../vscode-settings-templates/templates/template-4-warm-ember.jsonc) | Dark warm brown with amber and ember-orange accents |
| 5 | [template-5-high-contrast-teal.jsonc](../vscode-settings-templates/templates/template-5-high-contrast-teal.jsonc) | Near-black charcoal with high-contrast teal focus states |
| 6 | [template-6-purple-night.jsonc](../vscode-settings-templates/templates/template-6-purple-night.jsonc) | Deep purple with violet focus accents |
| 7 | [template-7-olive-moss.jsonc](../vscode-settings-templates/templates/template-7-olive-moss.jsonc) | Muted olive with moss and lime highlights |
| 8 | [template-8-copper-dusk.jsonc](../vscode-settings-templates/templates/template-8-copper-dusk.jsonc) | Copper, bronze, and warm dusk tones |
| 9 | [template-9-arctic-cyan.jsonc](../vscode-settings-templates/templates/template-9-arctic-cyan.jsonc) | Blue-black with icy cyan highlights |
| 10 | [template-10-graphite-red.jsonc](../vscode-settings-templates/templates/template-10-graphite-red.jsonc) | Graphite with clear red focus states |
| 11 | [template-11-black-gold.jsonc](../vscode-settings-templates/templates/template-11-black-gold.jsonc) | Pure black with gold accents |
| 12 | [template-12-black-lemon.jsonc](../vscode-settings-templates/templates/template-12-black-lemon.jsonc) | Black with bright lemon-yellow accents |
| 13 | [template-13-obsidian-claw.jsonc](../vscode-settings-templates/templates/template-13-obsidian-claw.jsonc) | Obsidian black with crimson accents |
| 14 | [template-14-black-copper.jsonc](../vscode-settings-templates/templates/template-14-black-copper.jsonc) | Black with copper-orange accents |
| 15 | [template-15-deep-amber.jsonc](../vscode-settings-templates/templates/template-15-deep-amber.jsonc) | Deep black-brown with amber accents |
| 16 | [template-16-paper-light.jsonc](../vscode-settings-templates/templates/template-16-paper-light.jsonc) | Warm paper light theme with bronze accents |
| 17 | [template-17-ivory-solar.jsonc](../vscode-settings-templates/templates/template-17-ivory-solar.jsonc) | Ivory light theme with solar-gold accents |
| 18 | [template-18-arctic-light.jsonc](../vscode-settings-templates/templates/template-18-arctic-light.jsonc) | Cool arctic light theme with cyan-blue accents |
| 19 | [template-19-mint-light.jsonc](../vscode-settings-templates/templates/template-19-mint-light.jsonc) | Soft mint light theme with emerald accents |
| 20 | [template-20-rose-light.jsonc](../vscode-settings-templates/templates/template-20-rose-light.jsonc) | Pale rose light theme with berry accents |

All files and the switcher live together in [vscode-settings-templates](../vscode-settings-templates/).

## What is preserved in every template

- `MesloLGS NF`, then `Menlo`, `Monaco`, and `monospace` as font fallbacks
- The same editor and terminal font family
- zsh as the default macOS terminal profile
- Shell integration and command decorations
- Blinking line cursor with a 2px width
- Terminal tabs on the right
- Compact workbench density
- Sidebar on the right
- Compact activity bar
- Minimap disabled
- GPU acceleration, smooth scrolling, and 10,000 lines of scrollback
- Automatic light/dark theme switching disabled

The shell prompt itself still comes from `~/.zshrc`, Oh My Zsh, Powerlevel10k, Starship, or another prompt framework. These files change VS Code and terminal colors, but they do not copy shell dotfiles or credentials.

## Interactive CLI switcher

The project folder includes a shell launcher at [switch.sh](../vscode-settings-templates/switch.sh) and the Python CLI it invokes at [vscode-settings-templates](../vscode-settings-templates/vscode-settings-templates).

From the repository root, run:

```sh
./vscode-settings-templates/switch.sh
```

Or enter the folder first and use the explicit current-directory prefix:

```sh
cd vscode-settings-templates
./switch.sh
```

Do not type `vscode-settings-templates --list` by itself. zsh does not search the current directory, and from the repository root `vscode-settings-templates` is a directory rather than a command. The `./` prefix is required.

The menu shows all twenty templates and a restore option. Before every real switch, it creates a timestamped backup under `vscode-settings-templates/backups/`, updates only the documented appearance keys, and preserves unrelated settings.

Templates 11-15 are the new high-contrast dark group. Template 11 is the black-and-gold combination, Template 12 is black-and-lemon, Template 13 is the obsidian/crimson claw style, Template 14 is black-and-copper, and Template 15 is deep amber. Templates 16-20 are light workspaces: paper, ivory solar, arctic, mint, and rose.

Useful non-interactive commands:

```sh
./vscode-settings-templates/switch.sh --list
./vscode-settings-templates/switch.sh --template 2
./vscode-settings-templates/switch.sh --template 9 --dry-run
```

After applying a template, run **Developer: Reload Window** and open a new terminal. The CLI requires Python 3, which is available on this development Mac through the existing Python setup. It accepts `--settings-file` and `--backup-dir` overrides, which makes isolated testing possible without changing the live settings.

## How to switch templates manually

1. Close extra VS Code windows and save any unsaved work.
2. Open the Command Palette with `Cmd+Shift+P`.
3. Run **Preferences: Open User Settings (JSON)**.
4. Make a backup of the current `settings.json` before switching.
5. Copy the contents of one template file into the user settings, or merge its appearance entries into the existing file.
6. Do not delete unrelated project settings such as Cucumber, Copilot, Claude, or extension configuration.
7. Make sure the selected template's `workbench.colorCustomizations` replaces the previous `workbench.colorCustomizations` object. JSON cannot contain two separate objects with the same key reliably.
8. Run **Developer: Reload Window** from the Command Palette.
9. Open a new terminal so the font and terminal colors are reapplied.

A template file is a portable appearance profile, not a complete replacement for a work computer's entire settings file. Keep work-specific settings and secrets in the destination settings file.

## Applying a template with a temporary profile

For low-risk experimentation, copy a template's entries into a temporary VS Code profile instead of changing the default profile:

1. Open the Command Palette.
2. Run **Profiles: Create Profile**.
3. Create a profile named after the template, such as `Midnight Blue`.
4. Open that profile's settings JSON.
5. Paste or merge the corresponding template.
6. Switch profiles with **Profiles: Switch Profile**.

This lets you compare appearances without repeatedly editing the default settings. Settings Sync can also synchronize profiles when using the same account, but fonts still need to be installed separately on each Mac.

## Font and prompt prerequisites

Install `MesloLGS NF` in Font Book on the office laptop before using any template. Restart VS Code after installing it. Without the font, the terminal falls back to `Menlo` or `Monaco`, and Powerline or Nerd Font symbols may render differently.

To match the prompt representation, transfer the relevant non-secret parts of the shell configuration and confirm the new terminal uses zsh:

```sh
echo $SHELL
echo $TERM_PROGRAM
```

Review shell files before transferring them. Do not copy tokens, private keys, passwords, or machine-specific credentials.

## Current base and backup

The active live configuration remains the neutral-charcoal appearance represented by Template 1. The pre-change backup is preserved at [settings.json](backups/vscode-user-state-2026-10-01/settings.json), with keybindings at [keybindings.json](backups/vscode-user-state-2026-10-01/keybindings.json).

The main analysis and step-by-step explanation remain in [vscode-terminal-appearance-settings.md](vscode-terminal-appearance-settings.md). This template collection is additive and does not replace those notes.

## Recommended use

- Use Template 1 for the current balanced daily setup.
- Use Template 2 when blue focus cues and a cooler workspace are useful.
- Use Template 3 for a softer, low-glare green workspace.
- Use Template 4 when warm contrast is easier to read.
- Use Template 5 when focus borders and selection states need maximum visibility.
