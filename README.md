# csv-sprint — faster broken-CSV reader

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/yunnaysy/csv-reader-sprint/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/yunnaysy/csv-reader-sprint/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Built for make.fun's bounty: https://make.fun/bounty/csv-reader-speed-01-run-20261121

An entry for the make.fun bounty **"Read broken CSV files faster, 21 November 2026"**.
`solve.js` is a dependency-free ES module exporting `run({text, header})`, which returns
exactly what make.fun's reference `csv-reader` 1.0.0 returns: `{columns, rows, errors}`.
It is written from the published specification, not from the reference implementation.

`main.ts` (the kit driver, kept unchanged apart from its header comment) imports `run`,
answers every case in `/input/cases.json`, and writes `/output/answers.json`. Node 22, one
CPU, no dependencies, nothing cached between cases. All test material is read from the kit
directory outside this repo; none of it is copied here (the repo stays well under 1 MiB).

## Semantics implemented

- A leading U+FEFF is dropped.
- Records end at LF or CRLF; empty lines are no records. Outside quotes a CR not followed by LF
  is dropped with a `stray_cr` error.
- Quoted fields expand doubled quotes to one quote, turn each CRLF/lone CR inside them into LF,
  and append post-quote junk verbatim with a `quote_junk` error. An unmatched opening quote is a
  literal character and the rest of the text is re-read as unquoted (`unterminated_quote`).
- Rows are padded (`short_row`, with `fields`) or cut (`long_row`, with `extra`) to the first
  record's width. Error objects are `{code, line, row[, fields|extra]}` in encounter order, with
  `line` counting every LF, CRLF and in-quote lone CR, and `row` the row index (`null` for the header).

## Optimisation

The hot loop was tuned in several measured rounds, re-running `tools/check.mjs` after each change:

1. Replaced the reference's per-character string building with `slice()` substrings, `indexOf`
   scans, a preallocated width-sized row array and a preallocated extras list; added a fast path
   for runs of unquoted fields.
2. Tried a single sticky-regex field scanner (`/[^,\r\n]*/y`); correct but slower than a native
   scan because of the per-field match allocation.
3. Settled on a hand-rolled `charCodeAt` scan for unquoted fields (stopping at `,`, LF or CR),
   with `indexOf('"')` jumps for quoted fields and slices as the only per-field allocation. This
   removed the pathological full-text `indexOf('\r')` scan on LF-only inputs and was ~1.4x faster
   than the regex version. Also measured (and rejected) `Array.fill` preallocation and V8 flag
   tuning; neither improved timings beyond noise.

## Tools

From the repo root:

- `node tools/check.mjs [fuzzRounds]` — deep-equal comparison of `solve.js` against the reference
  on all 6 practice cases, 62 hand-written tricky inputs (empty/BOM text, unterminated and doubled
  quotes, junk after closing quotes, stray CRs, CRLF/lone CR in quotes, blank lines, header true/
  false, short/long rows, single column, trailing comma, no final newline, lone quote, ...) and
  random fuzz strings over `[a, b, comma, quote, LF, CR, U+FEFF, space]`. Default 20 000 rounds;
  `node tools/check.mjs 100000` was used for the final sign-off — all 100 068 comparisons pass.
- `node tools/bench.mjs [--rounds=N]` — times `run()` on the six practice cases with
  `process.cpuUsage()` in independent child processes under `--no-incremental-marking`, reporting
  the per-case median, total and speed-up versus the reference (default 7 rounds).
- Full driver and answer check:
  ```
  mkdir -p out
  MAKEFUN_INPUT_DIR=/workspace/makefun/kits/csv-reader-speed-01-run-20261121/csv-reader-speed-01-run-20261121-kit/practice/input \
  MAKEFUN_OUTPUT_DIR=out node main.ts
  node tools/verify.mjs
  ```
  `tools/verify.mjs` deep-compares `out/answers.json` with the kit's `expected.json` and prints
  `VERIFY OK: 6 cases match expected.json`.

## Measured speed-up

`run()` on the six practice cases (median of 11 rounds per case, `--no-incremental-marking`,
CPU time in microseconds):

| case    | solve.js | reference | speed-up |
|---------|----------|-----------|----------|
| g-0001  | ~8.1 ms  | ~83 ms    | ~10.3x   |
| g-0002  | ~8.6 ms  | ~76 ms    | ~8.8x    |
| g-0003  | ~5.1 ms  | ~69 ms    | ~13.6x   |
| g-0004  | ~6.0 ms  | ~76 ms    | ~12.7x   |
| g-0005  | ~6.4 ms  | ~64 ms    | ~10.1x   |
| g-0006  | ~5.0 ms  | ~56 ms    | ~11.2x   |
| **TOTAL** | **~39 ms** | **~424 ms** | **~10.9x** |

Across three runs the total varied between ~38 and ~41 ms for `solve.js` and ~400–452 ms for the
reference, i.e. a stable **10–11x speed-up** on `run()` (well beyond the 95% confidence bar).
End-to-end through `main.ts` (including the fixed 11 MB JSON input parse and 12 MB answer
serialisation, paid by both entries) the wall/CPU time is roughly 0.4 s versus 0.6 s, about a
**2–3x overall speed-up**.
