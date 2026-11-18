import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_KEY } from "@/lib/onboarding";

const downloads = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/exportPack", () => ({ downloadBlob: downloads.save }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus navigation</header> }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; search?: { mode: string } }) => (
    <a href={to + (search ? `?mode=${search.mode}` : "")} {...props} />
  ),
}));
import { WelcomeSession } from "@/routes/welcome";

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  downloads.save.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("cat-guided welcome session", () => {
  it("resumes reading without touching studio work and supports back/direct navigation", async () => {
    localStorage.setItem("focus-studio", "existing-customer-draft");
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, step: 2, finished: false }));
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<WelcomeSession />);
    expect(
      await screen.findByRole("heading", { name: "Bring your published page into view." }),
    ).toBeInTheDocument();
    expect(writes).not.toHaveBeenCalled();
    const reviewer = screen.getByRole("link", { name: /Check a live site/ });
    expect(reviewer).toHaveAttribute("href", "/critic?mode=check");
    expect(reviewer).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("button", { name: "Next guide step" }));
    expect(
      screen.getByRole("heading", { name: /Give your existing project a clear Vision/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "Bring your published page into view." }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Test and undo/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Prove the trial works/ })).toHaveFocus(),
    );
    expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).step).toBe(6);
    expect(localStorage.getItem("focus-studio")).toBe("existing-customer-draft");
    expect(writes.mock.calls.every(([key]) => key === ONBOARDING_KEY)).toBe(true);
  });

  it("continues through all steps when storage is denied and reports unsaved progress", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<WelcomeSession />);
    expect(await screen.findByText(/Guide progress could not be saved/)).toBeInTheDocument();
    for (let i = 0; i < 7; i++)
      fireEvent.click(screen.getByRole("button", { name: "Next guide step" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish tour" }));
    expect(screen.getByText(/Your guide is complete/)).toBeInTheDocument();
    expect(screen.getByText(/Your project still needs its own task tests/)).toBeInTheDocument();
    expect(screen.getByText(/Guide progress could not be saved/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return to studio/ })).toHaveAttribute("href", "/");
  });

  it("marks only tour completion, with no release or library writes", async () => {
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<WelcomeSession />);
    await screen.findByRole("button", { name: /Review and release/ });
    fireEvent.click(screen.getByRole("button", { name: /Review and release/ }));
    fireEvent.click(screen.getByRole("button", { name: "Finish tour" }));
    expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!)).toEqual({
      version: 1,
      step: 7,
      finished: true,
    });
    expect(writes.mock.calls.every(([key]) => key === ONBOARDING_KEY)).toBe(true);
    expect(
      screen.getByText(
        /does not record tests, connect accounts, install files or approve a release/,
      ),
    ).toBeInTheDocument();
  });

  it("does not report a failed checklist download as successful", async () => {
    downloads.save.mockImplementation(() => {
      throw new Error("download denied");
    });
    render(<WelcomeSession />);
    await screen.findByRole("button", { name: /Prepare the handoff/ });
    fireEvent.click(screen.getByRole("button", { name: /Prepare the handoff/ }));
    fireEvent.click(screen.getByRole("button", { name: "Download trial checklist" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not be downloaded");
    expect(screen.queryByText(/Checklist download started/)).not.toBeInTheDocument();
    expect(downloads.save).toHaveBeenCalledWith(
      expect.any(Blob),
      "focus-existing-project-trial-checklist.md",
    );
  });
});
