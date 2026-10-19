import { readFileSync } from "node:fs";
import { DEFAULT_WEIGHTS } from "../src/lib/constants";
import {
  addMonths,
  daysBetween,
  monthsInRole,
  parseISODate,
  parseStartDate,
  toISODate,
  weekEnding,
} from "../src/lib/dates";
import {
  approvedQueueCsv,
  exampleCsv,
  parseImport,
  sourceUrlFor,
  TEMPLATE_CSV,
  TEMPLATE_HEADER,
  UNSCORED_LABEL,
} from "../src/lib/exchange";
import { RESEARCHERS } from "../src/lib/researchers";
import { cliffProximity, scoreResearchers } from "../src/lib/scoring";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`ok    ${message}`);
  }
}

const asOf = parseISODate("2026-10-19");
const WEEK_END = parseISODate("2026-10-25");
assert(weekEnding(asOf).getTime() === WEEK_END.getTime(), "injected week (19 Oct 2026) ends 25 Oct 2026");
assert(monthsInRole("2025-11-09", asOf) === 11, "11 months from 2025-11-09 to 2026-10-19");
const cliffDay = addMonths(parseISODate("2025-11-09"), 12);
assert(toISODate(cliffDay) === "2026-11-09", "12-month cliff from 2025-11-09 is 2026-11-09");
assert(daysBetween(asOf, cliffDay) === 21, "that cliff is 21 days out");
assert(cliffProximity(21) === 1, "21 days out is the peak");

const monthOnly = parseStartDate("2025-11");
assert(monthOnly === "2025-11-01", "YYYY-MM starts on the first of the month");
assert(monthsInRole(monthOnly ?? "", asOf) === 11, "11 months from 2025-11 to 2026-10-19");
const monthCliff = addMonths(parseISODate(monthOnly ?? ""), 12);
assert(toISODate(monthCliff) === "2026-11-01", "month-only cliff lands on 2026-11-01");
assert(daysBetween(asOf, monthCliff) === 13, "month-only cliff is 13 days out");

const fixture = readFileSync(new URL("./fixtures/import-fixture.csv", import.meta.url), "utf8");
const imported = parseImport(fixture, "import-fixture.csv");
assert(imported.people.length === 2, `fixture scores 2 people (got ${imported.people.length})`);
assert(imported.unscored.length === 1, `fixture holds 1 unscored person (got ${imported.unscored.length})`);
assert(imported.errors.length === 1, `fixture reports 1 bad row (got ${imported.errors.length})`);
assert(imported.unscored[0]?.name === "Cleo Marsh", "unscored person is Cleo Marsh");
assert(imported.unscored[0]?.reason === UNSCORED_LABEL, `flag is “${UNSCORED_LABEL}”`);
assert(imported.errors[0]?.row === 7, `bad row is line 7 (got ${imported.errors[0]?.row})`);
assert(
  imported.people.some((person) => person.name === "Ada Voss") &&
    imported.people.some((person) => person.name === "Ben Cho") &&
    imported.people.every((person) => person.name !== "Cleo Marsh"),
  "Ada and Ben are scored and Cleo is not dropped into the queue",
);

const balanced = scoreResearchers(imported.people, DEFAULT_WEIGHTS, asOf);
const ada = balanced.find((row) => row.person.name === "Ada Voss");
const ben = balanced.find((row) => row.person.name === "Ben Cho");
assert(ada?.status === "warm" && ada.score === 54, `Ada is warm at 54 (got ${ada?.status} ${ada?.score})`);
assert(ada?.driving.type === "cliff", `Ada is cliff-driven (got ${ada?.driving.type})`);
assert(ada?.monthsInRole === 11, `Ada has 11 months in role (got ${ada?.monthsInRole})`);
assert(ben?.status === "reach" && ben.score === 63, `Ben is reach at 63 (got ${ben?.status} ${ben?.score})`);
assert(ben?.driving.type === "oss", `Ben is driven by the open-source release (got ${ben?.driving.type})`);
assert(sourceUrlFor(ben!) === "https://example.com/ben-oss", "Ben’s driving signal keeps its source url");

const cliffWeek = scoreResearchers(imported.people, { cliff: 70, proof: 40, shift: 30 }, asOf);
const adaCliff = cliffWeek.find((row) => row.person.name === "Ada Voss");
const benCliff = cliffWeek.find((row) => row.person.name === "Ben Cho");
assert(adaCliff?.status === "reach" && adaCliff.score === 67, `Ada reaches 67 at cliff 70 (got ${adaCliff?.status} ${adaCliff?.score})`);
assert((ada?.rank ?? 0) > (adaCliff?.rank ?? 0), `Ada’s rank climbs (was ${ada?.rank}, now ${adaCliff?.rank})`);
assert(benCliff?.status !== "reach", `Ben leaves the week queue at cliff 70 (got ${benCliff?.status} ${benCliff?.score})`);

const exported = approvedQueueCsv(balanced, new Set([ben!.person.id]));
const exportedLines = exported.trim().split("\n");
assert(exportedLines.length === 2, `approved export has a header and one row (got ${exportedLines.length})`);
assert(exportedLines[1]?.startsWith("Ben Cho,63,"), `export names Ben Cho at score 63 (${exportedLines[1]})`);
assert(exported.includes("https://example.com/ben-oss"), "export includes Ben’s source url");

const bare = parseImport(
  "name,role,employer,start_date,type,date,source_url,note\nSam Hill,Scientist,Northline,2025-11-09,release,2026-10-19,https://example.com/sam,Same-day note\n",
);
const sam = scoreResearchers(bare.people, DEFAULT_WEIGHTS, asOf)[0];
const samRelease = sam?.signals.find((signal) => signal.type === "release");
assert(samRelease?.raw === 60, `omitted strength defaults to 0.6 and a same-day signal scores 60 (got ${samRelease?.raw})`);

const example = exampleCsv(RESEARCHERS);
const roundTrip = parseImport(example, "ping-when-example.csv");
assert(roundTrip.errors.length === 0, `example file has no import errors (got ${roundTrip.errors.length})`);
assert(roundTrip.unscored.length === 0, "example file has no unscored rows");
assert(roundTrip.people.length === 30, `example file restores 30 people (got ${roundTrip.people.length})`);
const original = scoreResearchers(RESEARCHERS, DEFAULT_WEIGHTS, asOf);
const restored = scoreResearchers(roundTrip.people, DEFAULT_WEIGHTS, asOf);
assert(original.length === restored.length, "example scoring covers every seed profile");
for (let i = 0; i < original.length; i += 1) {
  const left = original[i];
  const right = restored[i];
  assert(
    left.person.name === right.person.name &&
      left.score === right.score &&
      left.status === right.status &&
      left.driving.type === right.driving.type,
    `${left.person.name} matches after example round-trip (${right.person.name} ${right.score} ${right.status} ${right.driving.type})`,
  );
}


// --- Import fix (Oct 19): candidate-only CSV, signal aliases, template compat ---
{
  // (a) 4-column CSV imports; candidates appear and are cliff-scored with no signals.
  const fourCol = parseImport(
    "name,role,employer,start_date\nMira Sol,Research scientist,Northline,2025-11-09\nTheo Park,Research engineer,Harbor Glass,2026-01-12\n",
    "four-col.csv",
  );
  assert(fourCol.errors.length === 0, `4-col CSV has no errors (got ${JSON.stringify(fourCol.errors)})`);
  assert(fourCol.unscored.length === 0, `4-col CSV has no unscored candidates (got ${fourCol.unscored.length})`);
  assert(fourCol.people.length === 2, `4-col CSV imports 2 candidates (got ${fourCol.people.length})`);
  assert(
    fourCol.people.every((person) => person.signals.length === 0),
    "4-col candidates import with no signals",
  );
  const fourScored = scoreResearchers(fourCol.people, DEFAULT_WEIGHTS, asOf);
  assert(fourScored.length === 2 && fourScored.every((row) => row.signals.some((sig) => sig.type === "cliff")), "4-col candidates appear scored (cliff applies)");

  // Header aliases: company -> employer, start -> start_date (spaces/underscores normalised).
  const aliased = parseImport(
    "Name,Role,Company,Start Date\nMira Sol,Research scientist,Northline,2025-11-09\n",
    "aliased.csv",
  );
  assert(aliased.people.length === 1 && aliased.people[0]?.org === "Northline", `aliased headers import (got ${JSON.stringify(aliased.errors)})`);

  // Per-row empty signal fields in an 8-col file: candidate kept, no signal.
  const emptySignal = parseImport(
    "name,role,employer,start_date,type,date,source_url,note\nMira Sol,Research scientist,Northline,2025-11-09,,,,\n",
    "empty-signal.csv",
  );
  assert(emptySignal.people.length === 1 && emptySignal.people[0]?.signals.length === 0 && emptySignal.errors.length === 0, "row with empty signal fields imports as candidate with no signal");

  // (b) paper alias scores as release.
  const paper = parseImport(
    "name,role,employer,start_date,type,date,source_url,note\nWilla Greer,Research scientist,Paper Dock,2026-10-01,paper,2026-09-21,https://example.com/willa,A paper at one half-life\n",
    "paper.csv",
  );
  assert(paper.errors.length === 0, `paper alias has no errors (got ${JSON.stringify(paper.errors)})`);
  assert(paper.people[0]?.signals[0]?.type === "release", `paper alias becomes release (got ${paper.people[0]?.signals[0]?.type})`);
  const paperScored = scoreResearchers(paper.people, DEFAULT_WEIGHTS, asOf)[0];
  assert(paperScored?.categories.proof === 30, `paper-as-release scores proof 30 at default 0.6 strength (got ${paperScored?.categories.proof})`);
  // Unknown type: candidate kept, only that signal dropped, row reported, candidate scored (not "unscored").
  const unknown = parseImport(
    "name,role,employer,start_date,type,date,source_url,note\nWilla Greer,Research scientist,Paper Dock,2025-11-09,mystery,2026-09-21,https://example.com/willa,Unknown kind\n",
    "unknown.csv",
  );
  assert(unknown.people.length === 1 && unknown.unscored.length === 0, "unknown signal type keeps the candidate scored, not unscored");
  assert(unknown.people[0]?.signals.length === 0, "unknown signal type drops only that signal");
  assert(unknown.errors.length === 1 && unknown.errors[0]?.row === 2, `unknown signal type reported on row 2 (got ${JSON.stringify(unknown.errors)})`);

  // (c) 8-column template still works: header bytes unchanged, template parses to its fictional example.
  const templateOnDisk = readFileSync(new URL("../public/ping-when-template.csv", import.meta.url), "utf8");
  assert(templateOnDisk === TEMPLATE_CSV, "public template matches TEMPLATE_CSV");
  assert(templateOnDisk.split("\n")[0] === TEMPLATE_HEADER, "template header line is byte-identical to the original 8 columns");
  const templateParsed = parseImport(templateOnDisk, "ping-when-template.csv");
  assert(templateParsed.errors.length === 0 && templateParsed.people.length === 1, `template example row imports 1 candidate (got people=${templateParsed.people.length} errors=${JSON.stringify(templateParsed.errors)})`);
  assert(templateParsed.people[0]?.signals[0]?.type === "release", "template example row uses valid release type");
}

// --- Import fix 2 (Oct 19): fuzzy real-world headers, TSV/semicolon, name-only ---
{
  // (a) Candidate Name / Title / Company / Start Date imports.
  const fuzzy = parseImport(
    "Candidate Name,Title,Company,Start Date\nMira Sol,Research scientist,Northline,2025-11-09\n",
    "fuzzy.csv",
  );
  assert(fuzzy.errors.length === 0, `fuzzy Candidate Name/Title/Company/Start Date has no errors (got ${JSON.stringify(fuzzy.errors)})`);
  assert(fuzzy.people.length === 1 && fuzzy.people[0]?.name === "Mira Sol", "fuzzy headers import Mira Sol");
  assert(fuzzy.people[0]?.roleType === "Research scientist" && fuzzy.people[0]?.org === "Northline", `fuzzy Title->role and Company->employer (got ${fuzzy.people[0]?.roleType} / ${fuzzy.people[0]?.org})`);
  assert(fuzzy.people[0]?.roleStart === "2025-11-09", `fuzzy Start Date->start_date (got ${fuzzy.people[0]?.roleStart})`);

  // Bare signal date must not steal start_date when a start-ish column exists;
  // signal/event, url/link and details/comment aliases also map.
  const signals = parseImport(
    "Full Name,Job Title,Organisation,Date Started,Event,Signal Date,Link,Details\nMira Sol,Research scientist,Northline,2025-11-09,paper,2026-09-21,https://example.com/mira-fuzzy,A paper note\n",
    "fuzzy-signals.csv",
  );
  assert(signals.errors.length === 0, `fuzzy signal headers have no errors (got ${JSON.stringify(signals.errors)})`);
  assert(signals.people[0]?.roleStart === "2025-11-09", `Date Started wins start_date over Signal Date (got ${signals.people[0]?.roleStart})`);
  assert(signals.people[0]?.signals[0]?.type === "release" && signals.people[0]?.signals[0]?.date === "2026-09-21", `Event->type and Signal Date->date (got ${JSON.stringify(signals.people[0]?.signals[0])})`);
  assert(signals.people[0]?.signals[0]?.sourceUrl === "https://example.com/mira-fuzzy", "Link->source_url in fuzzy headers");

  // (b) Tab-separated paste imports.
  const tsv = parseImport(
    "Candidate Name\tTitle\tCompany\tStart Date\nMira Sol\tResearch scientist\tNorthline\t2025-11-09\n",
    "paste",
  );
  assert(tsv.errors.length === 0 && tsv.people.length === 1 && tsv.people[0]?.org === "Northline", `tab-separated paste imports (got people=${tsv.people.length} errors=${JSON.stringify(tsv.errors)})`);

  // (c) Semicolon CSV imports (quoted semicolons still respected).
  const semi = parseImport(
    'Candidate Name;Title;Company;Start Date\nMira Sol;Research scientist;"North; Line";2025-11-09\n',
    "semi.csv",
  );
  assert(semi.errors.length === 0 && semi.people.length === 1 && semi.people[0]?.org === "North; Line", `semicolon CSV imports with quoted field (got people=${semi.people.length} errors=${JSON.stringify(semi.errors)})`);

  // (d) Template 8-col unchanged (re-asserted alongside the new delimiters).
  const templateParsed2 = parseImport(TEMPLATE_CSV, "ping-when-template.csv");
  assert(TEMPLATE_CSV.split("\n")[0] === "name,role,employer,start_date,type,date,source_url,note", "template 8-col header unchanged in fuzzy block");
  assert(templateParsed2.errors.length === 0 && templateParsed2.people.length === 1, "template 8-col still imports in fuzzy block");

  // (e) name+employer only: listed, unscored-needs-date, not rejected.
  const nameEmployer = parseImport("name,employer\nMira Sol,Northline\nTheo Park,Harbor Glass\n", "name-employer.csv");
  assert(nameEmployer.errors.length === 0, `name+employer has no errors (got ${JSON.stringify(nameEmployer.errors)})`);
  assert(nameEmployer.people.length === 0 && nameEmployer.unscored.length === 2, `name+employer lists 2 unscored, none scored (got people=${nameEmployer.people.length} unscored=${nameEmployer.unscored.length})`);
  assert(nameEmployer.unscored.every((person) => person.reason === UNSCORED_LABEL), "name+employer rows are unscored \u2014 needs date");
  assert(nameEmployer.unscored[0]?.employer === "Northline" && nameEmployer.unscored[0]?.missing.includes("start_date"), "name+employer keeps employer and says missing start_date");

  // (f) name-only imports: listed, unscored-needs-date.
  const nameOnly = parseImport("name\nMira Sol\nTheo Park\n", "name-only.csv");
  assert(nameOnly.errors.length === 0 && nameOnly.people.length === 0 && nameOnly.unscored.length === 2, `name-only lists 2 unscored (got people=${nameOnly.people.length} unscored=${nameOnly.unscored.length} errors=${JSON.stringify(nameOnly.errors)})`);
  assert(nameOnly.unscored.map((person) => person.name).join(",") === "Mira Sol,Theo Park", "name-only keeps both names");

  // Invalid start_date on a row: still listed unscored, not dropped.
  const badStart = parseImport("name,start_date\nMira Sol,soon\n", "bad-start.csv");
  assert(badStart.errors.length === 0 && badStart.unscored.length === 1 && badStart.unscored[0]?.name === "Mira Sol", `invalid start_date lists candidate unscored (got ${JSON.stringify(badStart)})`);

  // No name column at all: whole file rejected, error echoes headers saw, row kept.
  const noName = parseImport("Foo,Bar\nx,y\n", "no-name.csv");
  assert(noName.people.length === 0 && noName.unscored.length === 0 && noName.errors.length === 1, "no-name file is rejected whole");
  assert(noName.errors[0]?.row === 1 && noName.errors[0]?.message.includes("Saw: Foo, Bar"), `no-name error echoes saw headers on row 1 (got ${JSON.stringify(noName.errors)})`);
  assert(noName.errors[0]?.message.includes("Only name is required"), "no-name error says only name is required");
}

const onDisk = readFileSync(new URL("../public/ping-when-example.csv", import.meta.url), "utf8");
assert(onDisk === example, "public example file matches the seed conversion");

if (process.exitCode) {
  console.error("import checks failed");
} else {
  console.log("fixture Ada", ada?.rank, ada?.score, ada?.status, "Ben", ben?.rank, ben?.score, ben?.status);
  console.log("cliff70 Ada", adaCliff?.rank, adaCliff?.score, adaCliff?.status, "Ben", benCliff?.rank, benCliff?.score, benCliff?.status);
}
