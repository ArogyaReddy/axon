# VS Code Terminal Appearance Settings

This document records the settings responsible for the terminal shown in the attached screenshot.

## Copyable settings

Add these entries to the office laptop's VS Code user `settings.json`. Keep the existing JSON comments if the file uses JSON with Comments, as VS Code does.

```jsonc
{
  "workbench.colorTheme": "Monokai",
  "window.autoDetectColorScheme": false,
  "terminal.integrated.profiles.osx": {
    "zsh": {
      "path": "/bin/zsh",
      "args": ["-l"]
    },
    "zsh (Homebrew)": {
      "path": "/opt/homebrew/bin/zsh",
      "args": ["-l"]
    },
    "bash": {
      "path": "/bin/bash",
      "args": ["-l"]
    }
  },
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.shellIntegration.enabled": true,
  "terminal.integrated.shellIntegration.decorationsEnabled": "both",
  "terminal.integrated.fontFamily": "'MesloLGS NF', 'Menlo', 'Monaco', monospace",
  "terminal.integrated.fontWeight": "normal",
  "terminal.integrated.lineHeight": 1.2,
  "terminal.integrated.cursorBlinking": true,
  "terminal.integrated.cursorStyle": "line",
  "terminal.integrated.cursorWidth": 2,
  "terminal.integrated.cursorStyleInactive": "outline",
  "terminal.integrated.tabs.enabled": true,
  "terminal.integrated.tabs.location": "right",
  "terminal.integrated.tabs.showActions": "singleTerminal",
  "terminal.integrated.tabs.showActiveTerminal": "singleTerminalOrNarrow",
  "terminal.integrated.splitCwd": "workspaceRoot",
  "terminal.integrated.gpuAcceleration": "on",
  "terminal.integrated.smoothScrolling": true,
  "terminal.integrated.scrollback": 10000,
  "terminal.integrated.persistentSessionScrollback": 100,
  "terminal.integrated.minimumContrastRatio": 4.5,
  "terminal.integrated.enableVisualBell": false,
  "accessibility.signals.terminalBell": {
    "sound": "off"
  },
  "workbench.colorCustomizations": {
    "terminal.background": "#1E1E1E",
    "terminal.foreground": "#D4D4D4",
    "terminalCursor.background": "#D4D4D4",
    "terminalCursor.foreground": "#D4D4D4",
    "terminal.ansiBlack": "#1E1E1E",
    "terminal.ansiBlue": "#569CD6",
    "terminal.ansiBrightBlack": "#666666",
    "terminal.ansiBrightBlue": "#569CD6",
    "terminal.ansiBrightCyan": "#4EC9B0",
    "terminal.ansiBrightGreen": "#B5CEA8",
    "terminal.ansiBrightMagenta": "#C586C0",
    "terminal.ansiBrightRed": "#F48771",
    "terminal.ansiBrightWhite": "#E5E5E5",
    "terminal.ansiBrightYellow": "#DCB67A",
    "terminal.ansiCyan": "#4EC9B0",
    "terminal.ansiGreen": "#608B4E",
    "terminal.ansiMagenta": "#C586C0",
    "terminal.ansiRed": "#D16969",
    "terminal.ansiWhite": "#D4D4D4",
    "terminal.ansiYellow": "#D7BA7D"
  }
}
```

## What controls what

| Appearance | Responsible setting | Effect |
| --- | --- | --- |
| Dark terminal background | `terminal.background` | Sets the terminal background to `#1E1E1E`. |
| Text color | `terminal.foreground` | Sets normal terminal text to light gray. |
| Command colors | `terminal.ansi*` entries | Controls the 16 ANSI colors used by shell output and prompts. |
| Font and prompt symbols | `terminal.integrated.fontFamily` | Uses MesloLGS NF first, which supports Powerline-style glyphs. |
| Text spacing | `terminal.integrated.lineHeight` | Sets line height to `1.2`. |
| Cursor | `terminal.integrated.cursor*` entries | Makes the active cursor a blinking 2px line. |
| Terminal tab strip | `terminal.integrated.tabs.location` | Places terminal tabs on the right side of the terminal panel. |
| Shell and prompt | `terminal.integrated.defaultProfile.osx` and zsh profile | Starts a login zsh shell. The prompt design itself comes from zsh dotfiles, not VS Code. |
| Shell decorations | `terminal.integrated.shellIntegration.*` | Adds command decorations and shell-aware behavior. |
| Surrounding VS Code layout | `workbench.sideBar.location`, `window.density.layout`, `workbench.activityBar.compact` | Moves the main sidebar right and makes the workbench compact. These are outside the terminal. |

## Important prerequisites

1. Install `MesloLGS NF` on the office Mac before opening a new terminal. This Mac has a copy at `~/Downloads/misc-files/MesloLGS NF Regular.ttf`; double-click it and choose **Install Font**, or install the complete Meslo Nerd Font family if the prompt uses additional weights.
2. Install or copy the same zsh prompt configuration if the prompt text, arrows, branch display, or icons need to match exactly. Check `~/.zshrc`, Oh My Zsh, Powerlevel10k, Starship, or another prompt framework on this Mac.
3. Restart existing VS Code terminals after changing the profile or font. Existing terminal processes do not always pick up profile changes.
4. `workbench.colorTheme` is set to `Monokai`, and both preferred fallback themes are now also set to `Monokai`. Automatic color-scheme switching is disabled so the selection stays consistent.

## Settings that affect layout but not terminal colors

These additional user settings are visible in the current configuration:

```jsonc
{
  "workbench.sideBar.location": "right",
  "window.density.layout": "compact",
  "workbench.activityBar.compact": true,
  "editor.minimap.enabled": false
}
```

The screenshot's terminal panel position itself is not explicitly fixed by the current settings. VS Code remembers the panel's last position and size, so use the panel controls to place it at the bottom if needed.

Source: `/Users/arog/Library/Application Support/Code/User/settings.json` on October 1, 2026.

## Why the earlier terminal-only change was not visible

The original configuration styled only `terminal.*` colors. That made the integrated terminal look right, but it left the editor, tabs, sidebar, panel, activity bar, title bar, and status bar under the active workbench theme.

The live settings also had `window.autoDetectColorScheme: true` with `Cobalt2` as both preferred themes. That allowed automatic theme selection to keep the surrounding workbench in the older Cobalt2 appearance even though `workbench.colorTheme` said `Monokai`. The workspace `.vscode/settings.json` was checked and does not override these colors.

The fix is to disable automatic theme switching and explicitly apply the terminal palette to the workbench. After changing these settings, run **Developer: Reload Window** from the Command Palette, or fully restart VS Code.

## Full workbench appearance override

These entries are now active in the live user settings. They extend the terminal palette to the rest of VS Code:

```jsonc
{
  "window.autoDetectColorScheme": false,
  "workbench.colorTheme": "Monokai",
  "workbench.preferredDarkColorTheme": "Monokai",
  "workbench.preferredLightColorTheme": "Monokai",
  "workbench.colorCustomizations": {
    "editor.background": "#1E1E1E",
    "editor.foreground": "#D4D4D4",
    "editorLineNumber.foreground": "#666666",
    "editorLineNumber.activeForeground": "#D4D4D4",
    "sideBar.background": "#1E1E1E",
    "sideBar.foreground": "#D4D4D4",
    "sideBar.border": "#333333",
    "panel.background": "#1E1E1E",
    "panel.border": "#333333",
    "titleBar.activeBackground": "#1E1E1E",
    "titleBar.activeForeground": "#D4D4D4",
    "activityBar.background": "#1E1E1E",
    "activityBar.foreground": "#D4D4D4",
    "activityBar.inactiveForeground": "#666666",
    "statusBar.background": "#1E1E1E",
    "statusBar.foreground": "#D4D4D4",
    "editorGroupHeader.tabsBackground": "#1E1E1E",
    "tab.activeBackground": "#1E1E1E",
    "tab.activeForeground": "#D4D4D4",
    "tab.inactiveBackground": "#181818",
    "tab.inactiveForeground": "#888888",
    "input.background": "#252526",
    "dropdown.background": "#252526",
    "list.background": "#1E1E1E",
    "list.hoverBackground": "#2A2D2E",
    "list.activeSelectionBackground": "#37373D",
    "focusBorder": "#569CD6"
  }
}
```

## Applied update and current backup

The documented appearance settings are now applied to the live VS Code user settings. The updates were:

```jsonc
"window.autoDetectColorScheme": false,
"editor.fontFamily": "'MesloLGS NF', 'Menlo', 'Monaco', monospace"
```

The workbench color customization was also expanded from terminal-only colors to the full editor and layout palette. The existing `Monokai` theme, terminal palette, zsh profile, right-side sidebar, compact density, and right-side terminal tabs were preserved.

A pre-change backup was created at:

- `docs/backups/vscode-user-state-2026-10-01/settings.json`
- `docs/backups/vscode-user-state-2026-10-01/keybindings.json`

To restore the pre-change settings manually, close VS Code first, then copy the backup `settings.json` back to the VS Code user settings location. The backup is the original file from before `editor.fontFamily` was added.

## Step-by-step: reproduce this look on another Mac

Use this section when setting up another VS Code installation or another VS Code extension environment. The previous sections describe the settings; this section gives the order in which to apply them.

### 1. Install the required font

The terminal is configured to use `MesloLGS NF` first. A font name in `settings.json` is not enough; the font must exist on the operating system.

1. Copy the Meslo font file to the other Mac, or download the same Meslo Nerd Font family from a trusted source.
2. Open the `.ttf` file in Font Book.
3. Select **Install Font**.
4. Quit and reopen VS Code after installation.

If the font is unavailable, VS Code falls back to `Menlo`, then `Monaco`, then `monospace`. The terminal will still work, but Powerline or Nerd Font symbols may appear as boxes or look different.

### 2. Sign in and use Settings Sync

Settings Sync is the easiest way to carry the VS Code configuration to another computer.

1. Open the Command Palette with `Cmd+Shift+P`.
2. Run **Settings Sync: Turn On**.
3. Sign in with the same account used on the other computer.
4. Enable synchronization for **Settings**, **Keyboard Shortcuts**, **Extensions**, and **UI State** when prompted.
5. On the other Mac, install VS Code, sign in with the same account, and turn on Settings Sync.
6. Restart VS Code after synchronization completes.

Settings Sync can transfer the VS Code settings, theme, extensions, keybindings, and some UI state. It does not install operating-system fonts, copy shell dotfiles, or guarantee the same saved panel size on every machine.

### 3. Apply the settings manually when Sync is not available

Open the Command Palette, run **Preferences: Open User Settings (JSON)**, and merge the copyable settings from the first section into the other Mac's existing file. Do not replace the whole file if it already contains work-specific settings.

For the surrounding VS Code layout, also add or confirm:

```jsonc
{
  "workbench.colorTheme": "Monokai",
  "workbench.iconTheme": "vscode-icons",
  "workbench.sideBar.location": "right",
  "window.density.layout": "compact",
  "workbench.activityBar.compact": true,
  "editor.minimap.enabled": false,
  "editor.fontFamily": "'MesloLGS NF', 'Menlo', 'Monaco', monospace"
}
```

The editor font and terminal font are separate settings. `editor.fontFamily` changes code and text editors; `terminal.integrated.fontFamily` changes the integrated terminal. VS Code does not provide a normal setting that changes every workbench UI label to the terminal font.

### 4. Match the layout by hand

After the settings load, use these commands and controls once:

1. Run **View: Toggle Primary Side Bar Position** until the sidebar is on the right.
2. Open the terminal with ``Ctrl+` `` or **View > Terminal**.
3. Use the terminal panel's layout controls to keep the terminal at the bottom.
4. Confirm that the terminal tab strip is on the right. This comes from `terminal.integrated.tabs.location`.
5. Resize the terminal panel to the desired height. VS Code remembers this as UI state, but it can differ between displays.
6. If the activity bar looks too large, confirm `workbench.activityBar.compact` is `true`.
7. If the editor overview strip is unwanted, confirm `editor.minimap.enabled` is `false`.

### 5. Match the shell prompt and representation

The prompt text, arrow shape, Git branch display, icons, and prompt colors are usually produced by zsh configuration, not by VS Code. To reproduce those details:

1. Compare the two machines' `~/.zshrc` files.
2. Copy the same prompt framework and configuration, such as Oh My Zsh, Powerlevel10k, Starship, or a custom prompt.
3. Copy any referenced theme files, aliases, functions, and environment setup.
4. Open a new VS Code terminal and run `echo $SHELL` to confirm that it is using zsh.
5. Run `echo $TERM_PROGRAM` to confirm that the shell is running inside VS Code.
6. Close and reopen the terminal after changing shell files.

Do not copy secrets from shell files. Review tokens, private keys, host-specific paths, and work credentials before transferring any dotfile.

### 6. Check the result

In the new VS Code installation, verify each item:

- **Theme:** the active theme is `Monokai`.
- **Editor font:** code text uses `MesloLGS NF` or the intended fallback.
- **Terminal font:** terminal text uses `MesloLGS NF`, with prompt symbols rendered correctly.
- **Colors:** the terminal background is near-black and normal text is light gray; ANSI colors match the palette in `workbench.colorCustomizations`.
- **Layout:** the sidebar is on the right, the workbench density is compact, and terminal tabs are on the right side of the terminal panel.
- **Prompt:** the zsh prompt shows the same symbols, spacing, and Git information.

If the colors match but the prompt symbols do not, check the installed font and zsh configuration. If the terminal matches but the editor does not, check `editor.fontFamily` separately. If the colors change after selecting another theme, confirm that the terminal colors remain present under `workbench.colorCustomizations` and that no workspace-level `.vscode/settings.json` overrides the user settings.