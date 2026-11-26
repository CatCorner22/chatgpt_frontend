import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeTokens } from "@/lib/design";
import {
  prepareSourceTrial,
  SOURCE_TRIAL_LIMITS,
  SourceTrialError,
  type PreparedSourceTrial,
} from "@/lib/source-trial";
import { compareSourceTrialReturn } from "@/lib/source-trial-return";

const fixtureDirectory = "src/test/fixtures/source-trial";
const original = ["Booking.tsx", "Booking.module.css"].map((name) => ({
  path: `src/${name}`,
  content: readFileSync(`${fixtureDirectory}/${name}`, "utf8"),
}));
const design = {
  id: "owned-return-comparison",
  tokens: normalizeTokens({
    headingFont: "Instrument Serif",
    bodyFont: "Instrument Sans",
    accent: "#d25a2e",
    buttonStyle: "pill",
  }),
};
const encode = (text: string) => new TextEncoder().encode(text);
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const selection = (trial: PreparedSourceTrial, stage: "before" | "after") =>
  trial.files.map(({ path, [stage]: text }) => ({ path, bytes: encode(text) }));

let trial: PreparedSourceTrial;

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  trial = await prepareSourceTrial(original, design);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("source trial returned bytes", () => {
  it("recognizes the two returned sources of a portable comparison at the stylesheet input limit", async () => {
    const pair = ["Booking.tsx", "Booking.module.css"].map((name) => ({
      path: "src/" + name,
      content: readFileSync("examples/booking-rehearsal/src/" + name, "utf8"),
    }));
    const css = pair[1]!;
    const padding = SOURCE_TRIAL_LIMITS.stylesheetBytes - encode(css.content).length - 5;
    css.content = "/*" + "x".repeat(padding) + "*/\n" + css.content;
    const prepared = await prepareSourceTrial(pair, design, {
      typography: "portable",
      bookingLayout: "compare",
    });
    expect(prepared.contract.files[1].afterBytes).toBeGreaterThan(
      SOURCE_TRIAL_LIMITS.stylesheetBytes + SOURCE_TRIAL_LIMITS.afterGrowthBytes,
    );
    await expect(
      compareSourceTrialReturn(prepared, selection(prepared, "after")),
    ).resolves.toMatchObject({ state: "proposed" });
    await expect(
      compareSourceTrialReturn(prepared, selection(prepared, "before")),
    ).resolves.toMatchObject({ state: "original" });
  });

  it("recognizes both proposed files regardless of picker order", async () => {
    const expected = trial.contract.files;
    const files = selection(trial, "after").reverse();
    await expect(compareSourceTrialReturn(trial, files)).resolves.toEqual({
      state: "proposed",
      files: expected.map(({ path, afterSha256: sha256 }) => ({ path, state: "proposed", sha256 })),
    });
  });

  it("hashes only the selected byte view even if its buffer has a prefix and suffix", async () => {
    const files = selection(trial, "after").map(({ bytes, path }) => {
      const buffer = new Uint8Array(bytes.length + 4).fill(0xff);
      buffer.set(bytes, 1);
      return { path, bytes: buffer.subarray(1, 1 + bytes.length) };
    });
    await expect(compareSourceTrialReturn(trial, files)).resolves.toMatchObject({
      state: "proposed",
    });
  });

  it("recognizes the exact original snapshot including returned rollback files", async () => {
    const expected = trial.contract.files;
    await expect(compareSourceTrialReturn(trial, selection(trial, "before"))).resolves.toEqual({
      state: "original",
      files: expected.map(({ path, beforeSha256: sha256 }) => ({
        path,
        state: "original",
        sha256,
      })),
    });
  });

  it.each([0, 1])(
    "recognizes a known partial result when only file %i was changed",
    async (index) => {
      const mixed = selection(trial, "before");
      mixed[index] = selection(trial, "after")[index]!;
      const result = await compareSourceTrialReturn(trial, mixed);
      expect(result.state).toBe("partial");
      expect(result.files.map(({ state }) => state)).toEqual(
        mixed.map((_, itemIndex) => (itemIndex === index ? "proposed" : "original")),
      );
    },
  );

  it.each([
    ["UTF-8 BOM", (content: string) => encode("\ufeff" + content)],
    ["missing final newline", (content: string) => encode(content.replace(/\n$/, ""))],
    ["CRLF line endings", (content: string) => encode(content.replaceAll("\n", "\r\n"))],
    ["malformed UTF-8", () => Uint8Array.of(0xc3, 0x28, 0xff)],
    ["empty file", () => new Uint8Array()],
  ] as const)("hashes %s as supplied and reports it as different", async (_kind, changed) => {
    const files = selection(trial, "after");
    // The stylesheet proposal grows enough that original CRLF and BOM variants remain bounded.
    const stylesheet = trial.files[1];
    const bytes = changed(stylesheet.before);
    expect(bytes.byteLength).toBeLessThanOrEqual(trial.contract.files[1].afterBytes);
    files[1] = { path: stylesheet.path, bytes };
    const result = await compareSourceTrialReturn(trial, files);
    expect(result.state).toBe("different");
    expect(result.files[1]).toEqual({
      path: stylesheet.path,
      state: "different",
      sha256: digest(bytes),
    });
  });

  it("rejects missing, extra, duplicate, wrong-case or unrelated paths", async () => {
    const [component, stylesheet] = selection(trial, "before");
    const safeSets = [
      [],
      [component!],
      [component!, stylesheet!, component!],
      [component!, component!],
      [{ ...component!, path: "src/booking.tsx" }, stylesheet!],
      [{ ...component!, path: "../Booking.tsx" }, stylesheet!],
      [{ ...component!, path: "src/Other.tsx" }, stylesheet!],
    ];
    for (const files of safeSets) {
      await expect(compareSourceTrialReturn(trial, files)).rejects.toThrow(SourceTrialError);
    }
  });

  it("enforces both the selected-file allowance and the independent absolute cap", async () => {
    const [component, stylesheet] = selection(trial, "before");
    const exactMaximum = trial.contract.files[0].afterBytes;
    const justOversized = { ...component!, bytes: new Uint8Array(exactMaximum + 1) };
    await expect(compareSourceTrialReturn(trial, [justOversized, stylesheet!])).rejects.toThrow(
      SourceTrialError,
    );
    Object.defineProperty(justOversized.bytes, "byteLength", { value: 1 });
    await expect(compareSourceTrialReturn(trial, [justOversized, stylesheet!])).rejects.toThrow(
      /exceeds the byte limit/,
    );
    const forged = structuredClone(trial);
    const overCap = SOURCE_TRIAL_LIMITS.componentBytes + SOURCE_TRIAL_LIMITS.afterGrowthBytes + 1;
    forged.contract.files[0].afterBytes = overCap;
    await expect(
      compareSourceTrialReturn(forged, [
        { ...component!, bytes: new Uint8Array(overCap) },
        stylesheet!,
      ]),
    ).rejects.toThrow(SourceTrialError);
  });

  it("checks proposal integrity without echoing private source or patch changes", async () => {
    const poisoned = { ...trial, patch: trial.patch + "\nprivate-source-value" };
    await expect(compareSourceTrialReturn(poisoned, selection(trial, "before"))).rejects.toThrow(
      SourceTrialError,
    );
    await compareSourceTrialReturn(poisoned, selection(trial, "before")).catch((error: Error) => {
      expect(error.message).not.toContain("private-source-value");
    });
  });

  it("refuses oversized nested proposal metadata before cloning", async () => {
    const forged = structuredClone(trial);
    forged.contract.tasks = Array(256).fill(forged.contract.tasks[0]);
    const clone = vi.spyOn(globalThis, "structuredClone");
    await expect(compareSourceTrialReturn(forged, selection(trial, "before"))).rejects.toThrow(
      SourceTrialError,
    );
    expect(clone).not.toHaveBeenCalled();
  });

  it("snapshots the proposal, file names and byte views before asynchronous work", async () => {
    const files = selection(trial, "after");
    const expected = trial.contract.files.map(({ path, afterSha256: sha256 }) => ({
      path,
      state: "proposed",
      sha256,
    }));
    const actualDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    let allowDigest!: () => void;
    const gate = new Promise<void>((resolve) => {
      allowDigest = resolve;
    });
    vi.spyOn(webcrypto.subtle, "digest").mockImplementationOnce(async (algorithm, data) => {
      await gate;
      return actualDigest(algorithm, data);
    });
    const comparison = compareSourceTrialReturn(trial, files);
    trial.contract.files[0].afterSha256 = "a".repeat(64);
    trial.patch = "";
    files[0]!.bytes.fill(0);
    files[1]!.path = "src/Other.module.css";
    allowDigest();
    await expect(comparison).resolves.toEqual({ state: "proposed", files: expected });
  });
});
