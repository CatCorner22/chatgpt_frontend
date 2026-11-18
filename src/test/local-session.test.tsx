import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useUser } from "@/hooks/useSession";

vi.mock("@/lib/runtime-config", () => ({ hasCloudBackend: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: new Proxy({}, { get() { throw new Error("Local mode must not initialize Supabase"); } }),
}));

function SessionState() {
  const user = useUser();
  return <p>{user ? "Signed in" : "Local studio"}</p>;
}

describe("local studio session", () => {
  it("renders without initializing an unconfigured cloud client", () => {
    render(<SessionState />);
    expect(screen.getByText("Local studio")).toBeInTheDocument();
  });
});
