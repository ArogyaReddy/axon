# Simple Code Mentor Skill Pack

This pack gives you a reusable beginner-friendly code explanation style.

It is designed for:

- Claude Code skills
- Copilot Studio skill instructions
- GitHub Copilot custom instructions
- Manual copy/paste prompting in any AI assistant

## What it does

It explains code using:

- Simple English
- Small chunks
- Colored Mermaid diagrams
- YES/NO paths
- Pseudo code
- UI/UX screen-flow mental models
- Tiny checkpoint summaries

## Files

- `claude/.claude/skills/simple-code-mentor/SKILL.md`  
  Claude Code skill file.

- `copilot-studio/COPILOT_STUDIO_SKILL.md`  
  Copy/paste instructions for Microsoft Copilot Studio custom skill.

- `github-copilot/copilot-instructions.md`  
  Project-level GitHub Copilot custom instruction style.

- `templates/`  
  Reusable explanation templates.

- `references/`  
  Usage guide and Mermaid notes.

## Claude Code install

From your project root:

```bash
mkdir -p .claude/skills/simple-code-mentor
cp path/to/SKILL.md .claude/skills/simple-code-mentor/SKILL.md
```

Then use:

```text
/simple-code-mentor Explain internal/gate/gate.go
```

## In this Copilot chat

There is no real slash command here.

Say:

```text
Use simple-code-mentor style and explain this file.
```
