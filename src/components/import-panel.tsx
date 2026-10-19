"use client";

import { useState } from "react";
import { parseImport, type ImportResult } from "@/lib/exchange";

export function ImportPanel({
  loaded,
  example,
  label,
  onImport,
  onClear,
}: {
  loaded: boolean;
  example: boolean;
  label: string;
  onImport: (result: ImportResult, source: "file" | "paste" | "example", label: string, ms: number) => void;
  onClear: () => void;
}) {
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);

  function take(text: string, filename: string, source: "file" | "paste") {
    const t0 = performance.now();
    const result = parseImport(text, filename);
    onImport(result, source, filename, performance.now() - t0);
    setNotice("");
    setOpen(false);
  }

  async function loadExample() {
    const response = await fetch("/ping-when-example.csv");
    if (!response.ok) {
      setNotice("The example file did not load.");
      return;
    }
    const text = await response.text();
    const t0 = performance.now();
    const result = parseImport(text, "ping-when-example.csv");
    onImport(result, "example", "Example. 30 fictional seed archetypes.", performance.now() - t0);
    setNotice("");
    setOpen(false);
  }

  const loadedLine = example ? "Example. 30 fictional seed archetypes." : label;
  if (loaded && !open) {
    return (
      <section id="import" className="flex flex-wrap items-baseline gap-x-6 gap-y-2" data-testid="import-collapsed">
        <p className="text-[13px] muted" data-loaded={example ? "example" : "roster"}>Loaded: {loadedLine}</p>
        <button type="button" className="tlink" onClick={() => setOpen(true)} data-testid="import-open">Import</button>
        <button type="button" className="tlink" onClick={onClear} data-testid="clear-data">Clear my data</button>
        {notice && <p className="text-[13px]">{notice}</p>}
      </section>
    );
  }
  return (
    <section id="import" className="grid gap-10 md:grid-cols-2">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void file.text().then((text) => take(text, file.name, "file"));
        }}
        data-dragging={dragging ? "true" : "false"}
      >
        <h2 className="h-section">Bring a roster.</h2>
        <p className="prose-s mt-4">
          CSV or JSON, or a comma, semicolon or tab-separated paste from Sheets or Excel. Only a name column is
          required. start_date (YYYY-MM or YYYY-MM-DD) is what scores a person; without it they are listed as
          incomplete. Signals are optional, one per row: type, date, source_url, note.
        </p>
        <p className="mt-4 text-[13px] muted">{dragging ? "Drop the file." : "Drop a CSV or JSON file anywhere here, or choose one."}</p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-4">
          <label className="tlink cursor-pointer">
            Choose file
            <input
              className="hidden"
              type="file"
              accept=".csv,.tsv,.json,text/csv,application/json"
              aria-label="Choose CSV or JSON file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void file.text().then((text) => take(text, file.name, "file"));
                e.target.value = "";
              }}
            />
          </label>
          <a className="tlink" href="/ping-when-template.csv" download="ping-when-template.csv">
            Download template
          </a>
          <a className="tlink" href="/ping-when-example.csv" download="ping-when-example.csv">
            Download example
          </a>
          <button type="button" className="tlink" onClick={() => void loadExample()}>
            Load example
          </button>
        </div>
        {!loaded && <p className="mt-4 text-[12px] muted">Example. 30 fictional seed archetypes. Load it on purpose. Clear it before a real list.</p>}
      </div>

      <div>
        <label className="eyebrow font-semibold" htmlFor="paste-roster">
          Or paste CSV or JSON
        </label>
        <textarea
          id="paste-roster"
          className="field mt-3 min-h-32"
          value={paste}
          spellCheck={false}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            className="tlink"
            onClick={() => {
              take(paste, "pasted.csv", "paste");
              setPaste("");
            }}
          >
            Import paste
          </button>
          {loaded && (
            <button type="button" className="tlink" onClick={onClear} data-testid="clear-data">
              Clear my data
            </button>
          )}
          {loaded && (
            <button type="button" className="tlink" onClick={() => setOpen(false)}>
              Hide import
            </button>
          )}
        </div>
        <p className="mt-4 text-[12px] muted" data-testid="storage-note">
          Your roster, weights and decisions are stored only in this browser (localStorage). Nothing is uploaded or sent.
          Clear my data removes them.
        </p>
        {loaded && (
          <p className="mt-2 text-[12px] muted" data-loaded={example ? "example" : "roster"}>
            Loaded: {loadedLine}
          </p>
        )}
        {notice && <p className="mt-3 text-[13px]">{notice}</p>}
      </div>
    </section>
  );
}
