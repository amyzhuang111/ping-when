"use client";

import { useState } from "react";
import { PRESETS } from "@/lib/constants";
import { weightsEqual } from "@/lib/scoring";
import { CATEGORY_META } from "@/lib/signals";
import type { WeightKey, Weights } from "@/lib/types";
import { Slider } from "@/components/ui/slider";

const ORDER: WeightKey[] = ["cliff", "proof", "shift"];

export function WeightPanel({ weights, onChange }: { weights: Weights; onChange: (weights: Weights) => void }) {
  const sum = weights.cliff + weights.proof + weights.shift;

  function setKey(key: WeightKey, value: number) {
    if (Number.isNaN(value)) return;
    onChange({ ...weights, [key]: Math.min(100, Math.max(0, Math.round(value))) });
  }

  return (
    <div data-testid="refine">
      <h3>Refine</h3>
      <p className="mt-2 text-[12px] leading-5 muted">A weighted average. Raising one weight spends attention the others no longer get.</p>
      <div className="mt-4 flex flex-col gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="tlink self-start"
            aria-pressed={weightsEqual(weights, preset.weights)}
            onClick={() => onChange(preset.weights)}
          >
            {preset.label} {preset.detail}
          </button>
        ))}
      </div>
      {ORDER.map((key) => {
        const meta = CATEGORY_META[key];
        const share = sum === 0 ? 0 : Math.round((weights[key] / sum) * 100);
        const labelId = `weight-label-${key}`;
        return (
          <div key={key} className="mt-6">
            <div className="flex items-baseline justify-between gap-2">
              <span id={labelId} className="text-[13px]">
                {meta.slider}
              </span>
              <span className="flex items-baseline gap-1 text-[12px] muted tnum">
                <WeightBox label={`${meta.slider} weight`} value={weights[key]} onCommit={(v) => setKey(key, v)} />
                <span>· {share}%</span>
              </span>
            </div>
            <div className="mt-3 py-2" data-testid={`slider-${key}`}>
              <Slider
                aria-labelledby={labelId}
                min={0}
                max={100}
                step={1}
                value={[weights[key]]}
                onValueChange={(value) => {
                  const next = typeof value === "number" ? value : value[0];
                  setKey(key, next ?? 0);
                }}
              />
            </div>
            <p className="mt-1 text-[12px] leading-5 muted">{meta.hint}.</p>
          </div>
        );
      })}
      {sum === 0 && <p className="mt-4 text-[12px]">All three weights are zero. Every score is 0.</p>}
    </div>
  );
}

/* Keeps a draft so typing 70 over 30 does not clamp to 100 on the first keystroke. */
function WeightBox({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      className="numbox"
      inputMode="numeric"
      min={0}
      max={100}
      type="number"
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text !== "" && Number.isFinite(n) && n >= 0 && n <= 100) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setDraft(null);
      }}
    />
  );
}
