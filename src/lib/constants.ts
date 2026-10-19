import type { Weights } from "@/lib/types";

export const HALF_LIFE_DAYS = 28;
/** Cliff strength peaks this many days before the anniversary. */
export const CLIFF_PEAK_DAYS = 21;
export const CLIFF_SIGMA = 22;

export const REACH_THRESHOLD = 60;
export const WARM_THRESHOLD = 38;

export const DEFAULT_WEIGHTS: Weights = {
  cliff: 30,
  proof: 40,
  shift: 30,
};

export const YEAR_WEIGHT = {
  12: 1,
  24: 0.84,
  36: 0.72,
} as const;

export const WINDOW = {
  cliff: { before: 42, after: 21 },
  release: { after: 35 },
  talk: { defaultLength: 21, afterSession: 7 },
  oss: { after: 28 },
  funding: { after: 21 },
  layoff: { after: 28 },
  building: { after: 21 },
  reorg: { after: 42 },
} as const;

export const PRESETS: { id: string; label: string; detail: string; weights: Weights }[] = [
  {
    id: "balanced",
    label: "Balanced",
    detail: "30 / 40 / 30",
    weights: { cliff: 30, proof: 40, shift: 30 },
  },
  {
    id: "cliff",
    label: "Cliff week",
    detail: "70 / 40 / 30",
    weights: { cliff: 70, proof: 40, shift: 30 },
  },
  {
    id: "proof",
    label: "Proof week",
    detail: "20 / 70 / 20",
    weights: { cliff: 20, proof: 70, shift: 20 },
  },
  {
    id: "shift",
    label: "Shift week",
    detail: "20 / 25 / 70",
    weights: { cliff: 20, proof: 25, shift: 70 },
  },
];
