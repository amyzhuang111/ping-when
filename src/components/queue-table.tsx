"use client";

import { useState } from "react";
import { NO_SOURCE_TEXT } from "@/lib/links";
import { firstTouch, statusNote, whyNow, windowPhrase, STATUS_LABEL, drivingLabel } from "@/lib/copy";
import { formatDay, parseISODate } from "@/lib/dates";
import { formulaLine, seedCode, type ScoredResearcher } from "@/lib/scoring";
import { SIGNAL_GUIDE } from "@/lib/signals";
import type { Researcher, Weights } from "@/lib/types";

export type Decision = "approve" | "snooze" | "dismiss";

const DECISION_LABEL: Record<Decision, string> = {
  approve: "Approved.",
  snooze: "Snoozed.",
  dismiss: "Dismissed.",
};

export function QueueTable({
  rows,
  baselineById,
  weights,
  peersById,
  decisions,
  onDecide,
  showActions,
  markSeed = false,
}: {
  rows: ScoredResearcher[];
  baselineById: Map<string, ScoredResearcher>;
  weights: Weights;
  peersById: Map<string, Researcher[]>;
  decisions: Record<string, Decision | undefined>;
  onDecide: (id: string, decision: Decision) => void;
  showActions: boolean;
  markSeed?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="gi-grid p-5">
        <p className="gi-prose-sm">No one clears the line at these weights.</p>
      </div>
    );
  }

  return (
    <div className="gi-grid overflow-x-auto">
      <div className="gi-row gi-row-head gi-mono text-[12px] text-[#888]">
        <div>Rank</div>
        <div>Person</div>
        <div>Score</div>
        <div>Status</div>
        <div>Driving signal</div>
      </div>
      {rows.map((row) => {
        const before = baselineById.get(row.person.id);
        const delta = before ? before.rank - row.rank : 0;
        const open = openId === row.person.id;
        const decision = decisions[row.person.id];
        const peers = markSeed ? (peersById.get(row.person.id) ?? []) : [];
        return (
          <div key={row.person.id} className="gi-block" data-person={row.person.id} data-status={row.status} data-rank={row.rank}>
            <div className="gi-row">
              <div className="gi-mono text-[20px] text-white">{row.rank}</div>
              <div>
                <p className="text-[18px] leading-[1.25] text-white">{row.person.name}</p>
                {row.person.archetype && (
                  <p className="mt-2 text-[16px] leading-[1.7]">{row.person.archetype}</p>
                )}
                <p className="gi-mono mt-3 text-[12px] leading-5 text-[#888]">
                  {markSeed ? `${seedCode(row.person.id)} · ` : ""}
                  {row.person.roleType} · {row.person.org} · {row.monthsInRole} mo
                  {row.person.location ? ` · ${row.person.location}` : ""}
                </p>
              </div>
              <div className="gi-mono text-[20px] text-white">{row.score}</div>
              <div>
                <p className="gi-mono text-[12px] leading-5 text-white">{STATUS_LABEL[row.status]}</p>
                <p className="mt-2 text-[16px] leading-[1.7]">{statusNote(row)}</p>
                {before && delta !== 0 && (
                  <p className="gi-mono mt-2 text-[12px] text-[#888]">
                    Was {before.rank}. Now {row.rank}.
                  </p>
                )}
                {row.toneReview && (
                  <p className="gi-mono mt-2 text-[12px] text-white">Tone review.</p>
                )}
                {decision && (
                  <p className="gi-mono mt-2 text-[12px] text-white">{DECISION_LABEL[decision]}</p>
                )}
              </div>
              <div>
                <p className="gi-mono text-[12px] leading-5 text-white">{row.driving.title}</p>
                <p className="mt-2 text-[16px] leading-[1.7]">{drivingLabel(row.driving)}.</p>
                <p className="gi-mono mt-3 text-[12px] leading-5 text-[#888]">{windowPhrase(row.driving)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-[#4d4d4d] px-5 py-5">
              <button
                type="button"
                className="gi-btn"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : row.person.id)}
              >
                {open ? "Hide signals" : "Signals"}
              </button>
              {showActions && (
                <>
                  <button
                    type="button"
                    className="gi-btn"
                    aria-pressed={decision === "approve"}
                    onClick={() => onDecide(row.person.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="gi-btn"
                    aria-pressed={decision === "snooze"}
                    onClick={() => onDecide(row.person.id, "snooze")}
                  >
                    Snooze
                  </button>
                  <button
                    type="button"
                    className="gi-btn"
                    aria-pressed={decision === "dismiss"}
                    onClick={() => onDecide(row.person.id, "dismiss")}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
            {open && (
              <SignalLines row={row} weights={weights} peers={peers} seed={markSeed} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SignalLines({
  row,
  weights,
  peers,
  seed,
}: {
  row: ScoredResearcher;
  weights: Weights;
  peers: Researcher[];
  seed: boolean;
}) {
  return (
    <div className="border-t border-[#4d4d4d]">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,45ch)_1fr]">
        <div>
          <p className="gi-prose-sm">{whyNow(row)}</p>
          <p className="gi-prose-sm mt-4">{firstTouch(row)}</p>
          <p className="gi-mono mt-4 text-[12px] leading-6 text-[#888]">{formulaLine(weights, row)}</p>
          {peers.length > 0 && (
            <p className="gi-prose-sm mt-4">
              Same fictional employer in this seed set: {peers.map((peer) => peer.name).join(", ")}.
              Signals stay on the person.
            </p>
          )}
        </div>
        <p className="gi-mono text-[12px] leading-6 text-[#888]">
          Marks.{" "}
          {row.cliffMarks
            .map(
              (mark) =>
                `${mark.months}-month ${formatDay(parseISODate(mark.date))}${mark.active ? " in the score" : ""}`,
            )
            .join(" · ")}
        </p>
      </div>
      <div className="border-t border-[#4d4d4d]">
        <div className="gi-signal gi-mono text-[12px] text-[#888]">
          <div>Date</div>
          <div>Signal</div>
          <div>Why a reply</div>
          <div>Verify in public</div>
        </div>
        {row.signals.map((signal) => {
          const guide = SIGNAL_GUIDE[signal.type];
          return (
            <div key={signal.id} className="gi-block">
              <div className="gi-signal">
                <div className="gi-mono text-[12px] leading-5">
                  {formatDay(parseISODate(signal.date))}
                  <span className="mt-2 block text-[#888]">{signal.raw.toFixed(1)}</span>
                </div>
                <div>
                  <p className="gi-mono text-[12px] leading-5 text-white">
                    {guide.label}
                    {signal.kind === "model" ? " · model" : ""}
                    {signal.type === "release" && signal.kind !== "model" ? " · paper" : ""}
                  </p>
                  <p className="mt-2 text-[16px] leading-[1.7]">{signal.title}</p>
                  <p className="mt-2 text-[16px] leading-[1.7] text-[#888]">{signal.detail}</p>
                  <p className="gi-mono mt-3 text-[12px] leading-5 text-[#888]">
                    {signal.factorLabel}. {windowPhrase(signal)}.
                  </p>
                  <p className="mt-3 text-[16px] leading-[1.7]">{guide.what}</p>
                  {signal.sourceUrl ? (
                    <a
                      className="gi-mono mt-3 block text-[12px] leading-5 underline [overflow-wrap:anywhere]"
                      href={signal.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {signal.sourceUrl}
                    </a>
                  ) : (
                    <p className="gi-mono mt-3 text-[12px] leading-5 text-[#888]" data-no-source="true">{seed ? NO_SOURCE_TEXT : "No source link given"}</p>
                  )}
                </div>
                <div className="text-[16px] leading-[1.7]">{guide.why}</div>
                <div className="text-[16px] leading-[1.7]">{guide.verify}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
