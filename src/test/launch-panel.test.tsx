import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchPanel } from "@/components/LaunchPanel";
import { normalizeTokens } from "@/lib/design";
import {
  EMPTY_LAUNCH,
  PROGRESS_KEY,
  TASKS,
  addEvidence,
  launchFingerprint,
  markLaunched,
  readProgress,
  upsertProgress,
  writeProgress,
  type ReviewEvidence,
} from "@/lib/launch";
import { saveProgress } from "@/lib/launch.functions";
import { critiqueUrl } from "@/lib/critic.functions";

const account = vi.hoisted(() => ({ signedIn: false }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/progress">{children}</a>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/useSession", () => ({
  useUser: () => (account.signedIn ? { id: "test-owner" } : null),
}));
vi.mock("@/lib/critic.functions", () => ({ critiqueUrl: vi.fn() }));
vi.mock("@/lib/launch.functions", () => ({ saveProgress: vi.fn() }));
vi.mock("@/components/ShotReview", () => ({ ShotReview: () => null }));
vi.mock("@/components/FixList", () => ({ FixList: () => null }));

beforeEach(() => {
  account.signedIn = false;
  localStorage.clear();
  vi.clearAllMocks();
});

describe("launch evidence belongs to the current artifact", () => {
  it("clears launch confirmation on a page edit and discards a review started for the prior build", async () => {
    const tokens = normalizeTokens({});
    const artifact = {
      content: { brand: "Clay House" },
      page: { composition: "studio", actionUrl: "https://example.com/book" },
    };
    const evidence: ReviewEvidence = {
      kind: "page",
      target: "https://example.com",
      at: "2026-11-18T00:00:00Z",
      score: 100,
      summary: "Prior review",
      checks: [{ name: "phone", ok: true, detail: "Phone setting present", fix: "" }],
      prescription: [],
      priorities: [],
      repair: "",
    };
    const records = upsertProgress(
      [],
      "build-a",
      "Clay House",
      tokens,
      "2026-11-18T00:00:00Z",
      artifact,
    );
    records[0]!.details = markLaunched(
      {
        ...addEvidence(EMPTY_LAUNCH, evidence),
        url: "https://example.com",
        tasks: TASKS.map((task) => task.id),
      },
      "2026-11-18T00:00:00Z",
    );
    writeProgress(records);
    let finish: (value: unknown) => void = () => {};
    vi.mocked(critiqueUrl).mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          finish = resolve;
        }) as ReturnType<typeof critiqueUrl>,
    );
    const { rerender } = render(
      <LaunchPanel
        id="build-a"
        title="Clay House"
        tokens={tokens}
        tool="Human developer"
        artifact={artifact}
      />,
    );
    expect(await screen.findByRole("button", { name: "Launch recorded" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review built page" }));
    expect(critiqueUrl).toHaveBeenCalledOnce();
    const changed = { ...artifact, page: { ...artifact.page, composition: "editorial" } };
    rerender(
      <LaunchPanel
        id="build-a"
        title="Clay House"
        tokens={tokens}
        tool="Human developer"
        artifact={changed}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Record launch" })).toBeDisabled(),
    );
    await act(async () => {
      finish({});
    });
    const saved = readProgress()[0]!;
    expect(saved.fingerprint).toBe(launchFingerprint(tokens, changed));
    expect(saved.details.status).toBe("ready");
    expect(saved.details.reviews).toEqual([]);
    expect(saved.details.tasks).toEqual([]);
    expect(screen.queryByText("Prior review")).not.toBeInTheDocument();
  });
});

describe("launch readiness explanations", () => {
  const tokens = normalizeTokens({});
  const evidence: ReviewEvidence = {
    kind: "page",
    target: "https://example.com/",
    at: "2026-11-18T00:00:00Z",
    score: 100,
    summary: "Measured page",
    checks: [{ name: "phone", ok: true, detail: "Phone setting present", fix: "" }],
    prescription: [],
    priorities: [],
    repair: "",
  };
  const seed = (review = evidence, tasks = TASKS.map((task) => task.id)) => {
    const records = upsertProgress(
      [],
      "readiness",
      "Customer site",
      tokens,
      "2026-11-18T00:00:00Z",
    );
    records[0]!.details = {
      ...addEvidence(EMPTY_LAUNCH, review),
      url: "https://example.com/",
      tasks,
    };
    writeProgress(records);
  };
  const panel = () =>
    render(
      <LaunchPanel id="readiness" title="Customer site" tokens={tokens} tool="Human developer" />,
    );

  it("keeps another tab's newer review when an older panel tries to record a launch", async () => {
    seed();
    panel();
    const launch = await screen.findByRole("button", { name: "Record launch" });
    const records = readProgress();
    const newer = {
      ...evidence,
      summary: "New issue from the second tab",
      checks: [{ ...evidence.checks[0]!, ok: false }],
    };
    records[0]!.details = addEvidence(records[0]!.details, newer);
    writeProgress(records);
    fireEvent.click(launch);
    expect(readProgress()[0]!.details).toEqual(records[0]!.details);
    expect(screen.getByText(newer.summary)).toBeInTheDocument();
    expect(launch).toBeDisabled();
    fireEvent.click(screen.getByLabelText(TASKS[0].label));
    const retried = readProgress()[0]!.details;
    expect(retried.tasks).toEqual([TASKS[0].id]);
    expect(retried.reviews).toEqual(records[0]!.details.reviews);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps typed address text available while it shows newer saved evidence", async () => {
    seed();
    panel();
    const address = await screen.findByLabelText("Built page address");
    fireEvent.change(address, { target: { value: "here.example/test" } });
    const records = readProgress();
    records[0]!.details.url = "https://elsewhere.example/work";
    writeProgress(records);
    fireEvent.blur(address);
    fireEvent.click(screen.getByRole("button", { name: "I have built the design" }));
    expect(readProgress()[0]!.details).toEqual(records[0]!.details);
    expect(address).toHaveValue("here.example/test");
    const exit = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(exit);
    });
    expect(exit.defaultPrevented).toBe(true);
  });

  it("preserves a partially damaged collection when opening a different launch checklist", async () => {
    seed();
    const raw = JSON.stringify({ version: 1, records: [...readProgress(), { id: "damaged" }] });
    localStorage.setItem(PROGRESS_KEY, raw);
    panel();
    expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw);
    expect(
      screen.queryByRole("button", { name: "I have built the design" }),
    ).not.toBeInTheDocument();
  });

  it("does not confirm a launch when browser storage silently drops the write", async () => {
    seed();
    panel();
    const launch = await screen.findByRole("button", { name: "Record launch" });
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    try {
      fireEvent.click(launch);
      expect(readProgress()[0]!.details.status).toBe("reviewed");
      expect(screen.queryByRole("button", { name: "Launch recorded" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it("requires a new account save if evidence changes while the first save is in flight", async () => {
    account.signedIn = true;
    seed();
    let finish!: () => void;
    vi.mocked(saveProgress).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: "saved" });
        }),
    );
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "Save evidence to account" }));
    fireEvent.click(screen.getByLabelText(TASKS[0].label));
    await act(async () => finish());
    expect(screen.queryByRole("button", { name: "Saved to account" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save evidence to account" })).toBeEnabled();
    expect(screen.getByLabelText(TASKS[0].label)).not.toBeChecked();
  });

  it("lets an owner finish the checklist after reviewing a shorthand page address", async () => {
    seed();
    vi.mocked(critiqueUrl).mockResolvedValue({
      host: "example.com",
      score: 100,
      review: null,
      facts: {
        fonts: [tokens.headingFont, tokens.bodyFont],
        colors: [tokens.bg, tokens.ink, tokens.accent],
      },
      findings: [
        {
          id: "phone",
          ok: true,
          detail: "Phone setting present",
          fix: "",
          area: "Accessibility",
          severity: "low",
        },
      ],
    } as Awaited<ReturnType<typeof critiqueUrl>>);
    panel();
    const address = await screen.findByLabelText("Built page address");
    fireEvent.change(address, { target: { value: "example.com" } });
    fireEvent.blur(address);
    expect(readProgress()[0]!.details.url).toBe("example.com");
    fireEvent.click(await screen.findByRole("button", { name: "Review built page" }));
    await waitFor(() => expect(readProgress()[0]!.details.reviews).toHaveLength(2));
    for (const task of TASKS) fireEvent.click(screen.getByLabelText(task.label));
    expect(screen.getByRole("button", { name: "Record launch" })).toBeEnabled();
  });

  it("retains the focused address on departure without reviewing a page or confirming launch", async () => {
    seed();
    const view = panel();
    const address = await screen.findByLabelText("Built page address");
    fireEvent.change(address, { target: { value: "https://new.example/booking" } });
    act(() => window.dispatchEvent(new Event("pagehide")));
    view.unmount();
    panel();
    expect(await screen.findByLabelText("Built page address")).toHaveValue(
      "https://new.example/booking",
    );
    const details = readProgress()[0]!.details;
    expect(details.tasks).toEqual([]);
    expect(details.launchedAt).toBeNull();
    expect(details.reviews).toEqual([evidence]);
  });

  it("preserves another tab’s newer address and allows recovery of the text in this tab", async () => {
    seed();
    panel();
    const address = await screen.findByLabelText("Built page address");
    fireEvent.change(address, { target: { value: "https://here.example/" } });
    const records = readProgress();
    records[0]!.details.url = "https://elsewhere.example/";
    writeProgress(records);
    const unload = new Event("beforeunload", { cancelable: true });
    act(() => {
      window.dispatchEvent(unload);
    });
    expect(unload.defaultPrevented).toBe(true);
    expect(readProgress()[0]!.details.url).toBe("https://elsewhere.example/");
    expect(address).toHaveValue("https://here.example/");
  });

  it("explains the unresolved findings instead of allowing task confirmations to override them", async () => {
    seed({ ...evidence, checks: [{ ...evidence.checks[0]!, ok: false }] });
    panel();
    expect(await screen.findByRole("button", { name: "Record launch" })).toBeDisabled();
    expect(
      screen.getByText(/Resolve and recheck the recorded findings for this page/),
    ).toBeInTheDocument();
    for (const task of TASKS) expect(screen.getByLabelText(task.label)).toBeChecked();
  });

  it("explains that a review for another URL cannot qualify the current address", async () => {
    seed({ ...evidence, target: "https://other.example/" });
    panel();
    expect(await screen.findByRole("button", { name: "Record launch" })).toBeDisabled();
    expect(screen.getByText(/Review this exact built page first/)).toBeInTheDocument();
  });

  it("records a launch only after a passing current-page review and all task confirmations", async () => {
    seed(evidence, []);
    panel();
    const launch = await screen.findByRole("button", { name: "Record launch" });
    expect(launch).toBeDisabled();
    expect(screen.getByText(/Complete all four task confirmations/)).toBeInTheDocument();
    for (const task of TASKS) fireEvent.click(screen.getByLabelText(task.label));
    expect(launch).toBeEnabled();
    fireEvent.click(launch);
    expect(await screen.findByRole("button", { name: "Launch recorded" })).toBeDisabled();
    expect(readProgress()[0]!.details.status).toBe("launched");
  });

  it("keeps historical launch records intact when their old evidence would no longer qualify", async () => {
    seed({ ...evidence, checks: [{ ...evidence.checks[0]!, ok: false }] });
    const records = readProgress();
    records[0]!.details = {
      ...records[0]!.details,
      status: "launched",
      launchedAt: "2026-11-17T00:00:00Z",
    };
    writeProgress(records);
    panel();
    expect(await screen.findByRole("button", { name: "Launch recorded" })).toBeDisabled();
    expect(readProgress()[0]!.details).toEqual(records[0]!.details);
  });

  it("waits for an active page review before allowing a launch to be recorded", async () => {
    seed();
    vi.mocked(critiqueUrl).mockImplementation(
      () => new Promise(() => {}) as ReturnType<typeof critiqueUrl>,
    );
    panel();
    expect(await screen.findByRole("button", { name: "Record launch" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Review built page" }));
    expect(screen.getByRole("button", { name: "Record launch" })).toBeDisabled();
    expect(screen.getByText(/Wait for the current page review/)).toBeInTheDocument();
  });

  it("cannot restore an old address when its pending review finishes after the owner changes the URL", async () => {
    seed();
    let finish: (value: unknown) => void = () => {};
    vi.mocked(critiqueUrl).mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          finish = resolve;
        }) as ReturnType<typeof critiqueUrl>,
    );
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "Review built page" }));
    const input = screen.getByRole("textbox", { name: "Built page address" });
    fireEvent.change(input, { target: { value: "https://other.example/" } });
    fireEvent.blur(input);
    await act(async () => {
      finish({
        host: "example.com",
        score: 100,
        review: null,
        facts: {
          fonts: [tokens.headingFont, tokens.bodyFont],
          colors: [tokens.bg, tokens.ink, tokens.accent],
        },
        findings: [
          {
            id: "phone",
            ok: true,
            detail: "Phone setting present",
            fix: "",
            area: "Accessibility",
            severity: "low",
          },
        ],
      });
    });
    const saved = readProgress()[0]!.details;
    expect(saved.url).toBe("https://other.example/");
    expect(saved.reviews).toHaveLength(1);
    expect(saved.tasks).toEqual([]);
    expect(screen.getByRole("button", { name: "Record launch" })).toBeDisabled();
    expect(screen.getByText(/Review this exact built page first/)).toBeInTheDocument();
  });

  it("preserves advisory findings as visible possibilities instead of silently passing or blocking them", async () => {
    seed();
    let finish: (value: unknown) => void = () => {};
    vi.mocked(critiqueUrl).mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          finish = resolve;
        }) as ReturnType<typeof critiqueUrl>,
    );
    panel();
    fireEvent.click(await screen.findByRole("button", { name: "Review built page" }));
    await act(async () => {
      finish({
        host: "example.com",
        score: 100,
        review: null,
        facts: {
          fonts: [tokens.headingFont, tokens.bodyFont],
          colors: [tokens.bg, tokens.ink, tokens.accent],
        },
        findings: [
          {
            id: "phone",
            ok: true,
            detail: "Phone setting present",
            fix: "",
            area: "Accessibility",
            severity: "low",
          },
          {
            id: "interruption",
            ok: false,
            possible: true,
            detail: "Possible cookie dialog",
            fix: "Inspect the interaction",
            area: "Ease of use",
            severity: "low",
          },
        ],
      });
    });
    expect(screen.getByText("Possible issues to review with the owner")).toBeInTheDocument();
    expect(screen.getByText(/Possible cookie dialog/)).toBeInTheDocument();
    const saved = readProgress()[0]!.details.reviews.at(-1)!;
    expect(saved.checks.find((check) => check.name === "interruption")).toMatchObject({
      possible: true,
      ok: false,
    });
    for (const task of TASKS) fireEvent.click(screen.getByLabelText(task.label));
    expect(screen.getByRole("button", { name: "Record launch" })).toBeEnabled();
  });
});
