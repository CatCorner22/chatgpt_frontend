export const SOURCE_TRIAL_LIMITS = {
  componentBytes: 128 * 1024,
  stylesheetBytes: 64 * 1024,
  totalBytes: 192 * 1024,
  patchBytes: 512 * 1024,
  afterGrowthBytes: 2048,
  v2AfterGrowthBytes: 8192,
} as const;

export class SourceTrialError extends Error {
  override name = "SourceTrialError";
}

export type SourceTrialFile = { path: string; content: string };
type Role = { className: string; label: string };
export type SourceTrialInspection = {
  componentName: string;
  componentPath: string;
  stylesheetPath: string;
  ground: string;
  roles: { heading: Role; body: Role; action: Role & { element: "a" | "button" } };
};

export type SourceTrialOptions = {
  typography: "preserve" | "portable";
  bookingLayout: "compact" | "compare";
};
export type SourceTrialAsset = { path: string; bytes: number; sha256: string };
export type SourceTrialContract = (
  | { version: 1; adapter: "react-vite-css-module-v1" }
  | ({
      version: 2;
      adapter: "react-vite-css-module-v2";
      assets: SourceTrialAsset[];
    } & SourceTrialOptions)
) & {
  status: "static-checks-complete";
  design: { id: string; fingerprint: string };
  sourceFingerprint: string;
  files: [ContractFile, ContractFile];
  patchSha256: string;
  inversePatchSha256: string;
  inspection: SourceTrialInspection;
  effective: {
    ground: string;
    colors: { heading: string; body: string; actionText: string; actionBackground: string };
    headingFont: string;
    bodyFont: string;
    buttonRadius: number;
    changedProperties: { heading: string[]; body: string[]; action: string[] };
  };
  limits: string[];
  tasks: { id: string; expected: string; status: "not-run" }[];
};

type ContractFile = {
  path: string;
  beforeBytes: number;
  afterBytes: number;
  beforeSha256: string;
  afterSha256: string;
};

export type SourceTrialEdit = { path: string; before: string; after: string };
export type SourceTrialChange = {
  role: "heading" | "body" | "action";
  property: string;
  before: string | null;
  after: string;
};
export type PreparedSourceTrial = {
  inspection: SourceTrialInspection;
  patch: string;
  inversePatch: string;
  contract: SourceTrialContract;
  files: [SourceTrialEdit, SourceTrialEdit];
  changes: SourceTrialChange[];
};

export function requireTrial(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SourceTrialError(message);
}

// Source must round-trip through UTF-8 without hidden controls.
const hidden =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069\ufeff\ud800-\udfff]|\r(?!\n)/u;
export const hasHiddenSourceText = (value: string) => hidden.test(value);
const safeSegment = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/;
const reservedDevice = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const excludedSegments = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  "vendor",
  "secrets",
]);
export const classIdentifier = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const trialMarker = /^focusTrial_[a-f0-9]{12}$/;

export function requireSourcePath(path: unknown): asserts path is string {
  requireTrial(
    typeof path === "string" &&
      path.length <= 200 &&
      path.split("/").length <= 12 &&
      path
        .split("/")
        .every(
          (segment) =>
            safeSegment.test(segment) &&
            !segment.endsWith(".") &&
            !reservedDevice.test(segment) &&
            !excludedSegments.has(segment.toLowerCase()),
        ),
    "Enter the exact repository-relative file paths with ordinary letters, numbers, dots, dashes, or underscores.",
  );
}

export const utf8 = (source: string) => new TextEncoder().encode(source);

export function trialGrowthLimit(version: SourceTrialContract["version"]) {
  return version === 2
    ? SOURCE_TRIAL_LIMITS.v2AfterGrowthBytes
    : SOURCE_TRIAL_LIMITS.afterGrowthBytes;
}

export function readSourcePair(
  files: readonly SourceTrialFile[],
  afterVersion?: SourceTrialContract["version"],
): [SourceTrialFile, SourceTrialFile] {
  requireTrial(
    Array.isArray(files) && files.length === 2,
    "Choose one TSX page and its matching CSS module.",
  );
  for (const file of files) {
    requireTrial(file && typeof file === "object", "Choose two readable source files.");
    requireSourcePath(file.path);
  }
  const component = files.find((file) => file.path.endsWith(".tsx"));
  const stylesheet = files.find((file) => file.path.endsWith(".module.css"));
  requireTrial(component && stylesheet, "Choose a .tsx page and a .module.css file.");
  const growth = afterVersion ? trialGrowthLimit(afterVersion) : 0;
  const validate = (file: SourceTrialFile, limit: number) => {
    requireTrial(
      typeof file.content === "string" && file.content.length > 0 && file.content.length <= limit,
      "One of the selected source files is empty or too large.",
    );
    requireTrial(
      !hidden.test(file.content),
      "The selected source contains hidden or invalid text.",
    );
    const size = utf8(file.content).length;
    requireTrial(size <= limit, "One of the selected source files exceeds the byte limit.");
    return size;
  };
  const total =
    validate(component, SOURCE_TRIAL_LIMITS.componentBytes + growth) +
    validate(stylesheet, SOURCE_TRIAL_LIMITS.stylesheetBytes + growth);
  requireTrial(
    total <= SOURCE_TRIAL_LIMITS.totalBytes + growth,
    "The source selection is too large.",
  );
  return [component, stylesheet];
}

export function requireDesignId(id: unknown): asserts id is string {
  requireTrial(
    typeof id === "string" &&
      id.length > 0 &&
      id.length <= 200 &&
      id.trim() === id &&
      !id.includes("\n") &&
      !id.includes("\t") &&
      !hidden.test(id),
    "Select a valid saved design for the source trial.",
  );
}

export async function hashBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  requireTrial(globalThis.crypto?.subtle, "Use a secure browser context to prepare this trial.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hashText(text: string): Promise<string> {
  return hashBytes(utf8(text));
}
