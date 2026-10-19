import { DEFAULT_WEIGHTS, HALF_LIFE_DAYS, REACH_THRESHOLD } from "../src/lib/constants";
import { daysBetween, parseISODate } from "../src/lib/dates";
import { RESEARCHERS } from "../src/lib/researchers";
import {
  cliffProximity,
  recencyDecay,
  scoreResearchers,
  type ScoredResearcher,
} from "../src/lib/scoring";
import { SIGNAL_ORDER } from "../src/lib/signals";
import type { SignalType, Weights } from "../src/lib/types";

function line(row: ScoredResearcher): string {
  return [
    String(row.rank).padStart(2, " "),
    row.person.id,
    row.status.padEnd(5, " "),
    row.score.toString().padStart(3, " "),
    row.scoreExact.toFixed(1).padStart(5, " "),
    row.driving.type.padEnd(8, " "),
    row.windowState.padEnd(6, " "),
    `C${row.categories.cliff.toFixed(0).padStart(3, " ")}`,
    `P${row.categories.proof.toFixed(0).padStart(3, " ")}`,
    `S${row.categories.shift.toFixed(0).padStart(3, " ")}`,
    row.person.name,
  ].join("  ");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok    ${message}`);
  }
}

const decay28 = recencyDecay(HALF_LIFE_DAYS);
assert(Math.abs(decay28 - 0.5) < 1e-9, `half-life decay is 0.5 (got ${decay28})`);
assert(Math.abs(cliffProximity(21) - 1) < 1e-9, "cliff proximity peaks at 21 days out");

assert(RESEARCHERS.length === 30, "seed set has 30 researchers");
const names = new Set(RESEARCHERS.map((person) => person.name));
const ids = new Set(RESEARCHERS.map((person) => person.id));
assert(names.size === 30 && ids.size === 30, "names and ids are unique");

const present = new Set<SignalType>(["cliff"]);
for (const person of RESEARCHERS) {
  for (const signal of person.signals) present.add(signal.type);
}
for (const type of SIGNAL_ORDER) {
  assert(present.has(type), `signal type ${type} appears in the seed set`);
}

const AS_OF = parseISODate("2026-10-19");
const balanced = scoreResearchers(RESEARCHERS, DEFAULT_WEIGHTS, AS_OF);
const cliffWeek: Weights = { cliff: 70, proof: 40, shift: 30 };
const emphasized = scoreResearchers(RESEARCHERS, cliffWeek, AS_OF);

const idrisBalanced = balanced.find((row) => row.person.id === "r01");
const idrisCliff = emphasized.find((row) => row.person.id === "r01");
if (!idrisBalanced || !idrisCliff) {
  throw new Error("Missing Idris Pell");
}

const cliffSignal = idrisBalanced.signals.find((signal) => signal.type === "cliff");
assert(cliffSignal?.cliffMonths === 12, "Idris active mark is the 12-month cliff");
assert(
  daysBetween(parseISODate("2026-10-19"), parseISODate(cliffSignal?.date ?? "")) === 21,
  "Idris cliff is 21 days out, the peak of the curve",
);
assert(idrisBalanced.status === "warm", `Idris is WARM at balanced weights (got ${idrisBalanced.status}, score ${idrisBalanced.score})`);
assert(idrisBalanced.driving.type === "cliff", `Idris is cliff-driven at balanced weights (got ${idrisBalanced.driving.type})`);
assert(idrisBalanced.windowState === "open", "Idris cliff window covers this week");
assert(idrisCliff.status === "reach", `Idris is REACH at cliff weight 70 (got ${idrisCliff.status}, score ${idrisCliff.score})`);
assert(idrisCliff.driving.type === "cliff", "Idris is still cliff-driven after the weight move");
assert(
  idrisBalanced.rank - idrisCliff.rank >= 3,
  `Idris climbs at least 3 ranks (was ${idrisBalanced.rank}, now ${idrisCliff.rank})`,
);

const defaultReach = balanced.filter((row) => row.status === "reach");
assert(defaultReach.length >= 5, `at least 5 people are REACH at balanced weights (got ${defaultReach.length})`);
assert(
  defaultReach.some((row) => row.driving.type === "cliff"),
  "at least one default REACH profile is driven by a cliff",
);
assert(
  defaultReach.every((row) => row.windowState === "open"),
  "every REACH profile has a driving window open this week",
);

const entered = emphasized.filter((row) => {
  const before = balanced.find((item) => item.person.id === row.person.id);
  return row.status === "reach" && before?.status !== "reach";
});
assert(
  entered.some((row) => row.driving.type === "cliff"),
  `someone enters REACH OUT THIS WEEK on a cliff signal (entered: ${entered.map((row) => `${row.person.name}/${row.driving.type}`).join(", ") || "none"})`,
);

const orderChanged =
  balanced.map((row) => row.person.id).join() !== emphasized.map((row) => row.person.id).join();
assert(orderChanged, "raising the cliff weight re-sorts the full list");

const topChanged =
  balanced
    .filter((row) => row.status === "reach")
    .slice(0, 3)
    .map((row) => row.person.id)
    .join() !==
  emphasized
    .filter((row) => row.status === "reach")
    .slice(0, 3)
    .map((row) => row.person.id)
    .join();
assert(topChanged, "the top 3 of this week's queue changes when cliff weight goes to 70");

for (const row of balanced) {
  assert(row.score >= 0 && row.score <= 100, `${row.person.name} score stays in 0–100 (${row.score})`);
  if (process.exitCode) break;
}

console.log("\nBalanced queue (REACH OUT THIS WEEK)");
for (const row of balanced.filter((item) => item.status === "reach")) console.log(line(row));
console.log("\nBalanced, next warm");
for (const row of balanced.filter((item) => item.status === "warm").slice(0, 6)) console.log(line(row));
console.log("\nCliff weight 70 queue");
for (const row of emphasized.filter((item) => item.status === "reach")) console.log(line(row));
console.log("\nEntered at cliff 70");
for (const row of entered) console.log(line(row));
console.log("\nFull balanced ranking");
for (const row of balanced) console.log(line(row));

const top3 = defaultReach.slice(0, 3);
console.log("\nTOP3");
for (const row of top3) {
  console.log(
    `${row.rank}. ${row.person.name} — ${row.person.archetype} — score ${row.score} — ${row.driving.title} — ${row.status}`,
  );
}
console.log(`REACH threshold ${REACH_THRESHOLD}`);
