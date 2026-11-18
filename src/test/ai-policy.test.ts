import { describe, expect, it, vi } from "vitest";
import { AI_SPENDING_ENABLED, withAiReservation } from "../lib/ai-policy";

describe("AI spending and reservations", () => {
  it("blocks paid work and reservations before launch approval", async () => {
    expect(AI_SPENDING_ENABLED).toBe(false);
    const reserve = vi.fn(); const release = vi.fn(); const run = vi.fn();
    await expect(withAiReservation(AI_SPENDING_ENABLED, reserve, release, run)).rejects.toThrow();
    expect(reserve).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  });
  it("does not run when reservation is refused", async () => {
    const run = vi.fn(); const release = vi.fn();
    await expect(withAiReservation(true, async () => { throw Error("limit"); }, release, run)).rejects.toThrow("limit");
    expect(run).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled();
  });
  it("releases the exact ticket after success", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    expect(await withAiReservation(true, async () => "ticket-a", release, async () => 42)).toBe(42);
    expect(release).toHaveBeenCalledWith("ticket-a");
  });
  it("releases on provider failure without replacing the failure", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    await expect(withAiReservation(true, async () => "ticket-b", release, async () => { throw Error("provider"); })).rejects.toThrow("provider");
    expect(release).toHaveBeenCalledWith("ticket-b");
  });
});