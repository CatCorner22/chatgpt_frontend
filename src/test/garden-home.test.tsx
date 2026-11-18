import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GARDEN_STEPS, getGardenStep } from "@/lib/garden-content";
import { GARDEN_DEFAULTS, GARDEN_KEY } from "@/lib/garden-preferences";
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
      expect(screen.getByRole("heading", { level: 1, name: "Pick a direction" })).toHaveFocus(),
    );
    expect(screen.getByText(/Your starting point: a new page/)).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "Garden Path steps" });
    for (const [index, step] of GARDEN_STEPS.entries()) {
      const button = within(navigation).getByRole("button", {
        name: `${index + 1}. ${step.title}`,
      });
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-current", "step");
      expect(navigation.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    }
    expect(screen.getByRole("heading", { level: 1, name: "Check the result" })).toHaveFocus();
    expect(screen.getByText(/Visiting a stop does not mark its work as done/)).toBeVisible();
    expect(screen.queryByText(/all tests passed|ready to launch|redesign complete/i)).toBeNull();
    expect(JSON.parse(localStorage.getItem(GARDEN_KEY)!)).toEqual({
      version: 1,
      step: "check",
      goal: "new",
      brief: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Previous stop" }));
    expect(screen.getByRole("heading", { level: 1, name: "Prepare the handoff" })).toHaveFocus();
    expect(writes.mock.calls.every(([key]) => key === GARDEN_KEY)).toBe(true);
    for (const [key, value] of protectedRecords) expect(localStorage.getItem(key)).toBe(value);
  });

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
    expect(screen.getByRole("heading", { level: 1, name: "Plan the page" })).toHaveFocus();
    const plan = getGardenStep("plan");
    expect(screen.getByText(plan.lessons[0]!.paragraphs[0]!)).toBeVisible();
    view.unmount();
    render(<GardenHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Plan the page");
    expect(lessons().details).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    expect(screen.getByText(plan.lessons[0]!.paragraphs[0]!)).not.toBeVisible();
    expect(screen.getByText(plan.essentials[0]!)).toBeVisible();
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
    expect(screen.getByRole("heading", { level: 1, name: "Pick a direction" })).toHaveFocus();
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
      expect(screen.getByText(/Your starting point: a new page/)).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Previous stop" }));
      expect(screen.getByRole("radio", { name: /^A new page/ })).toBeChecked();
      if (failure !== "denied readback") expect(readOriginal(GARDEN_KEY)).toBe(before);
    },
  );

  it("offers real destination links for the studio, handoff and static inspection tools", async () => {
    render(<GardenHome />);
    await screen.findByRole("button", { name: "Continue" });
    expect(screen.getByRole("link", { name: "Meet Reverie" })).toHaveAttribute("href", "/reverie");
    expect(screen.getByRole("link", { name: "Detailed walkthrough" })).toHaveAttribute(
      "href",
      "/welcome",
    );
    for (const [stepName, linkName, href] of [
      ["2. Pick a direction", "Explore design directions", "/?view=studio"],
      ["3. Plan the page", "Refine the design", "/?view=studio"],
      ["4. Prepare the handoff", "Prepare with Target", "/target"],
      ["5. Check the result", "Inspect with Telescope", "/telescope"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name: stepName }));
      expect(screen.getByRole("link", { name: linkName })).toHaveAttribute("href", href);
    }
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
