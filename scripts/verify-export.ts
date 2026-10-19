import { readFileSync } from "node:fs";
import { DEFAULT_WEIGHTS } from "../src/lib/constants";
import { parseImport, rankedQueueCsv } from "../src/lib/exchange";
import { compareRows, scoreResearchers } from "../src/lib/scoring";

let failed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
  } else console.log(`ok    ${message}`);
}

const asOf = new Date(Date.UTC(2026, 9, 19));
const roster = parseImport(readFileSync("scripts/fixtures/export-fixture.csv", "utf8"), "demo.csv");
assert(roster.errors.length === 0, "export fixture: 0 import errors");
assert(roster.people.length === 5, "export fixture: 5 scored");
assert(roster.unscored.length === 11, "export fixture: 11 need a start date");
const rows = scoreResearchers(roster.people, DEFAULT_WEIGHTS, asOf);
const lines = rankedQueueCsv(rows, roster.unscored).trim().split("\n");
assert(lines[0].startsWith("rank,name,status,score"), "ranked export: header");
assert(lines.length === 17, "ranked export: 16 people + header");
assert(lines[1].startsWith("1,"), "ranked export: rank 1 first");
assert(lines.slice(1, 6).every((l, i) => l.startsWith(`${i + 1},`)), "ranked export: scored rows in rank order");
assert(lines.slice(6).every((l) => l.startsWith(",") && l.includes(",needs-start-date,,")), "ranked export: unscored rows carry no score");
assert(!lines.slice(6).some((l) => /\d{4}-\d{2}/.test(l)), "ranked export: no start date invented for unscored rows");
const quoted = rankedQueueCsv(scoreResearchers(parseImport('name,employer,start_date\n"Doe, Jane","Acme, Inc",2025-09\n', "q.csv").people, DEFAULT_WEIGHTS, asOf), []);
assert(quoted.includes('"Doe, Jane"') && quoted.includes('"Acme, Inc"'), "ranked export: commas are quoted");
console.log(failed ? `${failed} export checks failed` : "export checks passed");

// Deterministic tiebreak: identical scores sort by name, then id, regardless of input order.
const twins = parseImport("name,employer,start_date\nZed Twin,Lab,2025-09\nAda Twin,Lab,2025-09\nAda Twin,Other,2025-09\n", "t.csv").people;
const orderA = scoreResearchers(twins, DEFAULT_WEIGHTS, asOf).map((r) => r.person.id).join();
const orderB = scoreResearchers([...twins].reverse(), DEFAULT_WEIGHTS, asOf).map((r) => r.person.id).join();
assert(orderA === orderB, "tiebreak: same order whatever the input order");
const sorted = scoreResearchers(twins, DEFAULT_WEIGHTS, asOf);
assert(sorted[0].person.name === "Ada Twin" && sorted[2].person.name === "Zed Twin", "tiebreak: equal scores sort by name");
const nudged = { ...sorted[0], scoreExact: sorted[1].scoreExact + 1e-13 };
assert(Math.sign(compareRows(nudged, sorted[1])) === Math.sign(compareRows(sorted[0], sorted[1])), "tiebreak: sub-1e-9 float noise does not decide order");
