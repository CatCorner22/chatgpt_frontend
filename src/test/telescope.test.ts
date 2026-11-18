import { webcrypto, createHash } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TELESCOPE_LIMITS,
  compareTelescopeReceipts,
  inspectTelescopeArtifact,
  parseTelescopeReceipt,
  telescopeTestPlan,
} from "@/lib/telescope";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());
const bytes = (text: string) => new TextEncoder().encode(text);
async function zip(files: Record<string, string>) {
  const archive = new JSZip();
  for (const [name, content] of Object.entries(files))
    archive.file(name, content, { createFolders: false });
  return archive.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
function centralOffsets(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const offsets: number[] = [];
  for (let i = 0; i + 46 <= data.length; i++)
    if (view.getUint32(i, true) === 0x02014b50) offsets.push(i);
  return offsets;
}

describe("Telescope local artifact boundary", () => {
  it("hashes exact selected bytes and never executes, renders, fetches or persists customer markup", async () => {
    const fetch = vi.fn(() => {
      throw new Error("No network allowed");
    });
    vi.stubGlobal("fetch", fetch);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const markup = bytes(
      '<script>fetch("/delete",{method:"DELETE"})</script><iframe src="https://example.com"></iframe><form action="/write"><input></form><img src="photo.png"><h1>Private title</h1>',
    );
    const report = await inspectTelescopeArtifact("page.html", markup);
    expect(report.artifact.sha256).toBe(createHash("sha256").update(markup).digest("hex"));
    expect(report.scope).toBe("static-inventory-only");
    expect(report.execution.browserTests).toBe("not-run");
    expect(report.inventory.html).toBe(1);
    expect(report.findings.some((f) => /standalone HTML/i.test(f.message))).toBe(true);
    expect(JSON.stringify(report)).not.toContain("Private title");
    expect(fetch).not.toHaveBeenCalled();
    expect(writes).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
    writes.mockRestore();
  });

  it("inventories a real ZIP and conservatively identifies missing local assets", async () => {
    const data = await zip({
      "site/index.html":
        '<link rel="stylesheet" href="styles.css"><img src="images/missing.png"><script src="app.js"></script>',
      "site/styles.css": "body{background:url(images/hero.png)}",
      "site/app.js": "console.log('customer code');",
      "site/images/hero.png": "image bytes are not decoded",
    });
    const report = await inspectTelescopeArtifact("build.zip", data);
    expect(report.inventory).toEqual({
      files: 4,
      html: 1,
      css: 1,
      javascript: 1,
      images: 1,
      other: 0,
      entryHtml: "site/index.html",
    });
    expect(
      report.findings.some(
        (f) => f.id === "missing-local-asset" && f.path === "site/images/missing.png",
      ),
    ).toBe(true);
    expect(
      report.findings.some((f) => f.id === "missing-local-asset" && f.path?.endsWith("hero.png")),
    ).toBe(false);
    expect(
      report.findings.some((f) => f.id === "runtime-unverified" && f.level === "unknown"),
    ).toBe(true);
    expect(report.findings.every((f) => ["fail", "warn", "unknown"].includes(f.level))).toBe(true);
  });

  it("keeps standalone HTML classified correctly when its display filename is shortened", async () => {
    const report = await inspectTelescopeArtifact(
      `${"x".repeat(200)}.html`,
      bytes("<h1>Page</h1>"),
    );
    expect(report.artifact.name.length).toBeLessThanOrEqual(180);
    expect(report.inventory.html).toBe(1);
    expect(report.inventory.entryHtml).toBe(report.artifact.name);
    expect(report.findings.some((finding) => finding.id === "no-html-entry")).toBe(false);
  });

  it.each([
    "../index.html",
    "a/../index.html",
    "/index.html",
    "C:/index.html",
    "a\\index.html",
    "a\u202e.html",
    "NUL.txt",
  ])("refuses ambiguous archive path %s", async (name) => {
    await expect(inspectTelescopeArtifact("build.zip", await zip({ [name]: "x" }))).rejects.toThrow(
      /path|name/i,
    );
  });

  it("rejects duplicate and case-colliding names before JSZip can overwrite them", async () => {
    const data = await zip({ "a.html": "first", "b.html": "second" });
    const view = new DataView(data.buffer);
    const second = centralOffsets(data)[1]!;
    const local = view.getUint32(second + 42, true);
    data[second + 46] = 97;
    data[local + 30] = 97;
    await expect(inspectTelescopeArtifact("build.zip", data)).rejects.toThrow(
      /collision|duplicate/i,
    );
    await expect(
      inspectTelescopeArtifact("build.zip", await zip({ "Index.html": "a", "index.html": "b" })),
    ).rejects.toThrow(/collision|duplicate/i);
    await expect(
      inspectTelescopeArtifact(
        "build.zip",
        await zip({ assets: "file", "assets/main.css": "css" }),
      ),
    ).rejects.toThrow(/collision|directory/i);
  });

  it("rejects encrypted and symlink entries before inspection", async () => {
    const encrypted = await zip({ "index.html": "hi" });
    const central = centralOffsets(encrypted)[0]!;
    encrypted[6] = encrypted[6]! | 1;
    encrypted[central + 8] = encrypted[central + 8]! | 1;
    await expect(inspectTelescopeArtifact("build.zip", encrypted)).rejects.toThrow(/encrypt/i);
    const archive = new JSZip();
    archive.file("link", "target", { unixPermissions: 0o120777 });
    await expect(
      inspectTelescopeArtifact(
        "build.zip",
        await archive.generateAsync({ type: "uint8array", platform: "UNIX" }),
      ),
    ).rejects.toThrow(/symbolic|symlink|regular/i);
  });

  it("rejects local/central mismatch, oversized declarations and malformed ZIP containers", async () => {
    const mismatch = await zip({ "index.html": "hi" });
    mismatch[30] = 88;
    await expect(inspectTelescopeArtifact("build.zip", mismatch)).rejects.toThrow(/header|name/i);
    const oversized = await zip({ "index.html": "hi" });
    new DataView(oversized.buffer).setUint32(
      centralOffsets(oversized)[0]! + 24,
      TELESCOPE_LIMITS.expandedBytes + 1,
      true,
    );
    await expect(inspectTelescopeArtifact("build.zip", oversized)).rejects.toThrow(/size|limit/i);
    await expect(inspectTelescopeArtifact("build.zip", bytes("not a zip"))).rejects.toThrow(/ZIP/i);
    await expect(
      inspectTelescopeArtifact("page.html", new Uint8Array(TELESCOPE_LIMITS.fileBytes + 1)),
    ).rejects.toThrow(/limit|large/i);
  });

  it("does not turn base URLs, srcset or remote assets into invented missing-file failures", async () => {
    const report = await inspectTelescopeArtifact(
      "build.zip",
      await zip({
        "index.html":
          '<base href="/app/"><img src="hero.png" srcset="a.png 1x, b.png 2x"><link rel="stylesheet" href="https://cdn.example/theme.css">',
      }),
    );
    expect(report.findings.some((f) => f.id === "base-url-unverified")).toBe(true);
    expect(report.findings.some((f) => f.id === "missing-local-asset")).toBe(false);
  });

  it("stops a forged-small expanded entry at its actual-byte cap and refuses corrupted text checksums", async () => {
    const oversized = await zip({ "index.html": "<h1>" + "A".repeat(120_000) + "</h1>" });
    const view = new DataView(oversized.buffer);
    view.setUint32(22, 3, true);
    view.setUint32(centralOffsets(oversized)[0]! + 24, 3, true);
    await expect(inspectTelescopeArtifact("build.zip", oversized)).rejects.toThrow(
      /actual-byte|decompressed|actual size/i,
    );
    const corrupt = await zip({ "index.html": "<h1>Hello</h1>" });
    const checksumView = new DataView(corrupt.buffer);
    checksumView.setUint32(14, 0, true);
    checksumView.setUint32(centralOffsets(corrupt)[0]! + 16, 0, true);
    await expect(inspectTelescopeArtifact("build.zip", corrupt)).rejects.toThrow(/checksum/i);
  });

  it("bounds a dense report and preserves an explicit unverified marker", async () => {
    const files = Object.fromEntries(
      Array.from({ length: 200 }, (_, n) => [
        `page-${n}.html`,
        `<base href="/app/"><script></script><img src="${n}.png">`,
      ]),
    );
    const report = await inspectTelescopeArtifact("build.zip", await zip(files));
    expect(report.findings.length).toBeLessThanOrEqual(TELESCOPE_LIMITS.findings);
    expect(report.findings.some((f) => f.id === "findings-truncated")).toBe(true);
    expect(report.findings.some((f) => f.id === "runtime-unverified")).toBe(true);
    expect(parseTelescopeReceipt(JSON.stringify(report))).toEqual(report);
  });

  it("keeps repeated unclosed markup and CSS openers bounded instead of rescanning suffixes", async () => {
    for (const opener of ["<script>", "<script src=", "<!--"]) {
      const text = opener.repeat(Math.floor(1_800_000 / opener.length));
      const start = performance.now();
      const report = await inspectTelescopeArtifact("page.html", bytes(text));
      expect(performance.now() - start).toBeLessThan(2000);
      expect(report.findings.some((f) => f.id === "reference-resolution-unverified")).toBe(true);
    }
    // STORE avoids a legitimate ratio-budget refusal hiding the parser behavior.
    for (const opener of ["url(foo", "/*"]) {
      const archive = new JSZip();
      archive.file("index.html", "<h1>Hi</h1>");
      archive.file("app.css", opener.repeat(200_000));
      const data = await archive.generateAsync({ type: "uint8array", compression: "STORE" });
      const start = performance.now();
      const report = await inspectTelescopeArtifact("build.zip", data);
      expect(performance.now() - start).toBeLessThan(2000);
      expect(report.findings.some((f) => f.id === "reference-resolution-unverified")).toBe(true);
    }
  });
});

describe("Telescope receipt and manual plan", () => {
  it("matches bytes, not filenames or a supplied success claim", async () => {
    const a = await inspectTelescopeArtifact("same.html", bytes("<h1>A</h1>"));
    const b = await inspectTelescopeArtifact("same.html", bytes("<h1>B</h1>"));
    expect(compareTelescopeReceipts(parseTelescopeReceipt(JSON.stringify(a)), a)).toBe(
      "same-bytes",
    );
    expect(compareTelescopeReceipts(a, b)).toBe("different-bytes");
    expect(
      compareTelescopeReceipts(
        { ...a, artifact: { ...a.artifact, bytes: a.artifact.bytes + 1 } },
        a,
      ),
    ).toBe("metadata-conflict");
    expect(
      compareTelescopeReceipts({ ...a, artifact: { ...a.artifact, name: "renamed.html" } }, a),
    ).toBe("same-bytes");
    expect(() => parseTelescopeReceipt(JSON.stringify({ ...a, readyToLaunch: true }))).toThrow();
    expect(() =>
      parseTelescopeReceipt(JSON.stringify({ ...a, scope: "browser-tested" })),
    ).toThrow();
    expect(() => parseTelescopeReceipt("{")).toThrow();
    expect(() => parseTelescopeReceipt(" ".repeat(TELESCOPE_LIMITS.receiptBytes + 1))).toThrow();
  });
  it("keeps its own pretty-printed receipt importable with many long multibyte paths", async () => {
    const html = Array.from(
      { length: 390 },
      (_, n) => `<img src="${"界".repeat(225)}${n}.png">`,
    ).join("");
    const report = await inspectTelescopeArtifact("build.zip", await zip({ "index.html": html }));
    const exported = JSON.stringify(report, null, 2) + "\n";
    expect(new TextEncoder().encode(exported).length).toBeLessThanOrEqual(
      TELESCOPE_LIMITS.receiptBytes,
    );
    expect(report.findings.some((f) => f.id === "findings-truncated")).toBe(true);
    expect(parseTelescopeReceipt(exported)).toEqual(report);
  });
  it("exports manual-not-run evidence fields tied to the exact selected artifact", async () => {
    const report = await inspectTelescopeArtifact("page.html", bytes("<h1>A</h1>"));
    const plan = telescopeTestPlan(report, "Book a service", {
      error: "Recover without losing selected time",
    });
    expect(plan).toContain(report.artifact.sha256);
    expect(plan).toContain("Book a service");
    expect(plan).toContain("Recover without losing selected time");
    expect(plan).toContain("manual — not run");
    expect(plan).toContain("rollback");
    expect(plan).not.toContain("[x]");
    expect(plan).not.toContain("ready to launch");
  });
});
