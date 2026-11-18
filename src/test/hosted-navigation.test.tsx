import type { ComponentType, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "@/components/AppHeader";
import { Route as AuthRoute } from "@/routes/auth";
import { useHostedSession } from "@/components/HostedBoundary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={props.className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }),
}));
vi.mock("@/components/HostedBoundary", () => ({ useHostedSession: vi.fn() }));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/lib/runtime-config", () => ({ hasCloudBackend: () => false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const AuthPage = AuthRoute.options.component as ComponentType;
beforeEach(() => {
  vi.mocked(useHostedSession).mockReturnValue({
    user: { id: "a", email: "a@example.test" },
    storageAvailable: true,
    mode: "hosted",
  });
});
describe("hosted account navigation", () => {
  it("identifies the actual hosted account and signs out in the top-level window", () => {
    render(<AppHeader />);
    expect(screen.getByText("a@example.test")).toBeInTheDocument();
    const signOut = screen.getByRole("link", { name: "Sign out", hidden: true });
    expect(signOut).toHaveAttribute("href", "/signout-with-chatgpt");
    expect(signOut).toHaveAttribute("target", "_top");
    expect(screen.queryByText("Local workspace")).not.toBeInTheDocument();
  });
  it("uses top-level ChatGPT sign-in when the preview has no hosted identity", () => {
    vi.mocked(useHostedSession).mockReturnValue({
      user: null,
      storageAvailable: false,
      mode: "preview",
    });
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin-with-chatgpt",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("target", "_top");
  });
  it("preserves the portable local workspace header", () => {
    vi.mocked(useHostedSession).mockReturnValue(null);
    render(<AppHeader />);
    expect(screen.getByText("Local workspace")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign out", hidden: true })).not.toBeInTheDocument();
  });
  it("explains the hosted save boundary without presenting a separate password form", () => {
    render(<AuthPage />);
    expect(screen.getByText(/Signed in as a@example.test/)).toBeInTheDocument();
    expect(
      screen.getByText(/unfinished studio drafts and other browser settings are not included/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/measured public-site checks/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("target", "_top");
  });
  it("does not promise online saves when storage is unavailable", () => {
    vi.mocked(useHostedSession).mockReturnValue({
      user: { id: "a", email: null },
      storageAvailable: false,
      mode: "hosted",
    });
    render(<AuthPage />);
    expect(screen.getByText(/Online storage is unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/choose Save library online/)).not.toBeInTheDocument();
  });
});
