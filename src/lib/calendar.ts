import { firstTouch } from "@/lib/copy";
import { addDays, formatDay, toISODate } from "@/lib/dates";
import { sourceUrlFor } from "@/lib/exchange";
import type { ScoredResearcher } from "@/lib/scoring";

/** One reminder per person: an all-day event on the day the driving window opens, or today if it is already open. */
export interface Reminder {
  id: string;
  name: string;
  day: Date;
  closes: Date;
  summary: string;
  description: string;
  url: string;
}

export interface ReminderPlan {
  reminders: Reminder[];
  /** People skipped because their driving window has already closed. */
  closed: string[];
}

export function planReminders(rows: ScoredResearcher[], asOf: Date): ReminderPlan {
  const reminders: Reminder[] = [];
  const closed: string[] = [];
  for (const row of rows) {
    const signal = row.driving;
    if (signal.windowCloses.getTime() < asOf.getTime()) {
      closed.push(row.person.name);
      continue;
    }
    const day = signal.windowOpens.getTime() > asOf.getTime() ? signal.windowOpens : asOf;
    const url = sourceUrlFor(row);
    const lines = [
      `Score ${row.score} at ${row.person.org || "no employer listed"}.`,
      `Driving signal: ${signal.title}.`,
      `Window: ${formatDay(signal.windowOpens)} to ${formatDay(signal.windowCloses)}.`,
      url ? `Source: ${url}` : "No source link in the imported file. Check before writing.",
      `Angle: ${firstTouch(row)}`,
      "Draft and send it yourself. Ping When sent nothing.",
    ];
    reminders.push({
      id: row.person.id,
      name: row.person.name,
      day,
      closes: signal.windowCloses,
      summary: `Reach out to ${row.person.name} (score ${row.score})`,
      description: lines.join("\n"),
      url,
    });
  }
  return { reminders, closed };
}

const compact = (d: Date) => toISODate(d).replace(/-/g, "");

/** RFC 5545 text escaping. */
export function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets, as RFC 5545 requires. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** A calendar file any calendar app can import. `stamp` is fixed by callers in tests. */
export function remindersIcs(reminders: Reminder[], stamp: Date = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ping When//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const r of reminders) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}-${compact(r.day)}@ping-when`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${compact(r.day)}`,
      `DTEND;VALUE=DATE:${compact(addDays(r.day, 1))}`,
      `SUMMARY:${icsText(r.summary)}`,
      `DESCRIPTION:${icsText(r.description)}`,
      ...(r.url ? [`URL:${r.url}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
