import { firstTouch } from "@/lib/copy";
import { formatDay, parseISODate } from "@/lib/dates";
import { sourceUrlFor, type UnscoredCandidate } from "@/lib/exchange";
import type { ScoredResearcher } from "@/lib/scoring";
import type { Decision } from "@/lib/storage";
import type { Weights } from "@/lib/types";

/** Styling follows the shared pretty_sheet formatter: title row, black header with white bold text,
 * frozen header, filter on every column, widths capped at 46, real date and number cells, live links. */
export const HEADER_FILL = "FF000000";
export const HEADER_FONT = "FFFFFFFF";
export const READY_FILL = "FFEBFF0A";
export const LINK_COLOR = "FF1F4E99";
export const WIDTH_CAP = 46;
/** Like pretty_sheet: row height follows the wrapped text in the first eight columns, 15 points a line. */
export const MAIN_COLUMNS = 8;
export const LINE_POINTS = 15;

export function rowLines(values: CellValue[], widths: number[]): number {
  let lines = 1;
  values.slice(0, MAIN_COLUMNS).forEach((v, j) => {
    if (typeof v === "string" && v) lines = Math.max(lines, Math.ceil(v.length / Math.max(1, widths[j] - 1)));
  });
  return lines;
}

export type CellValue = string | number | Date | { link: string } | null;

export interface Column {
  header: string;
  kind: "text" | "number" | "date" | "url";
}

export const QUEUE_COLUMNS: Column[] = [
  { header: "Rank", kind: "number" },
  { header: "Name", kind: "text" },
  { header: "Status", kind: "text" },
  { header: "Score", kind: "number" },
  { header: "Cliff", kind: "number" },
  { header: "Proof", kind: "number" },
  { header: "Shift", kind: "number" },
  { header: "Driving signal", kind: "text" },
  { header: "Window opens", kind: "date" },
  { header: "Window closes", kind: "date" },
  { header: "Decision", kind: "text" },
  { header: "Employer", kind: "text" },
  { header: "Start date", kind: "date" },
  { header: "Source", kind: "url" },
  { header: "Suggested angle", kind: "text" },
];

const STATUS_TEXT = { reach: "Ready to reach", warm: "Warm up", wait: "Wait" } as const;
const DECISION_TEXT = { approve: "Approved", snooze: "Snoozed", dismiss: "Dismissed" } as const;

/** Text that a spreadsheet would run as a formula is stored with a leading apostrophe, as pretty_sheet does. */
export function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export interface QueueSheet {
  title: string;
  columns: Column[];
  rows: CellValue[][];
  ready: boolean[];
  about: string[];
}

export function queueSheet(
  rows: ScoredResearcher[],
  unscored: UnscoredCandidate[],
  decisions: Record<string, Decision | undefined>,
  weights: Weights,
  asOf: Date,
  sourceLabel: string,
): QueueSheet {
  const body: CellValue[][] = [];
  const ready: boolean[] = [];
  for (const row of rows) {
    const url = sourceUrlFor(row);
    const d = decisions[row.person.id];
    body.push([
      row.rank,
      safeText(row.person.name),
      STATUS_TEXT[row.status],
      row.score,
      Math.round(row.categories.cliff),
      Math.round(row.categories.proof),
      Math.round(row.categories.shift),
      safeText(row.driving.title),
      row.driving.windowOpens,
      row.driving.windowCloses,
      d ? DECISION_TEXT[d] : "",
      safeText(row.person.org),
      row.person.roleStart ? parseISODate(row.person.roleStart) : null,
      url ? { link: url } : null,
      safeText(firstTouch(row)),
    ]);
    ready.push(row.status === "reach");
  }
  for (const person of unscored) {
    body.push([
      null,
      safeText(person.name),
      "Needs start date",
      null,
      null,
      null,
      null,
      "",
      null,
      null,
      "",
      safeText(person.employer ?? ""),
      null,
      null,
      "",
    ]);
    ready.push(false);
  }
  return {
    title: `Ping When ranked queue, scored ${formatDay(asOf)}`,
    columns: QUEUE_COLUMNS,
    rows: body,
    ready,
    about: [
      `Source file: ${sourceLabel || "imported roster"}.`,
      `Scored on ${formatDay(asOf)} with weights ${weights.cliff} cliff, ${weights.proof} proof, ${weights.shift} shift.`,
      `${rows.length} scored, ${unscored.length} need a start date. Rows without a start date have no score; none was guessed.`,
      "Yellow rows clear 60 inside this week's window. A cliff is inferred from the start date, not read from a grant.",
      "Decisions come from this browser. Nothing was sent.",
    ],
  };
}

function cellText(value: CellValue): string {
  if (value === null) return "";
  if (value instanceof Date) return "Mmm 00, 0000";
  if (typeof value === "object") return value.link;
  return String(value);
}

export function columnWidths(sheet: QueueSheet): number[] {
  return sheet.columns.map((col, j) => {
    const longest = Math.max(col.header.length, ...sheet.rows.map((r) => cellText(r[j]).length));
    return Math.min(WIDTH_CAP, Math.max(8, longest + 2));
  });
}

/* Minimal surface of ExcelJS used here, so the same code runs with the vendored browser build and in tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcelLib = { Workbook: new () => any };

export async function queueXlsx(lib: ExcelLib, sheet: QueueSheet): Promise<ArrayBuffer> {
  const wb = new lib.Workbook();
  wb.creator = "Ping When";
  const ws = wb.addWorksheet("Queue", {
    views: [{ state: "frozen", ySplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = columnWidths(sheet);
  const n = sheet.columns.length;
  ws.getCell(1, 1).value = sheet.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, name: "Arial" };
  sheet.columns.forEach((col, j) => {
    const c = ws.getCell(2, j + 1);
    c.value = col.header;
    c.font = { bold: true, color: { argb: HEADER_FONT }, name: "Arial" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    c.alignment = { vertical: "middle", wrapText: true };
    ws.getColumn(j + 1).width = widths[j];
  });
  sheet.rows.forEach((values, i) => {
    const r = i + 3;
    ws.getRow(r).height = LINE_POINTS * rowLines(values, widths);
    values.forEach((v, j) => {
      const c = ws.getCell(r, j + 1);
      const kind = sheet.columns[j].kind;
      c.font = { name: "Arial", size: 10 };
      if (v === null) c.value = null;
      else if (typeof v === "object" && !(v instanceof Date)) {
        c.value = { text: v.link, hyperlink: v.link };
        c.font = { color: { argb: LINK_COLOR }, underline: true, name: "Arial", size: 10 };
      } else c.value = v;
      if (kind === "date") c.numFmt = "mmm d, yyyy";
      c.alignment = { vertical: "top", wrapText: kind === "text" && j < MAIN_COLUMNS };
      if (sheet.ready[i]) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: READY_FILL } };
    });
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: Math.max(2, sheet.rows.length + 2), column: n } };
  const about = wb.addWorksheet("About");
  about.getColumn(1).width = 110;
  about.getCell(1, 1).value = "About this file";
  about.getCell(1, 1).font = { bold: true, size: 12, name: "Arial" };
  sheet.about.forEach((line, i) => {
    const c = about.getCell(i + 2, 1);
    c.value = line;
    c.alignment = { wrapText: true, vertical: "top" };
  });
  return wb.xlsx.writeBuffer();
}

/** Loads the vendored ExcelJS build once, on first export. */
let loading: Promise<ExcelLib> | null = null;
export function loadExcel(src = "/vendor/exceljs.min.js"): Promise<ExcelLib> {
  const w = window as unknown as { ExcelJS?: ExcelLib };
  if (w.ExcelJS) return Promise.resolve(w.ExcelJS);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => (w.ExcelJS ? resolve(w.ExcelJS) : reject(new Error("ExcelJS did not load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the spreadsheet library"));
    };
    document.head.appendChild(s);
  });
  return loading;
}
