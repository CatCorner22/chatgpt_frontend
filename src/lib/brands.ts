import { designId } from "./launch";
// Brand workspace: several website and app builds kept together under one brand name, sharing
// one look. Pure helpers over the browser library so grouping and linking are tested.
import type { Tokens } from "./design";
import type { LibraryEntry, LibraryState } from "./library";

export type BuildKind = "website" | "app";
export const kindOf = (e: LibraryEntry): BuildKind =>
  (e.state["purpose"] as { experience?: string } | undefined)?.experience === "app"
    ? "app"
    : "website";
export const brandOf = (e: LibraryEntry) =>
  (e.collection || e.state.content.brand || "Untitled brand").trim();
const look = (t: Tokens) => JSON.stringify(t);

export type Brand = {
  name: string;
  lead: LibraryEntry;
  builds: { entry: LibraryEntry; kind: BuildKind; sameLook: boolean }[];
};
export function groupBrands(list: LibraryEntry[]): Brand[] {
  const map = new Map<string, LibraryEntry[]>();
  for (const e of list) map.set(brandOf(e), [...(map.get(brandOf(e)) ?? []), e]);
  return [...map.entries()]
    .map(([name, es]) => {
      const sorted = [...es].sort((a, b) => a.created.localeCompare(b.created));
      const lead = sorted[0]!;
      return {
        name,
        lead,
        builds: sorted.map((entry) => ({
          entry,
          kind: kindOf(entry),
          sameLook: look(entry.state.tokens) === look(lead.state.tokens),
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A new build reuses the brand's look and words; it starts at the Vision for its own kind.
export function newBuild(
  from: LibraryEntry,
  kind: BuildKind,
  id: string,
  at: string,
): LibraryEntry {
  const brand = brandOf(from);
  const purpose = { ...((from.state["purpose"] as object) ?? {}), experience: kind };
  const state = {
    ...from.state,
    libraryId: id,
    purpose,
    stage: "rx",
    projectId: null,
    savedHash: null,
    cache: {},
  } as LibraryState;
  return {
    id,
    title: `${brand} — ${kind === "app" ? "App" : "Website"}`,
    collection: brand,
    favorite: false,
    created: at,
    updated: at,
    state,
  };
}

// Copy the lead's colours, fonts and shapes onto another build, keeping that build's words and kind.
export function syncLook(target: LibraryEntry, lead: LibraryEntry, at: string): LibraryEntry {
  return {
    ...target,
    collection: brandOf(lead),
    updated: at,
    state: { ...target.state, tokens: lead.state.tokens },
  };
}

// Finds the saved design whose current values produce this page's design code.
export function findByDesignId(id: string | null | undefined, entries: LibraryEntry[]) {
  if (!id) return null;
  return entries.find((e) => designId(e.state.tokens) === id) ?? null;
}
