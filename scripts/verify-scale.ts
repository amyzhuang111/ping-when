// 2,000-row performance + correctness check on a FICTIONAL fixture (scripts/fixtures/scale-2000.csv).
import { readFileSync } from "node:fs";
import { DEFAULT_WEIGHTS } from "../src/lib/constants";
import { parseImport, rankedQueueCsv } from "../src/lib/exchange";
import { compareRows, scoreResearchers } from "../src/lib/scoring";

let failed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) { failed++; console.error(`FAIL  ${message}`); process.exitCode = 1; }
  else console.log(`ok    ${message}`);
}
const asOf = new Date(Date.UTC(2026, 9, 19));
const text = readFileSync("scripts/fixtures/scale-2000.csv", "utf8");
const t0 = performance.now();
const parsed = parseImport(text, "scale-2000.csv");
const rows = scoreResearchers(parsed.people, DEFAULT_WEIGHTS, asOf);
const ms = performance.now() - t0;
console.log(`parse+score 2000 rows: ${ms.toFixed(0)} ms`);
assert(parsed.errors.length === 0, "scale: 0 import errors");
assert(parsed.people.length === 1900, "scale: 1,900 scored");
assert(parsed.unscored.length === 100, "scale: 100 need a start date");
assert(new Set(rows.map((r) => r.person.name)).size === 1900, "scale: no duplicates or drops among scored");
assert(rows.every((r, i) => r.rank === i + 1), "scale: ranks are 1..1900 contiguous");
assert(rows.every((r, i) => i === 0 || compareRows(rows[i - 1], r) <= 0), "scale: rows in compareRows order");
assert(rows.every((r) => Number.isFinite(r.score) && r.score >= 0 && r.score <= 100), "scale: every score finite in 0..100");
assert(ms < 3000, `scale: parse+score under 3000 ms (${ms.toFixed(0)} ms)`);
// Determinism: reversed row order yields the identical ranking.
const [head, ...body] = text.trim().split("\n");
const rev = scoreResearchers(parseImport([head, ...body.reverse()].join("\n"), "rev.csv").people, DEFAULT_WEIGHTS, asOf);
assert(rev.map((r) => r.person.name).join("|") === rows.map((r) => r.person.name).join("|"), "scale: order independent of input row order");
const out = rankedQueueCsv(rows, parsed.unscored).trim().split("\n");
assert(out.length === 2001, "scale: ranked export has 2,000 rows + header");
assert(!/https?:\/\//.test(out.join("\n")), "scale: fictional rows carry no source links");
console.log(failed ? `${failed} scale checks failed` : "scale checks passed");
