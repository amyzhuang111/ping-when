import { REACH_THRESHOLD, WARM_THRESHOLD } from "@/lib/constants";
import { describeDaysAgo, formatWeek } from "@/lib/dates";
import type { ScoredResearcher, ScoredSignal } from "@/lib/scoring";
import { SIGNAL_GUIDE } from "@/lib/signals";

export const STATUS_LABEL = {
  reach: "REACH OUT THIS WEEK",
  warm: "WARM UP",
  wait: "WAIT",
} as const;

export function whyNow(row: ScoredResearcher): string {
  const signal = row.driving;
  const when = describeDaysAgo(signal.daysAgo);
  const org = row.person.org;

  switch (signal.type) {
    case "cliff":
      return `${signal.cliffMonths}-month cliff at ${org} is ${when}. Reply odds move because the cost of leaving changes around that date.`;
    case "release":
      return signal.kind === "model"
        ? `Model “${signal.title}” landed ${when}. They are still in the stretch where a technical note gets an answer.`
        : `“${signal.title}” came out ${when}. A note that cites a real result gets read in this window.`;
    case "funding":
      return `${org} announced funding ${when}. It is a weak, two-way signal: timing context, not the opener.`;
    case "layoff":
      return `${org} announced a reduction ${when}. That raises reply odds and the risk of a cruel note. Tone review before anyone writes.`;
    case "talk":
      return `“${signal.title}” is on a public program. The window runs through the session week. Write about the subject, not the slot.`;
    case "oss":
      return `Shipped “${signal.title}” ${when}. People who just released answer a specific technical note, and then they stop.`;
    case "building":
      return `They posted about building something new ${when}. Intent is fresh and short-lived. It may mean they are not hireable.`;
    case "reorg":
      return `Role or org changed ${when}: “${signal.title}.” The charter is newly negotiable, which is when replies happen.`;
    default: {
      const exhaustive: never = signal.type;
      return exhaustive;
    }
  }
}

export function firstTouch(row: ScoredResearcher): string {
  const signal = row.driving;
  const hook = row.person.workHook;
  const proof = [...row.signals]
    .filter((item) => item.category === "proof" && item.raw >= 28)
    .sort((a, b) => b.raw - a.raw)[0];

  switch (signal.type) {
    case "cliff":
      return proof
        ? `Use “${proof.title}” as the reason to write, and the cliff as the reason to write now. Open on ${hook}. Do not mention the vest.`
        : `Open on ${hook}, not the anniversary. Ask what the next year should weigh. Let them mention timing.`;
    case "release":
      return `Cite one result from “${signal.title}” that only a reader would know. No role in the first line. The work to open on is ${hook}.`;
    case "funding":
      return `Do not open with the round. Open on ${hook}. Mention the news only if it changed the work.`;
    case "layoff":
      return `Do not mention the reduction. Write about ${hook}. If they bring up the news, listen. You may decide not to send.`;
    case "talk":
      return `Refer to “${signal.title}” by its content. Offer one precise comment. Suggest a conversation after the session, not before it.`;
    case "oss":
      return `Lead with a real remark on “${signal.title}”: a behavior, a limit, a use. The role, if it belongs at all, comes later. Open from ${hook}.`;
    case "building":
      return `Respond to what they said they are building. If they are founding, this is a relationship, not a requisition. Curiosity about ${hook} is enough.`;
    case "reorg":
      return `Acknowledge the new scope only if they have said it publicly. Otherwise stay on ${hook} and ask what they are protecting.`;
    default: {
      const exhaustive: never = signal.type;
      return exhaustive;
    }
  }
}

export function windowPhrase(signal: ScoredSignal): string {
  const opens = formatWeek(signal.windowOpens);
  const closes = formatWeek(signal.windowCloses);
  if (signal.windowState === "open") {
    return `Open this week · ${opens} to ${closes}`;
  }
  if (signal.windowState === "ahead") {
    return `Opens ${opens} · closes ${closes}`;
  }
  return `Closed · was ${opens} to ${closes}`;
}

export function statusNote(row: ScoredResearcher): string {
  if (row.status === "reach") return "Window is open this week.";
  if (row.score >= REACH_THRESHOLD && row.windowState === "ahead") {
    return `Clears ${REACH_THRESHOLD}, but the driving window opens ${formatWeek(row.driving.windowOpens)}.`;
  }
  if (row.score >= REACH_THRESHOLD && row.windowState === "closed") {
    return `Clears ${REACH_THRESHOLD}, but the driving window has closed.`;
  }
  if (row.status === "warm") {
    const gap = REACH_THRESHOLD - row.score;
    return `${gap} ${gap === 1 ? "point" : "points"} under ${REACH_THRESHOLD}. Warm, not this week.`;
  }
  return `Below ${WARM_THRESHOLD}. Not in the conversation yet.`;
}

export function drivingLabel(signal: ScoredSignal): string {
  return SIGNAL_GUIDE[signal.type].label;
}

