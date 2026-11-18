import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BeforeAfter } from "@/components/BeforeAfter";

const decodes = new Map<string, { onload: (() => void) | null; onerror: (() => void) | null }>();
const create = vi.fn((file: File) => `blob:${file.name}`);
const revoke = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  decodes.clear();
  create.mockClear();
  revoke.mockClear();
  vi.stubGlobal(
    "Image",
    class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 10;
      naturalHeight = 10;
      set src(value: string) {
        decodes.set(value, this);
      }
    },
  );
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const select = (label: string, name: string) =>
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [new File(["bytes"], name, { type: "image/png" })] },
  });
const decoded = async (name: string, valid = true) => {
  await act(async () => {
    const image = decodes.get(`blob:${name}`);
    if (valid) image?.onload?.();
    else image?.onerror?.();
  });
};

describe("before and after screenshot recovery", () => {
  it("retains a valid screenshot when a replacement cannot decode", async () => {
    render(<BeforeAfter />);
    select("Original screenshot", "original.png");
    await decoded("original.png");
    select("Restyled screenshot", "after.png");
    await decoded("after.png");
    expect(screen.getByAltText("Original site")).toHaveAttribute("src", "blob:original.png");
    select("Original screenshot", "broken.png");
    await decoded("broken.png", false);
    expect(await screen.findByRole("alert")).toHaveTextContent(/previous picture is unchanged/i);
    expect(screen.getByAltText("Original site")).toHaveAttribute("src", "blob:original.png");
    expect(revoke).toHaveBeenCalledWith("blob:broken.png");
    expect(revoke).not.toHaveBeenCalledWith("blob:original.png");
  });

  it("keeps the latest replacement when older decoding finishes later and releases all URLs", async () => {
    const view = render(<BeforeAfter />);
    select("Restyled screenshot", "after.png");
    await decoded("after.png");
    select("Original screenshot", "slow.png");
    select("Original screenshot", "latest.png");
    await decoded("latest.png");
    await decoded("slow.png");
    await waitFor(() =>
      expect(screen.getByAltText("Original site")).toHaveAttribute("src", "blob:latest.png"),
    );
    expect(revoke).toHaveBeenCalledWith("blob:slow.png");
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:latest.png");
    expect(revoke).toHaveBeenCalledWith("blob:after.png");
  });
});
