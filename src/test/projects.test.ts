import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProject } from "@/lib/projects";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: () => ({ update: mocks.update }),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.update.mockReturnValue({
    eq: () => ({ select: () => ({ maybeSingle: mocks.maybeSingle }) }),
  });
});

describe("verified project saves", () => {
  it("rejects a missing or inaccessible project instead of claiming a save", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(saveProject("missing", "Design", {})).rejects.toThrow("Could not save");
  });
  it("returns the project id only after a saved row is returned", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "existing" }, error: null });
    await expect(saveProject("existing", "Design", {})).resolves.toBe("existing");
  });
  it("refuses signed-out saves before querying projects", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(saveProject("existing", "Design", {})).rejects.toThrow("Sign in");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
