import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type AnchorHTMLAttributes, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens } from "@/lib/design";
import { EMPTY, type State } from "@/lib/studio-state";
import { GARDEN_DEFAULTS, GARDEN_KEY } from "@/lib/garden-preferences";
import {
  STRATOSPHERE_GROUPS,
  deriveStratosphereGraph,
  evaluateStratosphereCandidate,
  type StratosphereGroupId,
  type StratosphereInput,
} from "@/lib/stratosphere";

type AuthoredProps = ComponentProps<
  typeof import("@/components/AuthoredPagePanel").AuthoredPagePanel
>;
const operations = vi.hoisted(() => ({
  authored: vi.fn(),
  preview: vi.fn(),
  content: vi.fn(),
  download: vi.fn(),
  owner: vi.fn(),
}));
vi.mock("@/components/AuthoredPagePanel", () => ({
  AuthoredPagePanel: (props: AuthoredProps) => {
    operations.authored(props);
    return <div data-testid="authored-preview">Authored page preview</div>;
  },
}));
vi.mock("@/components/DesignPreview", () => ({
  DesignPreview: (props: unknown) => {
    operations.preview(props);
    return <div data-testid="style-preview">Design specimen</div>;
  },
}));
vi.mock("@/components/ContentEditor", () => ({
  ContentEditor: (props: unknown) => {
    operations.content(props);
    return <div>Content editor</div>;
  },
}));
vi.mock("@/lib/exportPack", async (original) => ({
  ...(await original<typeof import("@/lib/exportPack")>()),
  downloadBlob: operations.download,
}));
vi.mock("@/lib/browser-storage", async (original) => ({
  ...(await original<typeof import("@/lib/browser-storage")>()),
  getBrowserOwnerId: operations.owner,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    search?: Record<string, string>;
  }) => (
    <a
      href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}
      {...props}
    />
  ),
}));
import { StratospherePanel, StratosphereStart } from "@/components/StratospherePanel";

function makeState(overrides: Partial<State> = {}): State {
  return {
    ...EMPTY,
    stage: "rx",
    libraryId: "workshop-design",
    purpose: { audience: "general public", tone: "", experience: "website" },
    page: { ...EMPTY.page, actionUrl: "https://example.test/book", imageAlt: "Owner description" },
    tokens: normalizeTokens({
      bg: "#ffffff",
      surface: "#eef4fa",
      ink: "#17202b",
      muted: "#475569",
      accent: "#1d4ed8",
      accentInk: "#ffffff",
      headingFont: "Fraunces",
      bodyFont: "Karla",
      scale: 1.22,
      radius: 6,
      density: "balanced",
      heroLayout: "split",
      buttonStyle: "solid",
      texture: "none",
    }),
    content: {
      brand: "Owner studio",
      headline: "Keep the customer's words",
      sub: "A real service description.",
      cta: "Book a visit",
      features: [{ title: "A useful service", body: "Details from the owner." }],
      quote: "",
    },
    ...overrides,
  };
}

function inputOf(state: State): StratosphereInput {
  return {
    tokens: state.tokens!,
    content: state.content!,
    page: state.page,
    purpose: state.purpose,
    integration: state.integration,
    nav: state.nav,
  };
}

function Harness({
  initial,
  onPatch,
  onExport,
}: {
  initial: State;
  onPatch: (patch: Partial<State>) => void;
  onExport: () => void;
}) {
  const [state, setState] = useState(initial);
  return (
    <>
      <StratospherePanel
        state={state}
        onChange={(patch) => {
          onPatch(patch);
          setState((current) => ({ ...current, ...patch }));
        }}
        onExport={onExport}
      />
      <output data-testid="current-state">{JSON.stringify(state)}</output>
    </>
  );
}

function mount(initial = makeState()) {
  const onPatch = vi.fn(),
    onExport = vi.fn();
  return {
    initial,
    onPatch,
    onExport,
    ...render(<Harness initial={initial} onPatch={onPatch} onExport={onExport} />),
  };
}
function currentState(): State {
  return JSON.parse(screen.getByTestId("current-state").textContent!) as State;
}
function authoredProps(): AuthoredProps {
  return operations.authored.mock.calls.at(-1)![0] as AuthoredProps;
}
function visitGroup(id: StratosphereGroupId) {
  const group = STRATOSPHERE_GROUPS.find((item) => item.id === id)!;
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Stratosphere decisions" })).getByRole("button", {
      name: group.label,
    }),
  );
  return group;
}
function changedOption(state: State, id: StratosphereGroupId) {
  const group = STRATOSPHERE_GROUPS.find((item) => item.id === id)!;
  const option = group.options.find((candidate) => {
    const result = evaluateStratosphereCandidate(inputOf(state), id, candidate.id);
    return result.accepted && result.changedFields.length > 0;
  });
  expect(option, `A supported ${id} transition should be available`).toBeDefined();
  return {
    group,
    option: option!,
    expected: evaluateStratosphereCandidate(inputOf(state), id, option!.id),
  };
}
function optionRadio(label: string) {
  return screen.getByRole("radio", { name: (name) => name.startsWith(label) });
}
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  for (const operation of Object.values(operations)) operation.mockReset();
  operations.owner.mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Stratosphere workshop", () => {
  it("offers an empty-workshop path to the studio and library without changing saved work", () => {
    localStorage.setItem("refraction:v1", "unfinished owner work");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StratosphereStart />);
    expect(screen.getByRole("link", { name: "Start in the studio" })).toHaveAttribute(
      "href",
      "/?view=studio",
    );
    expect(screen.getByRole("link", { name: "Open a saved design" })).toHaveAttribute(
      "href",
      "/library",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem("refraction:v1")).toBe("unfinished owner work");
  });

  it.each(["palette", "spacing", "composition"] as const)(
    "applies an accepted %s choice once and keeps the preview, project and decision map in sync",
    async (id) => {
      const setup = mount();
      expect(screen.getByRole("region", { name: "Live authored page" })).toBeInTheDocument();
      const original = JSON.stringify(setup.initial);
      const { option, expected } = changedOption(setup.initial, id);
      visitGroup(id);
      fireEvent.click(optionRadio(option.label));
      expect(setup.onPatch).toHaveBeenCalledExactlyOnceWith({
        tokens: expected.tokens,
        page: expected.page,
      });
      expect(currentState()).toEqual({
        ...setup.initial,
        tokens: expected.tokens,
        page: expected.page,
      });
      expect(JSON.stringify(setup.initial)).toBe(original);
      expect(optionRadio(option.label)).toBeChecked();
      await screen.findByTestId("authored-preview");
      const authored = authoredProps();
      expect(authored.compact).toBe(true);
      expect(authored.tokens).toBe(setup.onPatch.mock.calls[0]![0].tokens);
      expect(authored.settings).toBe(setup.onPatch.mock.calls[0]![0].page);
      expect(authored.content).toBe(setup.initial.content);
      expect(authored.projectState).toEqual(currentState());
      const record = JSON.parse(authored.decisionRecord!);
      expect(record.source).toEqual(inputOf(currentState()));
      expect(record.graph).toEqual(deriveStratosphereGraph(inputOf(currentState())));
      expect(record.evidence).toMatch(/not a browser or customer-release certificate/);
      const changedNode = record.graph.nodes.find(
        (node: { id: string }) => node.id === `group:${id}`,
      );
      expect(
        screen.getByRole("region", { name: "Decision connections", hidden: true }),
      ).toHaveTextContent(changedNode.value);
      expect(setup.onExport).not.toHaveBeenCalled();
    },
  );

  it.each(["existing", "app"] as const)(
    "blocks composition changes for %s output and labels the specimen honestly",
    (scope) => {
      const initial = makeState(
        scope === "existing"
          ? { integration: "existing" }
          : { purpose: { audience: "general public", tone: "", experience: "app" } },
      );
      const setup = mount(initial);
      const palette = STRATOSPHERE_GROUPS.find((candidate) => candidate.id === "palette")!;
      expect(screen.getByRole("heading", { name: palette.label })).toBeVisible();
      expect(screen.queryByText(/Resolve these constraints before continuing/)).toBeNull();
      const group = visitGroup("composition");
      expect(screen.queryByText(/Resolve these constraints before continuing/)).toBeNull();
      for (const option of group.options) {
        const radio = optionRadio(option.label);
        expect(radio).toBeDisabled();
        expect(radio).toHaveAccessibleDescription();
        fireEvent.click(radio);
      }
      expect(setup.onPatch).not.toHaveBeenCalled();
      expect(currentState()).toEqual(initial);
      expect(operations.authored).not.toHaveBeenCalled();
      expect(screen.getByRole("region", { name: "Style study" })).toBeInTheDocument();
      expect(screen.getByText(/Style study · not your live app/)).toBeVisible();
      expect(screen.getByText(/still need implementation and testing in a separate/)).toBeVisible();
      expect(screen.getByRole("link", { name: "Prepare a scoped handoff" })).toHaveAttribute(
        "href",
        "/target",
      );
      expect(operations.preview.mock.calls.at(-1)![0]).toEqual({
        t: initial.tokens,
        c: initial.content,
      });
      expect(setup.onExport).not.toHaveBeenCalled();
    },
  );

  it("moves focus between decision groups using labelled native controls", () => {
    mount();
    const navigation = screen.getByRole("navigation", { name: "Stratosphere decisions" });
    for (const group of [...STRATOSPHERE_GROUPS.slice(1), STRATOSPHERE_GROUPS[0]!]) {
      visitGroup(group.id);
      expect(screen.getByRole("heading", { name: group.label })).toHaveFocus();
      const button = within(navigation).getByRole("button", { name: group.label });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-current", "step");
      expect(navigation.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
      const choices = screen.getByRole("group", { name: `Choose ${group.label.toLowerCase()}` });
      expect(choices.tagName).toBe("FIELDSET");
      for (const radio of within(choices).getAllByRole("radio")) {
        expect(radio.tagName).toBe("INPUT");
        expect(radio).toHaveAccessibleName();
      }
    }
  });

  it("restores optional lessons and saves only the brief preference while preserving the Garden position", () => {
    const preferences = { ...GARDEN_DEFAULTS, step: "responsive", goal: "new", brief: false };
    localStorage.setItem(GARDEN_KEY, JSON.stringify(preferences));
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const setup = mount();
    const group = STRATOSPHERE_GROUPS[0]!,
      option = group.options[0]!;
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
    expect(optionRadio(option.label)).toHaveAccessibleDescription(option.lesson);
    expect(writes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    expect(optionRadio(option.label)).not.toHaveAccessibleDescription(option.lesson);
    expect(screen.getByText(group.description)).toBeVisible();
    expect(JSON.parse(localStorage.getItem(GARDEN_KEY)!)).toEqual({ ...preferences, brief: true });
    setup.unmount();
    mount();
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
    expect(optionRadio(option.label)).not.toHaveAccessibleDescription(option.lesson);
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    expect(optionRadio(option.label)).toHaveAccessibleDescription(option.lesson);
    expect(writes.mock.calls.every(([key]) => key === GARDEN_KEY)).toBe(true);
    expect(setup.onPatch).not.toHaveBeenCalled();
  });

  it.each(["denied write", "dropped write", "denied readback"] as const)(
    "keeps lessons usable and reports a %s honestly",
    (failure) => {
      const setup = mount();
      if (failure === "denied write")
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("Storage full");
        });
      if (failure === "dropped write")
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
      if (failure === "denied readback")
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
          throw new Error("Storage denied");
        });
      fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
      const option = STRATOSPHERE_GROUPS[0]!.options[0]!;
      expect(screen.getByRole("checkbox", { name: "Keep it brief" })).not.toBeChecked();
      expect(optionRadio(option.label)).toHaveAccessibleDescription(option.lesson);
      expect(screen.getByText(/Garden preferences could not be confirmed as saved/)).toBeVisible();
      expect(setup.onPatch).not.toHaveBeenCalled();
      expect(currentState()).toEqual(setup.initial);
    },
  );

  it("keeps design choices usable when the initial lesson preference cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    const setup = mount();
    expect(screen.getByText(/Garden preferences could not be read/)).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
    const { option, expected } = changedOption(setup.initial, "spacing");
    visitGroup("spacing");
    fireEvent.click(optionRadio(option.label));
    expect(setup.onPatch).toHaveBeenCalledExactlyOnceWith({
      tokens: expected.tokens,
      page: expected.page,
    });
    expect(currentState().tokens).toEqual(expected.tokens);
  });

  it("downloads the current decision record without recording an authored export or mutating the source", async () => {
    const setup = mount();
    const { option } = changedOption(setup.initial, "palette");
    visitGroup("palette");
    fireEvent.click(optionRadio(option.label));
    await screen.findByTestId("authored-preview");
    const before = currentState(),
      record = authoredProps().decisionRecord!;
    const patchCount = setup.onPatch.mock.calls.length;
    const writes = vi.spyOn(Storage.prototype, "setItem");
    fireEvent.click(screen.getByRole("button", { name: "Download decision map" }));
    expect(operations.download).toHaveBeenCalledExactlyOnceWith(
      expect.any(Blob),
      "focus-decision-map.json",
    );
    const downloaded = await readBlob(operations.download.mock.calls[0]![0] as Blob);
    expect(downloaded).toBe(record);
    expect(JSON.parse(downloaded).source).toEqual(inputOf(before));
    expect(screen.getByText(/records choices, not completed tests/)).toBeVisible();
    expect(currentState()).toEqual(before);
    expect(setup.onPatch).toHaveBeenCalledTimes(patchCount);
    expect(setup.onExport).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(["browser download", "owner lock"] as const)(
    "reports a failed %s without an export or design mutation",
    (failure) => {
      const setup = mount();
      if (failure === "owner lock")
        operations.owner.mockImplementation(() => {
          throw new Error("Session needs verification");
        });
      else
        operations.download.mockImplementation(() => {
          throw new Error("Download blocked");
        });
      fireEvent.click(screen.getByRole("button", { name: "Download decision map" }));
      expect(screen.getByRole("alert")).toHaveTextContent(/decision map could not be downloaded/);
      expect(screen.queryByText(/Decision-map download started/)).toBeNull();
      if (failure === "owner lock") expect(operations.download).not.toHaveBeenCalled();
      expect(currentState()).toEqual(setup.initial);
      expect(setup.onPatch).not.toHaveBeenCalled();
      expect(setup.onExport).not.toHaveBeenCalled();
    },
  );

  it("replaces an earlier download success with the result of a failed retry", () => {
    const setup = mount();
    const button = screen.getByRole("button", { name: "Download decision map" });
    fireEvent.click(button);
    expect(screen.getByText(/Decision-map download started/)).toBeVisible();
    operations.download.mockImplementation(() => {
      throw new Error("Retry blocked");
    });
    fireEvent.click(button);
    expect(screen.getByRole("alert")).toHaveTextContent(/decision map could not be downloaded/);
    expect(screen.queryByText(/Decision-map download started/)).toBeNull();
    expect(setup.onExport).not.toHaveBeenCalled();
    expect(setup.onPatch).not.toHaveBeenCalled();
  });
});
