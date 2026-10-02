# Usage Guide

## Claude Code

Install the skill into your project:

```bash
mkdir -p .claude/skills/simple-code-mentor
cp SKILL.md .claude/skills/simple-code-mentor/SKILL.md
```

Use it:

```text
/simple-code-mentor Explain this file in simple visual flow
```

## Copilot Studio

Open Copilot Studio and create a blank skill.

Use:

- Name: `simple-code-mentor`
- Description: copy from `copilot-studio/COPILOT_STUDIO_SKILL.md`
- Instructions: copy the full instruction section

## GitHub Copilot

Copy `github-copilot/copilot-instructions.md` into your project instruction location or adapt it into your existing Copilot custom instructions.

## In normal chat

Say:

```text
Use simple-code-mentor style and explain this code.
```

## Best prompt

```text
Use simple-code-mentor style.
Explain this file in simple English with colored Mermaid YES/NO flows, pseudo code, and UI/UX mental model.
Keep it short and beginner friendly.
```
