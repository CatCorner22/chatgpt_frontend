import type { ComponentType, ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hosted: null as null | {
    user: { id: string; email: string } | null;
    mode: "hosted" | "preview";
    storageAvailable: boolean;
  },
  user: null as null | { id: string },
  critique: vi.fn(),
  inspire: vi.fn(),
}));
vi.mock("@/components/HostedBoundary", () => ({ useHostedSession: () => state.hosted }));
vi.mock("@/hooks/useSession", () => ({ useUser: () => state.user }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/auth">{children}</a>,
  createFileRoute: () => (options: object) => ({
    ...options,
    useSearch: () => ({ mode: "check" }),
  }),
}));
vi.mock("@/lib/critic.functions", () => ({ critiqueUrl: state.critique }));
vi.mock("@/lib/inspire.functions", () => ({ inspireFromSite: state.inspire }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: () => {} }));
vi.mock("@/lib/matcher", () => ({ matchDirections: () => [] }));
vi.mock("@/components/DesignPreview", () => ({ DesignPreview: () => null }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@/components/WholeSiteCheck", () => ({ WholeSiteCheck: () => null }));
vi.mock("@/components/ShotReview", () => ({ ShotReview: () => null }));
vi.mock("@/components/RescuePanel", () => ({ RescuePanel: () => null }));
vi.mock("@/components/Journey", () => ({ Journey: () => null }));
vi.mock("@/components/BeforeAfter", () => ({ BeforeAfter: () => null }));
vi.mock("@/components/AdvisorPanel", () => ({ AdvisorPanel: () => null }));
import { Route } from "@/routes/critic";
import { QuickStart } from "@/components/QuickStart";
const Critic = (Route as unknown as { component: ComponentType }).component;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  state.user = null;
  state.hosted = {
    user: { id: "sites-a", email: "a@example.com" },
    mode: "hosted",
    storageAvailable: true,
  };
});
afterEach(cleanup);
it("allows a signed-in Sites colleague to check a website without a Supabase account", async () => {
  state.critique.mockRejectedValueOnce(new Error("The site could not be read."));
  render(<Critic />);
  fireEvent.change(screen.getByRole("textbox", { name: "Website address" }), {
    target: { value: "https://example.com" },
  });
  expect(screen.getByRole("button", { name: "Check this page" })).toBeEnabled();
  expect(screen.queryByText("Sign in to check a site")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check this page" }));
  await waitFor(() =>
    expect(state.critique).toHaveBeenCalledWith({ data: { url: "https://example.com" } }),
  );
  expect(await screen.findByText("The site could not be read.")).toBeInTheDocument();
});
it("does not advertise a working URL check in the unsigned development preview", () => {
  state.hosted = { user: null, mode: "preview", storageAvailable: false };
  render(<Critic />);
  fireEvent.change(screen.getByRole("textbox", { name: "Website address" }), {
    target: { value: "https://example.com" },
  });
  expect(screen.getByRole("button", { name: "Check this page" })).toBeDisabled();
  expect(
    screen.getByText(/Public website checks need sign-in on the hosted app/),
  ).toBeInTheDocument();
});
it("explains why site inspiration cannot run before sign-in", () => {
  state.hosted = { user: null, mode: "preview", storageAvailable: false };
  render(<QuickStart onOpen={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Start from a site you admire" }), {
    target: { value: "example.com" },
  });
  expect(screen.getByRole("button", { name: "Read its look" })).toBeDisabled();
  expect(
    screen.getByText(/Public website checks need sign-in on the hosted app/),
  ).toBeInTheDocument();
});
it("lets the hosted colleague read inspiration and preserves useful service errors", async () => {
  state.inspire.mockRejectedValueOnce(
    new Error("Your account changed. Reload before checking another page."),
  );
  render(<QuickStart onOpen={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Start from a site you admire" }), {
    target: { value: "example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Read its look" }));
  await waitFor(() => expect(state.inspire).toHaveBeenCalledWith({ data: { url: "example.com" } }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your account changed. Reload before checking another page.",
  );
});
