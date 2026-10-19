"use client";

import { PRESETS, REACH_THRESHOLD, WARM_THRESHOLD } from "@/lib/constants";
import { weightsEqual } from "@/lib/scoring";
import { CATEGORY_META } from "@/lib/signals";
import type { WeightKey, Weights } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const ORDER: WeightKey[] = ["cliff", "proof", "shift"];

export function WeightPanel({
  weights,
  onChange,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
}) {
  const sum = weights.cliff + weights.proof + weights.shift;

  function setKey(key: WeightKey, value: number) {
    if (Number.isNaN(value)) return;
    const next = Math.min(100, Math.max(0, Math.round(value)));
    onChange({ ...weights, [key]: next });
  }

  return (
    <div className="gi-card">
      <div className="border-b border-[#4d4d4d] p-5">
        <h2 className="gi-h text-[28px] text-white">Weights.</h2>
        <p className="gi-prose-sm mt-3">
          A weighted average. Raising cliff proximity spends attention the other two weights no
          longer get.
        </p>
      </div>

      <p className="gi-mono border-b border-[#4d4d4d] p-5 text-[13px] leading-6 text-[#ffffffbb]">
        score = (wC · Cliff + wP · Proof + wS · Shift) / (wC + wP + wS)
      </p>

      <div className="flex flex-wrap gap-px border-b border-[#4d4d4d] p-5">
        {PRESETS.map((preset) => {
          const active = weightsEqual(weights, preset.weights);
          return (
            <button
              key={preset.id}
              type="button"
              className="gi-btn"
              aria-pressed={active}
              onClick={() => onChange(preset.weights)}
            >
              {preset.label} {preset.detail}
            </button>
          );
        })}
      </div>

      <div>
        {ORDER.map((key) => {
          const meta = CATEGORY_META[key];
          const share = sum === 0 ? 0 : Math.round((weights[key] / sum) * 100);
          const labelId = `weight-label-${key}`;
          return (
            <div key={key} className="border-b border-[#4d4d4d] p-5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span id={labelId} className="text-[16px] text-white">
                  {meta.slider}.
                </span>
                <span className="gi-mono text-[13px] text-[#888]">
                  {weights[key]} · {share}%
                </span>
              </div>
              <p className="mt-2 text-[16px] leading-[1.7] text-[#888]">{meta.hint}.</p>
              {key === "cliff" && (
                <p className="gi-prose-sm mt-2">
                  Drag this from 30 to 70. Proof stays 40. Shift stays 30.
                </p>
              )}
              <div className="mt-4 flex items-center gap-4">
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
                <Input
                  aria-label={`${meta.slider} weight`}
                  className="gi-mono w-14 shrink-0 px-1 text-center"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  type="number"
                  value={weights[key]}
                  onChange={(event) => setKey(key, event.target.valueAsNumber)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <dl className="gi-mono grid border-t border-[#4d4d4d] text-[13px] leading-6">
        <div className="border-b border-[#4d4d4d] p-5">
          <dt className="text-[#888]">Reach out this week</dt>
          <dd>
            Score at least {REACH_THRESHOLD}, and the driving window covers 19–25 Oct.
          </dd>
        </div>
        <div className="border-b border-[#4d4d4d] p-5">
          <dt className="text-[#888]">Warm up</dt>
          <dd>Score at least {WARM_THRESHOLD}, or a hotter score whose window is shut.</dd>
        </div>
        <div className="p-5">
          <dt className="text-[#888]">Wait</dt>
          <dd>Under {WARM_THRESHOLD}.</dd>
        </div>
      </dl>
      {sum === 0 && (
        <p className="border-t border-[#4d4d4d] p-5 text-[16px] leading-[1.7]">
          All three weights are zero. Every score is 0.
        </p>
      )}
    </div>
  );
}
