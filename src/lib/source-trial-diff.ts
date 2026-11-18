import type { SourceTrialEdit } from "./source-trial-model";

const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

function patchLine(prefix: string, value: string): string {
  return value.endsWith("\n")
    ? prefix + value
    : prefix + value + "\n\\ No newline at end of file\n";
}

/** One bounded hunk per file. Retain CRLF and Git's explicit no-final-newline markers. */
function makeHunk(path: string, oldText: string, newText: string): string {
  const before = lines(oldText);
  const after = lines(newText);
  let prefix = 0;
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++;

  const first = Math.max(0, prefix - 3);
  const lead = before.slice(first, prefix);
  const oldChanges = before.slice(prefix, before.length - suffix);
  const newChanges = after.slice(prefix, after.length - suffix);
  const tail = before.slice(before.length - suffix, before.length - suffix + Math.min(suffix, 3));
  const oldCount = lead.length + oldChanges.length + tail.length;
  const newCount = lead.length + newChanges.length + tail.length;
  return (
    `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n` +
    `@@ -${first + Number(oldCount > 0)},${oldCount} +${first + Number(newCount > 0)},${newCount} @@\n` +
    lead.map((line) => patchLine(" ", line)).join("") +
    oldChanges.map((line) => patchLine("-", line)).join("") +
    newChanges.map((line) => patchLine("+", line)).join("") +
    tail.map((line) => patchLine(" ", line)).join("")
  );
}

export function makeSourceTrialPatch(edits: readonly SourceTrialEdit[], inverse = false): string {
  return edits
    .map(({ path, before, after }) =>
      makeHunk(path, inverse ? after : before, inverse ? before : after),
    )
    .join("");
}
