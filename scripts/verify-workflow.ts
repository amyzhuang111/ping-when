// Checks the two workflow exports: the formatted .xlsx queue and the .ics reminders.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DEFAULT_WEIGHTS } from "../src/lib/constants";
import { parseImport } from "../src/lib/exchange";
import { scoreResearchers } from "../src/lib/scoring";
import { foldLine, icsText, planReminders, remindersIcs } from "../src/lib/calendar";
import { LINE_POINTS, rowLines, HEADER_FILL, QUEUE_COLUMNS, READY_FILL, WIDTH_CAP, columnWidths, queueSheet, queueXlsx, safeText } from "../src/lib/workbook";

let failed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    console.error(`FAIL  ${message}`);
    process.exitCode = 1;
  } else console.log(`ok    ${message}`);
}

const req = createRequire(__filename);
const ExcelJS = req("../public/vendor/exceljs.min.js");
const asOf = new Date(Date.UTC(2026, 9, 19));
const roster = parseImport(readFileSync("scripts/fixtures/export-fixture.csv", "utf8"), "export-fixture.csv");
const rows = scoreResearchers(roster.people, DEFAULT_WEIGHTS, asOf);
const first = rows[0];
const decisions = { [first.person.id]: "approve" as const };

async function main() {
// ---------- xlsx ----------
const sheet = queueSheet(rows, roster.unscored, decisions, DEFAULT_WEIGHTS, asOf, "export-fixture.csv");
assert(sheet.rows.length === rows.length + roster.unscored.length, "xlsx: one row per imported person (5 scored + 11 incomplete)");
assert(sheet.rows.slice(rows.length).every((r) => r[3] === null && r[0] === null && r[12] === null), "xlsx: incomplete rows carry no score, rank or start date");
assert(columnWidths(sheet).every((w) => w <= WIDTH_CAP && w >= 8), "xlsx: widths between 8 and 46");
assert(rowLines(["a", "x".repeat(30)], [10, 11]) === 3 && rowLines([1, "short"], [8, 20]) === 1, "xlsx: row lines from wrapped text in the main columns");
assert(safeText("=HYPERLINK(1)") === "'=HYPERLINK(1)" && safeText("+1") === "'+1" && safeText("Ada") === "Ada", "xlsx: formula-like text is quoted");
const buf = await queueXlsx(ExcelJS, sheet);
assert(buf.byteLength > 2000, `xlsx: workbook written (${buf.byteLength} bytes)`);
const back = new ExcelJS.Workbook();
await back.xlsx.load(buf);
const ws = back.getWorksheet("Queue");
assert(!!ws && !!back.getWorksheet("About"), "xlsx: Queue and About sheets");
assert(String(ws.getCell(1, 1).value).startsWith("Ping When ranked queue, scored Oct 19, 2026"), "xlsx: title names the scoring date");
assert(QUEUE_COLUMNS.every((c, j) => ws.getCell(2, j + 1).value === c.header), "xlsx: header row matches columns");
assert(ws.getCell(2, 1).fill?.fgColor?.argb === HEADER_FILL && ws.getCell(2, 1).font?.bold === true, "xlsx: header is black and bold");
assert(ws.views?.[0]?.state === "frozen" && ws.views[0].ySplit === 2, "xlsx: title and header frozen");
assert(!!ws.autoFilter, "xlsx: filter on header");
assert(ws.getCell(3, 2).value === first.person.name && ws.getCell(3, 1).value === 1, "xlsx: rank 1 first");
assert(ws.getRow(3).height % LINE_POINTS === 0 && ws.getCell(3, 2).font?.name === "Arial", "xlsx: row height in whole lines, Arial body");
assert(typeof ws.getCell(3, 4).value === "number", "xlsx: score is a number cell");
assert(ws.getCell(3, 9).value instanceof Date && ws.getCell(3, 9).numFmt === "mmm d, yyyy", "xlsx: window opens is a date cell");
assert(ws.getCell(3, 11).value === "Approved", "xlsx: decision carried");
const linkRow = rows.findIndex((r) => r.signals.some((s) => s.sourceUrl));
if (linkRow >= 0) {
  const v = ws.getCell(linkRow + 3, 14).value as { hyperlink?: string };
  assert(typeof v?.hyperlink === "string" && v.hyperlink.startsWith("http"), "xlsx: source is a live link");
} else assert(true, "xlsx: fixture has no source links (none invented)");
const readyIdx = rows.findIndex((r) => r.status === "reach");
if (readyIdx >= 0) assert(ws.getCell(readyIdx + 3, 2).fill?.fgColor?.argb === READY_FILL, "xlsx: ready-to-reach rows highlighted");
const notReady = rows.findIndex((r) => r.status !== "reach");
if (notReady >= 0) assert(!ws.getCell(notReady + 3, 2).fill?.fgColor, "xlsx: other rows not highlighted");
assert(ws.getCell(rows.length + 3, 3).value === "Needs start date", "xlsx: incomplete rows labelled");

// ---------- ics ----------
assert(icsText("a,b;c\\d\ne") === "a\\,b\\;c\\\\d\\ne", "ics: text escaping");
const long = "DESCRIPTION:" + "x".repeat(200);
assert(foldLine(long).split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75), "ics: lines folded at 75 octets");
assert(foldLine(long).replace(/\r\n /g, "") === long, "ics: folding is lossless");
const plan = planReminders(rows, asOf);
assert(plan.reminders.length + plan.closed.length === rows.length, "ics: every row planned or reported closed");
assert(plan.reminders.every((r) => r.day.getTime() >= asOf.getTime()), "ics: no reminder in the past");
assert(plan.reminders.every((r) => r.day.getTime() <= r.closes.getTime()), "ics: reminder falls inside the window");
const ics = remindersIcs(plan.reminders, new Date(Date.UTC(2026, 9, 19, 12)));
assert(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n") && ics.endsWith("END:VCALENDAR\r\n"), "ics: calendar wrapper and CRLF");
assert((ics.match(/BEGIN:VEVENT/g) ?? []).length === plan.reminders.length, "ics: one event per reminder");
assert(ics.includes("DTSTAMP:20261019T120000Z"), "ics: DTSTAMP in UTC");
assert(/DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}/.test(ics), "ics: all-day events");
assert(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75), "ics: no line over 75 octets");
// Window already closed: reported, not scheduled.
const past = scoreResearchers(parseImport("name,employer,start_date,type,date,note\nOld Signal,Lab,2020-01-15,release,2024-01-01,Old paper\n", "p.csv").people, DEFAULT_WEIGHTS, asOf);
const pastPlan = planReminders(past, asOf);
assert(past[0].driving.windowCloses < asOf ? pastPlan.closed.length === 1 && pastPlan.reminders.length === 0 : pastPlan.reminders.length === 1, "ics: closed windows reported, not scheduled");
// Future window: reminder lands on the day it opens.
const future = plan.reminders.find((r) => r.day.getTime() > asOf.getTime());
if (future) {
  const row = rows.find((r) => r.person.id === future.id)!;
  assert(future.day.getTime() === row.driving.windowOpens.getTime(), "ics: future window reminds on its opening day");
}
// Test-only rows (labelled, not people): a sourced release today, to check links, highlight and URL.
const linked = scoreResearchers(parseImport("name,employer,start_date,type,date,source_url,note\nTest Row Linked,Test Lab,2025-11-01,release,2026-10-18,https://arxiv.org/abs/2610.13002,Test release\n", "t.csv").people, DEFAULT_WEIGHTS, asOf);
const lsheet = queueSheet(linked, [], {}, DEFAULT_WEIGHTS, asOf, "t.csv");
const lwb = new ExcelJS.Workbook();
await lwb.xlsx.load(await queueXlsx(ExcelJS, lsheet));
const lv = lwb.getWorksheet("Queue").getCell(3, 14).value as { hyperlink?: string };
assert(lv?.hyperlink === "https://arxiv.org/abs/2610.13002", "xlsx: source url becomes a live link");
const lics = remindersIcs(planReminders(linked, asOf).reminders, asOf);
assert(lics.includes("URL:https://arxiv.org/abs/2610.13002"), "ics: event carries the source url");
assert(lics.replace(/\r\n /g, "").includes("Nothing was sent."), "ics: description says nothing was sent");
const ex = parseImport(readFileSync("public/ping-when-example.csv", "utf8"), "ping-when-example.csv");
const exRows = scoreResearchers(ex.people, DEFAULT_WEIGHTS, asOf);
const exWb = new ExcelJS.Workbook();
await exWb.xlsx.load(await queueXlsx(ExcelJS, queueSheet(exRows, ex.unscored, {}, DEFAULT_WEIGHTS, asOf, "example")));
const ri = exRows.findIndex((r) => r.status === "reach");
assert(ri >= 0 && exWb.getWorksheet("Queue").getCell(ri + 3, 2).fill?.fgColor?.argb === READY_FILL, "xlsx: ready-to-reach rows highlighted (example file)");
console.log(failed ? `${failed} workflow checks failed` : "workflow checks passed");
}
main();
