import { isolatedChildEnv } from "./isolated-child-env";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contrast, normalizeTokens } from "@/lib/design";
import {
  inspectSourceTrial,
  prepareSourceTrial,
  SourceTrialError,
  verifyPreparedSourceTrial,
  verifySourceTrialSnapshot,
} from "@/lib/source-trial";

const component = `import { useState } from "react";
import styles from "./Booking.module.css";
export default function Booking({ onBook }: { onBook: (email: string) => void }) {
  const [message, setMessage] = useState("");
  // Preserve this instruction from the customer: Do not change the form.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onBook(String(new FormData(event.currentTarget).get("email")));
    setMessage("Booking requested");
  }
  return <main className={styles.page}>
    <h1 className={styles.heading}>Book a consultation</h1>
    <p className={styles.body}>Choose a date with René.</p>
    <form onSubmit={submit}>
      <label>Email address<input required name="email" type="email" /></label>
      <button type="submit" className={styles.action}>Book now</button>
      <div role="status">{message}</div>
    </form>
  </main>;
}`;
const stylesheet = `.page { background-color: #f4f8fa; color: #193d36; }
.heading { color: #193d36; }
.body { color: #355e55; }
.action { background: #193d36; color: #ffffff; padding: 0.5rem; }
.action:focus-visible { outline: 2px solid #193d36; outline-offset: 2px; }`;
const design = {
  id: "vision-original",
  tokens: normalizeTokens({
    bg: "#101820",
    ink: "#ffffff",
    muted: "#b9c4c8",
    accent: "#e05f2d",
    accentInk: "#ffffff",
    headingFont: "Instrument Serif",
    bodyFont: "Instrument Sans",
    radius: 10,
  }),
};
const original = (tsx = component, css = stylesheet) => [
  { path: "src/Booking.tsx", content: tsx },
  { path: "src/Booking.module.css", content: css },
];
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("Target source trial", () => {
  it("identifies the actual owned heading, copy, action and preserved page ground", () => {
    expect(inspectSourceTrial(original())).toEqual({
      componentName: "Booking",
      componentPath: "src/Booking.tsx",
      stylesheetPath: "src/Booking.module.css",
      ground: "#f4f8fa",
      roles: {
        heading: { className: "heading", label: "Book a consultation" },
        body: { className: "body", label: "Choose a date with René." },
        action: { className: "action", label: "Book now", element: "button" },
      },
    });
  });

  it("adds a scoped color/type/shape proposal without changing the page ground or form source", async () => {
    const source = original();
    const trial = await prepareSourceTrial(source, design);
    const [tsx, css] = trial.files;
    expect(tsx.after).toMatch(
      /className=\{styles\.page \+ " " \+ styles\.focusTrial_[a-f0-9]{12}\}/,
    );
    expect(tsx.after.replace(/ \+ " " \+ styles\.focusTrial_[a-f0-9]{12}/, "")).toBe(tsx.before);
    expect(css.after.startsWith(css.before)).toBe(true);
    const added = css.after.slice(css.before.length);
    expect(added.match(/\.focusTrial_[a-f0-9]{12} \.\w+ \{/g)).toHaveLength(3);
    expect(added).not.toContain(".page");
    expect(added).not.toContain("outline");
    expect(trial.contract.effective.ground).toBe("#f4f8fa");
    const { colors, ground } = trial.contract.effective;
    expect(contrast(colors.heading, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.body, ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.actionText, colors.actionBackground)).toBeGreaterThanOrEqual(4.5);
    expect(trial.contract.tasks.every((task) => task.status === "not-run")).toBe(true);
    expect(trial.contract.patchSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(trial.contract.inversePatchSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(trial.changes).toContainEqual({
      role: "heading",
      property: "color",
      before: "#193d36",
      after: colors.heading,
    });
    await expect(verifyPreparedSourceTrial(trial)).resolves.toBeUndefined();
    await expect(prepareSourceTrial([...source].reverse(), design)).resolves.toEqual(trial);
  });

  it.each([
    [
      "shadowed style binding",
      component.replace("return <main", "const styles = fake; return <main"),
      stylesheet,
    ],
    [
      "mutated module",
      component.replace("return <main", "styles.heading = 'unrelated'; return <main"),
      stylesheet,
    ],
    ["component with spread props", component.replace("<h1", "<h1 {...props}"), stylesheet],
    [
      "conditional role",
      component.replace(
        "<h1 className={styles.heading}>Book a consultation</h1>",
        "{ready && <h1 className={styles.heading}>Book a consultation</h1>}",
      ),
      stylesheet,
    ],
    [
      "inline style on an ancestor",
      component
        .replace("<h1 ", "<section style={{background:'red'}}><h1 ")
        .replace("</h1>", "</h1></section>"),
      stylesheet,
    ],
    [
      "wrapper receives a different state ground",
      component,
      stylesheet + ".page:focus-within{background-color:#fff}",
    ],
    [
      "scope class is reused",
      component.replace('<div role="status">', '<div role="status" className={styles.heading}>'),
      stylesheet,
    ],
    ["competing state color", component, stylesheet + ".action:hover {color:#000}"],
    ["inherited state color", component, stylesheet + ".page:hover {color:#000}"],
    ["inherited state font", component, stylesheet + ".page:focus-within {font-family:serif}"],
    ["a different heading ground", component, stylesheet + ".heading {background-color:#000}"],
    ["unsafe stylesheet directive", component, stylesheet + "\n/*# sourceMappingURL=secret.txt */"],
    ["nested rule", component, stylesheet + "\n.body { & .heading {color:#000} }"],
    [
      "local import path mismatch",
      component.replace("./Booking.module.css", "./Wrong.module.css"),
      stylesheet,
    ],
    ["non-opaque wrapper", component, stylesheet.replace("#f4f8fa", "#f4f8fa80")],
    [
      "a wrapper that no longer paints its background",
      component,
      stylesheet + ".page{display:contents}",
    ],
    [
      "a hidden action",
      component.replace('<button type="submit"', '<button hidden type="submit"'),
      stylesheet,
    ],
  ])("refuses %s", (_name, tsx, css) => {
    expect(() => inspectSourceTrial(original(tsx, css))).toThrow(SourceTrialError);
  });

  it("rejects ambiguous source paths, hidden controls and oversized source before parsing", () => {
    const [tsx, css] = original();
    for (const path of [
      "../Booking.tsx",
      "C:/Booking.tsx",
      "src\\Booking.tsx",
      "node_modules/Booking.tsx",
      "src/".repeat(12) + "Booking.tsx",
    ]) {
      expect(() => inspectSourceTrial([{ ...tsx!, path }, css!])).toThrow(SourceTrialError);
    }
    expect(() => inspectSourceTrial(original("\ufeff" + component))).toThrow(SourceTrialError);
    expect(() => inspectSourceTrial(original(component.repeat(600)))).toThrow(SourceTrialError);
    expect(() => inspectSourceTrial(original(component + "\u202e"))).toThrow(SourceTrialError);
  });

  it.each([String.raw`{"\u202eSpoof"}`, "&#x202E;Spoof", String.raw`{"\uD800replacement"}`])(
    "rejects hidden or malformed characters in a decoded JSX role label",
    (label) => {
      const source = component.replace("Book a consultation", label);
      expect(() => inspectSourceTrial(original(source))).toThrow(SourceTrialError);
    },
  );

  it("retains ordinary Unicode and collapses decoded label spacing", () => {
    const source = component.replace("Book a consultation", String.raw`{"Book\n\twith René"}`);
    expect(inspectSourceTrial(original(source)).roles.heading.label).toBe("Book with René");
  });

  it("rejects a multiline or tabbed design ID", async () => {
    for (const id of ["design\nwith newline", "design\twith tab"]) {
      await expect(prepareSourceTrial(original(), { ...design, id })).rejects.toThrow(
        SourceTrialError,
      );
    }
  });

  it("declines a proposal when all directly declared role values already match", async () => {
    const trial = await prepareSourceTrial(original(), design);
    const matched = [
      ".page { background-color: #f4f8fa; color: #193d36; }",
      ...(["heading", "body", "action"] as const).map((role) => {
        const declarations = trial.changes
          .filter((change) => change.role === role)
          .map(({ property, after }) => `${property}: ${after};`)
          .join(" ");
        return `.${trial.inspection.roles[role].className} { ${declarations} }`;
      }),
    ].join("\n");
    await expect(prepareSourceTrial(original(component, matched), design)).rejects.toThrow(
      /already match/,
    );
  });

  it("requires both whole-file preimages and detects a modified proposal", async () => {
    const trial = await prepareSourceTrial(original(), design);
    const after = trial.files.map(({ path, after: content }) => ({ path, content }));
    await expect(verifySourceTrialSnapshot(trial, after, "after")).resolves.toBeUndefined();
    await expect(verifySourceTrialSnapshot(trial, after, "before")).rejects.toThrow(
      SourceTrialError,
    );
    await expect(
      verifySourceTrialSnapshot(trial, [after[0]!, original()[1]!], "after"),
    ).rejects.toThrow(SourceTrialError);
    await expect(
      verifySourceTrialSnapshot(trial, original(component + "\n// Later work"), "before"),
    ).rejects.toThrow(SourceTrialError);
    await expect(
      verifyPreparedSourceTrial({ ...trial, patch: trial.patch + "\nLatter edit" }),
    ).rejects.toThrow(SourceTrialError);
    await expect(
      verifyPreparedSourceTrial({
        ...trial,
        contract: { ...trial.contract, sourceFingerprint: "a".repeat(64) },
      }),
    ).rejects.toThrow(SourceTrialError);
  });

  it("applies and reverses exact Unicode CRLF source without a final newline", async () => {
    const source = original(
      component.replaceAll("\n", "\r\n"),
      stylesheet.replaceAll("\n", "\r\n"),
    );
    const trial = await prepareSourceTrial(source, design);
    const cwd = mkdtempSync(join(tmpdir(), "focus-source-trial-"));
    try {
      mkdirSync(join(cwd, "src"));
      for (const { path, content } of source) writeFileSync(join(cwd, path), content);
      for (const [patch, direction] of [
        [trial.patch, "after"],
        [trial.inversePatch, "before"],
      ] as const) {
        execFileSync("git", ["apply", "--check", "--whitespace=nowarn"], {
          cwd,
          input: patch,
          env: isolatedChildEnv(),
        });
        execFileSync("git", ["apply", "--whitespace=nowarn"], {
          cwd,
          input: patch,
          env: isolatedChildEnv(),
        });
        const actual = source.map(({ path }) => ({
          path,
          content: readFileSync(join(cwd, path), "utf8"),
        }));
        await expect(verifySourceTrialSnapshot(trial, actual, direction)).resolves.toBeUndefined();
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
