import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LAUNCH, PROGRESS_KEY, type ProgressRecord, type ReviewEvidence } from "@/lib/launch";
import { horizonGuidance } from "@/lib/horizon";

const session = vi.hoisted(() => ({
  user: null as { id: string } | null,
  cloud: false,
  list: vi.fn(),
}));
vi.mock("@/hooks/useSession", () => ({ useUser: () => session.user }));
vi.mock("@/lib/runtime-config", () => ({ hasCloudBackend: () => session.cloud }));
vi.mock("@/lib/launch.functions", () => ({ listProgress: session.list }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus navigation</header> }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
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
import { Horizon } from "@/routes/progress";

const clients: QueryClient[] = [];
function openHorizon() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <Horizon />
    </QueryClientProvider>,
  );
}
const record = (
  id: string,
  status: ProgressRecord["details"]["status"] = "ready",
): ProgressRecord => ({
  id,
  title: `Customer ${id}`,
  completedAt: new Date().toISOString(),
  fingerprint: "preserved-historical-fingerprint",
  details: {
    ...EMPTY_LAUNCH,
    status,
    tasks: [],
    reviews: [],
    launchedAt: status === "launched" ? new Date().toISOString() : null,
  },
});
beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  session.user = null;
  session.cloud = false;
  session.list.mockReset();
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Horizon progress view", () => {
  it("reports corrupt JSON without calling it empty or replacing the original data", async () => {
    const raw = "{interrupted-progress-save";
    localStorage.setItem(PROGRESS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    openHorizon();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Browser progress contains unreadable data",
    );
    expect(
      screen.queryByText("No project progress recorded in this browser yet."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry browser progress" }));
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it("shows valid records beside a partial-data notice without silently repairing stored history", async () => {
    const raw = JSON.stringify({
      version: 1,
      records: [record("readable"), { ...record("corrupt"), details: { status: "launched" } }],
    });
    localStorage.setItem(PROGRESS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    openHorizon();
    expect(await screen.findByRole("heading", { name: "Customer readable" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Browser progress contains unreadable data",
    );
    expect(screen.queryByRole("heading", { name: "Customer corrupt" })).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it("reports a failed browser read and retries without erasing the existing records", async () => {
    const raw = JSON.stringify({ version: 1, records: [record("kept")] });
    localStorage.setItem(PROGRESS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const deletes = vi.spyOn(Storage.prototype, "removeItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
      throw new Error("temporarily denied");
    });
    openHorizon();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Browser progress could not be read",
    );
    expect(
      screen.queryByText("No project progress recorded in this browser yet."),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry browser progress" }));
    expect(await screen.findByRole("heading", { name: "Customer kept" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
    expect(deletes).not.toHaveBeenCalled();
  });

  it("keeps historical status and evidence intact while giving bounded next steps", async () => {
    const records = [
      record("direction"),
      record("build", "built"),
      record("review", "reviewed"),
      record("released", "launched"),
    ];
    const raw = JSON.stringify({ version: 1, records });
    localStorage.setItem(PROGRESS_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    openHorizon();
    await screen.findByRole("heading", { name: "Customer direction" });
    expect(screen.getByText("Vision completed")).toBeInTheDocument();
    expect(screen.getByText("Build recorded")).toBeInTheDocument();
    expect(screen.getByText("Review recorded")).toBeInTheDocument();
    expect(screen.getByText("Launch recorded by owner")).toBeInTheDocument();
    const released = screen.getByRole("heading", { name: "Customer released" }).closest("li")!;
    expect(
      within(released).getByText(/historical record does not certify the current site/),
    ).toBeInTheDocument();
    expect(screen.getByText("This week · Monday–Sunday (UTC)")).toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it("uses a browser-scoped empty state and real supported tool links", async () => {
    openHorizon();
    expect(
      await screen.findByText("No project progress recorded in this browser yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Horizon" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open my design library" })).toHaveAttribute(
      "href",
      "/library",
    );
    expect(screen.getByRole("link", { name: "Open design studio" })).toHaveAttribute(
      "href",
      "/?view=studio",
    );
    expect(screen.getByRole("link", { name: "Check a live site" })).toHaveAttribute(
      "href",
      "/critic?mode=check",
    );
    expect(screen.getByRole("link", { name: "Follow the guided handoff" })).toHaveAttribute(
      "href",
      "/welcome",
    );
    expect(session.list).not.toHaveBeenCalled();
  });

  it("preserves local records when account loading fails and can retry the read-only account list", async () => {
    const local = record("local");
    const raw = JSON.stringify({ version: 1, records: [local] });
    localStorage.setItem(PROGRESS_KEY, raw);
    session.cloud = true;
    session.user = { id: "owner" };
    const account = record("account", "built");
    session.list.mockRejectedValueOnce(new Error("network unavailable")).mockResolvedValueOnce([
      {
        design_id: account.id,
        title: account.title,
        completed_at: account.completedAt,
        fingerprint: account.fingerprint,
        details: account.details,
      },
    ]);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    openHorizon();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Account records could not be loaded",
    );
    expect(screen.getByRole("heading", { name: "Customer local" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry account records" }));
    expect(await screen.findByRole("heading", { name: "Customer account" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Customer local" })).toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it("points out saved failures even on a historical launch instead of certifying it", () => {
    const evidence: ReviewEvidence = {
      kind: "page",
      target: "https://example.com",
      at: new Date().toISOString(),
      score: 70,
      summary: "Contrast needs repair",
      checks: [{ name: "Contrast", ok: false, detail: "Too low", fix: "Adjust foreground" }],
      prescription: [],
      priorities: [],
      repair: "Fix contrast",
    };
    const reviewed = record("review", "reviewed");
    reviewed.details.reviews = [evidence];
    expect(horizonGuidance(reviewed.details).next).toContain("unresolved findings");
    const launched = record("historical", "launched");
    launched.details.reviews = [evidence];
    expect(horizonGuidance(launched.details).next).toContain("historical owner-recorded launch");
    expect(horizonGuidance(launched.details).next).toContain("does not certify the current site");
    expect(launched.details.status).toBe("launched");
    expect(launched.details.reviews).toEqual([evidence]);
  });
});
