#!/usr/bin/env node
/**
 * static-scan-rules.js — shared static-scan findings (Checks 1-6)
 *
 * Extracted from ar-review-post-write.js (Gap 3, 2026-07-23) so the exact
 * same detection logic can be reused by two hooks instead of duplicated:
 *   - ar-review-pre-write.js  (PreToolUse)  — hard-blocks on CRITICAL/HIGH
 *   - ar-review-post-write.js (PostToolUse) — reports ALL severities, never blocks
 *
 * Pure function: no I/O, no session state, no process.exit. Given file
 * content + path, returns an array of findings. Behavior is byte-for-byte
 * identical to the original inline checks in ar-review-post-write.js.
 */

function scanFindings(src, filePath) {
  const lines = src.split("\n");
  const findings = [];

  // ── Check 1: Empty catch blocks ─────────────────────────────────────────
  lines.forEach((line, i) => {
    if (
      /catch\s*\([^)]*\)\s*\{\s*\}/.test(line) ||
      /catch\s*\{\s*\}/.test(line)
    ) {
      findings.push({
        severity: "HIGH",
        line: i + 1,
        code: line.trim(),
        issue: "Empty catch block — error silently swallowed",
        fix: "Log the error or re-throw. At minimum: catch (err) { this._output?.appendLine(`[Error] ${String(err)}`); }",
      });
    }
  });

  // ── Check 2: Unsafe TypeScript casts ────────────────────────────────────
  lines.forEach((line, i) => {
    if (
      /as\s+any\b/.test(line) &&
      !/\/\/.*as\s+any/.test(line) &&
      !/eslint-disable/.test(lines[i - 1] || "")
    ) {
      findings.push({
        severity: "HIGH",
        line: i + 1,
        code: line.trim(),
        issue: "`as any` cast — bypasses type safety",
        fix: "Use `unknown` and narrow with a type guard, or use the actual type.",
      });
    }
    if (
      /as\s+unknown\s+as/.test(line) &&
      !/\/\/.*as\s+unknown\s+as/.test(line)
    ) {
      findings.push({
        severity: "MEDIUM",
        line: i + 1,
        code: line.trim(),
        issue: "`as unknown as X` double cast — forced type erasure",
        fix: "Define a proper typed interface and use it instead of casting.",
      });
    }
  });

  // ── Check 3: User input in shell spawn ──────────────────────────────────
  // Look for spawn('sh', ['-c', variable]) where variable might be user-supplied
  lines.forEach((line, i) => {
    if (
      /spawn\s*\(\s*['"]sh['"]\s*,\s*\[.*['"]-c['"].*,/.test(line) ||
      /spawn\s*\(.*shell:\s*true/.test(line)
    ) {
      // Check if adjacent lines use canonical, msg.*, or user-supplied input
      const context = lines.slice(Math.max(0, i - 3), i + 3).join(" ");
      if (/canonical|msg\.|this\._canonical|this\._domain/.test(context)) {
        findings.push({
          severity: "CRITICAL",
          line: i + 1,
          code: line.trim(),
          issue:
            "User-controlled input may flow into shell command (injection risk)",
          fix: "Validate canonical format: /^[a-zA-Z][a-zA-Z0-9]*\\.[a-zA-Z][a-zA-Z0-9]*$/ before use. Or pass as array arg to spawn() with shell:false.",
        });
      }
    }
  });

  // ── Check 4: innerHTML with unescaped variable ──────────────────────────
  lines.forEach((line, i) => {
    // innerHTML assignment with a variable (not a literal string)
    if (
      /\.innerHTML\s*=\s*[^'"`]/.test(line) ||
      /\.innerHTML\s*\+=/.test(line)
    ) {
      // Check if escapeHtml is NOT wrapping the value
      if (!/escapeHtml/.test(line) && !/textContent/.test(line)) {
        // Check if the RHS contains a variable from external data
        // Exclude: canonicals array (controlled internal data, noun.verb format only)
        const rhs = line.split("innerHTML")[1] || "";
        if (
          /msg\.|ev\.|r\.|result\.|data\./.test(rhs) &&
          !/canonicals/.test(rhs)
        ) {
          findings.push({
            severity: "HIGH",
            line: i + 1,
            code: line.trim().slice(0, 100),
            issue: "Unescaped user/server data in innerHTML — potential XSS",
            fix: "Wrap server data in escapeHtml() before injecting into innerHTML.",
          });
        }
      }
    }
  });

  // ── Check 5: postMessage on possibly-undefined view ────────────────────
  lines.forEach((line, i) => {
    // this._view.webview.postMessage without optional chaining
    if (
      /this\._view\.webview\.postMessage/.test(line) &&
      !/this\._view\?\.webview/.test(line)
    ) {
      findings.push({
        severity: "MEDIUM",
        line: i + 1,
        code: line.trim(),
        issue:
          "`this._view.webview.postMessage` without optional chaining — crashes if panel not open",
        fix: "Use `this._view?.webview.postMessage(...)` (optional chaining).",
      });
    }
  });

  // ── Check 6: Hardcoded 'hr' domain fallback ─────────────────────────────
  lines.forEach((line, i) => {
    if (/\|\|\s*['"]hr['"]\s*/.test(line) || /\?\?\s*['"]hr['"]\s*/.test(line)) {
      // Skip if it's in a comment or test
      if (!/\/\//.test(line.split("||")[0])) {
        findings.push({
          severity: "MEDIUM",
          line: i + 1,
          code: line.trim(),
          issue:
            "Hardcoded 'hr' fallback domain — wrong domain for non-HR canonicals",
          fix: "Use this._effectiveDomain() or inferDomain(canonical.split('.')[0]) instead.",
        });
      }
    }
  });

  return findings;
}

module.exports = { scanFindings };
