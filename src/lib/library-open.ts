declare module "@tanstack/history" {
  interface HistoryState {
    focusLibraryOpen?: string;
  }
}

// A blocked navigation never installs its ticket in history. Only the intended Studio entry
// in this document can claim the selection, once; source bytes stay in the owner’s library.
let pending: { ticket: string; id: string } | null = null;

export function requestLibraryOpen(id: string) {
  const ticket = crypto.randomUUID();
  pending = { ticket, id };
  return { focusLibraryOpen: ticket };
}

export function takeLibraryOpenId(ticket: unknown): string | null {
  if (!pending || pending.ticket !== ticket) return null;
  const { id } = pending;
  pending = null;
  return id;
}
