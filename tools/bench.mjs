// CPU-time benchmark for solve.js and the reference csv-reader on the practice cases.
// Run directly (prints both) or with --impl=solve|ref to print one JSON result (used by the parent).

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setFlagsFromString } from 'node:v8';

const KIT = '/workspace/makefun/kits/csv-reader-speed-01-run-20261121/csv-reader-speed-01-run-20261121-kit';
const PRACTICE = `${KIT}/practice/input/cases.json`;
const REFERENCE = `${KIT}/baselines/csv-reader/vendor/csv-reader/index.js`;

const args = process.argv.slice(2);
const implArg = args.find((a) => a.startsWith('--impl='));
const roundsArg = args.find((a) => a.startsWith('--rounds='));
const impl = implArg ? implArg.slice(7) : null;
const rounds = roundsArg ? Number(roundsArg.slice(9)) : 7;

setFlagsFromString('--no-incremental-marking');

const { run } = await import(new URL('../solve.js', import.meta.url).href);
const { readCsv } = await import(pathToFileURL(REFERENCE).href);
const fn = impl === 'ref' ? readCsv : run;

const cases = JSON.parse(readFileSync(PRACTICE, 'utf8'));

// Warm up both engines and the JIT on the real data.
for (const c of cases) fn(c.input);

const perCase = [];
let total = 0;
for (const c of cases) {
  const samples = [];
  for (let r = 0; r < rounds; r++) {
    const t0 = process.cpuUsage();
    fn(c.input);
    const t1 = process.cpuUsage(t0);
    samples.push(t1.user + t1.system);
  }
  samples.sort((a, b) => a - b);
  const median = samples[samples.length >> 1];
  perCase.push({ id: c.id, median_us: median });
  total += median;
}

const result = { impl: impl ?? 'solve', rounds, perCase, total_us: total };
if (impl) {
  process.stdout.write(JSON.stringify(result));
} else {
  const runChild = (name) =>
    JSON.parse(
      spawnSync(process.execPath, [new URL(import.meta.url).pathname, `--impl=${name}`, `--rounds=${rounds}`], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }).stdout,
    );
  const mine = runChild('solve');
  const ref = runChild('ref');
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`rounds per case: ${rounds} (median), --no-incremental-marking`);
  console.log(`${pad('case', 10)}${pad('solve us', 12)}${pad('reference us', 14)}${pad('speed-up', 10)}`);
  for (let i = 0; i < mine.perCase.length; i++) {
    const a = mine.perCase[i].median_us / 1000;
    const b = ref.perCase[i].median_us / 1000;
    console.log(`${pad(mine.perCase[i].id, 10)}${pad(a.toFixed(2), 12)}${pad(b.toFixed(2), 14)}${pad((b / a).toFixed(2) + 'x', 10)}`);
  }
  const a = mine.total_us / 1000;
  const b = ref.total_us / 1000;
  console.log(`${pad('TOTAL', 10)}${pad(a.toFixed(2), 12)}${pad(b.toFixed(2), 14)}${pad((b / a).toFixed(2) + 'x', 10)}`);
}
