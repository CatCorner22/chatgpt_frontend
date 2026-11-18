import { Link } from "@tanstack/react-router";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { useUser } from "@/hooks/useSession";
import { hasCloudBackend } from "@/lib/runtime-config";
import { useHostedSession } from "@/components/HostedBoundary";
import { BrandLogo } from "@/components/BrandArt";

export function AppHeader({ children, onLogo }: { children?: ReactNode; onLogo?: () => void }) {
  const user = useUser();
  const hosted = useHostedSession();
  const active = { "aria-current": "page" as const };
  return (
    <header className="studio-header">
      <a
        href="#main-content"
        onClick={(event) => {
          const main = document.querySelector("main");
          if (main) {
            event.preventDefault();
            main.setAttribute("tabindex", "-1");
            main.focus();
            main.scrollIntoView({ block: "start" });
          }
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <div className="studio-header-main">
        <Link to="/" onClick={onLogo} className="studio-logo" aria-label="Focus home">
          <BrandLogo decorative />
        </Link>
        <nav className="studio-navigation" aria-label="Main">
          <Link to="/" activeOptions={{ exact: true }} activeProps={active}>
            Design studio
          </Link>
          <Link to="/library" activeProps={active}>
            My designs
          </Link>
          <Link
            to="/target"
            activeProps={active}
            title="Target — prepare your design for a real project"
          >
            Target
          </Link>
          <Link
            to="/progress"
            activeProps={active}
            title="Horizon — project progress and next steps"
          >
            Horizon
          </Link>
          <Link to="/telescope" activeProps={active} title="Telescope — advanced build tools">
            Telescope
          </Link>
          <details className="studio-more">
            <summary>
              Explore <ChevronDown size={13} />
            </summary>
            <div className="studio-more-menu">
              <Link to="/welcome">Welcome to Focus</Link>
              <Link to="/reverie">About Reverie</Link>
              <Link to="/quality">Quality lab</Link>
              <Link to="/review-room">Blind review room</Link>
              <Link to="/taste">Discover my taste</Link>
              <Link to="/critic">Check a live site</Link>
              <Link to="/brands">Brand collections</Link>
              <Link to="/watchtower">Site monitor</Link>
              <Link to="/proof">Before & after</Link>
            </div>
          </details>
        </nav>
        {hosted ? (
          hosted.user ? (
            <details className="studio-more">
              <summary className="studio-account">
                Your account <ChevronDown size={13} />
              </summary>
              <div className="studio-more-menu">
                <p className="max-w-64 break-words px-3 py-2 text-xs text-muted-foreground">
                  {hosted.user.email || "Signed in with ChatGPT"}
                </p>
                <Link to="/library">Your online library</Link>
                <Link to="/auth">Workspace details</Link>
                <a href="/signout-with-chatgpt" target="_top">
                  Sign out
                </a>
              </div>
            </details>
          ) : (
            <a href="/signin-with-chatgpt" target="_top" className="studio-account">
              Sign in <ArrowUpRight size={14} />
            </a>
          )
        ) : hasCloudBackend() ? (
          <Link to={user ? "/projects" : "/auth"} className="studio-account">
            {user ? "My account" : "Sign in"}
            <ArrowUpRight size={14} />
          </Link>
        ) : (
          <span
            className="studio-account"
            title="Designs are saved in this browser. Download a pack to keep a portable copy."
          >
            <span className="local-dot" />
            Local workspace
          </span>
        )}
      </div>
      {children && <div className="studio-header-tools">{children}</div>}
    </header>
  );
}
