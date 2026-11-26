import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useStudioNavigationGuard,
  type StudioNavigationRisk,
} from "@/hooks/useStudioNavigationGuard";
import { parseGardenSearch } from "@/lib/garden-navigation";

const SAVED: StudioNavigationRisk = { flush: () => true, busy: false };
const histories: ReturnType<typeof createMemoryHistory>[] = [];

async function mountStudio(initial: Partial<StudioNavigationRisk> = {}, browser = false) {
  let updateRisk!: (risk: StudioNavigationRisk) => void;
  let mounts = 0;
  function Studio() {
    useState(() => ++mounts);
    const [risk, setRisk] = useState({ ...SAVED, ...initial });
    updateRisk = setRisk;
    useStudioNavigationGuard(risk);
    return <p>Studio work remains mounted</p>;
  }
  const root = createRootRoute({ component: Outlet });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    validateSearch: parseGardenSearch,
    component: function Home() {
      return home.useSearch().view === "studio" ? <Studio /> : <p>Garden home</p>;
    },
  });
  const library = createRoute({
    getParentRoute: () => root,
    path: "/library",
    component: () => <p>Saved library</p>,
  });
  if (browser) window.history.replaceState(null, "", "/");
  const history = browser
    ? createBrowserHistory()
    : createMemoryHistory({ initialEntries: ["/", "/?view=studio"], initialIndex: 1 });
  if (browser) {
    history.push("/?view=studio");
    history.flush();
  }
  histories.push(history);
  const router = createRouter({ routeTree: root.addChildren([home, library]), history });
  const rendered = render(<RouterProvider router={router} />);
  await screen.findByText("Studio work remains mounted");
  return {
    router,
    history,
    unmount: rendered.unmount,
    mounts: () => mounts,
    update: async (risk: Partial<StudioNavigationRisk>) => {
      await act(async () => updateRisk({ ...SAVED, ...risk }));
    },
    home: async () => {
      await act(async () => {
        void router.navigate({ to: "/", search: {} });
      });
    },
  };
}

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  for (const history of histories.splice(0)) history.destroy();
  vi.restoreAllMocks();
});

describe("Studio SPA navigation guard with the real router", () => {
  it("keeps work mounted when Home would discard changes after persistence failed", async () => {
    const app = await mountStudio({ flush: () => false });
    await app.home();
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/could not be saved/i));
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
    expect(app.history.location.search).toBe("?view=studio");
  });

  it("leaves only after the owner accepts, and removes the blocker on unmount", async () => {
    const app = await mountStudio({ flush: () => false });
    vi.mocked(window.confirm).mockReturnValue(true);
    await app.home();
    expect(await screen.findByText("Garden home")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledOnce();
    await act(async () => {
      void app.router.navigate({ to: "/library" });
    });
    expect(await screen.findByText("Saved library")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  it("does not interrupt a saved idle design", async () => {
    const app = await mountStudio();
    await app.home();
    expect(await screen.findByText("Garden home")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("protects unpersisted design decisions when leaving for another tool", async () => {
    const app = await mountStudio({ flush: () => false });
    await act(async () => {
      void app.router.navigate({ to: "/library" });
    });
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
  });

  it("protects an ongoing task even before a design exists", async () => {
    const app = await mountStudio({ busy: true });
    await app.home();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/still running/i));
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
  });

  it("allows search and hash changes that keep the same Studio mounted", async () => {
    const app = await mountStudio({ flush: () => false, busy: true });
    await act(async () => {
      app.history.push("/?view=studio&lesson=palette#preview");
    });
    await waitFor(() => expect(app.history.location.hash).toBe("#preview"));
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("keeps Studio mounted through workshop group links and Back while guarding Your journey", async () => {
    const app = await mountStudio({ flush: () => false, busy: true });
    for (const group of ["palette", "fonts", "spacing"]) {
      await act(async () => {
        app.history.push(`/?view=studio&panel=stratosphere&group=${group}`);
      });
      await waitFor(() => expect(app.router.state.location.search).toMatchObject({ group }));
      expect(app.mounts()).toBe(1);
    }
    await act(async () => {
      app.history.back();
    });
    await waitFor(() => expect(app.router.state.location.search).toMatchObject({ group: "fonts" }));
    expect(app.mounts()).toBe(1);
    expect(window.confirm).not.toHaveBeenCalled();
    await app.home();
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
    expect(app.mounts()).toBe(1);
  });

  it("does not treat a studio query on another route as staying in the editor", async () => {
    const app = await mountStudio({ flush: () => false });
    await act(async () => {
      app.history.push("/library?view=studio");
    });
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
  });

  it("guards browser Back from the Studio query view to Garden", async () => {
    const app = await mountStudio({ flush: () => false }, true);
    await act(async () => {
      app.history.back();
    });
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?view=studio"));
    vi.mocked(window.confirm).mockReturnValue(true);
    await act(async () => {
      app.history.back();
    });
    expect(await screen.findByText("Garden home")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledTimes(2);
  });

  it("guards browser Forward after returning to an editor whose persistence then fails", async () => {
    const app = await mountStudio({}, true);
    await act(async () => {
      void app.router.navigate({ to: "/library" });
    });
    expect(await screen.findByText("Saved library")).toBeInTheDocument();
    await act(async () => {
      app.history.back();
    });
    expect(await screen.findByText("Studio work remains mounted")).toBeInTheDocument();
    await app.update({ flush: () => false });
    await act(async () => {
      app.history.forward();
    });
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?view=studio"));
  });

  it("uses current risk after saving recovers, without an obsolete warning", async () => {
    const app = await mountStudio({ flush: () => false });
    await app.update({});
    await app.home();
    expect(await screen.findByText("Garden home")).toBeInTheDocument();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("reacts when persistence fails after the editor mounted", async () => {
    const app = await mountStudio();
    await app.update({ flush: () => false });
    await app.home();
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
  });

  it("adds no duplicate beforeunload warning", async () => {
    const app = await mountStudio({ flush: () => false, busy: true });
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
    app.unmount();
  });

  it("fails closed if the browser cannot show confirmation", async () => {
    const app = await mountStudio({ flush: () => false });
    vi.mocked(window.confirm).mockImplementation(() => {
      throw new Error("Dialog unavailable");
    });
    await app.home();
    expect(screen.getByText("Studio work remains mounted")).toBeInTheDocument();
  });
});
