import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchPanel } from "@/components/LaunchPanel";
import { normalizeTokens } from "@/lib/design";
import { EMPTY_LAUNCH, TASKS, addEvidence, launchFingerprint, markLaunched, readProgress, upsertProgress, writeProgress, type ReviewEvidence } from "@/lib/launch";
import { critiqueUrl } from "@/lib/critic.functions";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="/progress">{children}</a> }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/lib/critic.functions", () => ({ critiqueUrl: vi.fn() }));
vi.mock("@/lib/launch.functions", () => ({ saveProgress: vi.fn() }));
vi.mock("@/components/ShotReview", () => ({ ShotReview: () => null }));
vi.mock("@/components/FixList", () => ({ FixList: () => null }));

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe("launch evidence belongs to the current artifact", () => {
  it("clears launch confirmation on a page edit and discards a review started for the prior build", async () => {
    const tokens = normalizeTokens({});
    const artifact = { content: { brand: "Clay House" }, page: { composition: "studio", actionUrl: "https://example.com/book" } };
    const evidence: ReviewEvidence = { kind: "page", target: "https://example.com", at: "2026-11-18T00:00:00Z", score: 100, summary: "Prior review", checks: [], prescription: [], priorities: [], repair: "" };
    const records = upsertProgress([], "build-a", "Clay House", tokens, "2026-11-18T00:00:00Z", artifact);
    records[0]!.details = markLaunched({ ...addEvidence(EMPTY_LAUNCH, evidence), url: "https://example.com", tasks: TASKS.map(task => task.id) }, "2026-11-18T00:00:00Z");
    writeProgress(records);
    let finish: (value: unknown) => void = () => {};
    vi.mocked(critiqueUrl).mockImplementation(() => new Promise<unknown>(resolve => { finish = resolve; }) as ReturnType<typeof critiqueUrl>);
    const { rerender } = render(<LaunchPanel id="build-a" title="Clay House" tokens={tokens} tool="Human developer" artifact={artifact} />);
    expect(await screen.findByRole("button", { name: "Launch recorded" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Review built page" }));
    expect(critiqueUrl).toHaveBeenCalledOnce();
    const changed = { ...artifact, page: { ...artifact.page, composition: "editorial" } };
    rerender(<LaunchPanel id="build-a" title="Clay House" tokens={tokens} tool="Human developer" artifact={changed} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Record launch" })).toBeDisabled());
    await act(async () => { finish({}); });
    const saved = readProgress()[0]!;
    expect(saved.fingerprint).toBe(launchFingerprint(tokens, changed));
    expect(saved.details.status).toBe("ready");
    expect(saved.details.reviews).toEqual([]);
    expect(saved.details.tasks).toEqual([]);
    expect(screen.queryByText("Prior review")).not.toBeInTheDocument();
  });
});
