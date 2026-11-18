import { verifyPreparedSourceTrial, type PreparedSourceTrial } from "./source-trial";
import {
  requireSourcePath,
  requireTrial,
  SOURCE_TRIAL_LIMITS,
  SourceTrialError,
} from "./source-trial-model";

export type SourceTrialReturnedFile = { path: string; bytes: Uint8Array };
type FileState = "proposed" | "original" | "different";
export type SourceTrialReturnComparison = {
  state: FileState | "partial";
  files: { path: string; state: FileState; sha256: string }[];
};

const unsafeProposal = "The source trial proposal could not be verified.";
const wrongSelection = "Choose the two files at the exact paths listed in the proposal.";
const oversizedReturn = "A returned file exceeds the byte limit for this proposal.";
const componentLimit = SOURCE_TRIAL_LIMITS.componentBytes;
const stylesheetLimit = SOURCE_TRIAL_LIMITS.stylesheetBytes;
const growthLimit = SOURCE_TRIAL_LIMITS.afterGrowthBytes;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const readArrayKind = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag,
)!.get!;
const readArrayBytes = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength")!.get!;

function requireBoundedProposalShape(value: PreparedSourceTrial) {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  let fields = 0;
  // Two patches and two source snapshots, plus bounded contract and inspection text.
  let textBudget =
    2 * SOURCE_TRIAL_LIMITS.patchBytes + 2 * SOURCE_TRIAL_LIMITS.totalBytes + growthLimit + 32_768;
  while (pending.length) {
    requireTrial(++fields <= 512, unsafeProposal);
    const item = pending.pop();
    if (typeof item === "string") {
      textBudget -= item.length;
      requireTrial(textBudget >= 0, unsafeProposal);
    } else if (item && typeof item === "object" && !seen.has(item)) {
      seen.add(item);
      if (Array.isArray(item)) {
        requireTrial(item.length <= 16, unsafeProposal);
        const keys = Object.keys(item);
        requireTrial(
          keys.length === item.length && keys.every((key, index) => key === String(index)),
          unsafeProposal,
        );
        for (let index = 0; index < item.length; index++) pending.push(item[index]);
      } else {
        const prototype = Object.getPrototypeOf(item);
        requireTrial(prototype === Object.prototype || prototype === null, unsafeProposal);
        const keys = Object.keys(item);
        requireTrial(keys.length <= 24, unsafeProposal);
        for (const key of keys) {
          requireTrial(key.length <= 64, unsafeProposal);
          pending.push((item as Record<string, unknown>)[key]);
        }
      }
    }
  }
}

function snapshotProposal(prepared: PreparedSourceTrial): PreparedSourceTrial {
  const entries = prepared?.contract?.files;
  requireTrial(
    Array.isArray(entries) &&
      entries.length === 2 &&
      Array.isArray(prepared.files) &&
      prepared.files.length === 2 &&
      typeof prepared.patch === "string" &&
      prepared.patch.length <= SOURCE_TRIAL_LIMITS.patchBytes &&
      typeof prepared.inversePatch === "string" &&
      prepared.inversePatch.length <= SOURCE_TRIAL_LIMITS.patchBytes,
    unsafeProposal,
  );

  for (const [index, limit] of [componentLimit, stylesheetLimit].entries()) {
    const entry = entries[index];
    const edit = prepared.files[index];
    const extension = index === 0 ? ".tsx" : ".module.css";
    requireTrial(entry && edit, unsafeProposal);
    requireSourcePath(entry.path);
    requireTrial(
      entry.path.endsWith(extension) &&
        edit.path === entry.path &&
        Number.isSafeInteger(entry.beforeBytes) &&
        entry.beforeBytes > 0 &&
        entry.beforeBytes <= limit &&
        Number.isSafeInteger(entry.afterBytes) &&
        entry.afterBytes > 0 &&
        entry.afterBytes <= limit + growthLimit &&
        typeof edit.before === "string" &&
        edit.before.length <= limit &&
        typeof edit.after === "string" &&
        edit.after.length <= limit + growthLimit,
      unsafeProposal,
    );
  }

  try {
    requireBoundedProposalShape(prepared);
    return structuredClone(prepared);
  } catch {
    throw new SourceTrialError(unsafeProposal);
  }
}

function snapshotReturnedFiles(
  proposal: PreparedSourceTrial,
  files: readonly SourceTrialReturnedFile[],
) {
  requireTrial(Array.isArray(files) && files.length === 2, wrongSelection);
  const returnedByPath = new Map<string, Uint8Array>();
  for (const file of files) {
    requireTrial(
      file &&
        typeof file.path === "string" &&
        file.path.length <= 200 &&
        ArrayBuffer.isView(file.bytes) &&
        readArrayKind.call(file.bytes) === "Uint8Array" &&
        !returnedByPath.has(file.path),
      wrongSelection,
    );
    returnedByPath.set(file.path, file.bytes);
  }
  const ordered = proposal.contract.files.map(({ path, beforeBytes, afterBytes }) => {
    const bytes = returnedByPath.get(path);
    requireTrial(bytes, wrongSelection);
    const size = readArrayBytes.call(bytes) as number;
    requireTrial(size <= Math.max(beforeBytes, afterBytes), oversizedReturn);
    return { path, bytes, size };
  });
  requireTrial(
    ordered[0]!.size + ordered[1]!.size <= SOURCE_TRIAL_LIMITS.totalBytes + growthLimit,
    oversizedReturn,
  );
  try {
    return ordered.map(({ path, bytes, size }) => {
      const snapshot = new Uint8Array(size);
      snapshot.set(bytes);
      return { path, bytes: snapshot };
    });
  } catch {
    throw new SourceTrialError("The returned bytes could not be read.");
  }
}

/** Compare raw returned bytes to this proposal's two snapshots. No returned source is decoded. */
export async function compareSourceTrialReturn(
  prepared: PreparedSourceTrial,
  files: readonly SourceTrialReturnedFile[],
): Promise<SourceTrialReturnComparison> {
  const proposal = snapshotProposal(prepared);
  const selected = snapshotReturnedFiles(proposal, files);
  const subtle = globalThis.crypto?.subtle;
  requireTrial(subtle, "Use a secure browser context to check these returned files.");

  try {
    await verifyPreparedSourceTrial(proposal);
  } catch {
    throw new SourceTrialError(unsafeProposal);
  }

  const compared = await Promise.all(
    selected.map(async ({ path, bytes }, index) => {
      const expected = proposal.contract.files[index]!;
      const digest = await subtle.digest("SHA-256", bytes.buffer);
      const sha256 = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      let state: FileState = "different";
      if (sha256 === expected.afterSha256) state = "proposed";
      else if (sha256 === expected.beforeSha256) state = "original";
      return { path, state, sha256 };
    }),
  );

  let state: SourceTrialReturnComparison["state"] = "partial";
  if (compared.some((file) => file.state === "different")) state = "different";
  else if (compared.every((file) => file.state === "proposed")) state = "proposed";
  else if (compared.every((file) => file.state === "original")) state = "original";
  return { state, files: compared };
}
