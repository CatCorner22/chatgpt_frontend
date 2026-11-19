import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GARDEN_STEPS, getGardenStep, type GardenStepId } from "@/lib/garden-content";
import { GARDEN_DEFAULTS, GARDEN_KEY } from "@/lib/garden-preferences";
import { GARDEN_FORMULA } from "@/lib/garden-formula";
import { LIBRARY_KEY } from "@/lib/library";
import { PROGRESS_KEY } from "@/lib/launch";
import { ONBOARDING_KEY } from "@/lib/onboarding";
import { STUDIO_KEY } from "@/lib/projects";

vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus navigation</header> }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: Record<string, string> }) => (
    <a
      href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}
      {...props}
    />
  ),
}));
import { GardenHome } from "@/components/GardenHome";

const protectedRecords = [
  [STUDIO_KEY, "unfinished customer design"],
  [LIBRARY_KEY, "customer library and history"],
  [ONBOARDING_KEY, JSON.stringify({ version: 1, step: 3, finished: false })],
  [PROGRESS_KEY, "recorded launch evidence"],
] as const;

function seedProtectedRecords() {
  for (const [key, value] of protectedRecords) localStorage.setItem(key, value);
}

function lessons() {
  const summary = screen.getByText(/^Learn:/).closest("summary")!;
  return { summary, details: summary.parentElement as HTMLDetailsElement };
}

function visitStep(id: GardenStepId) {
  const index = GARDEN_STEPS.findIndex((step) => step.id === id);
  const step = GARDEN_STEPS[index]!;
  fireEvent.click(screen.getByRole("button", { name: `${index + 1}. ${step.title}` }));
  return step;
}

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Garden home", () => {
  it("opens without saving defaults, inspecting project data or changing existing work", async () => {
    seedProtectedRecords();
    const reads = vi.spyOn(Storage.prototype, "getItem");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const removes = vi.spyOn(Storage.prototype, "removeItem");
    const clears = vi.spyOn(Storage.prototype, "clear");
    render(<GardenHome />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "What are we working on?",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
    expect(reads.mock.calls.every(([key]) => key === GARDEN_KEY)).toBe(true);
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
    expect(clears).not.toHaveBeenCalled();
    for (const [key, value] of protectedRecords) expect(localStorage.getItem(key)).toBe(value);
    expect(screen.getByRole("radio", { name: /^An existing app or website/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
  });

  it("remembers goal and navigation choices, focuses the new heading, and writes no completion evidence", async () => {
    seedProtectedRecords();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<GardenHome />);
    fireEvent.click(await screen.findByRole("radio", { name: /^A new page/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: GARDEN_STEPS[1]!.title })).toHaveFocus(),
    );
    visitStep("direction");
    expect(screen.getByText(/Your starting point: a new page/)).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "Garden Path steps" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(9);
    expect(GARDEN_STEPS.map((step) => step.id)).toEqual(
      expect.arrayContaining([
        "goal",
        "content",
        "plan",
        "direction",
        "craft",
        "behavior",
        "responsive",
        "handoff",
        "check",
      ]),
    );
    for (const [index, step] of GARDEN_STEPS.entries()) {
      const button = within(navigation).getByRole("button", {
        name: `${index + 1}. ${step.title}`,
      });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-current", "step");
      expect(navigation.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    }
    expect(
      screen.getByRole("heading", { level: 1, name: getGardenStep("check").title }),
    ).toHaveFocus();
    expect(screen.getByText(/Visiting a stop does not mark its work as done/)).toBeVisible();
    expect(screen.queryByText(/all tests passed|ready to launch|redesign complete/i)).toBeNull();
    expect(JSON.parse(localStorage.getItem(GARDEN_KEY)!)).toEqual({
      version: 1,
      step: "check",
      goal: "new",
      brief: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Previous stop" }));
    expect(
      screen.getByRole("heading", { level: 1, name: GARDEN_STEPS.at(-2)!.title }),
    ).toHaveFocus();
    expect(writes.mock.calls.every(([key]) => key === GARDEN_KEY)).toBe(true);
    for (const [key, value] of protectedRecords) expect(localStorage.getItem(key)).toBe(value);
  });

  it.each(["goal", "direction", "plan", "handoff", "check"] as const)(
    "reopens the original saved %s step by stable ID without rewriting it",
    async (stepId) => {
      const raw = JSON.stringify({ version: 1, step: stepId, goal: "new", brief: false });
      localStorage.setItem(GARDEN_KEY, raw);
      const writes = vi.spyOn(Storage.prototype, "setItem");
      render(<GardenHome />);
      const step = getGardenStep(stepId);
      expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
        stepId === "goal" ? "What are we working on?" : step.title,
      );
      expect(screen.getByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
      expect(lessons().details).toHaveAttribute("open");
      expect(writes).not.toHaveBeenCalled();
      expect(localStorage.getItem(GARDEN_KEY)).toBe(raw);
    },
  );

  it("restores and remembers the lesson preference across hiding, opening, steps and remounts", async () => {
    localStorage.setItem(
      GARDEN_KEY,
      JSON.stringify({ ...GARDEN_DEFAULTS, step: "direction", brief: false }),
    );
    const direction = getGardenStep("direction");
    let view = render(<GardenHome />);
    expect(await screen.findByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
    expect(lessons().details).toHaveAttribute("open");
    expect(screen.getByText(direction.lessons[0]!.paragraphs[0]!)).toBeVisible();
    expect(screen.getByText(direction.essentials[0]!)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Hide the longer lessons" }));
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
    expect(lessons().summary).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(direction.lessons[0]!.paragraphs[0]!)).not.toBeVisible();
    expect(screen.getByText(direction.essentials[0]!)).toBeVisible();
    view.unmount();
    view = render(<GardenHome />);
    expect(lessons().details).not.toHaveAttribute("open");
    expect(screen.getByText(direction.lessons[0]!.paragraphs[0]!)).not.toBeVisible();

    fireEvent.click(lessons().summary);
    expect(lessons().summary).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Visit next stop" }));
    const nextStep = GARDEN_STEPS[GARDEN_STEPS.findIndex((step) => step.id === "direction") + 1]!;
    expect(screen.getByRole("heading", { level: 1, name: nextStep.title })).toHaveFocus();
    expect(screen.getByText(nextStep.lessons[0]!.paragraphs[0]!)).toBeVisible();
    view.unmount();
    render(<GardenHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(nextStep.title);
    expect(lessons().details).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    expect(screen.getByText(nextStep.lessons[0]!.paragraphs[0]!)).not.toBeVisible();
    expect(screen.getByText(nextStep.essentials[0]!)).toBeVisible();
    expect(JSON.parse(localStorage.getItem(GARDEN_KEY)!).brief).toBe(true);
  });

  it("preserves an unreadable saved preference on mount and explains the fallback", async () => {
    const damaged = '{"version":99,"unknown":"kept for recovery"}';
    localStorage.setItem(GARDEN_KEY, damaged);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<GardenHome />);
    expect(await screen.findByRole("status")).toHaveTextContent(/could not be read/);
    expect(screen.getByRole("status")).toHaveTextContent(/saved copy has not been changed/);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(GARDEN_KEY)).toBe(damaged);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("remains usable when both preference reads and writes are denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    render(<GardenHome />);
    expect(await screen.findByRole("status")).toHaveTextContent(/could not be read/);
    fireEvent.click(screen.getByRole("radio", { name: /^A new page/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { level: 1, name: GARDEN_STEPS[1]!.title })).toHaveFocus();
    visitStep("direction");
    expect(screen.getByText(/Your starting point: a new page/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(/could not be confirmed as saved/);
    fireEvent.click(lessons().summary);
    expect(lessons().details).toHaveAttribute("open");
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
  });

  it.each(["denied write", "dropped write", "denied readback"] as const)(
    "keeps current choices usable and warns after a %s",
    async (failure) => {
      const before = JSON.stringify(GARDEN_DEFAULTS);
      localStorage.setItem(GARDEN_KEY, before);
      const readOriginal = localStorage.getItem.bind(localStorage);
      render(<GardenHome />);
      await screen.findByRole("checkbox", { name: "Keep it brief" });
      if (failure === "denied write")
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("Storage full");
        });
      if (failure === "dropped write")
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
      if (failure === "denied readback")
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
          throw new Error("Readback denied");
        });
      fireEvent.click(screen.getByRole("radio", { name: /^A new page/ }));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByRole("status")).toHaveTextContent(/could not be confirmed as saved/);
      visitStep("direction");
      expect(screen.getByText(/Your starting point: a new page/)).toBeVisible();
      visitStep("goal");
      expect(screen.getByRole("radio", { name: /^A new page/ })).toBeChecked();
      if (failure !== "denied readback") expect(readOriginal(GARDEN_KEY)).toBe(before);
    },
  );

  it("links the expanded steps to the studio, Stratosphere, quality, handoff and inspection tools", async () => {
    render(<GardenHome />);
    await screen.findByRole("button", { name: "Continue" });
    expect(screen.getByRole("link", { name: "Meet Reverie" })).toHaveAttribute("href", "/reverie");
    expect(screen.getByRole("link", { name: "Detailed walkthrough" })).toHaveAttribute(
      "href",
      "/welcome",
    );
    const destinations: Record<Exclude<GardenStepId, "goal">, string> = {
      content: "/?view=studio",
      plan: "/?view=studio&panel=stratosphere&group=composition",
      direction: "/?view=studio",
      craft: "/?view=studio&panel=stratosphere&group=palette",
      behavior: "/?view=studio&panel=stratosphere&group=form",
      responsive: "/quality",
      handoff: "/target",
      check: "/telescope",
    };
    const offered = new Set<string>();
    for (const step of GARDEN_STEPS) {
      if (step.id === "goal") continue;
      visitStep(step.id);
      const href = destinations[step.id];
      expect(
        screen.getByRole("link", {
          name: GARDEN_FORMULA[step.id].primaryLabel ?? step.actionLabel,
        }),
      ).toHaveAttribute("href", href);
      offered.add(href);
    }
    expect([...offered]).toEqual(
      expect.arrayContaining([
        "/?view=studio",
        "/?view=studio&panel=stratosphere&group=palette",
        "/quality",
        "/target",
        "/telescope",
      ]),
    );
  });

  it("keeps a complete Do / Changes / Check formula and all scope warnings visible at every stop", async () => {
    seedProtectedRecords();
    render(<GardenHome />);
    await screen.findByRole("button", { name: "Continue" });
    for (const step of GARDEN_STEPS) {
      visitStep(step.id);
      const formula = GARDEN_FORMULA[step.id];
      for (const label of ["Do", "Changes", "Check"]) {
        expect(screen.getByText(label, { selector: "dt" })).toBeVisible();
      }
      for (const value of [formula.do, formula.changes, formula.check]) {
        expect(screen.getByText(value)).toBeVisible();
      }
      if (formula.scopeNote) expect(screen.getByText(formula.scopeNote)).toBeVisible();
      if (step.id !== "goal") expect(screen.getByText(step.evidenceNote)).toBeVisible();
      expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
      expect(screen.queryByRole("region", { name: "Design decision field notes" })).toBeNull();
      expect(document.querySelectorAll(".garden-primary")).toHaveLength(1);
    }
    for (const [key, value] of protectedRecords) expect(localStorage.getItem(key)).toBe(value);
  });

  it("offers real font, hierarchy and spacing links beside the primary palette task", async () => {
    render(<GardenHome />);
    await screen.findByRole("button", { name: "Continue" });
    visitStep("craft");
    const navigation = screen.getByRole("navigation", { name: "Other craft details" });
    for (const detail of GARDEN_FORMULA.craft.details!) {
      expect(within(navigation).getByRole("link", { name: detail.label })).toHaveAttribute(
        "href",
        `/?view=studio&panel=stratosphere&group=${detail.group}`,
      );
    }
    expect(screen.getByRole("img", { name: "Reverie reading a map" })).toHaveAttribute(
      "src",
      "/brand/reverie-map-guide.png",
    );
    expect(screen.getByRole("img", { name: "Reverie walking with her kite" })).toHaveAttribute(
      "src",
      "/brand/reverie-kite.png",
    );
    expect(document.querySelector(".garden-river")).toHaveAttribute(
      "src",
      "/brand/garden-river.png",
    );
  });

  it("mounts the read-only decision guide only while lessons are open and reopens it for the current stop", async () => {
    seedProtectedRecords();
    render(<GardenHome />);
    await screen.findByRole("button", { name: "Continue" });
    expect(screen.queryByRole("region", { name: "Design decision field notes" })).toBeNull();
    fireEvent.click(lessons().summary);
    const guide = await screen.findByRole("region", { name: "Design decision field notes" });
    expect(guide).toBeVisible();
    await within(guide).findByRole("combobox");
    fireEvent.click(screen.getByRole("button", { name: "Hide the longer lessons" }));
    expect(screen.queryByRole("region", { name: "Design decision field notes" })).toBeNull();
    visitStep("craft");
    expect(screen.getByText(GARDEN_FORMULA.craft.scopeNote!)).toBeVisible();
    fireEvent.click(lessons().summary);
    expect(
      await screen.findByRole("region", { name: "Design decision field notes" }),
    ).toBeVisible();
    await screen.findByRole("combobox");
    expect(screen.getByText(GARDEN_FORMULA.craft.scopeNote!)).toBeVisible();
    for (const [key, value] of protectedRecords) expect(localStorage.getItem(key)).toBe(value);
  });

  it("uses labelled native controls and a focusable heading for keyboard access", async () => {
    render(<GardenHome />);
    const group = await screen.findByRole("group", { name: "Choose a starting point" });
    expect(group.tagName).toBe("FIELDSET");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.tagName).toBe("INPUT");
      expect(radio).toHaveAttribute("name", "garden-goal");
      expect(radio).toHaveAccessibleName();
    }
    const brief = screen.getByRole("checkbox", { name: "Keep it brief" });
    expect(brief.tagName).toBe("INPUT");
    expect(brief).toHaveAccessibleDescription(/Hide the longer lessons/);
    const { summary, details } = lessons();
    expect(summary.tagName).toBe("SUMMARY");
    expect(details.tagName).toBe("DETAILS");
    expect(summary).toHaveAttribute("aria-expanded", "false");
    for (const button of screen.getAllByRole("button")) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
