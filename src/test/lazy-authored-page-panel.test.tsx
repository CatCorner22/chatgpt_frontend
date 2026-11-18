import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { LazyAuthoredPagePanel } from "@/components/LazyAuthoredPagePanel";
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

vi.mock("@/components/AuthoredPagePanel", async () => {
  await loading.pending;
  return {
    get AuthoredPagePanel() {
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
