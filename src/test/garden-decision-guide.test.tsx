import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GardenDecisionGuide } from "@/components/GardenDecisionGuide";
import catalogue from "@/lib/garden-decisions.data.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Garden decision field notes", () => {
  it("offers the complete region as research without writing a project or claiming completion", async () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<GardenDecisionGuide stepId="craft" />);
    const select = await screen.findByRole("combobox", { name: /Explore a question/ });
    expect(within(select).getAllByRole("option")).toHaveLength(21);
    expect(screen.getByText(/Reading them changes no project and proves no test/)).toBeVisible();
    expect(writes).not.toHaveBeenCalled();
    expect(catalogue.decisions).toHaveLength(128);
    expect(new Set(catalogue.decisions.map((item) => item.id)).size).toBe(128);
  });

  it("keeps pattern-specific checks and complementary practices distinct", async () => {
    render(<GardenDecisionGuide stepId="behavior" />);
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "B15" } });
    expect(screen.getByText(/without modal containment/)).toBeVisible();
    expect(screen.getByText(/remains inside while open/)).toBeVisible();
    expect(screen.getByText(/Use the approach that fits each part of the task/)).toBeVisible();
    fireEvent.change(select, { target: { value: "B03" } });
    expect(screen.getByText(/These approaches can work together/)).toBeVisible();
    expect(screen.getByText(/If this is unknown, clarify it before acting/)).toBeVisible();
  });

  it("switches regions without displaying a previous-region question and retains source limits", async () => {
    const view = render(<GardenDecisionGuide stepId="craft" />);
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "F21" } });
    view.rerender(<GardenDecisionGuide stepId="responsive" />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("R01"));
    expect(within(screen.getByRole("combobox")).getAllByRole("option")).toHaveLength(15);
    const sources = screen.getByText("Sources and limits").closest("details")!;
    sources.open = true;
    for (const link of within(sources).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(within(sources).getByText(/not a certification/)).toBeVisible();
  });

  it("preserves technical terms and includes device operations in completion guidance", async () => {
    const view = render(<GardenDecisionGuide stepId="responsive" />);
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: "R10" } });
    expect(screen.getAllByText(/75th percentile/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/75 th/)).not.toBeInTheDocument();
    view.rerender(<GardenDecisionGuide stepId="handoff" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "H07" } });
    expect(screen.getAllByText(/IPv4\/IPv6/).length).toBeGreaterThan(0);
    view.rerender(<GardenDecisionGuide stepId="behavior" />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "B04" } });
    expect(screen.getByText(/local, device or remote work/)).toBeVisible();
  });
});
