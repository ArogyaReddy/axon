---
name: wh-explainer
description: Explains technical issues, architecture, reviews, and plans using explicit WH-questions (WHAT, WHERE, WHY, HOW, HOW DO WE KNOW), Before/After flowcharts (Mermaid), and step-by-step resolutions.
---

# WH Explainer Skill

## Purpose
Use this skill when explaining any complex technical system, codebase review, bug audit, gap analysis, or architectural plan. It enforces a strict, structured **WH-Framework** so every issue is crystal clear and actionable.

---

## The WH-Framework Structure

Every item, feature, or issue MUST be structured using these 7 standard sections:

### 1. WHAT is it?
- A clear, 1-to-2 sentence plain English definition of the concept, component, or issue.

### 2. WHERE is it located?
- Exact file paths, line numbers, function names, API endpoints, environment names, or repository paths.

### 3. WHY is it important / WHY is it an issue?
- Business impact, technical risk, performance penalty, or security risk of this item.

### 4. HOW do we know? (Evidence & Detection)
- Empirical proof: log lines, error messages, finding IDs (e.g. FX-03), test failures, status codes, or Arize trace evidence.

### 5. BEFORE the fix (Current State)
- **Text Explanation**: What happens right now if left unaddressed.
- **Mermaid Flowchart**: Visual diagram showing the broken or inefficient workflow.

### 6. AFTER the fix (Target State)
- **Text Explanation**: What happens once the resolution is applied.
- **Mermaid Flowchart**: Visual diagram showing the optimized, working workflow.

### 7. HOW & WHERE to fix it (Step-by-step Solution)
- Exact file changes, diffs, configuration edits, terminal commands, or code refactors required to resolve the item.

---

## Formatting Rules

1. **Never skip WH questions**: Every section must explicitly include `WHAT`, `WHERE`, `WHY`, `HOW DO WE KNOW`, `BEFORE`, `AFTER`, and `HOW TO FIX`.
2. **Use Colored Mermaid Diagrams**: Always use `flowchart TD` or `flowchart LR` with clear color coding for action, decision, success, and error nodes.
3. **No Speculation**: Cite real file paths, code symbols, and empirical trace output.
