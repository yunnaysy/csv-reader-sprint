// Correctness harness: runs solve.js and the reference csv-reader on the practice cases, on a table of
// tricky inputs and on randomized fuzz strings, and reports the first deep-equality mismatch.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const KIT = '/workspace/makefun/kits/csv-reader-speed-01-run-20261121/csv-reader-speed-01-run-20261121-kit';
const PRACTICE = `${KIT}/practice/input/cases.json`;
const REFERENCE = `${KIT}/baselines/csv-reader/vendor/csv-reader/index.js`;

const { run } = await import(new URL('../solve.js', import.meta.url).href);
const { readCsv } = await import(pathToFileURL(REFERENCE).href);

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

function show(x, limit = 400) {
  let s;
  try {
    s = JSON.stringify(x);
  } catch {
    s = String(x);
  }
  return s.length > limit ? `${s.slice(0, limit)}...(${s.length})` : s;
}

let checked = 0;

function compare(name, input) {
  checked++;
  const got = run(input);
  const want = readCsv(input);
  if (!deepEqual(got, want)) {
    console.log(`MISMATCH ${name}`);
    console.log(`  input: ${show(input)}`);
    console.log(`  want : ${show(want)}`);
    console.log(`  got  : ${show(got)}`);
    process.exit(1);
  }
}

// --- practice cases ---
const cases = JSON.parse(readFileSync(PRACTICE, 'utf8'));
for (const c of cases) compare(`practice ${c.id}`, c.input);
console.log(`practice cases: ${cases.length} ok`);

// --- tricky table ---
const tricky = [
  ['empty', { text: '', header: true }],
  ['empty no header', { text: '', header: false }],
  ['bom only', { text: '\uFEFF', header: true }],
  ['bom only no header', { text: '\uFEFF', header: false }],
  ['bom then text', { text: '\uFEFFa,b\r\nc,d\r\n', header: true }],
  ['bom mid', { text: 'a,\uFEFFb\r\n', header: false }],
  ['just lf', { text: '\n', header: true }],
  ['just crlf', { text: '\r\n', header: true }],
  ['just cr', { text: '\r', header: true }],
  ['cr cr', { text: '\r\r', header: false }],
  ['cr cr lf', { text: '\r\r\n', header: false }],
  ['a cr', { text: 'a\r', header: false }],
  ['a cr b', { text: 'a\rb', header: false }],
  ['a crlf b', { text: 'a\r\nb', header: false }],
  ['lone quote', { text: '"', header: false }],
  ['lone quote nl', { text: '"\n', header: false }],
  ['lone quote comma', { text: '"a,b\n', header: false }],
  ['open quote eof', { text: 'a,"b', header: false }],
  ['open quote eof header', { text: 'a,"b', header: true }],
  ['open quote nl', { text: 'a,"b\nc', header: false }],
  ['open quote cr', { text: 'a,"b\rc', header: false }],
  ['open quote crlf', { text: 'a,"b\r\nc', header: false }],
  ['closed empty', { text: '""\n', header: false }],
  ['closed empty header', { text: '""\n', header: true }],
  ['two quotes', { text: '""""\n', header: false }],
  ['three quotes', { text: '"""\n', header: false }],
  ['junk after close', { text: '"a"b,c\n', header: false }],
  ['junk after close eof', { text: '"a"b', header: false }],
  ['junk cr after close', { text: '"a"\rb\n', header: false }],
  ['junk crlf after close', { text: '"a"\r\n', header: false }],
  ['junk comma after close', { text: '"a",b\n', header: false }],
  ['quote in unquoted', { text: 'a"b,c\n', header: false }],
  ['quote after text', { text: 'ab"cd\n', header: false }],
  ['crlf in quotes', { text: '"a\r\nb",c\r\n', header: false }],
  ['cr in quotes', { text: '"a\rb",c\r\n', header: false }],
  ['lf in quotes', { text: '"a\nb",c\r\n', header: false }],
  ['crlf in quotes header', { text: '"a\r\nb",c\r\n1,2\r\n', header: true }],
  ['dbl in quotes', { text: '"a""b",c\r\n', header: false }],
  ['dbl at end', { text: '"a""",c\r\n', header: false }],
  ['dbl at start', { text: '"""a",c\r\n', header: false }],
  ['dbl only', { text: '"""""",c\r\n', header: false }],
  ['short row', { text: 'a,b,c\n1,2\n', header: true }],
  ['long row', { text: 'a,b\n1,2,3\n', header: true }],
  ['single col', { text: 'a\nb\nc\n', header: false }],
  ['trailing comma', { text: 'a,b,\n', header: false }],
  ['trailing comma header', { text: 'a,b,\n1,2,3\n', header: true }],
  ['last no newline', { text: 'a,b\nc,d', header: false }],
  ['blank lines', { text: '\n\n\na\n\n', header: false }],
  ['blank crlf lines', { text: '\r\n\r\na\r\n', header: false }],
  ['header true one row', { text: 'a,b\r\n', header: true }],
  ['header false one row', { text: 'a,b\r\n', header: false }],
  ['empty fields', { text: ',\r\n,\r\n', header: false }],
  ['only commas', { text: ',,\n', header: false }],
  ['cr in middle of unquoted', { text: 'a\rb\rc,d\n', header: false }],
  ['quote then cr', { text: '"a\r', header: false }],
  ['quote then crlf', { text: '"a\r\n', header: false }],
  ['unterminated with comma', { text: ',"a,b\nc,d\n', header: false }],
  ['unterminated with quote', { text: ',"a""b\nc\n', header: false }],
  ['header unterminated', { text: '"a,b\nc,d\n', header: true }],
  ['long row first', { text: 'a,b,c\n1,2\n', header: false }],
  ['short row first', { text: 'a\n1,2,3\n', header: false }],
  ['errors order', { text: 'a\rb,"c"d,e\n', header: false }],
];

for (const [name, input] of tricky) compare(`tricky ${name}`, input);
console.log(`tricky cases: ${tricky.length} ok`);

// --- fuzz ---
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const alphabet = ['a', 'b', ',', '"', '\n', '\r', '\uFEFF', ' ', 'c'];
const rng = makeRng(0x5eed1234);
const fuzzRounds = Number(process.argv[2] ?? 20000);
for (let i = 0; i < fuzzRounds; i++) {
  const n = Math.floor(rng() * 60);
  let text = '';
  for (let j = 0; j < n; j++) text += alphabet[Math.floor(rng() * alphabet.length)];
  const header = rng() < 0.5;
  compare(`fuzz #${i}`, { text, header });
  if (i > 0 && i % 5000 === 0) console.log(`fuzz ${i}/${fuzzRounds} ok`);
}

console.log(`ALL OK (${checked} comparisons)`);
