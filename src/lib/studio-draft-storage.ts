import { focusLocalStorage } from "./browser-storage";
import type { State } from "./studio-state";

export const STUDIO_KEY = "refraction:v1";

export const changedElsewhere =
  "Another tab changed this draft. Download your current work before reloading to open the other tab’s version.";

export function writeCurrentDraft(state: State, expected: string | null): string {
  const raw = JSON.stringify(state);
  const stored = focusLocalStorage.getItem(STUDIO_KEY);
  if (stored === raw) return raw;
  if (stored !== expected) throw new Error(changedElsewhere);
  focusLocalStorage.setItem(STUDIO_KEY, raw);
  if (focusLocalStorage.getItem(STUDIO_KEY) !== raw)
    throw new Error("Draft write was not retained");
  return raw;
}

export function isLayoutCheckpoint(key: string) {
  return key.startsWith(STUDIO_KEY + ":recovery:") && key.includes(":layout:");
}

declare module "@tanstack/history" {
  interface HistoryState {
    focusLayoutOpen?: boolean;
  }
}
