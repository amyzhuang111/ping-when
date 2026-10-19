"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AutomationPanel } from "@/components/automation-panel";
import { ImportPanel } from "@/components/import-panel";
import { QueueTable } from "@/components/queue-table";
import { WeightPanel } from "@/components/weight-panel";
import { DEFAULT_WEIGHTS } from "@/lib/constants";
import { drivingLabel, STATUS_LABEL } from "@/lib/copy";
import { AS_OF, formatDay, todayUTC, weekEnding, weekOf } from "@/lib/dates";
import { approvedQueueCsv, type ImportResult } from "@/lib/exchange";
import { scoreResearchers, weightsEqual, type ScoredResearcher } from "@/lib/scoring";
import {
  getWorkspaceServerSnapshot,
  getWorkspaceSnapshot,
  subscribeWorkspace,
  writeWorkspace,
  type Decision,
  type Workspace,
} from "@/lib/storage";
import type { Researcher, Weights } from "@/lib/types";

const NO_PEOPLE: Researcher[] = [];
let operatorDay: Date | undefined;

function subscribeClock(): () => void {
  return () => {};
}

function readOperatorDay(): Date {
  operatorDay ??= todayUTC();
  return operatorDay;
}

function readServerDay(): Date {
  return AS_OF;
}

type View = "week" | "rank" | "next";
type Band = "all" | "reach" | "warm" | "wait" | "cliff";

export function PingWhen() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [view, setView] = useState<View>("week");
  const [band, setBand] = useState<Band>("all");
  const workspace = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getWorkspaceServerSnapshot,
  );
  const [exportText, setExportText] = useState("");
  const asOf = useSyncExternalStore(subscribeClock, readOperatorDay, readServerDay);

  const people = workspace?.people ?? NO_PEOPLE;
  const decisions = workspace?.decisions ?? {};
  const example = workspace?.source === "example";

  const rows = useMemo(
    () => scoreResearchers(people, weights, asOf),
    [people, weights, asOf],
  );
  const baseline = useMemo(
    () => scoreResearchers(people, DEFAULT_WEIGHTS, asOf),
    [people, asOf],
  );
  const baselineById = useMemo(
    () => new Map(baseline.map((row) => [row.person.id, row])),
    [baseline],
  );
  const peersById = useMemo(() => {
    const map = new Map<string, Researcher[]>();
    for (const person of people) {
      map.set(
        person.id,
        people.filter((other) => other.org === person.org && other.id !== person.id),
      );
    }
    return map;
  }, [people]);

  const queue = rows.filter((row) => row.status === "reach");
  const bubble = rows.filter((row) => row.status !== "reach").slice(0, 4);
  const dirty = !weightsEqual(weights, DEFAULT_WEIGHTS);
  const loaded =
    workspace !== null &&
    (people.length > 0 || workspace.unscored.length > 0 || workspace.errors.length > 0);

  const filtered = rows.filter((row) => {
    if (band === "all") return true;
    if (band === "cliff") return row.driving.type === "cliff";
    return row.status === band;
  });

  function commit(next: Workspace | null) {
    writeWorkspace(next);
  }

  function onImport(result: ImportResult, source: Workspace["source"], label: string) {
    const empty = result.people.length === 0 && result.unscored.length === 0 && result.errors.length === 0;
    if (empty) {
      commit(null);
      return;
    }
    commit({
      version: 1,
      source,
      label,
      people: result.people,
      unscored: result.unscored,
      errors: result.errors,
      decisions: {},
    });
    setView("week");
    setExportText("");
  }

  function onDecide(id: string, decision: Decision) {
    if (!workspace) return;
    commit({
      ...workspace,
      decisions: {
        ...workspace.decisions,
        [id]: workspace.decisions[id] === decision ? undefined : decision,
      },
    });
  }

  function onExport() {
    const approved = new Set(
      Object.entries(decisions)
        .filter(([, decision]) => decision === "approve")
        .map(([id]) => id),
    );
    const csv = approvedQueueCsv(rows, approved);
    setExportText(csv);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ping-when-approved.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const weekStart = weekOf(asOf);
  const weekEnd = weekEnding(asOf);

  return (
    <div className="min-h-full bg-black text-[#ffffffbb]">
      <header className="gi-hero">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <p className="gi-mono gi-subtle text-[13px]">Ping when.</p>
          <h1 className="gi-h mt-6 max-w-[45ch] text-[40px] text-black">
            Sourcing is automated. Timing is not.
          </h1>
          <p className="mt-6 max-w-[45ch] text-[18px] leading-[1.7] text-black">
            It decides when to reach out. A person still writes.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="gi-grid">
          <div className="gi-split cols-3">
            <p className="text-[18px] leading-[1.7]">Nothing is sent.</p>
            <p className="text-[18px] leading-[1.7]">The queue starts empty.</p>
            <p className="gi-mono text-[13px] leading-6 text-[#888]">
              Week of {formatDay(weekStart)} through {formatDay(weekEnd)}. Approve, snooze, or
              dismiss.
            </p>
          </div>
        </div>

        <section className="mt-8 gi-card p-5">
          <h2 className="gi-h text-[28px] text-white">Limits.</h2>
          <div className="mt-5 grid gap-px md:grid-cols-2">
            <p className="gi-prose-sm border-t border-[#4d4d4d] py-4 md:pr-6">
              The roster is the file you import. The example is 30 fictional archetypes and stays
              off the queue until you load it.
            </p>
            <p className="gi-prose-sm border-t border-[#4d4d4d] py-4 md:pl-6">
              A cliff is inferred from start_date. A month with no day uses the first of that month.
              It is not a view of a grant.
            </p>
            <p className="gi-prose-sm border-t border-[#4d4d4d] py-4 md:pr-6">
              A layoff is news about the employer. It is not proof this person was cut. Open the
              source link before you approve.
            </p>
            <p className="gi-prose-sm border-t border-[#4d4d4d] py-4 md:pl-6">
              The line at 60 predicts a likelier reply, not a hire. Approve records a decision on
              this machine. It does not send.
            </p>
          </div>
        </section>

        <div className="mt-8">
          <ImportPanel
            loaded={loaded}
            example={example}
            label={workspace?.label ?? ""}
            onImport={onImport}
            onClear={() => {
              commit(null);
              setExportText("");
              setWeights(DEFAULT_WEIGHTS);
            }}
          />
        </div>

        {loaded && workspace && (
          <Issues workspace={workspace} />
        )}

        {!loaded && (
          <div className="gi-grid mt-8 p-5" data-empty="true">
            <h2 className="gi-h text-[32px] text-white">The queue is empty.</h2>
            <p className="gi-prose mt-4">
              Bring ping-when-template.csv, or a JSON file with the same fields. Each person needs
              only a name, role, employer, and start_date — four columns are enough. Signals are
              optional, one per row (type, date, source_url, note), and a candidate with no signal
              still scores from start_date (cliff). A missing start_date, or a signal missing its
              date, stays on the page as unscored. It is not guessed.
            </p>
          </div>
        )}

        {loaded && people.length === 0 && (
          <div className="gi-grid mt-8 p-5">
            <p className="gi-prose-sm">No scored candidates yet. Check the rows above — a candidate needs a valid start_date, and any signal needs a valid date — then import the file again.</p>
          </div>
        )}

        {loaded && people.length > 0 && (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-4">
              <WeightPanel weights={weights} onChange={setWeights} />
            </div>
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" className="gi-btn" onClick={onExport}>
                  Export approved
                </button>
              </div>
              {exportText && (
                <pre
                  className="gi-mono mb-6 overflow-x-auto border border-[#fff] p-5 text-[12px] leading-6 text-[#ffffffbb]"
                  data-export="true"
                >
                  {exportText}
                </pre>
              )}
              <div className="gi-grid mb-6">
                <div className="gi-split cols-3">
                  {(
                    [
                      ["week", "This week"],
                      ["rank", "All scored"],
                      ["next", "Automate next"],
                    ] as const
                  ).map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className="bg-black text-left text-[16px] leading-[1.25]"
                      aria-pressed={view === id}
                      onClick={() => setView(id)}
                    >
                      <span className={view === id ? "text-white" : "text-[#888]"}>{text}.</span>
                      {id === "week" && (
                        <span className="gi-mono mt-2 block text-[12px] text-[#888]">{queue.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {view === "week" && (
                <WeekView
                  dirty={dirty}
                  queue={queue}
                  bubble={bubble}
                  rows={rows}
                  baselineById={baselineById}
                  example={example}
                  weights={weights}
                  peersById={peersById}
                  decisions={decisions}
                  onDecide={onDecide}
                  markSeed={example}
                />
              )}

              {view === "rank" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All", rows.length],
                        ["reach", "This week", rows.filter((row) => row.status === "reach").length],
                        ["warm", "Warm up", rows.filter((row) => row.status === "warm").length],
                        ["wait", "Wait", rows.filter((row) => row.status === "wait").length],
                        ["cliff", "Cliff-driven", rows.filter((row) => row.driving.type === "cliff").length],
                      ] as const
                    ).map(([id, text, count]) => (
                      <button
                        key={id}
                        type="button"
                        className="gi-btn"
                        aria-pressed={band === id}
                        onClick={() => setBand(id)}
                      >
                        {text} {count}
                      </button>
                    ))}
                  </div>
                  <QueueTable
                    rows={filtered}
                    baselineById={baselineById}
                    weights={weights}
                    peersById={peersById}
                    decisions={decisions}
                    onDecide={onDecide}
                    showActions
                    markSeed={example}
                  />
                </div>
              )}

              {view === "next" && <AutomationPanel />}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-[#4d4d4d]">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <p className="max-w-[45ch] text-[16px] leading-[1.7] text-[#888]">
            Ping when is an interview case. It is not a General Intuition product, and it is not
            affiliated with General Intuition.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Issues({ workspace }: { workspace: Workspace }) {
  if (workspace.errors.length === 0 && workspace.unscored.length === 0) return null;
  return (
    <div className="mt-8 space-y-8">
      {workspace.errors.length > 0 && (
        <section>
          <h2 className="gi-h text-[28px] text-white">Import errors.</h2>
          <p className="gi-prose-sm mt-3">These rows had a problem. Only the faulty row or signal noted was dropped or skipped — a candidate listed here can still appear in the scored queue from start_date (cliff) or other valid signals.</p>
          <div className="gi-grid mt-4">
            {workspace.errors.map((error) => (
              <p key={`${error.row}-${error.message}`} className="gi-block p-5 text-[16px] leading-[1.7]">
                <span className="gi-mono text-[12px] text-[#888]">Row {error.row}. </span>
                {error.message}
              </p>
            ))}
          </div>
        </section>
      )}
      {workspace.unscored.length > 0 && (
        <section>
          <h2 className="gi-h text-[28px] text-white">Unscored.</h2>
          <div className="gi-grid mt-4 overflow-x-auto">
            <div className="gi-signal gi-mono text-[12px] text-[#888]">
              <div>Rows</div>
              <div>Person</div>
              <div>Flag</div>
              <div>What is missing</div>
            </div>
            {workspace.unscored.map((person) => (
              <div key={person.id} className="gi-block" data-unscored={person.name}>
                <div className="gi-signal">
                  <div className="gi-mono text-[12px]">{person.rows.join(", ")}</div>
                  <div>
                    <p className="text-[18px] leading-[1.25] text-white">{person.name}</p>
                    <p className="gi-mono mt-2 text-[12px] text-[#888]">
                      {person.role} · {person.employer}
                    </p>
                  </div>
                  <div className="gi-mono text-[12px] leading-5 text-white">{person.reason}</div>
                  <div className="text-[16px] leading-[1.7]">{person.missing}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WeekView({
  dirty,
  queue,
  bubble,
  rows,
  baselineById,
  example,
  weights,
  peersById,
  decisions,
  onDecide,
  markSeed,
}: {
  dirty: boolean;
  queue: ScoredResearcher[];
  bubble: ScoredResearcher[];
  rows: ScoredResearcher[];
  baselineById: Map<string, ScoredResearcher>;
  example: boolean;
  weights: Weights;
  peersById: Map<string, Researcher[]>;
  decisions: Record<string, Decision | undefined>;
  onDecide: (id: string, decision: Decision) => void;
  markSeed: boolean;
}) {
  const entered = rows.filter((row) => {
    const before = baselineById.get(row.person.id);
    return row.status === "reach" && before?.status !== "reach";
  });
  const left = rows.filter((row) => {
    const before = baselineById.get(row.person.id);
    return row.status !== "reach" && before?.status === "reach";
  });
  const idris = example ? rows.find((row) => row.person.name === "Idris Pell") : undefined;

  return (
    <div className="space-y-8">
      <div aria-live="polite">
        <h2 className="gi-h text-[32px] text-white">This week.</h2>
        <p className="gi-prose-sm mt-3">
          Ranked from the imported file. Approve, snooze, or dismiss. A person writes the note.
        </p>
        {idris && (
          <p className="gi-mono mt-4 text-[13px] leading-6 text-white">
            Idris Pell. Rank {idris.rank}. {STATUS_LABEL[idris.status]}. Score {idris.score}.{" "}
            {drivingLabel(idris.driving)}.
          </p>
        )}
        {!dirty && (
          <p className="gi-prose-sm mt-3">
            Balanced weights, 30 cliff, 40 proof, 30 shift. Drag cliff proximity and this list
            re-sorts.
          </p>
        )}
        {dirty && (
          <div className="mt-4 space-y-2 text-[16px] leading-[1.7]">
            {entered.length > 0 && (
              <p>
                Entered the queue.{" "}
                {entered
                  .map((row) => {
                    const before = baselineById.get(row.person.id);
                    return `${row.person.name} (${drivingLabel(row.driving).toLowerCase()}, was ${before?.rank ?? "—"}, now ${row.rank})`;
                  })
                  .join("; ")}
                .
              </p>
            )}
            {left.length > 0 && (
              <p>
                Left the queue. {left.map((row) => row.person.name).join(", ")}. Their scores fell
                because this is an average.
              </p>
            )}
          </div>
        )}
      </div>
      <QueueTable
        rows={queue}
        baselineById={baselineById}
        weights={weights}
        peersById={peersById}
        decisions={decisions}
        onDecide={onDecide}
        showActions
        markSeed={markSeed}
      />
      <div>
        <h2 className="gi-h text-[28px] text-white">Closest to the line.</h2>
        <p className="gi-prose-sm mt-3">Highest scores that are not this week.</p>
        <div className="mt-4">
          <QueueTable
            rows={bubble}
            baselineById={baselineById}
            weights={weights}
            peersById={peersById}
            decisions={decisions}
            onDecide={onDecide}
            showActions={false}
            markSeed={markSeed}
          />
        </div>
      </div>
    </div>
  );
}
