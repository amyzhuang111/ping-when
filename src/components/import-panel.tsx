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
  onImport: (result: ImportResult, source: "file" | "paste" | "example", label: string) => void;
  onClear: () => void;
}) {
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");

  function take(text: string, filename: string, source: "file" | "paste") {
    onImport(parseImport(text, filename), source, filename);
    setNotice("");
  }

  async function loadExample() {
    const response = await fetch("/ping-when-example.csv");
    if (!response.ok) {
      setNotice("The example file did not load.");
      return;
    }
    const text = await response.text();
    onImport(parseImport(text, "ping-when-example.csv"), "example", "Example. 30 fictional seed archetypes.");
    setNotice("");
  }

  return (
    <section className="gi-card">
      <div className="border-b border-[#4d4d4d] p-5">
        <h2 className="gi-h text-[28px] text-white">Bring a file.</h2>
        <p className="gi-prose-sm mt-3">
          CSV or JSON — comma, semicolon, or tab-separated paste from Sheets/Excel works too.
          Only name is required: a name column (name, Candidate Name, Full Name) is enough to
          list someone; role (Title) and employer (Company) can be blank. start_date (Start
          Date, Date Started) as YYYY-MM (or YYYY-MM-DD with a day) is what scores them —
          without it they stay listed as unscored. Signals are optional, one per row: add type,
          date, source_url, note only when you have a signal. A candidate with no signal still
          scores from start_date (cliff). The queue scores only what you import.
        </p>
      </div>

      <div
        className="border-b border-[#4d4d4d] p-5"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (!file) return;
          void file.text().then((text) => take(text, file.name, "file"));
        }}
        data-dragging={dragging ? "true" : "false"}
      >
        <p className="text-[16px] leading-[1.7]">
          {dragging ? "Drop the file." : "Drop a CSV or JSON file here, or choose one."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="gi-btn cursor-pointer">
            Choose file
            <input
              className="hidden"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              aria-label="Choose CSV or JSON file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => take(text, file.name, "file"));
                event.target.value = "";
              }}
            />
          </label>
          <a className="gi-btn" href="/ping-when-template.csv" download="ping-when-template.csv">
            Download template
          </a>
          <a className="gi-btn" href="/ping-when-example.csv" download="ping-when-example.csv">
            Download example
          </a>
          <button type="button" className="gi-btn" onClick={() => void loadExample()}>
            Load example
          </button>
          {loaded && (
            <button type="button" className="gi-btn" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
        <p className="gi-mono mt-4 text-[12px] leading-5 text-[#888]">
          Example. 30 fictional seed archetypes. Load it on purpose. Clear it before a real list.
        </p>
      </div>

      <div className="p-5">
        <label className="text-[16px] leading-[1.25] text-white" htmlFor="paste-roster">
          Or paste CSV or JSON.
        </label>
        <textarea
          id="paste-roster"
          className="gi-mono mt-3 min-h-28 w-full border border-[#4d4d4d] bg-black p-3 text-[13px] leading-6 text-[#ffffffbb] outline-none"
          value={paste}
          spellCheck={false}
          onChange={(event) => setPaste(event.target.value)}
        />
        <button
          type="button"
          className="gi-btn mt-3"
          onClick={() => {
            take(paste, "pasted.csv", "paste");
            setPaste("");
          }}
        >
          Import paste
        </button>
        {loaded && (
          <p className="gi-mono mt-4 text-[12px] leading-5 text-[#888]" data-loaded={example ? "example" : "roster"}>
            {example ? "Example. 30 fictional seed archetypes." : label}
          </p>
        )}
        {notice && <p className="mt-3 text-[16px] leading-[1.7]">{notice}</p>}
      </div>
    </section>
  );
}
