import type { ComponentType, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("dismisses a header menu when focus or a pointer moves outside it, leaving the next control usable", () => {
    render(
      <>
        <AppHeader />
        <main>
          <button>Continue the draft</button>
        </main>
      </>,
    );
    const summary = screen.getByText("Tools").closest("summary")!;
    const menu = summary.parentElement!;
    fireEvent.click(summary);
    const link = screen.getByRole("link", { name: "Quality lab" });
    link.focus();
    fireEvent.pointerDown(link);
    expect(menu).toHaveAttribute("open");
    const next = screen.getByRole("button", { name: "Continue the draft" });
    next.focus();
    expect(menu).not.toHaveAttribute("open");
    expect(next).toHaveFocus();
    fireEvent.click(summary);
    fireEvent.pointerDown(screen.getByRole("main"));
    expect(menu).not.toHaveAttribute("open");
  });

  it("opens only one header disclosure at a time, including the account menu", () => {
    const { container } = render(<AppHeader />);
    const tools = screen.getByText("Tools").closest("summary")!;
    const help = screen.getByText("Help").closest("summary")!;
    const account = screen.getByText("Your account").closest("summary")!;
    for (const summary of [tools, help, account, tools]) {
      // Activate a nested icon as well as the summary text; both belong to the control.
      fireEvent.click(summary.querySelector("svg") ?? summary);
      expect(summary.parentElement).toHaveAttribute("open");
      expect(container.querySelectorAll("details[open]")).toHaveLength(1);
      for (const sibling of [tools, help, account]) {
        if (sibling !== summary) expect(sibling.parentElement).not.toHaveAttribute("open");
      }
    }
    expect(screen.getByText("Detailed walkthrough")).not.toBeVisible();
    expect(screen.getByText("Your online library")).not.toBeVisible();
    expect(screen.getByText("Design studio · Vision")).toBeVisible();
    fireEvent.click(tools);
    expect(container.querySelectorAll("details[open]")).toHaveLength(0);
  });

  it.each([
    ["Tools", "Quality lab"],
    ["Help", "Detailed walkthrough"],
    ["Your account", "Your online library"],
  ])("closes %s with Escape from a menu link and returns focus to its summary", (label, link) => {
    render(<AppHeader />);
    const summary = screen.getByText(label).closest("summary")!;
    fireEvent.click(summary);
    const destination = screen.getByRole("link", { name: link });
    destination.focus();
    expect(destination).toHaveFocus();
    fireEvent.keyDown(destination, { key: "ArrowDown" });
    expect(summary.parentElement).toHaveAttribute("open");
    expect(destination).toHaveFocus();
    fireEvent.keyDown(destination, { key: "Escape" });
    expect(summary.parentElement).not.toHaveAttribute("open");
    expect(destination).not.toBeVisible();
    expect(summary).toHaveFocus();
  });

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
