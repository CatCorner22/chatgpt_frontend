import { createHash, webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserAuditFileMatch } from "@/components/BrowserAuditFileMatch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("compares actual delivered bytes and discards a superseded file read", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const text = "<p>First</p>";
  const bytes = new TextEncoder().encode(text);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  render(<BrowserAuditFileMatch entry={{ bytes: bytes.length, sha256 }} />);
  const choose = (file: File) =>
    fireEvent.change(screen.getByLabelText("Compare delivered HTML"), {
      target: { files: [file] },
    });
  const file = (contents: string, read?: () => Promise<ArrayBufferLike>) => {
    const result = new File([contents], "page.html");
    Object.defineProperty(result, "arrayBuffer", {
      value: read ?? (async () => new TextEncoder().encode(contents).buffer),
    });
    return result;
  };
  choose(file(text));
  expect(await screen.findByText(/These HTML bytes match/)).toBeInTheDocument();
  choose(file("<p>Other</p>"));
  expect(await screen.findByText(/HTML contents changed/)).toBeInTheDocument();
  let finish!: (buffer: ArrayBufferLike) => void;
  choose(
    file(
      text,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  choose(file("short"));
  expect(screen.getByText(/file size changed/)).toBeInTheDocument();
  await act(async () => {
    finish(bytes.buffer);
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(screen.getByText(/file size changed/)).toBeInTheDocument();
});
