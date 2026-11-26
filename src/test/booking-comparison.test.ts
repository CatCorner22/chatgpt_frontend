import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import practiceComponent from "../../examples/booking-rehearsal/src/Booking.tsx?raw";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isolatedChildEnv } from "./isolated-child-env";
import { applyBookingComparison, inspectBookingComparison } from "@/lib/booking-comparison";
import { normalizeTokens } from "@/lib/design";
import { prepareSourceTrial, verifyPreparedSourceTrial } from "@/lib/source-trial";
import { validateEditedSyntax } from "@/lib/source-trial-analysis";
import { makeSourceTrialPatch } from "@/lib/source-trial-diff";

const practiceStyles = readFileSync("examples/booking-rehearsal/src/Booking.module.css", "utf8");
const marker = "focusTrial_012345abcdef";
const ink = "#24414b";
const startingPicker = '        <label htmlFor="session">Class</label>';
const nextLabel = '        <label htmlFor="email">Practice email</label>';

describe("River Kiln class comparison", () => {
  it("reads class names, hours and displayed totals from the supplied component", () => {
    const customer = practiceComponent
      .replace("Wheel basics · 10 am", "Raku & Clay · 11:15 am")
      .replace("Glaze studio · 2 pm", "Cerámica · 16:30")
      .replace('"$48" : "$56"', '"$61.50" : "$42"')
      .replace("Find your place at the wheel.", "Choose a class for the weekend.");
    expect(inspectBookingComparison(customer)).toEqual([
      { value: "wheel", label: "Raku & Clay", time: "11:15 am", total: "$61.50" },
      { value: "glaze", label: "Cerámica", time: "16:30", total: "$42" },
    ]);
    const changed = applyBookingComparison(customer, marker, ink).component;
    expect(changed).toContain("Choose a class for the weekend.");
    expect(changed).toContain("Raku & Clay");
    expect(changed).toContain("Cerámica");
    expect(changed.match(/\$61\.50/g)).toHaveLength(1);
    expect(changed).not.toContain("$48");
  });

  it.each([
    [
      "different booking handler",
      practiceComponent.replace(
        "setSession(event.target.value);",
        "setSession(event.target.value.trim());",
      ),
    ],
    [
      "reordered class identities",
      practiceComponent.replace('value="wheel">Wheel', 'value="glaze">Wheel'),
    ],
    [
      "additional option",
      practiceComponent.replace("</select>", '<option value="new">New · 5 pm</option></select>'),
    ],
    ["another pricing model", practiceComponent.replace('"$48" : "$56"', '"$48" : liveTotal')],
    [
      "disabled option",
      practiceComponent.replace('<option value="glaze"', '<option disabled value="glaze"'),
    ],
    ["JSX expression", practiceComponent.replace("Wheel basics · 10 am", "{name} · 10 am")],
    [
      "encoded class data requiring interpretation",
      practiceComponent.replace("Wheel basics", "Wheel &amp; clay"),
    ],
    [
      "unknown outside dependency",
      practiceComponent.replace(
        "const inFlight =",
        'const sessionId = document.getElementById("session");\n  const inFlight =',
      ),
    ],
    [
      "new form action",
      practiceComponent.replace("onSubmit={submit}", 'action="/reserve" onSubmit={submit}'),
    ],
    ["other component", "export default function Booking() { return <div />; }"],
  ])("declines the comparison for %s", (_, source) => {
    expect(inspectBookingComparison(source)).toBeNull();
    expect(() => applyBookingComparison(source, marker, ink)).toThrow(/developer-guided/);
  });

  it("sets native group semantics, keeps the existing handlers and scopes every new style", () => {
    const scoped = practiceComponent.replace("styles.page}", `styles.page + " ${marker}"}`);
    const { component, stylesheetAddition } = applyBookingComparison(scoped, marker, ink);
    expect(component).toContain(`styles.page + " ${marker}"`);
    expect(component).toContain(
      '<fieldset id="session" data-focus-booking-choices="" disabled={pending}>',
    );
    expect(component).toContain("<legend>Class</legend>");
    expect(stylesheetAddition).toContain(`color: ${ink}`);
    expect(component).toContain('type="radio"');
    expect(component).toContain('name="session"');
    expect(component).toContain("checked={session === choice.value}");
    expect(
      component
        .slice(component.indexOf("export default"), component.indexOf("<fieldset"))
        .trimEnd(),
    ).toEqual(
      scoped.slice(scoped.indexOf("export default"), scoped.indexOf(startingPicker)).trimEnd(),
    );
    expect(component.slice(component.indexOf(nextLabel))).toBe(
      scoped.slice(scoped.indexOf(nextLabel)),
    );
    for (const line of stylesheetAddition.split("\n").filter((text) => text.endsWith("{"))) {
      expect(line).toMatch(/^:global\(\.focusTrial_012345abcdef\) \[data-focus-booking-choices\]/);
    }
    expect(() =>
      validateEditedSyntax(component, practiceStyles + stylesheetAddition),
    ).not.toThrow();
    expect(() => applyBookingComparison(component, marker, ink)).toThrow();
    expect(() => applyBookingComparison(practiceComponent, marker, "inherit")).toThrow();
    expect(() => applyBookingComparison(practiceComponent, ".page", ink)).toThrow();
    expect(() => applyBookingComparison(scoped, "focusTrial_aaaaaaaaaaaa", ink)).toThrow();
  });

  it("binds the chosen treatment into the real handoff and preserves the compact version", async () => {
    vi.stubGlobal("crypto", webcrypto);
    try {
      const input = [
        { path: "src/Booking.tsx", content: practiceComponent },
        { path: "src/Booking.module.css", content: practiceStyles },
      ];
      const design = { id: "river-kiln", tokens: normalizeTokens({ buttonStyle: "solid" }) };
      const [compact, compare] = await Promise.all([
        prepareSourceTrial(input, design, { typography: "preserve", bookingLayout: "compact" }),
        prepareSourceTrial(input, design, { typography: "preserve", bookingLayout: "compare" }),
      ]);
      for (const prepared of [compact, compare]) await verifyPreparedSourceTrial(prepared);
      expect(compact.contract.sourceFingerprint).toBe(compare.contract.sourceFingerprint);
      expect(compact.contract.patchSha256).not.toBe(compare.contract.patchSha256);
      expect(compact.files[0].after).toContain(startingPicker);
      expect(compact.files[0].after).not.toContain('type="radio"');
      expect(compare.files[0].after).toContain('type="radio"');
      expect(compare.contract).toMatchObject({ version: 2, bookingLayout: "compare", assets: [] });
      const mislabeled = {
        ...compare,
        contract: { ...compare.contract, bookingLayout: "compact" as const },
      };
      await expect(verifyPreparedSourceTrial(mislabeled)).rejects.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves CRLF and reverses the exact recipient bytes including the original picker", () => {
    const before = practiceComponent.replace(/\r?\n/g, "\r\n");
    const { component, stylesheetAddition } = applyBookingComparison(before, marker, ink);
    expect(component).not.toMatch(/(?<!\r)\n/);
    expect(stylesheetAddition).not.toMatch(/(?<!\r)\n/);
    const edit = { path: "src/Booking.tsx", before, after: component };
    const work = mkdtempSync(join(tmpdir(), "focus-compare-picker-"));
    try {
      mkdirSync(join(work, "src"));
      const file = join(work, edit.path);
      writeFileSync(file, before);
      for (const inverse of [false, true]) {
        execFileSync("git", ["apply", "-"], {
          cwd: work,
          input: makeSourceTrialPatch([edit], inverse),
          env: isolatedChildEnv(),
        });
        expect(readFileSync(file, "utf8")).toBe(inverse ? before : component);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
