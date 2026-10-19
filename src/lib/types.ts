export type WeightKey = "cliff" | "proof" | "shift";

export type Weights = Record<WeightKey, number>;

export type ObservedSignalType =
  | "release"
  | "talk"
  | "oss"
  | "funding"
  | "layoff"
  | "building"
  | "reorg";

export type SignalType = ObservedSignalType | "cliff";

export type Status = "reach" | "warm" | "wait";

export type ReleaseKind = "paper" | "model";

export interface SeedSignal {
  type: ObservedSignalType;
  date: string;
  title: string;
  detail: string;
  /** Inherent strength before recency decay, from 0 to 1. */
  strength: number;
  kind?: ReleaseKind;
  /** Session end for a talk. The window closes a week after this date. */
  endsOn?: string;
  /** Public page a person can open before approving. */
  sourceUrl?: string;
}

export interface Researcher {
  id: string;
  name: string;
  archetype: string;
  roleType: string;
  org: string;
  location: string;
  /** ISO date the current role started. Cliffs are inferred from this. */
  roleStart: string;
  focus: string;
  /** Concrete work the first-touch angle should open on. */
  workHook: string;
  signals: SeedSignal[];
}
