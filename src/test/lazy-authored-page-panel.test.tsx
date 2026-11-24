import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LazyAuthoredPagePanel } from "@/components/LazyAuthoredPagePanel";
import * as fontLoader from "@/lib/load-authored-fonts";
import { normalizeTokens } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";

type AuthoredProps = ComponentProps<typeof LazyAuthoredPagePanel>;
const loading = vi.hoisted(() => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  return { pending, resolve, readPanel: vi.fn() };
});

vi.mock("@/components/AuthoredPageEditor", async () => {
  await loading.pending;
  return {
    get AuthoredPageEditor() {
      loading.readPanel();
      return AuthoredPagePanel;
    },
  };
});

function AuthoredPagePanel({ content, onExport }: AuthoredProps) {
  return <button onClick={onExport}>Export {content.brand}</button>;
}

function makeProps(): AuthoredProps {
  return {
    tokens: normalizeTokens({}),
    content: { brand: "First project", headline: "", sub: "", cta: "", features: [], quote: "" },
    settings: DEFAULT_PAGE_SETTINGS,
    onSettings: vi.fn(),
    onContent: vi.fn(),
    onExport: vi.fn(),
    projectState: { libraryId: "first" },
  };
}

beforeEach(() => loading.readPanel.mockReset());
afterEach(() => vi.restoreAllMocks());

it("announces loading and mounts the editor with the latest project props", async () => {
  const props = makeProps();
  const currentExport = vi.fn();
  const { rerender } = render(<LazyAuthoredPagePanel {...props} />);
  expect(screen.getByRole("status")).toHaveTextContent(/loading the working page/i);
  expect(screen.queryByRole("button", { name: /^Export/ })).toBeNull();
  rerender(
    <LazyAuthoredPagePanel
      {...props}
      content={{ ...props.content, brand: "Current project" }}
      projectState={{ libraryId: "current" }}
      onExport={currentExport}
    />,
  );
  await act(async () => loading.resolve());
  const download = await screen.findByRole("button", { name: "Export Current project" });
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", { name: "Export First project" })).toBeNull();
  fireEvent.click(download);
  expect(props.onExport).not.toHaveBeenCalled();
  expect(currentExport).toHaveBeenCalledOnce();
});

it("contains a rejected panel import and retries while the surrounding studio stays mounted", async () => {
  const chunkFailure = new Error("The panel chunk is temporarily unavailable");
  loading.readPanel.mockImplementationOnce(() => {
    throw chunkFailure;
  });
  const props = makeProps();
  loading.resolve();
  const onCaughtError = vi.fn();
  render(
    <>
      <label>
        Owner draft
        <input defaultValue="Original copy" />
      </label>
      <LazyAuthoredPagePanel {...props} />
    </>,
    { onCaughtError },
  );
  const draft = screen.getByRole("textbox", { name: "Owner draft" });
  fireEvent.change(draft, { target: { value: "Keep this draft" } });
  await act(async () => loading.resolve());
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /preview and downloads couldn’t load/i,
  );
  expect(onCaughtError).toHaveBeenCalledWith(chunkFailure, expect.anything());
  expect(screen.queryByRole("button", { name: /^Export/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try loading preview again" }));
  expect(await screen.findByRole("button", { name: "Export First project" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Owner draft" })).toBe(draft);
  expect(draft).toHaveValue("Keep this draft");
  expect(loading.readPanel).toHaveBeenCalledTimes(2);
  expect(props.onExport).not.toHaveBeenCalled();
});

it("keeps an abandoned font request from mounting an editor for the previous selection", async () => {
  const props = makeProps();
  let finish!: (value: Awaited<ReturnType<typeof fontLoader.loadAuthoredFontFamilies>>) => void;
  const pending = new Promise<Awaited<ReturnType<typeof fontLoader.loadAuthoredFontFamilies>>>(
    (resolve) => {
      finish = resolve;
    },
  );
  const load = vi.spyOn(fontLoader, "loadAuthoredFontFamilies").mockReturnValueOnce(pending);
  const { rerender } = render(<LazyAuthoredPagePanel {...props} />);
  // Isolate the slow family request from the separate editor-module loading test.
  await act(async () => {
    loading.resolve();
    await vi.dynamicImportSettled();
  });
  expect(screen.queryByRole("button", { name: /^Export/ })).toBeNull();
  const revised = {
    ...props,
    tokens: normalizeTokens({ headingFont: "Outfit", bodyFont: "DM Sans" }),
    content: { ...props.content, brand: "New pair" },
  };
  rerender(<LazyAuthoredPagePanel {...revised} />);
  const current = await screen.findByRole("button", { name: "Export New pair" });
  await act(async () => finish([]));
  expect(screen.getByRole("button", { name: "Export New pair" })).toBe(current);
  expect(load).toHaveBeenCalledWith("Outfit", "DM Sans");
  expect(screen.queryByRole("button", { name: "Export First project" })).toBeNull();
});

it("withholds downloads after a failed family load and retries the current selection", async () => {
  loading.resolve();
  const load = vi
    .spyOn(fontLoader, "loadAuthoredFontFamilies")
    .mockRejectedValueOnce(new Error("Offline font chunk"));
  const props = makeProps();
  render(<LazyAuthoredPagePanel {...props} />, { onCaughtError: vi.fn() });
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("button", { name: /^Export/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try loading preview again" }));
  expect(await screen.findByRole("button", { name: "Export First project" })).toBeVisible();
  expect(load.mock.calls).toEqual([
    [props.tokens.headingFont, props.tokens.bodyFont],
    [props.tokens.headingFont, props.tokens.bodyFont],
  ]);
});
