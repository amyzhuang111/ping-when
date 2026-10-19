"use client";

import { useEffect, useRef } from "react";
import { firstTouch, statusNote, whyNow, windowPhrase, drivingLabel } from "@/lib/copy";
import { REACH_THRESHOLD, WARM_THRESHOLD, HALF_LIFE_DAYS } from "@/lib/constants";
import { formatDay, parseISODate } from "@/lib/dates";
import type { UnscoredCandidate } from "@/lib/exchange";
import { NO_SOURCE_TEXT } from "@/lib/links";
import { formulaLine, seedCode, type ScoredResearcher } from "@/lib/scoring";
import { SIGNAL_GUIDE } from "@/lib/signals";
import type { Decision } from "@/lib/storage";
import type { Researcher, Weights } from "@/lib/types";

export const STATUS_WORD = { reach: "Ready to reach", warm: "Warm up", wait: "Wait" } as const;

export function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "#0a0a0a" : "none"} stroke="#0a0a0a" strokeWidth="1.2">
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
    </svg>
  );
}

export function ProductCard({
  row,
  before,
  decision,
  onOpen,
  onSave,
  markSeed,
}: {
  row: ScoredResearcher;
  before?: ScoredResearcher;
  decision?: Decision;
  onOpen: () => void;
  onSave: () => void;
  markSeed: boolean;
}) {
  const moved = before && before.rank !== row.rank ? `Was ${before.rank}, now ${row.rank}` : "";
  return (
    <div className="relative" data-person={row.person.id} data-name={row.person.name} data-score={row.score} data-status={row.status} data-rank={row.rank}>
      <button
        type="button"
        className="heart"
        aria-label={decision === "approve" ? `Saved: ${row.person.name} approved. Click to undo` : `Save ${row.person.name} (approve)`}
        aria-pressed={decision === "approve"}
        onClick={onSave}
      >
        <Heart filled={decision === "approve"} />
      </button>
      <button type="button" className="card" onClick={onOpen} aria-label={`${row.person.name}, score ${row.score}, ${STATUS_WORD[row.status]}. Quick view`}>
        <div className="tile">
          <span className="mono" aria-hidden="true">{initials(row.person.name)}</span>
          <span className="tile-brand" aria-hidden="true">{row.person.org}</span>
          <span className="quick" aria-hidden="true">Quick view</span>
        </div>
        <div className="ctext">
          <p className="brandline truncate">{row.person.org}</p>
          <p className="name">{row.person.name}</p>
          <p className="role truncate">
            {markSeed ? `${seedCode(row.person.id)} · ` : ""}
            {row.person.roleType}
          </p>
          <p className="price">
            Score {row.score} · {STATUS_WORD[row.status]}
          </p>
          <p className="role truncate">{drivingLabel(row.driving)}</p>
          {(moved || decision) && (
            <p className="role">
              {moved}
              {moved && decision ? " · " : ""}
              {decision === "approve" ? "Approved" : decision === "snooze" ? "Snoozed" : decision === "dismiss" ? "Dismissed" : ""}
            </p>
          )}
        </div>
      </button>
    </div>
  );
}

export function IncompleteCard({ person, onOpen }: { person: UnscoredCandidate; onOpen: () => void }) {
  return (
    <div data-unscored={person.name}>
      <button type="button" className="card" onClick={onOpen} aria-label={`${person.name}, incomplete, needs start date. Quick view`}>
        <div className="tile">
          <span className="mono" aria-hidden="true" style={{ opacity: 0.5 }}>{initials(person.name)}</span>
          <span className="tile-brand" aria-hidden="true">{person.employer}</span>
          <span className="quick" aria-hidden="true">Quick view</span>
        </div>
        <div className="ctext">
          <p className="brandline truncate">{person.employer || "Employer not given"}</p>
          <p className="name">{person.name}</p>
          <p className="role truncate">{person.role}</p>
          <p className="price">Score — · Incomplete</p>
          <p className="role">Needs start date</p>
        </div>
      </button>
    </div>
  );
}

function useDrawer(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return ref;
}

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useDrawer(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="drawer outline-none" data-testid="drawer">
        <div className="flex items-center justify-between px-8 pt-6">
          <span className="eyebrow muted">Detail</span>
          <button type="button" className="tlink" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="px-8 pt-6 pb-16">{children}</div>
      </div>
    </>
  );
}

export function DetailDrawer({
  row,
  before,
  weights,
  peers,
  decision,
  onDecide,
  onClose,
  markSeed,
}: {
  row: ScoredResearcher;
  before?: ScoredResearcher;
  weights: Weights;
  peers: Researcher[];
  decision?: Decision;
  onDecide: (decision: Decision) => void;
  onClose: () => void;
  markSeed: boolean;
}) {
  const c = row.categories;
  return (
    <DrawerShell title={row.person.name} onClose={onClose}>
      <p className="brandline">{row.person.org}</p>
      <h1 className="h-drawer mt-3">{row.person.name}</h1>
      <p className="mt-2 text-[13px] muted">
        {markSeed ? `${seedCode(row.person.id)} · Fictional seed archetype · ` : ""}
        {row.person.roleType}
        {row.person.location ? ` · ${row.person.location}` : ""}
      </p>
      {row.person.archetype && <p className="prose-s mt-3">{row.person.archetype}</p>}
      <p className="mt-6 text-[15px] tnum">
        Score {row.score} · {STATUS_WORD[row.status]}
      </p>
      <p className="prose-s mt-2 muted">{statusNote(row)}</p>
      {before && before.rank !== row.rank && (
        <p className="mt-2 text-[13px] muted tnum">Rank was {before.rank} at balanced weights. Now {row.rank}.</p>
      )}
      {row.toneReview && <p className="mt-2 eyebrow">Tone review</p>}

      <div className="mt-8 flex flex-wrap gap-6">
        {(["approve", "snooze", "dismiss"] as const).map((d) => (
          <button key={d} type="button" className="tlink" aria-pressed={decision === d} onClick={() => onDecide(d)}>
            {d === "approve" ? "Approve" : d === "snooze" ? "Snooze" : "Dismiss"}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12px] muted">Records a decision in this browser. Nothing is sent.</p>

      <h2 className="eyebrow mt-12 font-semibold">Overview</h2>
      <dl className="spec mt-4">
        <dt>Rank</dt>
        <dd className="tnum">{row.rank}</dd>
        <dt>Driving signal</dt>
        <dd>
          {row.driving.title}
          <span className="block muted">{drivingLabel(row.driving)}</span>
        </dd>
        <dt>Window</dt>
        <dd>{windowPhrase(row.driving)}</dd>
        <dt>Start date</dt>
        <dd className="tnum">
          {row.person.roleStart} · {row.monthsInRole} mo in role
        </dd>
        <dt>Cliff · Proof · Shift</dt>
        <dd className="tnum">
          {Math.round(c.cliff)} · {Math.round(c.proof)} · {Math.round(c.shift)}
        </dd>
        <dt>Formula</dt>
        <dd className="tnum">{formulaLine(weights, row)}</dd>
        <dt>Cliff marks</dt>
        <dd className="tnum">
          {row.cliffMarks
            .map((m) => `${m.months}-month ${formatDay(parseISODate(m.date))}${m.active ? " (in the score)" : ""}`)
            .join(" · ")}
        </dd>
      </dl>

      <h2 className="eyebrow mt-12 font-semibold">Why now</h2>
      <p className="prose-s mt-3">{whyNow(row)}</p>
      <h2 className="eyebrow mt-8 font-semibold">First touch</h2>
      <p className="prose-s mt-3">{firstTouch(row)}</p>
      {peers.length > 0 && (
        <p className="prose-s mt-4 muted">
          Same fictional employer in this seed set: {peers.map((p) => p.name).join(", ")}. Signals stay on the person.
        </p>
      )}

      <h2 className="eyebrow mt-12 font-semibold">Signals and sources</h2>
      <dl className="spec mt-4" data-testid="signals">
        {row.signals.map((signal) => {
          const guide = SIGNAL_GUIDE[signal.type];
          return (
            <SignalSpec key={signal.id} label={formatDay(parseISODate(signal.date))}>
              <span className="block">
                {guide.label}
                {signal.kind === "model" ? " · model" : ""}
                {signal.type === "release" && signal.kind !== "model" ? " · paper" : ""}
              </span>
              <span className="block">{signal.title}</span>
              <span className="block muted">
                {signal.factorLabel}. {windowPhrase(signal)}. Strength {signal.raw.toFixed(1)}.
              </span>
              {signal.type === "cliff" ? (
                <span className="block muted">Inferred from start_date. Not a view of a grant.</span>
              ) : signal.sourceUrl ? (
                <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="block">
                  {signal.sourceUrl}
                </a>
              ) : (
                <span className="block muted" data-no-source="true">
                  {markSeed ? NO_SOURCE_TEXT : "No source link given"}
                </span>
              )}
            </SignalSpec>
          );
        })}
      </dl>

      <h2 className="eyebrow mt-12 font-semibold">Methodology</h2>
      <p className="prose-s mt-3">
        score = (wC · Cliff + wP · Proof + wS · Shift) / (wC + wP + wS). Cliff peaks 21 days after a 12, 24 or 36
        month start-date anniversary (year weights 1, 0.84, 0.72) and is zero outside −40 to +110 days. Proof and
        shift signals decay with a {HALF_LIFE_DAYS}-day half-life. Ready to reach needs a rounded score of at least{" "}
        {REACH_THRESHOLD} with the driving window open this week; warm up starts at {WARM_THRESHOLD}.
      </p>
      <p className="prose-s mt-3 muted">
        A layoff is news about the employer, not proof this person was cut. The line predicts a likelier reply, not a
        hire. Open the source before you approve.
      </p>
    </DrawerShell>
  );
}

function SignalSpec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function IncompleteDrawer({ person, onClose }: { person: UnscoredCandidate; onClose: () => void }) {
  return (
    <DrawerShell title={person.name} onClose={onClose}>
      <p className="brandline">{person.employer || "Employer not given"}</p>
      <h1 className="h-drawer mt-3">{person.name}</h1>
      <p className="mt-2 text-[13px] muted">{person.role}</p>
      <p className="mt-6 text-[15px]">Score — · Incomplete</p>
      <dl className="spec mt-8">
        <dt>Flag</dt>
        <dd>{person.reason}</dd>
        <dt>What is missing</dt>
        <dd>{person.missing}</dd>
        <dt>Rows</dt>
        <dd className="tnum">{person.rows.join(", ")}</dd>
      </dl>
      <p className="prose-s mt-6 muted">
        A start date is never guessed. Add a sourced start_date to the file and import it again to score this person.
      </p>
    </DrawerShell>
  );
}
