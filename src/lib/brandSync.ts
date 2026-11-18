import { normalizeTokens } from "./design";
import { parseLibrary, type LibraryEntry } from "./library";

// Pure merge of this browser's builds with the account's: the newer edit of a build wins, nothing is dropped.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const syncable = (e: LibraryEntry) => UUID.test(e.id);

export function mergeBuilds(local: LibraryEntry[], remote: LibraryEntry[]) {
  const byId = new Map(local.map((e) => [e.id, e]));
  const push: LibraryEntry[] = [];
  for (const r of remote) {
    const l = byId.get(r.id);
    if (!l || Date.parse(r.updated) > Date.parse(l.updated)) byId.set(r.id, r);
  }
  const remoteIds = new Map(remote.map((r) => [r.id, r]));
  for (const l of local) {
    const r = remoteIds.get(l.id);
    if (syncable(l) && (!r || Date.parse(l.updated) > Date.parse(r.updated))) push.push(l);
  }
  const merged = [...byId.values()].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  return { merged, push };
}

export type BuildRow = {
  build_id: string;
  title: string;
  collection: string;
  favorite: boolean;
  state: unknown;
  created_at: string;
  updated_at: string;
};
export const toRow = (e: LibraryEntry) => ({
  build_id: e.id,
  title: e.title.slice(0, 120),
  collection: e.collection,
  favorite: e.favorite,
  state: e.state,
  created_at: e.created,
  updated_at: e.updated,
});
// Rows from the account are validated the same way as browser storage, so bad rows are skipped.
export function fromRows(rows: BuildRow[]): LibraryEntry[] {
  const entries = rows.map((r) => ({
    id: r.build_id,
    title: r.title,
    collection: r.collection,
    favorite: r.favorite,
    created: r.created_at,
    updated: r.updated_at,
    state: r.state,
  }));
  return parseLibrary(JSON.stringify({ version: 1, entries })).map((e) => ({
    ...e,
    state: { ...e.state, tokens: normalizeTokens(e.state.tokens), libraryId: e.id },
  }));
}
