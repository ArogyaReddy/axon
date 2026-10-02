---
id: ISS-0002
title: Plugin output style needs the plugin prefix; outputStyle brief would be silently ignored
status: fixed
severity: high
type: bug
feature: p0-installer
found: 2026-10-01
found_in: test
found_by: P0 spike S2 on Claude Code 2.1.197
files: global/settings/base.json
fixed: 2026-10-01
fix_commit: 
verified_by: ADR-0003 spike S2; tests/install.test.mjs outputStyle assertions
related: 
---

# ISS-0002: Plugin output style needs the plugin prefix; outputStyle brief would be silently ignored

## What happened

The plan set `outputStyle: brief`. Claude Code silently falls back to the Default style when the name does not resolve.

## How it was found

Spike S2: `--settings '{"outputStyle":"spike-style"}'` produced no marker; `spike:spike-style` produced it.

## Root cause

Plugin output styles are namespaced by plugin name; the docs did not state it and the plan assumed the plain name.

## Impact

High: the whole output-style decision would have had no effect, with no error.

## Fix

`global/settings/base.json` uses `axon-learn:brief`. Plan section 11 and ADR-0003 updated.

## Verification

Install tests assert `outputStyle === 'axon-learn:brief'`; spike S2 evidence in ADR-0003.

## Lessons

Settings that fail silently need a marker test; the marker-style technique from P0 is reusable for any settings key.
