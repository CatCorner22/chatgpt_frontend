import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY, type State } from "@/lib/studio-state";
import { normalizeTokens, STEPS, type Tokens } from "@/lib/design";
import { buildLocalOptions } from "@/lib/local-design";
import { readLibrary } from "@/lib/library";

const operations = vi.hoisted(() => ({
  search: { view: "studio", panel: "stratosphere" } as {
    view: "studio";
    panel?: "stratosphere";
    start?: "new" | "existing";
  },
  step: vi.fn(),
  directions: vi.fn(),
}));
vi.mock("@tanstack/react-router", async (original) => ({
  ...(await original<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => operations.search }),
  useBlocker: () => undefined,
  Navigate: () => null,
  Link: ({
    to,
    children,
    search,
    reloadDocument: _reload,
    replace: _replace,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    search?: Record<string, string>;
    reloadDocument?: boolean;
    replace?: boolean;
  }) => (
    <a href={to + (search ? `?${new URLSearchParams(search)}` : "")} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@tanstack/react-start", async (original) => ({
  ...(await original<typeof import("@tanstack/react-start")>()),
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/lib/design.functions", () => ({
  proposeStep: operations.step,
  proposeDirections: operations.directions,
}));
vi.mock("@/lib/ai-policy", () => ({ AI_SPENDING_ENABLED: true }));
vi.mock("@/lib/runtime-config", async (original) => ({
  ...(await original<typeof import("@/lib/runtime-config")>()),
  hasCloudBackend: () => true,
}));
vi.mock("@/hooks/useSession", () => ({ useUser: () => null }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: () => {} }));
vi.mock("@/components/AppHeader", () => ({
  AppHeader: ({ children }: { children?: ReactNode }) => <header>{children}</header>,
}));
vi.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/Help", () => ({
  HelpTip: ({ children }: { children: ReactNode }) => <>{children}</>,
  Term: ({ children }: { children: ReactNode }) => <>{children}</>,
  WhyPopover: () => null,
}));
vi.mock("@/components/Journey", () => ({ Journey: () => null }));
vi.mock("@/components/DesignPreview", () => ({
  PreviewFrame: ({ t }: { t: Tokens }) => <output data-testid="preview-accent">{t.accent}</output>,
  DesignPreview: () => null,
}));
vi.mock("@/components/StudioWelcome", () => ({
  StudioWelcome: ({ onStart }: { onStart: () => void }) => (
    <button onClick={onStart}>Start fixture directions</button>
  ),
  StarterCollection: () => null,
}));
vi.mock("@/components/StratospherePanel", () => ({
  StratosphereStart: () => <p>Bring a design</p>,
  StratospherePanel: ({
    state,
    onChange,
  }: {
    state: State;
    onChange: (patch: Partial<State>) => void;
  }) => (
    <section>
      <button
        onClick={() =>
          onChange({
            tokens: { ...state.tokens!, accent: "#b51f41", accentInk: "#ffffff" },
            page: state.page,
          })
        }
      >
        Choose workshop crimson
      </button>
      <button onClick={() => onChange({ page: { ...state.page, composition: "journal" } })}>
        Choose workshop page
      </button>
      <output data-testid="workshop-accent">{state.tokens!.accent}</output>
    </section>
  ),
}));

import { Route } from "@/routes/index";
const FocusHome = (Route as unknown as { options: { component: ComponentType } }).options.component;
const key = "refraction:v1";
function makeState(): State {
  const tokens = normalizeTokens({
    bg: "#ffffff",
    surface: "#eef4fa",
    ink: "#17202b",
    muted: "#475569",
    accent: "#1d4ed8",
    accentInk: "#ffffff",
  });
  return {
    ...EMPTY,
    quick: false,
    stage: "exam",
    libraryId: "fixture-design",
    brief: "Owner's project",
    tokens,
    content: {
      brand: "Owner",
      headline: "Keep this work",
      sub: "Original words",
      cta: "Contact",
      features: [],
      quote: "",
    },
    stepIndex: STEPS.findIndex((step) => step.id === "density"),
    cache: { density: buildLocalOptions("density", tokens) },
  };
}
function saved(): State {
  return JSON.parse(localStorage.getItem(key)!);
}
function mount(state: State) {
  localStorage.setItem(key, JSON.stringify(state));
  const rendered = render(<FocusHome />);
  return {
    ...rendered,
    studio: () => {
      operations.search = { view: "studio" };
      rendered.rerender(<FocusHome />);
    },
    workshop: () => {
      operations.search = { view: "studio", panel: "stratosphere" };
      rendered.rerender(<FocusHome />);
    },
  };
}
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  sessionStorage.clear();
  operations.search = { view: "studio", panel: "stratosphere" };
  operations.step
    .mockReset()
    .mockImplementation(async ({ data }: { data: { stepId: string; tokens: Tokens } }) => ({
      options: buildLocalOptions(data.stepId, data.tokens),
    }));
  operations.directions.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Garden-directed Studio start", () => {
  it("lets an untouched saved workspace adopt either project type without a recovery copy", async () => {
    operations.search = { view: "studio", start: "existing" };
    localStorage.setItem(key, JSON.stringify({ ...EMPTY, integration: "new" }));
    render(<FocusHome />);
    await screen.findByRole("button", { name: "Start fixture directions" });
    const result = JSON.parse(localStorage.getItem(key)!);
    expect(result.integration).toBe("existing");
    expect(result.past).toEqual([]);
    expect(screen.queryByText(/Original saved data preserved/)).toBeNull();
  });

  it.each(["brief", "history"] as const)(
    "preserves %s work and offers an explicit separate draft",
    async (kind) => {
      const original = {
        ...EMPTY,
        integration: "new",
        brief: kind === "brief" ? "Family studio appointments" : "",
        future: kind === "history" ? [{ ...EMPTY, brief: "Restorable edits" }] : [],
      };
      operations.search = { view: "studio", start: "existing" };
      localStorage.setItem(key, JSON.stringify(original));
      const ui = render(<FocusHome />);
      expect(await screen.findByRole("heading", { name: "You have a saved draft" })).toBeVisible();
      expect(screen.getByRole("link", { name: "Resume saved work" })).toHaveAttribute(
        "href",
        "/?view=studio",
      );
      const previous = localStorage.getItem(key)!;
      expect(JSON.parse(previous).integration).toBe("new");
      fireEvent.click(screen.getByRole("button", { name: "Start a separate draft" }));
      await screen.findByRole("button", { name: "Start fixture directions" });
      const checkpoints = Object.keys(localStorage).filter((item) =>
        item.startsWith(key + ":recovery:"),
      );
      expect(checkpoints).toHaveLength(1);
      expect(localStorage.getItem(checkpoints[0]!)).toBe(previous);
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({
        integration: "existing",
        brief: "",
      });
      operations.search = { view: "studio" };
      ui.rerender(<FocusHome />);
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({
        integration: "new",
        brief: original.brief,
      });
    },
  );

  it("keeps a newer draft from another tab when a separate start is requested", async () => {
    operations.search = { view: "studio", start: "new" };
    const before = { ...EMPTY, integration: "existing", brief: "Original brief" };
    localStorage.setItem(key, JSON.stringify(before));
    render(<FocusHome />);
    const button = await screen.findByRole("button", { name: "Start a separate draft" });
    const newer = JSON.stringify({ ...before, brief: "Changed in another tab" });
    localStorage.setItem(key, newer);
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(/changed in another tab/);
    expect(localStorage.getItem(key)).toBe(newer);
  });
});

describe("Incoming Studio handoff with a brief in progress", () => {
  afterEach(() => vi.restoreAllMocks());
  const pendingKey = "refraction:pending-rescue";
  const previous = { ...EMPTY, brief: "Keep the venue’s wheelchair entrance in the redesign." };

  it("keeps the original draft bytes available after the replacement and a reload", async () => {
    const original = JSON.stringify(previous, null, 2);
    localStorage.setItem(key, original);
    const replacement = { ...makeState(), brief: "Open this design instead" };
    sessionStorage.setItem(pendingKey, JSON.stringify(replacement));
    const page = render(<FocusHome />);
    await screen.findByText(/Original saved data preserved/);
    expect(saved().brief).toBe(replacement.brief);
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    const copyKey = Object.keys(localStorage).find((name) => name.startsWith(key + ":recovery:"));
    expect(localStorage.getItem(copyKey!)).toBe(original);
    page.unmount();
    render(<FocusHome />);
    await screen.findByRole("button", { name: "Download preserved data 1" });
    expect(localStorage.getItem(copyKey!)).toBe(original);
  });

  it.each([true, false])(
    "checkpoints a complete design only for user-edited options (draft = %s)",
    async (hasDraft) => {
      const original = makeState();
      if (hasDraft) {
        original.cache["density"]![1]!.draft = {
          reason: "Make prices easier to compare.",
          nudges: ["quieter"],
        };
      }
      const raw = JSON.stringify(original);
      localStorage.setItem(key, raw);
      sessionStorage.setItem(
        pendingKey,
        JSON.stringify({ ...EMPTY, brief: "A different workshop" }),
      );
      render(<FocusHome />);
      await waitFor(() => expect(saved().brief).toBe("A different workshop"));
      const copies = Object.keys(localStorage).filter((name) =>
        name.startsWith(key + ":recovery:"),
      );
      expect(copies).toHaveLength(hasDraft ? 1 : 0);
      if (hasDraft) expect(localStorage.getItem(copies[0]!)).toBe(raw);
    },
  );

  it("keeps the current brief open and the incoming handoff pending if its backup fails", async () => {
    const raw = JSON.stringify(previous);
    localStorage.setItem(key, raw);
    const incoming = JSON.stringify(makeState());
    sessionStorage.setItem(pendingKey, incoming);
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      name,
      value,
    ) {
      if (name.startsWith(key + ":recovery:")) throw new DOMException("Full", "QuotaExceededError");
      write.call(this, name, value);
    });
    render(<FocusHome />);
    await screen.findByRole("alert");
    expect(localStorage.getItem(key)).toBe(raw);
    expect(sessionStorage.getItem(pendingKey)).toBe(incoming);
    expect(Object.keys(localStorage).some((name) => name.startsWith(key + ":recovery:"))).toBe(
      false,
    );
  });
});

describe("Question preview drafts", () => {
  it("restores the chosen preview, nudges and unconfirmed words after a return visit", async () => {
    operations.search = { view: "studio" };
    const state = makeState();
    const app = mount(state);
    const input = await screen.findByPlaceholderText("What do you like about it? (optional)");
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.click(screen.getByRole("button", { name: "Warmer" }));
    fireEvent.change(input, { target: { value: "Keep the shelves easy to scan." } });
    expect(saved().tokens).toEqual(state.tokens);
    expect(saved().picks).toEqual([]);
    expect(saved().past).toEqual([]);
    expect(readLibrary().find((design) => design.id === state.libraryId)?.state["cache"]).toEqual(
      {},
    );
    expect(operations.step).not.toHaveBeenCalled();

    app.unmount();
    render(<FocusHome />);
    expect(await screen.findByDisplayValue("Keep the shelves easy to scan.")).toBeVisible();
    expect(screen.getByText(/Option 2, nudged: warmer/)).toBeVisible();
    expect(operations.step).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Choose 2" }));
    await waitFor(() => expect(saved().picks[0]?.reason).toBe("Keep the shelves easy to scan."));
    expect(saved().picks[0]?.label).toContain("warmer");
    expect(saved().cache["density"]?.every((option) => !option.draft)).toBe(true);
  });

  it("discards invalid preview metadata without discarding the underlying options", async () => {
    operations.search = { view: "studio" };
    const state = makeState();
    state.cache["density"]![1]!.draft = {
      reason: "Untrusted option metadata",
      nudges: ["bad value"],
    } as unknown as NonNullable<State["cache"][string][number]["draft"]>;
    mount(state);
    expect(await screen.findByPlaceholderText("What do you like about it? (optional)")).toHaveValue(
      "",
    );
    expect(screen.getByRole("button", { name: "Choose 1" })).toBeVisible();
    expect(operations.step).not.toHaveBeenCalled();
  });
});

describe("Studio workshop and question lifetime", () => {
  it.each(["success", "rejection"] as const)(
    "accepts the final StrictMode request and ignores the abandoned request's %s",
    async (outcome) => {
      const abandoned = pending<{ options: ReturnType<typeof buildLocalOptions> }>();
      const current = pending<{ options: ReturnType<typeof buildLocalOptions> }>();
      operations.step.mockReturnValueOnce(abandoned.promise).mockReturnValueOnce(current.promise);
      const original = { ...makeState(), cache: {} };
      operations.search = { view: "studio" };
      localStorage.setItem(key, JSON.stringify(original));
      render(
        <StrictMode>
          <FocusHome />
        </StrictMode>,
      );
      await waitFor(() => expect(operations.step).toHaveBeenCalledTimes(2));
      await act(async () =>
        current.resolve({ options: buildLocalOptions("density", original.tokens!) }),
      );
      await screen.findByRole("button", { name: "Choose 1" });
      await act(async () => {
        if (outcome === "rejection") abandoned.reject(new Error("Abandoned server failure"));
        else
          abandoned.resolve({
            options: buildLocalOptions("density", { ...original.tokens!, accent: "#b51f41" }),
          });
      });
      expect(saved().cache["density"]![0]!.tokens.accent).toBe(original.tokens!.accent);
      expect(saved().aiCalls).toBe(1);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show three different options" })).toBeEnabled();
    },
  );

  it("abandons pending options when Undo changes the same question's tokens before a cache exists", async () => {
    const old = pending<{ options: ReturnType<typeof buildLocalOptions> }>();
    operations.step.mockReturnValueOnce(old.promise);
    const original = makeState();
    const app = mount(original);
    fireEvent.click(await screen.findByRole("button", { name: "Choose workshop crimson" }));
    app.studio();
    await waitFor(() => expect(operations.step).toHaveBeenCalledOnce());
    expect(saved().cache).toEqual({});
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(operations.step).toHaveBeenCalledTimes(2));
    expect(operations.step.mock.calls[1]![0].data.tokens.accent).toBe(original.tokens!.accent);
    await act(async () =>
      old.resolve({
        options: buildLocalOptions("density", { ...original.tokens!, accent: "#b51f41" }),
      }),
    );
    expect(saved().tokens!.accent).toBe(original.tokens!.accent);
    expect(saved().cache["density"]![0]!.tokens.accent).toBe(original.tokens!.accent);
    expect(screen.getByRole("button", { name: "Show three different options" })).toBeEnabled();
    expect(saved().aiCalls).toBe(1);
  });

  it("leaves a cached destination usable when regeneration of another question is abandoned", async () => {
    const job = pending<{ options: ReturnType<typeof buildLocalOptions> }>();
    operations.step.mockReturnValueOnce(job.promise);
    const original = makeState();
    operations.search = { view: "studio" };
    mount({
      ...original,
      cache: { ...original.cache, scale: buildLocalOptions("scale", original.tokens!) },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Show three different options" }));
    expect(screen.getByRole("button", { name: "Getting 3 new options…" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Change answer to question 4, Headline size" }),
    );
    await waitFor(() => expect(saved().stepIndex).toBe(3));
    expect(screen.getByRole("button", { name: "Show three different options" })).toBeEnabled();
    await act(async () => job.resolve({ options: buildLocalOptions("density", original.tokens!) }));
    expect(saved().aiCalls).toBe(0);
    expect(screen.getByRole("button", { name: "Show three different options" })).toBeEnabled();
  });

  it.each(["Undo", "Redo"] as const)(
    "rebuilds the same question after %s of a workshop edit",
    async (action) => {
      const original = makeState();
      const app = mount(original);
      fireEvent.click(await screen.findByRole("button", { name: "Choose workshop crimson" }));
      app.studio();
      await screen.findByRole("button", { name: "Choose 1" });
      expect(screen.getByTestId("preview-accent")).toHaveTextContent("#b51f41");
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => expect(saved().tokens!.accent).toBe(original.tokens!.accent));
      expect(saved().stepIndex).toBe(original.stepIndex);
      await waitFor(() =>
        expect(screen.getByTestId("preview-accent")).toHaveTextContent(original.tokens!.accent),
      );
      const expectedAccent = action === "Redo" ? "#b51f41" : original.tokens!.accent;
      if (action === "Redo") {
        fireEvent.click(screen.getByRole("button", { name: "Redo" }));
        await waitFor(() =>
          expect(screen.getByTestId("preview-accent")).toHaveTextContent(expectedAccent),
        );
      }
      fireEvent.click(screen.getByRole("button", { name: "Choose 1" }));
      await waitFor(() => expect(saved().stepIndex).toBe(original.stepIndex + 1));
      expect(saved().tokens!.accent).toBe(expectedAccent);
    },
  );

  it("keeps a workshop palette when the owner returns and chooses a previously cached spacing answer", async () => {
    const app = mount(makeState());
    fireEvent.click(await screen.findByRole("button", { name: "Choose workshop crimson" }));
    expect(saved().tokens!.accent).toBe("#b51f41");
    app.studio();
    fireEvent.click(await screen.findByRole("button", { name: "Choose 1" }));
    await waitFor(() => expect(saved().stepIndex).toBe(5));
    expect(saved().tokens!.accent).toBe("#b51f41");
    expect(operations.step.mock.calls[0]![0].data.tokens.accent).toBe("#b51f41");
  });

  it("invalidates cached questions for a workshop page change without resetting stage or answers", async () => {
    const original = makeState();
    mount(original);
    fireEvent.click(await screen.findByRole("button", { name: "Choose workshop page" }));
    expect(saved().cache).toEqual({});
    expect(saved().stage).toBe(original.stage);
    expect(saved().stepIndex).toBe(original.stepIndex);
    expect(saved().tokens).toEqual(original.tokens);
    expect(saved().past.at(-1)?.page).toEqual(original.page);
  });

  it("ignores an abandoned question request after entering the workshop and changing the design", async () => {
    const job = pending<{ options: ReturnType<typeof buildLocalOptions> }>();
    operations.step.mockReturnValueOnce(job.promise);
    const original = makeState();
    operations.search = { view: "studio" };
    const app = mount({ ...original, cache: {} });
    await waitFor(() => expect(operations.step).toHaveBeenCalledOnce());
    app.workshop();
    fireEvent.click(await screen.findByRole("button", { name: "Choose workshop crimson" }));
    await act(async () => job.resolve({ options: buildLocalOptions("density", original.tokens!) }));
    expect(saved().cache).toEqual({});
    expect(saved().tokens!.accent).toBe("#b51f41");
    expect(saved().aiCalls).toBe(0);
  });

  it("does not let abandoned direction generation replace the saved brief after opening the workshop", async () => {
    const job = pending<unknown>();
    operations.directions.mockReturnValue(job.promise);
    operations.search = { view: "studio" };
    const original = makeState();
    const app = mount({ ...EMPTY, brief: "Keep my original brief" });
    fireEvent.click(await screen.findByRole("button", { name: "Start fixture directions" }));
    app.workshop();
    await screen.findByText("Bring a design");
    await act(async () =>
      job.resolve({
        content: original.content,
        directions: [{ name: "Late", mood: "Late", why: "Late", tokens: original.tokens }],
      }),
    );
    expect(saved().stage).toBe("brief");
    expect(saved().content).toBeNull();
    expect(saved().aiCalls).toBe(0);
  });

  it("explains intentional answer rewind and lets Undo restore the workshop design", async () => {
    const original = makeState();
    const app = mount({ ...original, history: [original.tokens!] });
    fireEvent.click(await screen.findByRole("button", { name: "Choose workshop crimson" }));
    app.studio();
    expect(
      await screen.findByText(/restores the design from before the previous answer/i),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Revisit previous answer" }));
    await waitFor(() => expect(saved().stepIndex).toBe(original.stepIndex - 1));
    expect(saved().tokens!.accent).toBe(original.tokens!.accent);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(saved().tokens!.accent).toBe("#b51f41"));
    expect(saved().stepIndex).toBe(original.stepIndex);
  });
});
