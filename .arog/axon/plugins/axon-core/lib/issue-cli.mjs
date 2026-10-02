// The issue tracker command line, shared by `axon issue` (your terminal) and `axon-issue` (Claude's PATH, plugin bin).
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import * as issues from './issues.mjs';
import { parseArgs } from './args.mjs';

export const ISSUE_USAGE = `issue new "<title>" --severity critical|high|medium|low --type bug|regression|gap|risk|doc
      --found-in plan|implementation|review|test|production [--found-by ..] [--feature ..] [--files a,b] [--related ISS-n] [--force]
issue list [--status open|in-progress|fixed|wont-fix|duplicate|all] [--feature ..]
issue show <ID> | issue start <ID> | issue index
issue fix <ID> --verified-by "<test or evidence>" [--commit <sha>] [--files a,b]
issue close <ID> --as wont-fix|duplicate --reason "<why>"
      (every issue command accepts --dir; default: <repo>/.axon/config.json issues.dir, else ~/.axon/docs/issues/<repo>)`;

export function runIssueCli(argv, { cwd = process.cwd(), home = os.homedir(), out = console.log, err = console.error } = {}) {
  const { option, flag, positional, list } = parseArgs(argv);
  const [sub, a1] = positional;
  try {
    const dir = option('dir') ? path.resolve(cwd, option('dir')) : issues.resolveIssuesDir({ cwd, home: option('home') ?? home });
    switch (sub) {
      case 'new': {
        const r = issues.newIssue(dir, { title: a1, severity: option('severity'), type: option('type'), foundIn: option('found-in'),
          foundBy: option('found-by') ?? '', feature: option('feature') ?? '', files: list('files'), related: option('related') ?? '', force: flag('force') });
        out(`${r.id} created: ${r.file}`);
        return 0;
      }
      case 'list': {
        const rows = issues.listIssues(dir, { status: option('status') ?? 'all', feature: option('feature') });
        if (!rows.length) { out(`No issues in ${dir}`); return 0; }
        for (const i of rows) out(`${i.id}  ${i.status.padEnd(11)} ${i.severity.padEnd(8)} ${i.type.padEnd(10)} ${i.title}`);
        return 0;
      }
      case 'show': out(readFileSync(issues.readIssue(dir, a1).path, 'utf8')); return 0;
      case 'start': issues.setStatus(dir, a1, 'in-progress'); out(`${a1} in progress`); return 0;
      case 'fix': issues.fixIssue(dir, a1, { verifiedBy: option('verified-by'), commit: option('commit') ?? '', files: list('files') }); out(`${a1} fixed`); return 0;
      case 'close': issues.closeIssue(dir, a1, { as: option('as'), reason: option('reason') }); out(`${a1} closed as ${option('as')}`); return 0;
      case 'index': issues.writeIndex(dir); out(`Index written: ${path.join(dir, 'INDEX.md')}`); return 0;
      default: out(ISSUE_USAGE); return 1;
    }
  } catch (e) {
    err(`axon: ${e.message}`);
    return 1;
  }
}
