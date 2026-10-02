// Plan doc checker: every required section present, no unfilled [placeholders], at least one concrete acceptance criterion.
// Used by `axon-plan-check` (run by understand / plan-feature, and by their Stop hook).
export const REQUIRED_SECTIONS = ['1. UNDERSTAND', '2. ROOT CAUSE', '3. WHERE', '4. HOW', '5. ACCEPTANCE CRITERIA',
  '6. TEST BEFORE', '7. TEST AFTER', '8. IMPACT', '9. PLATFORM CONTEXT', '10. TRACKER', '11. FILE CHANGE SUMMARY'];

function section(text, name) {
  const start = text.indexOf(`## ${name}`);
  if (start < 0) return null;
  const rest = text.slice(start + name.length + 3);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

export function checkPlan(text) {
  const problems = [];
  for (const s of REQUIRED_SECTIONS) if (section(text, s) === null) problems.push(`Missing section: ## ${s}`);
  const placeholders = [...new Set((text.match(/\[[^\]\n]+\](?!\()/g) ?? []))].filter(p => !/^\[[ xX]\]$/.test(p));
  if (placeholders.length) problems.push(`Unfilled placeholder(s): ${placeholders.slice(0, 5).join(', ')}${placeholders.length > 5 ? ' ...' : ''}`);
  const ac = section(text, '5. ACCEPTANCE CRITERIA') ?? '';
  const bullets = ac.split('\n').filter(l => /^\s*[-*]\s+\S/.test(l) || /^\s*\d+\.\s+\S/.test(l));
  if (!bullets.length) problems.push('Acceptance criteria: add at least one concrete, observable criterion (a bullet with input and expected output)');
  return { ok: problems.length === 0, problems };
}
