import { contrast, normalizeTokens, HEADING_FONTS, BODY_FONTS, type Tokens } from "./design";
import { fixContrast } from "./engine";
import { fontStack } from "./fonts";
import { analyzeSourceTrial, validateEditedSyntax } from "./source-trial-analysis";
import { makeSourceTrialPatch } from "./source-trial-diff";
import {
  hashText,
  readSourcePair,
  requireDesignId,
  requireTrial,
  SOURCE_TRIAL_LIMITS,
  trialMarker,
  utf8,
  type PreparedSourceTrial,
  type SourceTrialChange,
  type SourceTrialContract,
  type SourceTrialEdit,
  type SourceTrialFile,
  type SourceTrialInspection,
} from "./source-trial-model";

export { SOURCE_TRIAL_LIMITS, SourceTrialError } from "./source-trial-model";
export type {
  PreparedSourceTrial,
  SourceTrialChange,
  SourceTrialContract,
  SourceTrialFile,
  SourceTrialInspection,
} from "./source-trial-model";

type Analysis = ReturnType<typeof analyzeSourceTrial>;
type Effective = SourceTrialContract["effective"];
type Design = SourceTrialContract["design"];
const sha256 = /^[a-f0-9]{64}$/;
const opaqueHex = /^#[a-f0-9]{6}$/;
const changedProperties = () => ({
  heading: ["color", "font-family"],
  body: ["color", "font-family"],
  action: ["background-color", "color", "font-family", "border-radius"],
});

function describeEffective(tokens: Tokens, ground: string): Effective {
  const fixed = fixContrast({ ...tokens, bg: ground });
  return {
    ground,
    colors: {
      heading: fixed.ink.toLowerCase(),
      body: fixed.muted.toLowerCase(),
      actionText: fixed.accentInk.toLowerCase(),
      actionBackground: fixed.accent.toLowerCase(),
    },
    headingFont: fixed.headingFont,
    bodyFont: fixed.bodyFont,
    buttonRadius: fixed.buttonStyle === "pill" ? 999 : fixed.radius,
    changedProperties: changedProperties(),
  };
}

function unpackEffective(effective: Effective, ground: string): Effective {
  const { colors } = effective;
  requireTrial(
    effective.ground === ground &&
      colors &&
      [colors.heading, colors.body, colors.actionText, colors.actionBackground].every(
        (color) => typeof color === "string" && opaqueHex.test(color),
      ) &&
      HEADING_FONTS.some((font) => font === effective.headingFont) &&
      BODY_FONTS.some((font) => font === effective.bodyFont) &&
      Number.isInteger(effective.buttonRadius) &&
      ((effective.buttonRadius >= 0 && effective.buttonRadius <= 28) ||
        effective.buttonRadius === 999) &&
      contrast(colors.heading, ground) >= 4.5 &&
      contrast(colors.body, ground) >= 4.5 &&
      contrast(colors.actionText, colors.actionBackground) >= 4.5,
    "The proposed styles no longer match a supported, readable trial.",
  );
  return {
    ground,
    colors: {
      heading: colors.heading,
      body: colors.body,
      actionText: colors.actionText,
      actionBackground: colors.actionBackground,
    },
    headingFont: effective.headingFont,
    bodyFont: effective.bodyFont,
    buttonRadius: effective.buttonRadius,
    changedProperties: changedProperties(),
  };
}

function resolveChanges(analysis: Analysis, effective: Effective): SourceTrialChange[] {
  const local = {
    heading: { color: effective.colors.heading, "font-family": fontStack(effective.headingFont) },
    body: { color: effective.colors.body, "font-family": fontStack(effective.bodyFont) },
    action: {
      "background-color": effective.colors.actionBackground,
      color: effective.colors.actionText,
      "font-family": fontStack(effective.bodyFont),
      "border-radius": `${effective.buttonRadius}px`,
    },
  };
  return (["heading", "body", "action"] as const).flatMap((role) => {
    const className = analysis.inspection.roles[role].className;
    const declarations = (analysis.styles.get(className) ?? [])
      .filter(({ state }) => !state)
      .reverse();
    return Object.entries(local[role]).map(([property, after]) => {
      // A shorthand declaration makes the specific previous value uncertain.
      const last = declarations.find(
        (declaration) =>
          declaration.property === property ||
          (property === "font-family" && declaration.property === "font") ||
          (property === "background-color" && declaration.property === "background") ||
          (property === "border-radius" &&
            declaration.property.startsWith("border-") &&
            declaration.property.endsWith("radius")),
      );
      return {
        role,
        property,
        before: last?.property === property && last.value.length <= 400 ? last.value : null,
        after,
      };
    });
  });
}

function editSources(
  analysis: Analysis,
  marker: string,
  changes: SourceTrialChange[],
): [SourceTrialEdit, SourceTrialEdit] {
  const { component, stylesheet, wrapperClassEnd, inspection } = analysis;
  requireTrial(trialMarker.test(marker), "The proposed trial marker is unreadable.");
  // A literal scope marker needs no new CSS-module export or generated .d.ts
  // entry. Keep the customer's existing role classes local to their module.
  const suffix = ` + " ${marker}"`;
  const afterComponent =
    component.content.slice(0, wrapperClassEnd) + suffix + component.content.slice(wrapperClassEnd);
  const eol = stylesheet.content.match(/\r?\n/)?.[0] ?? "\n";
  const rules = (["heading", "body", "action"] as const).map((role) =>
    [
      `:global(.${marker}) .${inspection.roles[role].className} {`,
      ...changes
        .filter((change) => change.role === role)
        .map(({ property, after }) => `  ${property}: ${after};`),
      "}",
    ].join(eol),
  );
  const added = `${stylesheet.content.endsWith("\n") ? "" : eol}${eol}/* Focus source trial */${eol}${rules.join(eol)}${eol}`;
  const afterStylesheet = stylesheet.content + added;
  requireTrial(
    utf8(suffix).length + utf8(added).length <= SOURCE_TRIAL_LIMITS.afterGrowthBytes,
    "The proposed changes exceed the source trial’s size limit.",
  );
  return [
    { path: component.path, before: component.content, after: afterComponent },
    { path: stylesheet.path, before: stylesheet.content, after: afterStylesheet },
  ];
}

function taskRows(action: "a" | "button"): SourceTrialContract["tasks"] {
  return [
    {
      id: "visual-and-keyboard",
      expected:
        "Review role styling, readable text, reflow and visible keyboard focus at phone and desktop widths.",
      status: "not-run",
    },
    {
      id: "primary-action",
      expected:
        action === "a"
          ? "Open the original link and confirm the intended destination and interaction."
          : "Run the original form task with test data and confirm both success and error or retry behavior.",
      status: "not-run",
    },
    {
      id: "selective-undo",
      expected:
        "Verify both resulting files, reverse just the trial, and confirm the original files and task.",
      status: "not-run",
    },
  ];
}

async function fingerprintSource(files: readonly SourceTrialFile[]): Promise<string> {
  const entries = await Promise.all(
    files.map(async ({ path, content }) => [path, await hashText(content)]),
  );
  return hashText(JSON.stringify(entries));
}

async function trialFiles(
  edits: [SourceTrialEdit, SourceTrialEdit],
): Promise<SourceTrialContract["files"]> {
  async function describe({ path, before, after }: SourceTrialEdit) {
    const [beforeSha256, afterSha256] = await Promise.all([hashText(before), hashText(after)]);
    return {
      path,
      beforeBytes: utf8(before).length,
      afterBytes: utf8(after).length,
      beforeSha256,
      afterSha256,
    };
  }
  return Promise.all([describe(edits[0]), describe(edits[1])]);
}

async function materialize(
  analysis: Analysis,
  design: Design,
  sourceFingerprint: string,
  effective: Effective,
): Promise<PreparedSourceTrial> {
  const { inspection } = analysis;
  const seed = await hashText(JSON.stringify([design.id, design.fingerprint, sourceFingerprint]));
  const changes = resolveChanges(analysis, effective);
  requireTrial(
    changes.some(({ before, after }) => before !== after),
    "The selected role declarations already match these visual choices.",
  );
  const files = editSources(analysis, `focusTrial_${seed.slice(0, 12)}`, changes);
  validateEditedSyntax(files[0].after, files[1].after);
  const patch = makeSourceTrialPatch(files);
  const inversePatch = makeSourceTrialPatch(files, true);
  requireTrial(
    [patch, inversePatch].every((item) => utf8(item).length <= SOURCE_TRIAL_LIMITS.patchBytes),
    "The proposed patches exceed the source trial’s size limit.",
  );
  const [fileRecords, patchSha256, inversePatchSha256] = await Promise.all([
    trialFiles(files),
    hashText(patch),
    hashText(inversePatch),
  ]);
  return {
    inspection,
    patch,
    inversePatch,
    files,
    changes,
    contract: {
      version: 1,
      adapter: "react-vite-css-module-v1",
      status: "static-checks-complete",
      design,
      sourceFingerprint,
      files: fileRecords,
      patchSha256,
      inversePatchSha256,
      inspection,
      effective,
      limits: [
        "React with Vite is owner-declared. This check covers only the two selected files.",
        "The page background and base wrapper styles stay in place. Fonts use installed faces and system fallbacks.",
        "The surrounding CSS cascade, layout, behavior, production integrations and rendered accessibility still need review.",
      ],
      tasks: taskRows(inspection.roles.action.element),
    },
  };
}

export function inspectSourceTrial(files: readonly SourceTrialFile[]): SourceTrialInspection {
  return analyzeSourceTrial(files).inspection;
}

/** This adapter writes a filled action surface; never substitute it for another treatment. */
export function sourceTrialActionIssue(tokens: Pick<Tokens, "buttonStyle">): string | null {
  return tokens.buttonStyle === "solid" || tokens.buttonStyle === "pill"
    ? null
    : "This source-change trial supports filled and pill actions only. Your selected action treatment has not been changed. Keep it and use the design pack for developer-guided integration, or deliberately choose a filled or pill action in Buttons and corners before preparing a source trial.";
}

export async function prepareSourceTrial(
  files: readonly SourceTrialFile[],
  design: { id: string; tokens: Tokens },
): Promise<PreparedSourceTrial> {
  const id = design.id;
  requireDesignId(id);
  const tokens = normalizeTokens(design.tokens);
  const actionIssue = sourceTrialActionIssue(tokens);
  requireTrial(!actionIssue, actionIssue ?? "Unsupported action treatment.");
  const source = readSourcePair(files).map(({ path, content }) => ({ path, content }));
  const analysis = analyzeSourceTrial(source);
  const [fingerprint, sourceFingerprint] = await Promise.all([
    hashText(JSON.stringify(tokens)),
    fingerprintSource(source),
  ]);
  return materialize(
    analysis,
    { id, fingerprint },
    sourceFingerprint,
    describeEffective(tokens, analysis.inspection.ground),
  );
}

async function checkPrepared(candidate: PreparedSourceTrial): Promise<PreparedSourceTrial> {
  requireTrial(
    candidate &&
      Array.isArray(candidate.files) &&
      candidate.files.length === 2 &&
      typeof candidate.patch === "string" &&
      candidate.patch.length <= SOURCE_TRIAL_LIMITS.patchBytes &&
      typeof candidate.inversePatch === "string" &&
      candidate.inversePatch.length <= SOURCE_TRIAL_LIMITS.patchBytes &&
      candidate.contract?.design &&
      candidate.contract.effective,
    "The prepared source trial is incomplete.",
  );
  const originals = readSourcePair(
    candidate.files.map(({ path, before }) => ({ path, content: before })),
  );
  readSourcePair(
    candidate.files.map(({ path, after }) => ({ path, content: after })),
    true,
  );
  const stored = JSON.stringify(candidate);
  const analysis = analyzeSourceTrial(originals);
  const { id, fingerprint } = candidate.contract.design;
  requireDesignId(id);
  requireTrial(
    typeof fingerprint === "string" && sha256.test(fingerprint),
    "The trial’s design fingerprint is unreadable.",
  );
  const effective = unpackEffective(candidate.contract.effective, analysis.inspection.ground);
  const sourceFingerprint = await fingerprintSource(originals);
  const expected = await materialize(analysis, { id, fingerprint }, sourceFingerprint, effective);
  requireTrial(
    stored === JSON.stringify(expected),
    "The prepared trial or its file hashes changed. Prepare it again before downloading.",
  );
  return expected;
}

export async function verifyPreparedSourceTrial(prepared: PreparedSourceTrial): Promise<void> {
  await checkPrepared(prepared);
}

/** Verify the two whole files together. This does not apply or write either file. */
export async function verifySourceTrialSnapshot(
  prepared: PreparedSourceTrial,
  files: readonly SourceTrialFile[],
  direction: "before" | "after",
): Promise<void> {
  requireTrial(
    direction === "before" || direction === "after",
    "Select a valid verification direction.",
  );
  const selected = readSourcePair(files, direction === "after").map(({ path, content }) => ({
    path,
    content,
  }));
  const [trial, hashes] = await Promise.all([
    checkPrepared(prepared),
    Promise.all(selected.map(({ content }) => hashText(content))),
  ]);
  const matching = trial.contract.files.every((entry, index) => {
    const expected = direction === "before" ? entry.beforeSha256 : entry.afterSha256;
    return entry.path === selected[index]!.path && hashes[index] === expected;
  });
  requireTrial(
    matching,
    "Both source files must match the chosen trial state. A file changed, is missing or has already been patched.",
  );
}
