import { parseStartDate } from "@/lib/dates";
import type { ScoredResearcher } from "@/lib/scoring";
import { firstTouch } from "@/lib/copy";
import type { ObservedSignalType, ReleaseKind, Researcher, SeedSignal } from "@/lib/types";

export const TEMPLATE_HEADER = "name,role,employer,start_date,type,date,source_url,note";

export const TEMPLATE_CSV = `${TEMPLATE_HEADER}\nFictional Example,Research scientist,Example Lab (fictional),2025-11-09,release,2026-10-19,https://example.com/fictional-example,Fictional example release (replace this row)\n`;

export const DEFAULT_SIGNAL_STRENGTH = 0.6;

export const UNSCORED_LABEL = "unscored — needs date";

/** Signal-type aliases, keyed by the type stripped of spaces/hyphens/underscores and lower-cased. */
const SIGNAL_TYPE_ALIASES: Record<string, ObservedSignalType> = {
  release: "release",
  paper: "release",
  publication: "release",
  talk: "talk",
  presentation: "talk",
  keynote: "talk",
  oss: "oss",
  opensource: "oss",
  github: "oss",
  funding: "funding",
  raised: "funding",
  raise: "funding",
  layoff: "layoff",
  layoffs: "layoff",
  building: "building",
  reorg: "reorg",
};

function resolveSignalType(raw: string): ObservedSignalType | undefined {
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return SIGNAL_TYPE_ALIASES[key];
}

/** Only name is truly required; role/employer may be blank and a missing
 *  or invalid start_date leaves the candidate listed but unscored. */
const REQUIRED = ["name"] as const;

/** Normalised header: BOM stripped, lower-cased, punctuation becomes spaces. */
function normalizeHeader(cell: string): string {
  return cell
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface HeaderCandidate {
  canonical: string;
  priority: number;
}

/**
 * Fuzzy header candidates for one cell, highest priority first.
 * Exact/template headers score highest so they keep working unchanged;
 * start-ish matches outrank a bare signal "date" so a signal-date column
 * is never taken for start_date (and vice versa for "date started").
 */
function headerCandidates(cell: string): HeaderCandidate[] {
  const norm = normalizeHeader(cell);
  if (!norm) return [];
  const compact = norm.replace(/ /g, "");
  const tokens = new Set(norm.split(" "));
  const found = new Map<string, number>();
  const add = (canonical: string, priority: number) => {
    if ((found.get(canonical) ?? -1) < priority) found.set(canonical, priority);
  };

  // name: exact name/candidate/person, or any header containing "name"
  if (compact === "name" || compact === "candidate" || compact === "person") add("name", 100);
  if (tokens.has("candidate") || tokens.has("person")) add("name", 85);
  if (compact.includes("name")) add("name", 80);

  // role: role/title/position/job/function
  if (compact === "role") add("role", 100);
  if (["role", "title", "position", "job", "function"].some((word) => compact.includes(word))) add("role", 80);

  // employer: employer/company/organisation/organization/org/firm
  if (compact === "employer" || compact === "company") add("employer", 100);
  if (
    ["employer", "company", "organisation", "organization", "firm"].some((word) => compact.includes(word)) ||
    tokens.has("org")
  )
    add("employer", 80);

  // start_date: start/joined/tenure/since/hired/hire (incl. "date started")
  if (compact === "startdate") add("start_date", 100);
  if (norm === "start date" || norm === "date started") add("start_date", 95);
  if (
    ["start", "started", "joined", "tenure", "since", "hired", "hire"].some(
      (word) => tokens.has(word) || compact.includes(word),
    )
  )
    add("start_date", 85);

  // ends_on must beat a generic "date" reading of "end date"
  if (compact === "endson") add("ends_on", 100);
  if (norm === "ends on" || norm === "end date") add("ends_on", 92);

  // signal type: type, or bare signal/event, or signal/event type
  if (compact === "type") add("type", 100);
  if ((tokens.has("signal") || tokens.has("event")) && tokens.has("type")) add("type", 90);
  if (norm === "signal" || norm === "event") add("type", 85);

  // signal date: bare date, or signal/event date; never from a start-ish header
  if (compact === "date") add("date", 90);
  if ((tokens.has("signal") || tokens.has("event")) && tokens.has("date")) add("date", 88);
  if (compact.includes("date")) add("date", 70);

  // source_url: source_url/source url, or any url/link header
  if (compact === "sourceurl" || norm === "source url") add("source_url", 100);
  if (compact.includes("url") || compact.includes("link")) add("source_url", 85);

  // note: note/notes, or details/comment
  if (compact === "note" || compact === "notes") add("note", 100);
  if (["note", "details", "comment"].some((word) => compact.includes(word))) add("note", 80);

  // remaining exact template/extra columns
  if (compact === "strength") add("strength", 100);
  if (compact === "kind") add("kind", 100);
  if (compact === "id") add("id", 100);
  if ((tokens.has("candidate") || tokens.has("person")) && tokens.has("id")) add("id", 90);
  if (compact === "archetype") add("archetype", 100);
  if (compact === "workhook" || norm === "work hook") add("work_hook", 100);

  // Tie-break: more specific columns win over a generic "name"/"date" reading
  // (e.g. "Company Name" is the employer, "Candidate ID" is the id).
  const tieBreak = ["start_date", "ends_on", "id", "source_url", "employer", "role", "type", "date", "note", "name"];
  return [...found.entries()]
    .map(([canonical, priority]) => ({ canonical, priority }))
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        tieBreak.indexOf(a.canonical) - tieBreak.indexOf(b.canonical),
    );
}

export interface ImportError {
  row: number;
  message: string;
}

export interface UnscoredCandidate {
  id: string;
  name: string;
  role: string;
  employer: string;
  startDate: string;
  rows: number[];
  reason: typeof UNSCORED_LABEL;
  missing: string;
}

export interface ImportResult {
  people: Researcher[];
  unscored: UnscoredCandidate[];
  errors: ImportError[];
}

interface DraftSignal {
  row: number;
  type: ObservedSignalType;
  date: string;
  sourceUrl?: string;
  note: string;
  strength: number;
  kind?: ReleaseKind;
  endsOn?: string;
  undated: boolean;
}

interface DraftPerson {
  id: string;
  name: string;
  role: string;
  employer: string;
  startRaw: string;
  startDate: string | null;
  archetype: string;
  workHook: string;
  rows: number[];
  signals: DraftSignal[];
  needsDate: string[];
}

export function parseImport(text: string, filename = "paste"): ImportResult {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { people: [], unscored: [], errors: [{ row: 1, message: "The file is empty." }] };
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed, filename);
  }
  return parseCsvDocument(text);
}

export function exampleCsv(people: Researcher[]): string {
  const header = `${TEMPLATE_HEADER},strength,kind,ends_on,id,archetype,work_hook`;
  const lines = [
    header,
    ...people.flatMap((person) => {
      if (person.signals.length === 0) {
        return [
          csvRow([
            person.name,
            person.roleType,
            person.org,
            person.roleStart,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            person.id,
            person.archetype,
            person.workHook,
          ]),
        ];
      }
      return person.signals.map((signal, index) =>
        csvRow([
          person.name,
          person.roleType,
          person.org,
          person.roleStart,
          signal.type,
          signal.date,
          signal.sourceUrl ?? `https://example.com/ping-when/${person.id}/${index + 1}`,
          signal.title,
          String(signal.strength),
          signal.kind ?? "",
          signal.endsOn ?? "",
          person.id,
          person.archetype,
          person.workHook,
        ]),
      );
    }),
  ];
  return `${lines.join("\n")}\n`;
}

export function sourceUrlFor(row: ScoredResearcher): string {
  if (row.driving.sourceUrl) return row.driving.sourceUrl;
  const ranked = [...row.signals].filter((signal) => signal.sourceUrl).sort((a, b) => b.raw - a.raw);
  return ranked[0]?.sourceUrl ?? "";
}

export function approvedQueueCsv(rows: ScoredResearcher[], approvedIds: Set<string>): string {
  const header = "name,score,driving signal,source url,suggested angle";
  const lines = rows
    .filter((row) => approvedIds.has(row.person.id))
    .map((row) =>
      csvRow([
        row.person.name,
        String(row.score),
        row.driving.title,
        sourceUrlFor(row),
        firstTouch(row),
      ]),
    );
  return `${[header, ...lines].join("\n")}\n`;
}

function parseJson(text: string, filename: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      people: [],
      unscored: [],
      errors: [{ row: 1, message: `${filename} is not valid JSON.` }],
    };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { candidates?: unknown }).candidates)
      ? (data as { candidates: unknown[] }).candidates
      : null;
  if (!list) {
    return {
      people: [],
      unscored: [],
      errors: [{ row: 1, message: "JSON must be an array of candidates, or an object with a candidates array." }],
    };
  }
  if (list.length === 0) {
    return {
      people: [],
      unscored: [],
      errors: [{ row: 1, message: "No candidates in this file." }],
    };
  }
  const drafts: DraftPerson[] = [];
  const errors: ImportError[] = [];
  list.forEach((item, index) => {
    const row = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ row, message: "Candidate must be an object." });
      return;
    }
    const record = item as Record<string, unknown>;
    const name = asString(record.name);
    const role = asString(record.role);
    const employer = asString(record.employer) || asString(record.company);
    const startRaw =
      asString(record.start_date) ||
      asString(record.start) ||
      asString(record["start-date"]) ||
      asString(record["start date"]);
    if (!name) {
      errors.push({ row, message: "Missing name." });
      return;
    }
    const draft = blankDraft({
      id: asString(record.id) || stableId(name, employer, role, startRaw),
      name,
      role,
      employer,
      startRaw,
      archetype: asString(record.archetype),
      workHook: asString(record.work_hook),
      row,
    });
    const signals = record.signals;
    if (signals !== undefined && !Array.isArray(signals)) {
      errors.push({ row, message: "signals must be an array." });
    } else if (Array.isArray(signals)) {
      signals.forEach((signal, signalIndex) => {
        readSignal(draft, errors, row, signal, signalIndex + 1);
      });
    }
    drafts.push(draft);
  });
  return finish(drafts, errors);
}

function parseCsvDocument(text: string): ImportResult {
  const table = parseCsvRows(text);
  if (table.length === 0) {
    return { people: [], unscored: [], errors: [{ row: 1, message: "The file is empty." }] };
  }
  const header = table[0];
  const columns = indexHeader(header.cells);
  const missing = REQUIRED.filter((name) => columns[name] === undefined);
  if (missing.length > 0) {
    const saw = header.cells.map((cell) => cell.trim()).filter(Boolean).join(", ") || "(no headers)";
    return {
      people: [],
      unscored: [],
      errors: [
        {
          row: header.line,
          message: `Header is missing ${missing.join(", ")}. Saw: ${saw}. Only name is required: a name column is enough to list someone; role and employer can be blank, and start_date (YYYY-MM or YYYY-MM-DD) is what scores them \u2014 without it they stay unscored. Signal columns (type, date, source_url, note) are optional. Full template: ${TEMPLATE_HEADER}.`,
        },
      ],
    };
  }
  if (table.length === 1) {
    return {
      people: [],
      unscored: [],
      errors: [{ row: header.line, message: "No candidate rows under the header." }],
    };
  }
  const errors: ImportError[] = [];
  const groups = new Map<string, DraftPerson>();
  const order: string[] = [];
  for (const record of table.slice(1)) {
    const cells = record.cells;
    const minColumns = Math.min(4, header.cells.length);
    if (cells.length < minColumns) {
      errors.push({
        row: record.line,
        message: `Expected at least ${minColumns} columns, received ${cells.length}.`,
      });
      continue;
    }
    const extra = cells.slice(header.cells.length).some((value) => value.trim() !== "");
    if (extra) {
      errors.push({
        row: record.line,
        message: `Expected ${header.cells.length} columns, received ${cells.length}.`,
      });
      continue;
    }
    const read = (name: string) => (cells[columns[name] ?? -1] ?? "").trim();
    const name = read("name");
    const role = read("role");
    const employer = read("employer");
    const startRaw = read("start_date");
    if (!name) {
      errors.push({ row: record.line, message: "Missing name." });
      continue;
    }
    const explicitId = read("id");
    const key = explicitId || `${name}\u0000${role}\u0000${employer}\u0000${startRaw}`;
    let draft = groups.get(key);
    if (!draft) {
      draft = blankDraft({
        id: explicitId || stableId(name, employer, role, startRaw),
        name,
        role,
        employer,
        startRaw,
        archetype: read("archetype"),
        workHook: read("work_hook"),
        row: record.line,
      });
      groups.set(key, draft);
      order.push(key);
    } else {
      draft.rows.push(record.line);
      if (!draft.archetype && read("archetype")) draft.archetype = read("archetype");
      if (!draft.workHook && read("work_hook")) draft.workHook = read("work_hook");
    }
    const type = read("type");
    const date = read("date");
    const sourceUrl = read("source_url");
    const note = read("note");
    const strengthRaw = read("strength");
    const kindRaw = read("kind");
    const endsOn = read("ends_on");
    if (!type && !date && !sourceUrl && !note && !strengthRaw) continue;
    pushSignal(draft, errors, record.line, {
      type,
      date,
      sourceUrl,
      note,
      strengthRaw,
      kindRaw,
      endsOn,
    });
  }
  return finish(order.map((key) => groups.get(key)!), errors);
}

function blankDraft(input: {
  id: string;
  name: string;
  role: string;
  employer: string;
  startRaw: string;
  archetype: string;
  workHook: string;
  row: number;
}): DraftPerson {
  const startDate = input.startRaw ? parseStartDate(input.startRaw) : null;
  const needsDate: string[] = [];
  if (!input.startRaw) needsDate.push("Missing start_date.");
  else if (!startDate) needsDate.push(`start_date “${input.startRaw}” is not YYYY-MM or YYYY-MM-DD.`);
  return {
    id: input.id,
    name: input.name,
    role: input.role,
    employer: input.employer,
    startRaw: input.startRaw,
    startDate,
    archetype: input.archetype,
    workHook: input.workHook,
    rows: [input.row],
    signals: [],
    needsDate,
  };
}

function pushSignal(
  draft: DraftPerson,
  errors: ImportError[],
  row: number,
  input: {
    type: string;
    date: string;
    sourceUrl: string;
    note: string;
    strengthRaw: string;
    kindRaw: string;
    endsOn: string;
  },
) {
  const resolvedType = resolveSignalType(input.type);
  if (input.type.trim().toLowerCase().replace(/[\s_-]+/g, "") === "cliff") {
    errors.push({ row, message: "A cliff is inferred from start_date. Remove this cliff row." });
    return;
  }
  if (!resolvedType) {
    errors.push({
      row,
      message: `Unknown signal type “${input.type || "(blank)"}”. Only this signal was dropped; the candidate was kept and can still be scored from start_date (cliff) or other valid signals. Use release, talk, oss, funding, layoff, building, or reorg (aliases include paper, publication, presentation, keynote, opensource, github, raised, layoffs, re-org).`,
    });
    return;
  }
  if (!input.date) {
    draft.needsDate.push(`Row ${row} signal has no date.`);
  }
  const dated = input.date ? parseStartDate(input.date) : null;
  if (input.date && (!dated || !/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()))) {
    errors.push({ row, message: `Signal date “${input.date}” must be YYYY-MM-DD.` });
    draft.needsDate.push(`Row ${row} signal date is not usable.`);
  }
  let strength = DEFAULT_SIGNAL_STRENGTH;
  if (input.strengthRaw) {
    const parsed = Number(input.strengthRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      errors.push({ row, message: `strength “${input.strengthRaw}” must be a number from 0 to 1.` });
    } else {
      strength = parsed;
    }
  }
  let kind: ReleaseKind | undefined;
  if (input.kindRaw) {
    if (input.kindRaw === "paper" || input.kindRaw === "model") kind = input.kindRaw;
    else errors.push({ row, message: `kind “${input.kindRaw}” must be paper or model.` });
  }
  let endsOn: string | undefined;
  if (input.endsOn) {
    const parsed = parseStartDate(input.endsOn);
    if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn.trim())) {
      errors.push({ row, message: `ends_on “${input.endsOn}” must be YYYY-MM-DD.` });
    } else {
      endsOn = parsed;
    }
  }
  let sourceUrl: string | undefined;
  if (input.sourceUrl) {
    if (!/^https?:\/\//i.test(input.sourceUrl)) {
      errors.push({ row, message: `source_url “${input.sourceUrl}” must start with http:// or https://.` });
    } else {
      sourceUrl = input.sourceUrl;
    }
  }
  const usableDate = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) ? input.date.trim() : "";
  draft.signals.push({
    row,
    type: resolvedType,
    date: usableDate,
    sourceUrl,
    note: input.note,
    strength,
    kind,
    endsOn,
    undated: !usableDate,
  });
}

function readSignal(draft: DraftPerson, errors: ImportError[], row: number, signal: unknown, signalIndex: number) {
  if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
    errors.push({ row, message: `Signal ${signalIndex} must be an object.` });
    return;
  }
  const record = signal as Record<string, unknown>;
  pushSignal(draft, errors, row, {
    type: asString(record.type),
    date: asString(record.date),
    sourceUrl: asString(record.source_url),
    note: asString(record.note),
    strengthRaw: record.strength === undefined || record.strength === null ? "" : String(record.strength),
    kindRaw: asString(record.kind),
    endsOn: asString(record.ends_on),
  });
}

function finish(drafts: DraftPerson[], errors: ImportError[]): ImportResult {
  const seen = new Set<string>();
  const people: Researcher[] = [];
  const unscored: UnscoredCandidate[] = [];
  for (const draft of drafts) {
    let id = draft.id || stableId(draft.name, draft.employer, draft.role, draft.startRaw);
    if (seen.has(id)) id = `${id}-${draft.rows[0]}`;
    seen.add(id);
    if (!draft.startDate || draft.needsDate.length > 0 || draft.signals.some((signal) => signal.undated)) {
      const missing = draft.needsDate.length > 0 ? draft.needsDate.join(" ") : "A signal is missing its date.";
      unscored.push({
        id,
        name: draft.name,
        role: draft.role,
        employer: draft.employer,
        startDate: draft.startRaw,
        rows: draft.rows,
        reason: UNSCORED_LABEL,
        missing,
      });
      continue;
    }
    const signals: SeedSignal[] = draft.signals
      .filter((signal) => signal.date)
      .map((signal) => ({
        type: signal.type,
        date: signal.date,
        title: signal.note || signal.type,
        detail: signal.note || signal.type,
        strength: signal.strength,
        kind: signal.kind,
        endsOn: signal.endsOn,
        sourceUrl: signal.sourceUrl,
      }));
    people.push({
      id,
      name: draft.name,
      archetype: draft.archetype,
      roleType: draft.role || "Researcher",
      org: draft.employer || "Unknown employer",
      location: "",
      roleStart: draft.startDate,
      focus: "",
      workHook: draft.workHook || `the work at ${draft.employer || "their current employer"}`,
      signals,
    });
  }
  if (people.length === 0 && unscored.length === 0 && errors.length === 0) {
    errors.push({ row: 1, message: "No candidates in this file." });
  }
  return { people, unscored, errors };
}

function indexHeader(cells: string[]): Record<string, number> {
  // Assign highest-priority matches first so exact and start-ish headers
  // claim their column before a fuzzy/bare-date reading of another cell can.
  const candidates = cells.flatMap((cell, i) =>
    headerCandidates(cell).map((candidate) => ({ ...candidate, cell: i })),
  );
  candidates.sort((a, b) => b.priority - a.priority || a.cell - b.cell);
  const index: Record<string, number> = {};
  const used = new Set<number>();
  for (const candidate of candidates) {
    if (used.has(candidate.cell) || index[candidate.canonical] !== undefined) continue;
    index[candidate.canonical] = candidate.cell;
    used.add(candidate.cell);
  }
  return index;
}

/** Sniff the delimiter from the header line: tabs, then semicolons over commas. */
function detectDelimiter(text: string): string {
  const src = text.replace(/^\uFEFF/, "");
  const headerLine = src.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  if (headerLine.includes("\t")) return "\t";
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i += 1) {
    const char = headerLine[i];
    if (char === '"') {
      if (inQuotes && headerLine[i + 1] === '"') i += 1;
      else inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === ",") commas += 1;
    if (char === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stableId(name: string, employer: string, role: string, start: string): string {
  const raw = `${name}|${employer}|${role}|${start}`.toLowerCase();
  let hash = 0;
  for (const char of raw) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return `p-${hash.toString(16)}`;
}

export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

interface CsvParsedRow {
  line: number;
  cells: string[];
}

export function parseCsvRows(text: string): CsvParsedRow[] {
  const rows: CsvParsedRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const pushRow = () => {
    cells.push(cell);
    cell = "";
    if (cells.some((value) => value.trim() !== "")) rows.push({ line: rowLine, cells });
    cells = [];
    rowLine = line;
  };
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && src[i + 1] === "\n") i += 1;
      line += 1;
      pushRow();
      rowLine = line;
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || cells.length > 0) pushRow();
  return rows;
}
