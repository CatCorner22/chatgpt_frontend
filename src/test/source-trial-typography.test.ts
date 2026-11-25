import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeTokens } from "@/lib/design";
import {
  prepareSourceTrial,
  verifiedTrialAssets,
  verifyPreparedSourceTrial,
} from "@/lib/source-trial";
import { getAuthoredFontAvailability } from "@/lib/authored-font-availability";

const files = ["Booking.tsx", "Booking.module.css"].map((filename) => ({
  path: "src/" + filename,
  content: readFileSync("examples/booking-rehearsal/src/" + filename, "utf8"),
}));
const design = {
  id: "portable-type",
  tokens: normalizeTokens({
    headingFont: "Instrument Serif",
    bodyFont: "Instrument Sans",
    buttonStyle: "solid",
  }),
};
const portable = { typography: "portable", bookingLayout: "compact" } as const;
const preserve = { ...portable, typography: "preserve" } as const;

describe("existing-app typography choices", () => {
  it("keeps the project's font declarations for preserve and retains the legacy contract for old callers", async () => {
    const [old, kept] = await Promise.all([
      prepareSourceTrial(files, design),
      prepareSourceTrial(files, design, preserve),
    ]);
    expect(old.contract).toMatchObject({ version: 1, adapter: "react-vite-css-module-v1" });
    expect(old.changes.filter(({ property }) => property === "font-family")).toHaveLength(3);
    expect(kept.contract).toMatchObject({ version: 2, typography: "preserve", assets: [] });
    expect(kept.changes.some(({ property }) => property === "font-family")).toBe(false);
    expect(kept.files[1].after.slice(kept.files[1].before.length)).not.toMatch(
      /font-family|@font-face|url\(/,
    );
    expect(kept.files[0].after).toContain("<select");
    await expect(verifyPreparedSourceTrial(kept)).resolves.toBeUndefined();
  });

  it("transports selected original font/license bytes, unique scoped faces and real weights", async () => {
    const trial = await prepareSourceTrial(files, design, portable);
    const assets = await verifiedTrialAssets(trial);
    expect(assets).toHaveLength(4);
    expect(trial.files[1].after.match(/@font-face/g)).toHaveLength(2);
    expect(trial.files[1].after).toContain("font-weight: 400;");
    expect(trial.files[1].after).toContain("font-weight: 400 600;");
    for (const { record, data } of assets) {
      const match =
        /^(?:src\/)(focus-assets-([\da-f]{12}))\/(instrument-(?:serif|sans))-([\da-f]{12})\.(woff2|txt)$/.exec(
          record.path,
        );
      expect(match).not.toBeNull();
      const [, folder, scope, family, digestPrefix, extension] = match!;
      expect(record.sha256.slice(0, 12)).toBe(digestPrefix);
      const upstream =
        extension === "woff2" ? family + "-latin-normal.woff2" : "licenses/" + family + "-OFL.txt";
      expect(Buffer.from(data).equals(readFileSync("assets/vendor-fonts/" + upstream))).toBe(true);
      if (extension === "woff2") {
        expect(trial.files[1].after).toContain(
          `url("./${folder}/${family}-${digestPrefix}.woff2")`,
        );
        expect(
          trial.changes.some(({ after }) => after.startsWith(`"FocusTrial-${scope}-${family}",`)),
        ).toBe(true);
      } else {
        expect(trial.files[1].after).toContain(
          `url("./${folder}/${family}-${digestPrefix}.txt?no-inline")`,
        );
      }
    }
    const copy = await prepareSourceTrial(files, design, portable);
    expect(copy.patch).toEqual(trial.patch);
    expect(copy.contract).toEqual(trial.contract);
    if (copy.contract.version !== 2) throw Error("Expected v2");
    copy.contract.assets[0]!.sha256 = "0".repeat(64);
    await expect(verifyPreparedSourceTrial(copy)).rejects.toThrow(/changed/);
  });

  it("deduplicates a shared heading and body face and refuses unavailable family choices", async () => {
    const same = {
      ...design,
      tokens: { ...design.tokens, headingFont: "Instrument Sans" as const },
    };
    expect(await verifiedTrialAssets(await prepareSourceTrial(files, same, portable))).toHaveLength(
      2,
    );
    const rare = { ...design, tokens: { ...design.tokens, headingFont: "Syne" as const } };
    expect(
      getAuthoredFontAvailability(rare.tokens.headingFont, rare.tokens.bodyFont).missingFamilies,
    ).toEqual(["Syne"]);
    await expect(prepareSourceTrial(files, rare, portable)).rejects.toThrow(/Syne.*Keep the app/);
    await expect(prepareSourceTrial(files, rare, preserve)).resolves.toMatchObject({
      contract: { typography: "preserve", assets: [] },
    });
  });
});
