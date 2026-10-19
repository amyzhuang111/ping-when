import {
  CLIFF_PEAK_DAYS,
  CLIFF_SIGMA,
  HALF_LIFE_DAYS,
  REACH_THRESHOLD,
  WARM_THRESHOLD,
  WINDOW,
  YEAR_WEIGHT,
} from "@/lib/constants";
import {
  addDays,
  addMonths,
  daysBetween,
  formatDay,
  parseISODate,
  rangesOverlap,
  toISODate,
  todayUTC,
  weekEnding,
} from "@/lib/dates";
import type { Researcher, SignalType, Status, WeightKey, Weights } from "@/lib/types";

export type WindowState = "open" | "ahead" | "closed";

export interface ScoredSignal {
  id: string;
  type: SignalType;
  category: WeightKey;
  date: string;
  title: string;
  detail: string;
  raw: number;
  daysAgo: number;
  factorLabel: string;
  windowOpens: Date;
  windowCloses: Date;
  windowState: WindowState;
  cliffMonths?: 12 | 24 | 36;
  yearWeight?: number;
  kind?: "paper" | "model";
  sourceUrl?: string;
}

export interface CliffFootnote {
  months: 12 | 24 | 36;
  date: string;
  active: boolean;
}

export interface ScoredResearcher {
  person: Researcher;
  monthsInRole: number;
  scoreExact: number;
  score: number;
  status: Status;
  categories: Record<WeightKey, number>;
  weightedPoints: Record<WeightKey, number>;
  signals: ScoredSignal[];
  driving: ScoredSignal;
  windowState: WindowState;
  toneReview: boolean;
  cliffMarks: CliffFootnote[];
  rank: number;
}

const MARKS = [12, 24, 36] as const;

export function categoryOf(type: SignalType): WeightKey {
  if (type === "cliff") return "cliff";
  if (type === "release" || type === "talk" || type === "oss") return "proof";
  return "shift";
}

export function recencyDecay(daysAgo: number): number {
  if (daysAgo <= 0) {
    const ahead = -daysAgo;
    if (ahead <= CLIFF_PEAK_DAYS) return 1;
    return 0.5 ** ((ahead - CLIFF_PEAK_DAYS) / HALF_LIFE_DAYS);
  }
  return 0.5 ** (daysAgo / HALF_LIFE_DAYS);
}

export function cliffProximity(daysUntil: number): number {
  if (daysUntil > 110 || daysUntil < -40) return 0;
  const delta = daysUntil - CLIFF_PEAK_DAYS;
  const gaussian = Math.exp(-(delta * delta) / (2 * CLIFF_SIGMA * CLIFF_SIGMA));
  return 0.05 + 0.95 * gaussian;
}

export function windowStateFor(opens: Date, closes: Date, asOf: Date = todayUTC()): WindowState {
  const weekEnd = weekEnding(asOf);
  if (rangesOverlap(opens, closes, asOf, weekEnd)) return "open";
  if (opens.getTime() > weekEnd.getTime()) return "ahead";
  return "closed";
}

function windowFor(type: SignalType, event: Date, endsOn?: Date): { opens: Date; closes: Date } {
  switch (type) {
    case "cliff":
      return {
        opens: addDays(event, -WINDOW.cliff.before),
        closes: addDays(event, WINDOW.cliff.after),
      };
    case "release":
      return { opens: event, closes: addDays(event, WINDOW.release.after) };
    case "talk": {
      const end = endsOn ?? addDays(event, WINDOW.talk.defaultLength);
      return { opens: event, closes: addDays(end, WINDOW.talk.afterSession) };
    }
    case "oss":
      return { opens: event, closes: addDays(event, WINDOW.oss.after) };
    case "funding":
      return { opens: event, closes: addDays(event, WINDOW.funding.after) };
    case "layoff":
      return { opens: event, closes: addDays(event, WINDOW.layoff.after) };
    case "building":
      return { opens: event, closes: addDays(event, WINDOW.building.after) };
    case "reorg":
      return { opens: event, closes: addDays(event, WINDOW.reorg.after) };
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function squash(raws: number[]): number {
  const sorted = [...raws].sort((a, b) => b - a);
  const total = (sorted[0] ?? 0) + 0.45 * (sorted[1] ?? 0) + 0.2 * (sorted[2] ?? 0);
  return Math.min(100, total);
}

/** Closest to the line: every scored person who is not in this week's queue, in rank order. No cap — a scored person must never be silently hidden. */
export function closestToTheLine(rows: ScoredResearcher[]): ScoredResearcher[] {
  return rows.filter((row) => row.status !== "reach");
}

/* Deterministic order: score to 1e-9 (so last-bit float differences between engines cannot flip
   a tie), then name by code point (no locale), then id. */
const quantize = (n: number) => Math.round(n * 1e9);
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function compareRows(a: ScoredResearcher, b: ScoredResearcher): number {
  return (
    quantize(b.scoreExact) - quantize(a.scoreExact) ||
    byCodePoint(a.person.name, b.person.name) ||
    byCodePoint(a.person.id, b.person.id)
  );
}

export function scoreResearchers(
  people: Researcher[],
  weights: Weights,
  asOf: Date = todayUTC(),
): ScoredResearcher[] {
  const scored = people.map((person) => scoreOne(person, weights, asOf));
  scored.sort(compareRows);
  return scored.map((row, index) => ({ ...row, rank: index + 1 }));
}

function scoreOne(person: Researcher, weights: Weights, asOf: Date): ScoredResearcher {
  const start = parseISODate(person.roleStart);
  const marks = MARKS.map((months) => {
    const date = addMonths(start, months);
    const daysUntil = daysBetween(asOf, date);
    const proximity = cliffProximity(daysUntil);
    const yearWeight = YEAR_WEIGHT[months];
    return { months, date, daysUntil, proximity, yearWeight, raw: 100 * proximity * yearWeight };
  });

  let active = marks[0];
  for (const mark of marks.slice(1)) {
    const tied = Math.abs(mark.raw - active.raw) <= 0.01;
    const closer = Math.abs(mark.daysUntil) < Math.abs(active.daysUntil);
    if (mark.raw > active.raw + 0.01 || (tied && closer)) active = mark;
  }

  const cliffWindow = windowFor("cliff", active.date);
  const cliffSignal: ScoredSignal = {
    id: `${person.id}-cliff-${active.months}`,
    type: "cliff",
    category: "cliff",
    date: toISODate(active.date),
    title: `${active.months}-month cliff`,
    detail: `Role started ${formatDay(start)}. The ${active.months}-month mark falls on ${formatDay(active.date)}. This is inferred from a public start date, not read off a grant. Only the strongest of the three marks enters the score.`,
    raw: active.raw,
    daysAgo: daysBetween(active.date, asOf),
    factorLabel: `proximity ${active.proximity.toFixed(2)} × year weight ${active.yearWeight.toFixed(2)}`,
    windowOpens: cliffWindow.opens,
    windowCloses: cliffWindow.closes,
    windowState: windowStateFor(cliffWindow.opens, cliffWindow.closes, asOf),
    cliffMonths: active.months,
    yearWeight: active.yearWeight,
  };

  const observed: ScoredSignal[] = person.signals.map((signal, index) => {
    const event = parseISODate(signal.date);
    const endsOn = signal.endsOn ? parseISODate(signal.endsOn) : undefined;
    const daysAgo = daysBetween(event, asOf);
    const decay = recencyDecay(daysAgo);
    const span = windowFor(signal.type, event, endsOn);
    return {
      id: `${person.id}-${signal.type}-${index}`,
      type: signal.type,
      category: categoryOf(signal.type),
      date: signal.date,
      title: signal.title,
      detail: signal.detail,
      raw: 100 * signal.strength * decay,
      daysAgo,
      factorLabel: `strength ${signal.strength.toFixed(2)} × decay ${decay.toFixed(2)}`,
      windowOpens: span.opens,
      windowCloses: span.closes,
      windowState: windowStateFor(span.opens, span.closes, asOf),
      kind: signal.kind,
      sourceUrl: signal.sourceUrl,
    };
  });

  const signals = [...observed, cliffSignal].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );

  const byCategory: Record<WeightKey, ScoredSignal[]> = {
    cliff: signals.filter((signal) => signal.category === "cliff"),
    proof: signals.filter((signal) => signal.category === "proof"),
    shift: signals.filter((signal) => signal.category === "shift"),
  };

  const categories: Record<WeightKey, number> = {
    cliff: squash(byCategory.cliff.map((signal) => signal.raw)),
    proof: squash(byCategory.proof.map((signal) => signal.raw)),
    shift: squash(byCategory.shift.map((signal) => signal.raw)),
  };

  const weightedPoints: Record<WeightKey, number> = {
    cliff: weights.cliff * categories.cliff,
    proof: weights.proof * categories.proof,
    shift: weights.shift * categories.shift,
  };

  const weightSum = weights.cliff + weights.proof + weights.shift;
  const scoreExact =
    weightSum === 0
      ? 0
      : (weightedPoints.cliff + weightedPoints.proof + weightedPoints.shift) / weightSum;
  const score = Math.round(scoreExact);

  const priority: Record<WeightKey, number> = { cliff: 3, proof: 2, shift: 1 };
  const rankedBuckets = (Object.keys(categories) as WeightKey[])
    .map((key) => ({
      key,
      points: weightedPoints[key],
      score: categories[key],
      top: [...byCategory[key]].sort((a, b) => b.raw - a.raw)[0],
    }))
    .filter((bucket) => bucket.top)
    .sort(
      (a, b) =>
        b.points - a.points || b.score - a.score || priority[b.key] - priority[a.key],
    );

  const driving = rankedBuckets[0]?.top ?? cliffSignal;
  const state = driving.windowState;
  let status: Status;
  if (weightSum === 0 || score < WARM_THRESHOLD) status = "wait";
  else if (score >= REACH_THRESHOLD && state === "open") status = "reach";
  else status = "warm";

  const months =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - start.getUTCMonth()) -
    (asOf.getUTCDate() < start.getUTCDate() ? 1 : 0);

  return {
    person,
    monthsInRole: Math.max(0, months),
    scoreExact,
    score,
    status,
    categories,
    weightedPoints,
    signals,
    driving,
    windowState: state,
    toneReview: signals.some((signal) => signal.type === "layoff" && signal.raw >= 12),
    cliffMarks: marks.map((mark) => ({
      months: mark.months,
      date: toISODate(mark.date),
      active: mark.months === active.months,
    })),
    rank: 0,
  };
}

export function formulaLine(weights: Weights, row: ScoredResearcher): string {
  const sum = weights.cliff + weights.proof + weights.shift;
  if (sum === 0) return "All three weights are 0, so the score is defined as 0.";
  const cliff = row.categories.cliff.toFixed(1);
  const proof = row.categories.proof.toFixed(1);
  const shift = row.categories.shift.toFixed(1);
  return `(${weights.cliff} × ${cliff} + ${weights.proof} × ${proof} + ${weights.shift} × ${shift}) / ${sum} = ${row.scoreExact.toFixed(1)} → ${row.score}`;
}

export function weightsEqual(a: Weights, b: Weights): boolean {
  return a.cliff === b.cliff && a.proof === b.proof && b.shift === a.shift;
}

export function seedCode(id: string): string {
  const digits = id.replace(/\D/g, "");
  return `SEED ${digits.padStart(2, "0")}`;
}
