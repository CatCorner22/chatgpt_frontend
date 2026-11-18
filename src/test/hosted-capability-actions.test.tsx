import type { ComponentType, ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens } from "@/lib/design";

const mode = vi.hoisted(() => ({ hosted: false }));
vi.mock("@/lib/browser-storage", () => ({
  isHostedBuild: () => mode.hosted,
  focusLocalStorage: {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => localStorage.setItem(key, value),
  },
  focusSessionStorage: {
    getItem: (key: string) => sessionStorage.getItem(key),
    setItem: (key: string, value: string) => sessionStorage.setItem(key, value),
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string; className?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@/components/DesignPreview", () => ({ DesignPreview: () => null }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: () => {} }));
vi.mock("@/lib/northstar.functions", () => ({
  publishVision: vi.fn(),
  recordVision: vi.fn(),
  setVisionLink: vi.fn(),
  setShowcase: vi.fn(),
}));
vi.mock("@/lib/badge.functions", () => ({ issueBadge: vi.fn() }));
vi.mock("@/lib/watchtower.functions", () => ({
  listWatches: vi.fn(),
  addWatch: vi.fn(),
  checkWatch: vi.fn(),
  changeWatch: vi.fn(),
}));
vi.mock("@/lib/brandCloud", () => ({
  fetchBuilds: vi.fn(),
  pushBuilds: vi.fn(),
  removeBuilds: vi.fn(),
}));

import { LiveVisionPanel } from "@/components/LiveVisionPanel";
import { BadgePanel } from "@/components/BadgePanel";
import { DesignShareAction } from "@/components/DesignShareAction";
import { Route as BrandsRoute } from "@/routes/brands";
import { Route as WatchtowerRoute } from "@/routes/watchtower";
const Brands = BrandsRoute.options.component as ComponentType;
const Watchtower = WatchtowerRoute.options.component as ComponentType;
const surfaces = [
  {
    name: "Live Vision",
    element: () => <LiveVisionPanel designId="one" title="Workshop" vision="My vision" />,
    action: "Sign in to make a live link",
    alternative: "Open My designs",
    href: "/library",
  },
  {
    name: "badge",
    element: () => <BadgePanel tokens={normalizeTokens({})} />,
    action: "Sign in to get a badge",
    alternative: "Check a public page",
    href: "/critic",
  },
  {
    name: "site monitor",
    element: () => <Watchtower />,
    action: "Sign in to watch your pages",
    alternative: "Check a public page",
    href: "/critic",
  },
  {
    name: "brands",
    element: () => <Brands />,
    action: "Sign in",
    alternative: "My designs",
    href: "/library",
  },
];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mode.hosted = false;
});
afterEach(cleanup);
function show(element: ReactNode) {
  render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>);
}

describe("hosted capability boundaries", () => {
  for (const surface of surfaces) {
    it(`${surface.name} gives a working alternative without promising another sign-in unlocks it`, async () => {
      mode.hosted = true;
      show(surface.element());
      expect(await screen.findByRole("link", { name: surface.alternative })).toHaveAttribute(
        "href",
        surface.href,
      );
      expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
      expect(screen.getByText(/not configured/i)).toBeInTheDocument();
    });
    it(`${surface.name} preserves the portable account action`, async () => {
      show(surface.element());
      expect(await screen.findByRole("link", { name: surface.action })).toHaveAttribute(
        "href",
        "/auth",
      );
    });
  }
});

describe("design export sharing action", () => {
  it("offers library transfer in the hosted edition even when an account exists", () => {
    mode.hosted = true;
    const share = vi.fn();
    show(<DesignShareAction signedIn busy={false} sharing={false} onShare={share} />);
    expect(screen.getByRole("link", { name: "Open My designs" })).toHaveAttribute(
      "href",
      "/library",
    );
    expect(screen.getByText(/Public share links are not configured/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy share link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(share).not.toHaveBeenCalled();
  });
  it("retains signed-out and signed-in portable sharing, including the busy lock", () => {
    const share = vi.fn();
    const { rerender } = render(
      <DesignShareAction signedIn={false} busy={false} sharing={false} onShare={share} />,
    );
    expect(screen.getByRole("link", { name: "Sign in to share" })).toHaveAttribute("href", "/auth");
    rerender(<DesignShareAction signedIn busy={false} sharing={false} onShare={share} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(share).toHaveBeenCalledOnce();
    rerender(<DesignShareAction signedIn busy sharing onShare={share} />);
    expect(screen.getByRole("button", { name: "Creating your share link…" })).toBeDisabled();
  });
});
