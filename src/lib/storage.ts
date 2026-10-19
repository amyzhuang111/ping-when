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
