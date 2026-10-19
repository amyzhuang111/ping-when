import type { ImportError, UnscoredCandidate } from "@/lib/exchange";
import type { Researcher } from "@/lib/types";

export const WORKSPACE_KEY = "ping-when-workspace-v1";

export type Decision = "approve" | "snooze" | "dismiss";

export interface Workspace {
  version: 1;
  source: "file" | "paste" | "example";
  label: string;
  people: Researcher[];
  unscored: UnscoredCandidate[];
  errors: ImportError[];
  decisions: Record<string, Decision | undefined>;
}

const listeners = new Set<() => void>();
let memory: Workspace | null | undefined;

function parseStored(raw: string | null): Workspace | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Workspace;
    if (parsed?.version !== 1 || !Array.isArray(parsed.people)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function subscribeWorkspace(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWorkspaceSnapshot(): Workspace | null {
  if (memory === undefined) memory = parseStored(window.localStorage.getItem(WORKSPACE_KEY));
  return memory;
}

export function getWorkspaceServerSnapshot(): Workspace | null {
  return null;
}

export function writeWorkspace(workspace: Workspace | null): void {
  memory = workspace;
  try {
    if (!workspace) window.localStorage.removeItem(WORKSPACE_KEY);
    else window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch {
    /* Private mode can refuse the write. The session still scores. */
  }
  listeners.forEach((listener) => listener());
}

/* Weights persist separately so a reload keeps the operator's slider position. */
export const WEIGHTS_KEY = "ping-when-weights-v1";
const weightListeners = new Set<() => void>();
let weightMemory: { cliff: number; proof: number; shift: number } | null | undefined;

function parseWeights(raw: string | null): { cliff: number; proof: number; shift: number } | null {
  if (!raw) return null;
  try {
    const w = JSON.parse(raw);
    const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
    if (w && ok(w.cliff) && ok(w.proof) && ok(w.shift)) return { cliff: w.cliff, proof: w.proof, shift: w.shift };
  } catch {
    /* ignore */
  }
  return null;
}

export function subscribeWeights(listener: () => void): () => void {
  weightListeners.add(listener);
  return () => weightListeners.delete(listener);
}

export function getWeightsSnapshot(): { cliff: number; proof: number; shift: number } | null {
  if (weightMemory === undefined) {
    try {
      weightMemory = parseWeights(window.localStorage.getItem(WEIGHTS_KEY));
    } catch {
      weightMemory = null;
    }
  }
  return weightMemory;
}

export function getWeightsServerSnapshot(): null {
  return null;
}

export function writeWeights(weights: { cliff: number; proof: number; shift: number } | null): void {
  weightMemory = weights;
  try {
    if (!weights) window.localStorage.removeItem(WEIGHTS_KEY);
    else window.localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
  } catch {
    /* Private mode can refuse the write. */
  }
  weightListeners.forEach((listener) => listener());
}
