// Compares out/answers.json (written by main.ts) with the kit's expected.json, deep-equal per case.

import { readFileSync } from 'node:fs';

const KIT = '/workspace/makefun/kits/csv-reader-speed-01-run-20261121/csv-reader-speed-01-run-20261121-kit';
const ANSWERS = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
const EXPECTED = `${KIT}/practice/reference/expected.json`;

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
const expected = JSON.parse(readFileSync(EXPECTED, 'utf8'));
const answers = JSON.parse(readFileSync(`${ANSWERS}/answers.json`, 'utf8'));

// expected.cases is keyed by index; index it by id so the comparison does not depend on key order.
const wanted = new Map();
for (const key of Object.keys(expected.cases)) {
  const entry = expected.cases[key];
  wanted.set(entry.id, entry.output);
}

if (answers.length !== cases.length) {
  console.error(`answer count ${answers.length} != case count ${cases.length}`);
  process.exit(1);
}

let bad = 0;
for (let i = 0; i < cases.length; i++) {
  const want = wanted.get(cases[i].id);
  if (!deepEqual(answers[i], want)) {
    bad++;
    console.error(`MISMATCH ${cases[i].id}`);
    console.error(`  want: ${JSON.stringify(want).slice(0, 300)}`);
    console.error(`  got : ${JSON.stringify(answers[i]).slice(0, 300)}`);
  }
}
if (bad > 0) {
  console.error(`${bad} mismatching case(s)`);
  process.exit(1);
}
console.log(`VERIFY OK: ${cases.length} cases match expected.json`)
