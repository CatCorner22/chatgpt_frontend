import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { flushRouterDrafts } from "@/hooks/useDraftExitSave";
import { takeLibraryOpenId } from "@/lib/library-open";
import { GALLERY } from "@/lib/gallery";
import { archiveDesign, LIBRARY_KEY, type LibraryState, writeLibrary } from "@/lib/library";
import { EMPTY_PROFILE, PORTRAIT_KEY, profileText, readProfile } from "@/lib/portrait";

const propose = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/design.functions", () => ({ proposePortrait: propose }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@/components/HostedLibraryPanel", () => ({ HostedLibraryPanel: () => null }));
vi.mock("@/components/DesignPreview", () => ({ DesignPreview: () => null }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: () => {} }));

import { Route as libraryRoute } from "@/routes/library";
import { Route as tasteRoute } from "@/routes/taste";
const Library = (libraryRoute as unknown as { options: { component: ComponentType } }).options
  .component;
const Taste = (tasteRoute as unknown as { options: { component: ComponentType } }).options
  .component;
const work = GALLERY[0]!;
function seed() {
  const entries = archiveDesign(
    [],
    {
      content: work.content,
      tokens: work.direction.tokens,
      libraryId: "work",
      stage: "rx",
    } as LibraryState,
    "2026-11-25",
  );
  entries[0]!.title = "River";
  writeLibrary(entries);
  return entries;
}
function hide() {
  act(() => {
    window.dispatchEvent(new Event("pagehide"));
  });
}
function leave() {
  let saved = false;
  act(() => {
    saved = flushRouterDrafts();
  });
  return saved;
}
beforeEach(() => {
  navigate.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("flushes a still-focused name on Back and keeps a different tab’s collection", async () => {
  const entries = seed();
  const view = render(<Library />);
  const name = await screen.findByLabelText("Name for River");
  name.focus();
  fireEvent.change(name, { target: { value: "New river" } });
  writeLibrary([{ ...entries[0]!, collection: "Workshops" }]);
  expect(leave()).toBe(true);
  expect(document.activeElement).toBe(name);
  expect(screen.getByLabelText("Collection for New river")).toHaveValue("Workshops");
  const writes = vi.spyOn(Storage.prototype, "setItem");
  hide();
  expect(writes).not.toHaveBeenCalled();
  view.unmount();
  render(<Library />);
  expect(await screen.findByLabelText("Name for New river")).toHaveValue("New river");
});

it("protects a newer library title and retains typed text when an exit fails", async () => {
  const entries = seed();
  render(<Library />);
  const name = await screen.findByLabelText("Name for River");
  fireEvent.change(name, { target: { value: "My draft" } });
  writeLibrary([{ ...entries[0]!, title: "Changed elsewhere" }]);
  expect(leave()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Open its Vision" }));
  expect(navigate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("refraction:pending-rescue")).toBeNull();
  expect(name).toHaveValue("My draft");
  expect(screen.getByRole("alert")).toHaveTextContent(/changed in another tab/);
  expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries[0].title).toBe("Changed elsewhere");
});

it("opens only the exact accepted library navigation and stores no project in history or session storage", async () => {
  seed();
  render(<Library />);
  const button = await screen.findByRole("button", { name: "Open its Vision" });
  fireEvent.click(button);
  const request = navigate.mock.calls[0]![0];
  expect(request).toMatchObject({ to: "/", search: { view: "studio" } });
  expect(Object.keys(request.state)).toEqual(["focusLibraryOpen"]);
  // A canceled transition never sets this ticket. A later normal Studio visit must be inert.
  expect(takeLibraryOpenId(undefined)).toBeNull();
  expect(sessionStorage.getItem("refraction:pending-rescue")).toBeNull();
  fireEvent.click(button);
  const accepted = navigate.mock.calls[1]![0].state.focusLibraryOpen;
  expect(takeLibraryOpenId(request.state.focusLibraryOpen)).toBeNull();
  expect(takeLibraryOpenId(accepted)).toBe("work");
  expect(takeLibraryOpenId(accepted)).toBeNull();
});

it("restores unsubmitted Taste notes on exit without casting a vote or running analysis", async () => {
  const view = render(<Taste />);
  fireEvent.change(screen.getByLabelText("What do you love?"), {
    target: { value: "Night gardens" },
  });
  fireEvent.change(screen.getByLabelText(/What feels wrong/), { target: { value: "Tiny text" } });
  fireEvent.change(screen.getByLabelText(/What draws you/), {
    target: { value: "Room to breathe" },
  });
  hide();
  expect(readProfile()).toMatchObject({
    inspiration: "Night gardens",
    avoid: "Tiny text",
    votes: [],
  });
  expect(profileText(readProfile())).not.toContain("Room to breathe");
  expect(propose).not.toHaveBeenCalled();
  view.unmount();
  render(<Taste />);
  expect(screen.getByLabelText(/What draws you/)).toHaveValue("Room to breathe");
  fireEvent.click(screen.getByRole("button", { name: "Choose A" }));
  expect(readProfile().votes).toEqual([{ id: "type", choice: "a", reason: "Room to breathe" }]);
  expect(readProfile().draftReasons).toBeUndefined();
});

it("leaves clean taste alone and refuses to replace a newer profile with an older draft", () => {
  render(<Taste />);
  hide();
  expect(localStorage.getItem(PORTRAIT_KEY)).toBeNull();
  fireEvent.change(screen.getByLabelText("What do you love?"), {
    target: { value: "Quiet forest" },
  });
  const newer = JSON.stringify({ ...EMPTY_PROFILE, inspiration: "Ocean" });
  localStorage.setItem(PORTRAIT_KEY, newer);
  expect(leave()).toBe(false);
  expect(localStorage.getItem(PORTRAIT_KEY)).toBe(newer);
  expect(screen.getByRole("alert")).toHaveTextContent(/changed elsewhere/);
  expect(screen.getByLabelText("What do you love?")).toHaveValue("Quiet forest");
});
