/**
 * Independent score checks. Expected numbers are the formula evaluated by hand
 * below. They do not call the scorer, and they do not use the seed roster or
 * the Ada/Ben/Cleo fixture. A change to a formula constant should fail these.
 */
import { parseImport, UNSCORED_LABEL } from "../src/lib/exchange";
import { scoreResearchers } from "../src/lib/scoring";
import type { Researcher, SeedSignal, Weights } from "../src/lib/types";
import { parseISODate } from "../src/lib/dates";

const AS_OF = parseISODate("2026-10-19");
const WEEK_END = "2026-10-25";
const BALANCED: Weights = { cliff: 30, proof: 40, shift: 30 };

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok    ${message}`);
  }
}

function near(actual: number, expected: number, label: string): void {
  const delta = Math.abs(actual - expected);
  assert(delta < 1e-9, `${label}: expected ${expected}, computed ${actual}, delta ${delta}`);
}

function researcher(input: {
  id: string;
  name: string;
  org: string;
  roleStart: string;
  signals?: SeedSignal[];
}): Researcher {
  return {
    id: input.id,
    name: input.name,
    archetype: "",
    roleType: "Research scientist",
    org: input.org,
    location: "",
    roleStart: input.roleStart,
    focus: "",
    workHook: "the published work",
    signals: input.signals ?? [],
  };
}

function scoreOne(person: Researcher, weights: Weights = BALANCED) {
  const row = scoreResearchers([person], weights, AS_OF)[0];
  if (!row) throw new Error(`No score for ${person.name}`);
  return row;
}

// Clock is Monday 19 Oct 2026. The scored week runs through Sunday 25 Oct 2026.
// Cliff: proximity = 0 outside (110, -40), else 0.05 + 0.95 * exp(-(d-21)^2 / (2*22^2)).
// Mark raw = 100 * proximity * yearWeight, yearWeight 12/24/36 = 1 / 0.84 / 0.72.
// Only the strongest mark is kept. Proof/shift raw = 100 * strength * 0.5^(daysAgo/28).
// Score = (30*Cliff + 40*Proof + 30*Shift) / 100, then round. One signal, so no squash.

// --- 1. 12-month mark, exactly 21 days before the anniversary (the peak) ---
// Anniversary 9 Nov 2026 is 21 days after 19 Oct. Start 9 Nov 2025.
// delta = 21 - 21 = 0, gaussian = exp(0) = 1, proximity = 0.05 + 0.95*1 = 1.
// 24- and 36-month marks are ~386 and ~751 days away, outside the 110-day floor, raw 0.
// Cliff = 100 * 1 * 1 = 100. Proof = 0. Shift = 0.
// score = (30*100 + 40*0 + 30*0) / 100 = 30.
{
  const row = scoreOne(
    researcher({ id: "ind-12", name: "Lumen Peck", org: "Glass Orchard", roleStart: "2025-11-09" }),
  );
  const cliff = row.signals.find((signal) => signal.type === "cliff");
  near(cliff?.raw ?? NaN, 100, "12-month peak cliff raw");
  near(row.scoreExact, 30, "12-month peak score");
  assert(row.score === 30, `12-month peak rounds to 30 (got ${row.score})`);
  assert(cliff?.cliffMonths === 12, "active mark is 12 months");
  assert(cliff?.daysAgo === -21, `peak is 21 days ahead (daysAgo ${cliff?.daysAgo})`);
  console.log(`case 1  12-month peak     expected 30  computed ${row.score} (${row.scoreExact})`);
}

// --- 2. 24-month mark at the same 21-day peak ---
// Start 9 Nov 2024. The 12-month mark (9 Nov 2025) is ~344 days past, proximity 0.
// The 36-month mark is ~386 days ahead, proximity 0.
// Cliff = 100 * 1 * 0.84 = 84.
// score = (30*84) / 100 = 25.2, rounds to 25.
{
  const row = scoreOne(
    researcher({ id: "ind-24", name: "Maren Sol", org: "Harbor Current", roleStart: "2024-11-09" }),
  );
  const cliff = row.signals.find((signal) => signal.type === "cliff");
  near(cliff?.raw ?? NaN, 84, "24-month peak cliff raw");
  near(row.scoreExact, 25.2, "24-month peak score");
  assert(row.score === 25, `24-month peak rounds to 25 (got ${row.score})`);
  assert(cliff?.cliffMonths === 24, "active mark is 24 months");
  console.log(`case 2  24-month peak     expected 25.2 → 25  computed ${row.scoreExact} → ${row.score}`);
}

// --- 3. 36-month mark at the same 21-day peak ---
// Start 9 Nov 2023. Earlier marks are more than 40 days past, proximity 0.
// Cliff = 100 * 1 * 0.72 = 72.
// score = (30*72) / 100 = 21.6, rounds to 22.
{
  const row = scoreOne(
    researcher({ id: "ind-36", name: "Tovin Ell", org: "West Lantern", roleStart: "2023-11-09" }),
  );
  const cliff = row.signals.find((signal) => signal.type === "cliff");
  near(cliff?.raw ?? NaN, 72, "36-month peak cliff raw");
  near(row.scoreExact, 21.6, "36-month peak score");
  assert(row.score === 22, `36-month peak rounds to 22 (got ${row.score})`);
  assert(cliff?.cliffMonths === 36, "active mark is 36 months");
  console.log(`case 3  36-month peak     expected 21.6 → 22  computed ${row.scoreExact} → ${row.score}`);
}

// --- 4. Cliff one sigma off the peak, so the gaussian width is locked ---
// Anniversary 1 Dec 2026 is 43 days after 19 Oct. delta = 43 - 21 = 22 = one sigma.
// gaussian = exp(-(22^2) / (2*22^2)) = exp(-1/2) = 0.6065306597126334
// proximity = 0.05 + 0.95 * 0.6065306597126334 = 0.6262041267270018
// Cliff = 100 * proximity * 1 = 62.620412672700176
// score = (30 * 62.620412672700176) / 100 = 18.786123801810053, rounds to 19.
// A pure gaussian with no 0.05 floor would be exp(-1/2) and would round to 18.
{
  const gaussian = Math.exp(-1 / 2);
  const proximity = 0.05 + 0.95 * gaussian;
  const cliffRaw = 100 * proximity * 1;
  const expected = (30 * cliffRaw) / 100;
  const row = scoreOne(
    researcher({ id: "ind-sigma", name: "Cass Holt", org: "Low Meridian", roleStart: "2025-12-01" }),
  );
  const cliff = row.signals.find((signal) => signal.type === "cliff");
  near(cliff?.raw ?? NaN, cliffRaw, "one-sigma cliff raw");
  near(row.scoreExact, expected, "one-sigma score");
  assert(row.score === 19, `one-sigma cliff rounds to 19 (got ${row.score})`);
  assert(cliff?.cliffMonths === 12, "one-sigma case is still the 12-month mark");
  console.log(`case 4  one-sigma cliff    expected ${expected} → 19  computed ${row.scoreExact} → ${row.score}`);
}

// --- 5. Proof signal at the 28-day half-life ---
// Role started 1 Oct 2026, so every cliff mark is >110 days away and contributes 0.
// Paper dated 21 Sep 2026 is 28 days before 19 Oct. decay = 0.5^(28/28) = 0.5.
// strength 1, so Proof = 100 * 1 * 0.5 = 50. Shift = 0.
// score = (40*50) / 100 = 20.
{
  const row = scoreOne(
    researcher({
      id: "ind-proof",
      name: "Willa Greer",
      org: "Paper Dock",
      roleStart: "2026-10-01",
      signals: [
        {
          type: "release",
          date: "2026-09-21",
          title: "A note at one half-life",
          detail: "A note at one half-life",
          strength: 1,
          sourceUrl: "https://example.com/willa-note",
        },
      ],
    }),
  );
  const paper = row.signals.find((signal) => signal.type === "release");
  assert(paper?.daysAgo === 28, `proof signal is 28 days old (got ${paper?.daysAgo})`);
  near(paper?.raw ?? NaN, 50, "28-day proof raw");
  near(row.categories.cliff, 0, "fresh role has no cliff");
  near(row.scoreExact, 20, "28-day proof score");
  assert(row.score === 20, `28-day proof rounds to 20 (got ${row.score})`);
  console.log(`case 5  28-day proof       expected 20  computed ${row.score} (${row.scoreExact})`);
}

// --- 6. Org-shift signal at the same 28-day half-life ---
// Funding on 21 Sep 2026, strength 1. Shift = 100 * 0.5 = 50. Cliff = 0. Proof = 0.
// score = (30*50) / 100 = 15.
{
  const row = scoreOne(
    researcher({
      id: "ind-shift",
      name: "Jun Park",
      org: "Field Budget",
      roleStart: "2026-10-01",
      signals: [
        {
          type: "funding",
          date: "2026-09-21",
          title: "A round at one half-life",
          detail: "A round at one half-life",
          strength: 1,
          sourceUrl: "https://example.com/jun-round",
        },
      ],
    }),
  );
  const funding = row.signals.find((signal) => signal.type === "funding");
  near(funding?.raw ?? NaN, 50, "28-day shift raw");
  near(row.scoreExact, 15, "28-day shift score");
  assert(row.score === 15, `28-day shift rounds to 15 (got ${row.score})`);
  assert(row.driving.type === "funding", "the shift signal drives");
  console.log(`case 6  28-day org shift   expected 15  computed ${row.score} (${row.scoreExact})`);
}

// --- 7. Release window closes exactly on the week’s first day ---
// A release window is the event day through 35 days later.
// 14 Sep 2026 + 35 days = 19 Oct 2026, which is `asOf`. The week is 19–25 Oct.
// Closing on asOf still overlaps, so the window is open. One day earlier would not.
// daysAgo = 35. decay = 0.5^(35/28) = 0.5^1.25 = 0.4204482076268573
// Proof = 42.04482076268573
// score = (40 * 42.04482076268573) / 100 = 16.817928305074293, rounds to 17.
{
  const decay = 0.5 ** (35 / 28);
  const proof = 100 * 1 * decay;
  const expected = (40 * proof) / 100;
  const row = scoreOne(
    researcher({
      id: "ind-edge-close",
      name: "Nessa Brom",
      org: "Edge Lab",
      roleStart: "2026-10-01",
      signals: [
        {
          type: "release",
          date: "2026-09-14",
          title: "Closes on the Monday",
          detail: "Closes on the Monday",
          strength: 1,
          sourceUrl: "https://example.com/nessa",
        },
      ],
    }),
  );
  const paper = row.signals.find((signal) => signal.type === "release");
  assert(paper?.windowCloses.toISOString().slice(0, 10) === "2026-10-19", "window closes on 19 Oct");
  assert(paper?.windowState === "open", `closing on asOf is open (got ${paper?.windowState})`);
  near(row.scoreExact, expected, "window-close edge score");
  assert(row.score === 17, `window-close edge rounds to 17 (got ${row.score})`);
  console.log(`case 7  window closes asOf expected ${expected} → 17  computed ${row.scoreExact} → ${row.score}  state ${paper?.windowState}`);
}

// --- 8. The day before that edge is closed, and the open-on-Sunday edge is open ---
// 13 Sep 2026 + 35 days = 18 Oct 2026, the day before asOf. No overlap with 19–25 Oct.
// daysAgo = 36. decay = 0.5^(36/28) = 0.4101676780038189
// Proof = 41.01676780038189
// score = 40 * that / 100 = 16.406707120152756, rounds to 16. State is closed.
//
// A second person, Ivo Tan, publishes on Sunday 25 Oct, the last day of the week.
// The release window opens that day, so it still overlaps. 25 Oct is 6 days ahead.
// 6 <= 21, so decay = 1. strength 0.8, Proof = 80.
// score = (40*80) / 100 = 32. State is open.
{
  const decay = 0.5 ** (36 / 28);
  const expectedClosed = (40 * (100 * decay)) / 100;
  const closed = scoreOne(
    researcher({
      id: "ind-edge-shut",
      name: "Soren Vale",
      org: "Edge Lab",
      roleStart: "2026-10-01",
      signals: [
        {
          type: "release",
          date: "2026-09-13",
          title: "Closed yesterday",
          detail: "Closed yesterday",
          strength: 1,
          sourceUrl: "https://example.com/soren",
        },
      ],
    }),
  );
  const shut = closed.signals.find((signal) => signal.type === "release");
  assert(shut?.windowCloses.toISOString().slice(0, 10) === "2026-10-18", "window closes on 18 Oct");
  assert(shut?.windowState === "closed", `day-before close is closed (got ${shut?.windowState})`);
  near(closed.scoreExact, expectedClosed, "day-before score");
  assert(closed.score === 16, `day-before rounds to 16 (got ${closed.score})`);

  const open = scoreOne(
    researcher({
      id: "ind-edge-open",
      name: "Ivo Tan",
      org: "Sunday Press",
      roleStart: "2026-10-01",
      signals: [
        {
          type: "release",
          date: WEEK_END,
          title: "Opens on the Sunday",
          detail: "Opens on the Sunday",
          strength: 0.8,
          sourceUrl: "https://example.com/ivo",
        },
      ],
    }),
  );
  const sunday = open.signals.find((signal) => signal.type === "release");
  assert(sunday?.windowOpens.toISOString().slice(0, 10) === WEEK_END, "window opens on 25 Oct");
  assert(sunday?.windowState === "open", `opening on week end is open (got ${sunday?.windowState})`);
  assert(sunday?.daysAgo === -6, `Sunday paper is 6 days ahead (got ${sunday?.daysAgo})`);
  near(sunday?.raw ?? NaN, 80, "future-within-21 proof raw");
  near(open.scoreExact, 32, "Sunday-open score");
  assert(open.score === 32, `Sunday-open rounds to 32 (got ${open.score})`);
  console.log(`case 8  day before close   expected ${expectedClosed} → 16  computed ${closed.scoreExact} → ${closed.score}  state ${shut?.windowState}`);
  console.log(`case 8b opens on week end  expected 32  computed ${open.score} (${open.scoreExact})  state ${sunday?.windowState}`);
}

// --- 9. Weights reorder two people who are not in the story fixtures ---
// Nim Rao: no cliff (started 1 Sep 2026), one open-source release today, strength 1.
//   Proof = 100 * 1 * 0.5^0 = 100. Balanced score = (40*100) / 100 = 40.
//   Shift-week weights 20/25/70, sum 115. score = (25*100) / 115 = 21.73913043478261, rounds to 22.
// Oka Venn: no cliff, one layoff dated today, strength 1. Shift = 100.
//   Balanced score = (30*100) / 100 = 30.
//   Shift-week score = (70*100) / 115 = 60.8695652173913, rounds to 61.
// Balanced order is Nim then Oka. Shift-week order is Oka then Nim.
{
  const nim = researcher({
    id: "ind-nim",
    name: "Nim Rao",
    org: "Open Keel",
    roleStart: "2026-09-01",
    signals: [
      {
        type: "oss",
        date: "2026-10-19",
        title: "Weights tagged today",
        detail: "Weights tagged today",
        strength: 1,
        sourceUrl: "https://example.com/nim",
      },
    ],
  });
  const oka = researcher({
    id: "ind-oka",
    name: "Oka Venn",
    org: "Keel News",
    roleStart: "2026-09-01",
    signals: [
      {
        type: "layoff",
        date: "2026-10-19",
        title: "Lab posted a reduction",
        detail: "Lab posted a reduction",
        strength: 1,
        sourceUrl: "https://example.com/oka",
      },
    ],
  });
  const shiftWeek: Weights = { cliff: 20, proof: 25, shift: 70 };
  const balanced = scoreResearchers([nim, oka], BALANCED, AS_OF);
  const shifted = scoreResearchers([nim, oka], shiftWeek, AS_OF);
  const nimBalanced = balanced.find((row) => row.person.name === "Nim Rao");
  const okaBalanced = balanced.find((row) => row.person.name === "Oka Venn");
  const nimShift = shifted.find((row) => row.person.name === "Nim Rao");
  const okaShift = shifted.find((row) => row.person.name === "Oka Venn");
  near(nimBalanced?.scoreExact ?? NaN, 40, "Nim balanced");
  near(okaBalanced?.scoreExact ?? NaN, 30, "Oka balanced");
  assert(nimBalanced?.rank === 1 && okaBalanced?.rank === 2, "balanced rank is Nim then Oka");
  near(nimShift?.scoreExact ?? NaN, 2500 / 115, "Nim shift-week");
  near(okaShift?.scoreExact ?? NaN, 7000 / 115, "Oka shift-week");
  assert(nimShift?.score === 22, `Nim shift-week rounds to 22 (got ${nimShift?.score})`);
  assert(okaShift?.score === 61, `Oka shift-week rounds to 61 (got ${okaShift?.score})`);
  assert(okaShift?.rank === 1 && nimShift?.rank === 2, "shift-week rank is Oka then Nim");
  assert(okaShift?.status === "reach", `Oka clears the line at shift-week (got ${okaShift?.status})`);
  console.log(`case 9  balanced ranks    expected Nim 40 then Oka 30  computed Nim ${nimBalanced?.score} rank ${nimBalanced?.rank}, Oka ${okaBalanced?.score} rank ${okaBalanced?.rank}`);
  console.log(`case 9b shift-week ranks  expected Oka 60.869… → 61 then Nim 21.739… → 22  computed Oka ${okaShift?.scoreExact} → ${okaShift?.score} rank ${okaShift?.rank}, Nim ${nimShift?.scoreExact} → ${nimShift?.score} rank ${nimShift?.rank}`);
}

// --- 10. Missing start_date or an undated signal is unscored, and a short row is reported ---
// Pia Quell has a dated paper and no start_date. Ren Sato has start 2024-03 and a signal with no date.
// Neither receives a score. The third data line has 3 columns and is row 4.
{
  const csv = [
    "name,role,employer,start_date,type,date,source_url,note",
    "Pia Quell,Research scientist,Glass Orchard,,release,2026-10-01,https://example.com/pia,Dated note without a start",
    "Ren Sato,Research engineer,North Current,2024-03,oss,,https://example.com/ren,Signal without a date",
    "not,enough,columns",
  ].join("\n");
  const imported = parseImport(csv, "independent.csv");
  assert(imported.people.length === 0, `no scored people (got ${imported.people.length})`);
  assert(imported.unscored.length === 2, `two unscored rows (got ${imported.unscored.length})`);
  for (const name of ["Pia Quell", "Ren Sato"]) {
    const row = imported.unscored.find((person) => person.name === name);
    assert(row?.reason === UNSCORED_LABEL, `${name} is ${UNSCORED_LABEL} (got ${row?.reason})`);
  }
  assert(imported.errors.length === 1 && imported.errors[0]?.row === 4, `bad row is line 4 (got ${imported.errors[0]?.row})`);
  console.log("case 10 unscored          expected no score, flag “unscored — needs date”, error on row 4");
  console.log(`        computed          scored ${imported.people.length}, unscored ${imported.unscored.map((person) => `${person.name}: ${person.reason}`).join("; ")}, error row ${imported.errors[0]?.row}`);
}

if (process.exitCode) console.error("independent checks failed");
