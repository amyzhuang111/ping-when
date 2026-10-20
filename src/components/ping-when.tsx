"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AutomationPanel } from "@/components/automation-panel";
import { ImportPanel } from "@/components/import-panel";
import { DetailDrawer, IncompleteCard, IncompleteDrawer, ProductCard } from "@/components/storefront";
import { WeightPanel } from "@/components/weight-panel";
import { DEFAULT_WEIGHTS, REACH_THRESHOLD } from "@/lib/constants";
import { drivingLabel } from "@/lib/copy";
import { formatDay, todayUTC, weekEnding, weekOf } from "@/lib/dates";
import { planReminders, remindersIcs } from "@/lib/calendar";
import { loadExcel, queueSheet, queueXlsx } from "@/lib/workbook";
import { approvedQueueCsv, rankedQueueCsv, type ImportResult } from "@/lib/exchange";
import { closestToTheLine, scoreResearchers, weightsEqual, type ScoredResearcher } from "@/lib/scoring";
import { SIGNAL_GUIDE } from "@/lib/signals";
import {
  getWeightsServerSnapshot,
  getWeightsSnapshot,
  subscribeWeights,
  writeWeights,
  getWorkspaceServerSnapshot,
  getWorkspaceSnapshot,
  subscribeWorkspace,
  writeWorkspace,
  type Decision,
  type Workspace,
} from "@/lib/storage";
import type { Researcher, SignalType, Status, Weights } from "@/lib/types";

const NO_PEOPLE: Researcher[] = [];
const PAGE = 48;
let operatorDay: Date | undefined;
const noop = () => () => {};
const readOperatorDay = () => (operatorDay ??= todayUTC());
const readServerDay = () => todayUTC();
const clientTrue = () => true;
const serverFalse = () => false;

type Sort = "score" | "cliff" | "name";
type StatusFilter = Status | "incomplete";

function nextCliff(row: ScoredResearcher, asOf: Date): number {
  const soon = row.cliffMarks
    .map((m) => Date.parse(m.date))
    .filter((t) => t >= asOf.getTime() - 40 * 86400000)
    .sort((a, b) => a - b);
  return soon[0] ?? Number.POSITIVE_INFINITY;
}

function download(data: string | ArrayBuffer, filename: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PingWhen() {
  const hydrated = useSyncExternalStore(noop, clientTrue, serverFalse);
  const storedWeights = useSyncExternalStore(subscribeWeights, getWeightsSnapshot, getWeightsServerSnapshot);
  const weights: Weights = storedWeights ?? DEFAULT_WEIGHTS;
  const setWeights = useCallback(
    (next: Weights) => writeWeights(weightsEqual(next, DEFAULT_WEIGHTS) ? null : next),
    [],
  );
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspaceSnapshot, getWorkspaceServerSnapshot);
  const asOf = useSyncExternalStore(noop, readOperatorDay, readServerDay);

  const [sort, setSort] = useState<Sort>("score");
  const [statusF, setStatusF] = useState<Set<StatusFilter>>(new Set());
  const [orgF, setOrgF] = useState<Set<string>>(new Set());
  const [typeF, setTypeF] = useState<Set<SignalType>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [limit, setLimit] = useState({ reach: PAGE, near: PAGE, incomplete: PAGE });
  const [importMs, setImportMs] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  const people = workspace?.people ?? NO_PEOPLE;
  const unscored = useMemo(() => workspace?.unscored ?? [], [workspace]);
  const decisions = workspace?.decisions ?? {};
  const example = workspace?.source === "example";
  const loaded =
    workspace !== null && (people.length > 0 || unscored.length > 0 || workspace.errors.length > 0);

  const rows = useMemo(() => scoreResearchers(people, weights, asOf), [people, weights, asOf]);
  const baseline = useMemo(() => scoreResearchers(people, DEFAULT_WEIGHTS, asOf), [people, asOf]);
  const baselineById = useMemo(() => new Map(baseline.map((r) => [r.person.id, r])), [baseline]);
  const peersById = useMemo(() => {
    const byOrg = new Map<string, Researcher[]>();
    for (const p of people) byOrg.set(p.org, [...(byOrg.get(p.org) ?? []), p]);
    return byOrg;
  }, [people]);
  const dirty = !weightsEqual(weights, DEFAULT_WEIGHTS);

  const orgs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.person.org, (counts.get(r.person.org) ?? 0) + 1);
    for (const u of unscored) counts.set(u.employer || "No employer", (counts.get(u.employer || "No employer") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }, [rows, unscored]);
  const types = useMemo(() => {
    const counts = new Map<SignalType, number>();
    for (const r of rows) counts.set(r.driving.type, (counts.get(r.driving.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const passes = (r: ScoredResearcher) =>
    (statusF.size === 0 || statusF.has(r.status)) &&
    (orgF.size === 0 || orgF.has(r.person.org)) &&
    (typeF.size === 0 || typeF.has(r.driving.type));
  const sorter = (a: ScoredResearcher, b: ScoredResearcher) =>
    sort === "score"
      ? a.rank - b.rank
      : sort === "name"
        ? (a.person.name < b.person.name ? -1 : a.person.name > b.person.name ? 1 : 0)
        : nextCliff(a, asOf) - nextCliff(b, asOf) || a.rank - b.rank;
  const reach = rows.filter((r) => r.status === "reach" && passes(r)).sort(sorter);
  const near = closestToTheLine(rows).filter(passes).sort(sorter);
  const incomplete = unscored
    .filter(
      (u) =>
        (statusF.size === 0 || statusF.has("incomplete")) &&
        (orgF.size === 0 || orgF.has(u.employer || "No employer")) &&
        typeF.size === 0,
    )
    .sort((a, b) => (sort === "name" ? (a.name < b.name ? -1 : 1) : 0));

  const filtering = statusF.size > 0 || orgF.size > 0 || typeF.size > 0;
  const closest = closestToTheLine(rows)[0];
  const entered = rows.filter((r) => r.status === "reach" && baselineById.get(r.person.id)?.status !== "reach");
  const left = rows.filter((r) => r.status !== "reach" && baselineById.get(r.person.id)?.status === "reach");
  const orderSame = rows.every((r) => baselineById.get(r.person.id)?.rank === r.rank);

  function onImport(result: ImportResult, source: Workspace["source"], label: string, ms: number) {
    setImportMs(ms);
    if (result.people.length === 0 && result.unscored.length === 0 && result.errors.length === 0) {
      writeWorkspace(null);
      return;
    }
    writeWorkspace({ version: 1, source, label, people: result.people, unscored: result.unscored, errors: result.errors, decisions: {} });
    setLimit({ reach: PAGE, near: PAGE, incomplete: PAGE });
    setOpenId(null);
  }
  function onDecide(id: string, decision: Decision) {
    if (!workspace) return;
    writeWorkspace({
      ...workspace,
      decisions: { ...workspace.decisions, [id]: workspace.decisions[id] === decision ? undefined : decision },
    });
  }
  const approvedIds = new Set(Object.entries(decisions).filter(([, d]) => d === "approve").map(([id]) => id));
  async function exportXlsx() {
    setNotice("Building the spreadsheet.");
    try {
      const lib = await loadExcel();
      const buf = await queueXlsx(lib, queueSheet(rows, unscored, decisions, weights, asOf, workspace?.label ?? ""));
      download(buf, "ping-when-ranked-queue.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setNotice(`Saved ping-when-ranked-queue.xlsx. ${rows.length} scored rows, ${unscored.length} waiting on a start date.`);
    } catch (e) {
      setNotice(`Spreadsheet not saved. ${e instanceof Error ? e.message : ""}`.trim());
    }
  }
  function saveReminders(target: ScoredResearcher[], filename: string) {
    const plan = planReminders(target, asOf);
    const skipped = plan.closed.length > 0 ? ` Skipped, window already closed: ${plan.closed.join(", ")}.` : "";
    if (plan.reminders.length === 0) {
      setNotice(`No reminder saved.${skipped}`);
      return;
    }
    download(remindersIcs(plan.reminders), filename, "text/calendar;charset=utf-8");
    const n = plan.reminders.length;
    setNotice(`Saved ${filename} with ${n} reminder${n === 1 ? "" : "s"}.${skipped}`);
  }
  function remindApproved() {
    const target = rows.filter((r) => approvedIds.has(r.person.id));
    if (target.length === 0) {
      setNotice("No one is approved yet. Open a card and choose Approve, then save reminders.");
      return;
    }
    saveReminders(target, "ping-when-reminders.ics");
  }

  function clearAll() {
    writeWorkspace(null);
    writeWeights(null);
    setOpenId(null);
    setStatusF(new Set());
    setOrgF(new Set());
    setTypeF(new Set());
  }
  function toggle<T>(set: Set<T>, value: T, apply: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  }

  const openRow = rows.find((r) => r.person.id === openId);
  const openUnscored = unscored.find((u) => u.id === openId);
  const closeDrawer = useCallback(() => { setOpenId(null); setNotice(""); }, []);
  const datasetLine = !loaded ? "" : example ? "EXAMPLE DATA, fictional" : "Real public sources · scores are illustrative";

  return (
    <div className="min-h-full bg-[var(--paper)]">
      <header className="top" data-testid="topbar">
        <span className="mark">ping when</span>
        <nav className="navrow" aria-label="Sections" data-testid="nav">
          {(!loaded || reach.length > 0) && <a className="tl nav-wide" href="#new-in">New in</a>}
          <a className="tl" href="#almost">Almost there</a>
          {(!loaded || unscored.length > 0) && <a className="tl nav-wide" href="#incomplete">Incomplete</a>}
          <a className="tl" href="#import">Import</a>
          <a className="tl" href="#method">Method</a>
        </nav>
      </header>

      <section className={`wrapx ${loaded ? "hero-loaded py-8 md:py-10" : "py-16 md:py-24"}`} data-testid="hero" data-loaded={loaded ? "1" : undefined}>
        <p className="eyebrow muted">
          Week of {formatDay(weekOf(asOf))} through {formatDay(weekEnding(asOf))}
          {hydrated && datasetLine ? " · " : ""}
          <span data-testid="dataset">{hydrated ? datasetLine : ""}</span>
        </p>
        <h1 className={`display ${loaded ? "mt-3" : "mt-6"}`}>Sourcing is automated.{loaded ? " " : <br />}<span className="key">Timing is not.</span></h1>
        {!loaded && (
          <p className="prose-s mt-6 text-[16px]">
            It decides when to reach out. A person still writes, and the queue scores only the roster you import.
          </p>
        )}
        {!loaded && hydrated && (
          <button type="button" className="tlink mt-8" data-testid="hero-example" onClick={() => document.getElementById("load-example")?.click()}>
            See it with 30 example researchers
          </button>
        )}
        {!loaded && (
          <div className="ghostgrid" data-testid="ghostgrid" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i}>
                <span className="eyebrow">{i === 0 ? "Ready to reach" : "Employer"}</span>
                <span className="gname">{i === 0 ? "Your first ready-to-reach person lands here" : "Name"}</span>
                {i === 0 ? <span className="gscore lit tnum">{REACH_THRESHOLD}+</span> : <span className="gscore">--</span>}
                <span className="eyebrow">{i === 0 ? "This week" : "Wait"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="wrapx pb-16">
        {!loaded && <ImportPanel loaded={loaded} example={example} label={workspace?.label ?? ""} onImport={onImport} onClear={clearAll} />}
        {loaded && workspace && workspace.errors.length > 0 && (
          <section className="mt-12">
            <h2 className="h-section">Import errors.</h2>
            <p className="prose-s mt-3 muted">
              Only the faulty row or signal noted was skipped. A person listed here can still be scored from start_date or other valid signals.
            </p>
            <dl className="spec mt-4">
              {workspace.errors.map((e) => (
                <Err key={`${e.row}-${e.message}`} row={e.row} message={e.message} />
              ))}
            </dl>
          </section>
        )}

        {hydrated && !loaded && (
          <section className="mt-16 hair-t pt-12" data-empty="true">
            <h2 className="h-section">The queue is empty.</h2>
            <p className="prose-s mt-4">Nothing is scored until you bring a roster. Three steps:</p>
            <ol className="prose-s mt-4 list-decimal space-y-2 pl-5" data-testid="how-to">
              <li>Choose or drop a CSV or JSON file, or paste rows. Only a name column is required; Download template shows every column.</li>
              <li>Each person with a start_date gets a score. People without one are listed as incomplete (needs start date). Dates are never guessed.</li>
              <li>Read New in and Almost there, open Refine to drag the weights and watch the order change, then Export ranked queue to CSV.</li>
            </ol>
            <p className="prose-s mt-4 muted">Want to see it first? Load example uses 30 fictional seed archetypes, labelled as such.</p>
          </section>
        )}

        {loaded && (
          <div className="mt-6 hair-t pt-6">
            <aside id="adjust-panel" className={`side${refineOpen ? " open" : ""}`} aria-label="Adjust weights and filters" hidden={!refineOpen}>
              {people.length > 0 && <WeightPanel weights={weights} onChange={setWeights} />}
              <div className="mt-10">
                <h3>Status</h3>
                <div className="mt-3">
                  {(
                    [
                      ["reach", "Ready to reach", rows.filter((r) => r.status === "reach").length],
                      ["warm", "Warm up", rows.filter((r) => r.status === "warm").length],
                      ["wait", "Wait", rows.filter((r) => r.status === "wait").length],
                      ["incomplete", "Incomplete", unscored.length],
                    ] as const
                  ).map(([id, text, n]) => (
                    <label key={id} className="check">
                      <input type="checkbox" checked={statusF.has(id)} onChange={() => toggle(statusF, id, setStatusF)} />
                      <span className="flex-1">{text}</span>
                      <span className="muted tnum">{n}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <h3>Employer</h3>
                <div className="mt-3 max-h-64 overflow-y-auto">
                  {orgs.map(([org, n]) => (
                    <label key={org} className="check">
                      <input type="checkbox" checked={orgF.has(org)} onChange={() => toggle(orgF, org, setOrgF)} />
                      <span className="min-w-0 flex-1 truncate">{org}</span>
                      <span className="muted tnum">{n}</span>
                    </label>
                  ))}
                </div>
              </div>
              {types.length > 0 && (
                <div className="mt-8">
                  <h3>Driving signal</h3>
                  <div className="mt-3">
                    {types.map(([t, n]) => (
                      <label key={t} className="check">
                        <input type="checkbox" checked={typeF.has(t)} onChange={() => toggle(typeF, t, setTypeF)} />
                        <span className="flex-1">{SIGNAL_GUIDE[t].label}</span>
                        <span className="muted tnum">{n}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {(statusF.size > 0 || orgF.size > 0 || typeF.size > 0) && (
                <button type="button" className="tlink mt-6" onClick={() => { setStatusF(new Set()); setOrgF(new Set()); setTypeF(new Set()); }}>
                  Clear filters
                </button>
              )}
            </aside>

            <main className="min-w-0">
              <div className="toolbar">
                <p className="text-[13px] muted tnum" data-testid="summary">
                  {people.length} scored · {unscored.length} need a start date{workspace && workspace.errors.length > 0 ? ` · ${workspace.errors.length} import errors` : ""}
                </p>
                <div className="flex items-center gap-6">
                <button type="button" className="tlink" data-testid="adjust" aria-expanded={refineOpen} aria-controls="adjust-panel" onClick={() => setRefineOpen(!refineOpen)}>
                  {refineOpen ? "Hide adjust" : dirty || filtering ? "Adjust (changed)" : "Adjust"}
                </button>
                <label className="flex items-center gap-3">
                  <span className="eyebrow muted">Sort by</span>
                  <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
                    <option value="score">Score</option>
                    <option value="cliff">Cliff date</option>
                    <option value="name">Name</option>
                  </select>
                </label>
                </div>
              </div>

              {people.length > 0 && (
                <div className="mt-6 text-[13px] leading-6" aria-live="polite">
                  {!dirty && refineOpen && <p className="muted">Balanced weights, 30 cliff, 40 proof, 30 shift. Drag cliff proximity and the order changes.</p>}
                  {dirty && entered.length > 0 && (
                    <p>
                      Entered ready to reach:{" "}
                      {entered
                        .map((r) => `${r.person.name} (${drivingLabel(r.driving).toLowerCase()}, was ${baselineById.get(r.person.id)?.rank ?? "unranked"}, now ${r.rank})`)
                        .join("; ")}
                      .
                    </p>
                  )}
                  {dirty && left.length > 0 && <p>Left ready to reach: {left.map((r) => r.person.name).join(", ")}. Their scores fell because this is an average.</p>}
                  {dirty && entered.length === 0 && left.length === 0 && orderSame && (
                    <p data-testid="order-unchanged">
                      Scores moved, but the order did not. No one here has a stronger cliff signal than their other signals, so this weight cannot re-rank them. Nothing is invented to make it move.
                    </p>
                  )}
                </div>
              )}

              {people.length > 0 && (reach.length > 0 || filtering) && (
                <Section id="new-in" testid="this-week" title="New in: ready to reach" count={reach.length} empty="No one clears the line at these weights.">
                  {reach.slice(0, limit.reach).map((r) => (
                    <ProductCard key={r.person.id} row={r} before={baselineById.get(r.person.id)} decision={decisions[r.person.id]} markSeed={example}
                      onOpen={() => setOpenId(r.person.id)} />
                  ))}
                  <More shown={limit.reach} total={reach.length} onMore={() => setLimit({ ...limit, reach: limit.reach + PAGE })} />
                </Section>
              )}
              {people.length > 0 && reach.length === 0 && !filtering && closest && (
                <section className="closest-hero" data-testid="closest-hero" aria-label="Closest to ready">
                  <div className="ch-who">
                    <p className="eyebrow">Closest to ready · {closest.person.org}</p>
                    <button type="button" className="ch-name" onClick={() => setOpenId(closest.person.id)}>{closest.person.name}</button>
                    <p className="ch-why">{drivingLabel(closest.driving)} · {closest.person.roleType}</p>
                  </div>
                  <div className="ch-meter" aria-hidden="true">
                    <p className="ch-score tnum">{closest.score}<span>/{REACH_THRESHOLD}</span></p>
                    <div className="ch-track"><div className="ch-fill" style={{ width: `${Math.min(100, (closest.score / REACH_THRESHOLD) * 100)}%` }} /></div>
                    <p className="eyebrow tnum">{REACH_THRESHOLD - closest.score} points under the line</p>
                  </div>
                  <p className="ch-line tnum" data-testid="none-clear">
                    Nobody clears {REACH_THRESHOLD} this week, so no card is lit. Open{" "}
                    <a className="underline underline-offset-4" href={`#card-${closest.person.id}`} data-testid="closest-link"
                      onClick={() => setOpenId(closest.person.id)}>
                      {closest.person.name}
                    </a>{" "}
                    to see which signal would move the score.
                  </p>
                </section>
              )}
              {people.length > 0 && (
                <Section id="almost" testid="closest" title="Almost there" count={near.length} sub="Highest scores that are not ready this week." empty="No one here with these filters.">
                  {near.slice(0, limit.near).map((r) => (
                    <ProductCard key={r.person.id} row={r} before={baselineById.get(r.person.id)} decision={decisions[r.person.id]} markSeed={example}
                      onOpen={() => setOpenId(r.person.id)} />
                  ))}
                  <More shown={limit.near} total={near.length} onMore={() => setLimit({ ...limit, near: limit.near + PAGE })} />
                </Section>
              )}
              {people.length === 0 && (
                <p className="prose-s mt-10">No scored people yet. Everyone below needs a valid start_date. Add one and import the file again.</p>
              )}
              {unscored.length > 0 && (
                <Section id="incomplete" testid="incomplete" title="Incomplete" count={incomplete.length} sub="Needs start date. Listed, never scored, never guessed." empty="No one here with these filters.">
                  {incomplete.slice(0, limit.incomplete).map((u) => (
                    <IncompleteCard key={u.id} person={u} onOpen={() => setOpenId(u.id)} />
                  ))}
                  <More shown={limit.incomplete} total={incomplete.length} onMore={() => setLimit({ ...limit, incomplete: limit.incomplete + PAGE })} />
                </Section>
              )}
              {people.length > 0 && (
                <div className="mt-14 hair-t pt-6 flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="exports">
                  <button type="button" className="tlink" data-testid="export-ranked" onClick={() => download(rankedQueueCsv(rows, unscored), "ping-when-ranked-queue.csv")}>
                    Export ranked queue (CSV)
                  </button>
                  <button
                    type="button"
                    className="tlink"
                    onClick={() =>
                      download(
                        approvedQueueCsv(rows, approvedIds),
                        "ping-when-approved.csv",
                      )
                    }
                  >
                    Export approved
                  </button>
                  <button type="button" className="tlink" data-testid="export-xlsx" onClick={exportXlsx}>
                    Export ranked queue (Excel)
                  </button>
                  <button type="button" className="tlink" data-testid="remind-approved" onClick={remindApproved}>
                    Calendar reminders for approved ({approvedIds.size})
                  </button>
                  {dirty && (
                    <button type="button" className="tlink" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                      Reset weights
                    </button>
                  )}
                </div>
              )}
              <p className={notice ? "mt-3 text-[13px] tnum" : "sr-only"} aria-live="polite" data-testid="notice">{notice}</p>
            </main>
          </div>
        )}

        {loaded && (
          <div className="mt-14" data-testid="loaded-file">
            <ImportPanel loaded={loaded} example={example} label={workspace?.label ?? ""} onImport={onImport} onClear={clearAll} />
            {importMs !== null && (
              <p className="mt-2 text-[12px] muted tnum" data-testid="import-ms">
                Parsed in {Math.round(importMs)} ms.
              </p>
            )}
          </div>
        )}
        <footer className="cc-foot">
          <p className="foot">Nothing is sent. Data stays in your browser. Scores are a guide, so open the source before you act.</p>
          <hr className="hair" />
          <details id="method" className="method">
            <summary><span className="lab">Method and limits</span><span className="gn">How the score works and what it cannot tell you</span></summary>
          <div className="mt-6 grid gap-x-12 gap-y-4 md:grid-cols-2">
            <p className="prose-s">The roster is the file you import. The example is 30 fictional archetypes and stays off the queue until you load it.</p>
            <p className="prose-s">A cliff is inferred from start_date. A month with no day uses the first of that month. It is not a view of a grant.</p>
            <p className="prose-s">A layoff is news about the employer. It is not proof this person was cut. Open the source link before you approve.</p>
            <p className="prose-s">The line at 60 predicts a likelier reply, not a hire. Approve records a decision on this machine. It does not send.</p>
          </div>
            <div className="mt-12">
              <AutomationPanel />
            </div>
            <p className="mt-10 text-[12px] muted">Ping when is an interview case by Amy Zhuang. It is not a General Intuition product, and it is not affiliated with General Intuition.</p>
          </details>
        </footer>
      </div>

      {openRow && (
        <DetailDrawer
          row={openRow}
          before={baselineById.get(openRow.person.id)}
          weights={weights}
          peers={example ? (peersById.get(openRow.person.org) ?? []).filter((p) => p.id !== openRow.person.id) : []}
          decision={decisions[openRow.person.id]}
          onDecide={(d) => onDecide(openRow.person.id, d)}
          onRemind={() => saveReminders([openRow], `ping-when-reminder-${openRow.person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person"}.ics`)}
          notice={notice}
          onClose={closeDrawer}
          markSeed={example}
        />
      )}
      {openUnscored && <IncompleteDrawer person={openUnscored} onClose={closeDrawer} />}
    </div>
  );
}

function Err({ row, message }: { row: number; message: string }) {
  return (
    <>
      <dt>Row {row}</dt>
      <dd>{message}</dd>
    </>
  );
}

function Section({ id, testid, title, count, sub, empty, children }: { id: string; testid: string; title: string; count: number; sub?: string; empty: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14" data-testid={testid}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="h-section">{title}</h2>
        <span className="text-[13px] muted tnum">{count}</span>
      </div>
      {sub && <p className="mt-2 text-[13px] muted">{sub}</p>}
      {count === 0 ? <p className="prose-s mt-6 muted">{empty}</p> : <div className="pgrid mt-8">{children}</div>}
    </section>
  );
}

function More({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return (
    <div className="col-span-full text-center">
      <button type="button" className="tlink" onClick={onMore}>
        Show more ({total - shown})
      </button>
    </div>
  );
}
