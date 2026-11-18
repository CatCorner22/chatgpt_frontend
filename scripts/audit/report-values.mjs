const STATUSES = new Set(["fails", "holds", "not-applicable", "could-not-measure"]);
const TEXT_FIELDS = { where: 500, measured: 1000, required: 1000, fix: 1000 };
const MAX_FINDINGS = 80;

/**
 * Bounds structural report values. This is not a semantic instruction filter:
 * the returned text remains untrusted page data, even when it reads like a command.
 * Only primitives are converted, so object-provided coercion methods never run.
 */
export function safeReportText(value, max = 500) {
  if (!Number.isSafeInteger(max) || max < 0)
    throw new RangeError("Text maximum must be a nonnegative safe integer.");
  const raw =
    typeof value === "string"
      ? value
      : ["number", "boolean", "bigint"].includes(typeof value)
        ? String(value)
        : "";
  const line = raw
    .replace(/[\r\n\t\v\f\u0085\u2028\u2029]+/gu, " ")
    .replace(/[\p{Cc}\p{Cf}\u034f\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const bounded = line.slice(0, max);
  // A size limit must not leave half of an astral character at the boundary.
  return /[\uD800-\uDBFF]$/.test(bounded) ? bounded.slice(0, -1) : bounded;
}

function trustedRuleId(value) {
  if (
    typeof value !== "string" ||
    value.length > 120 ||
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
  ) {
    throw new Error("A stable trusted rule ID is required.");
  }
  return value;
}

const unknown = (ruleId, measured) => ({ ruleId, status: "could-not-measure", measured });

/** Uses the caller's registered checker identity, never a page-returned identity. */
export function normalizeFinding(input, expectedRuleId) {
  const ruleId = trustedRuleId(expectedRuleId);
  if (!input || typeof input !== "object" || Array.isArray(input))
    return unknown(ruleId, "The check returned an invalid finding record.");
  const status = Object.getOwnPropertyDescriptor(input, "status");
  if (!status || !("value" in status) || !STATUSES.has(status.value))
    return unknown(ruleId, "The check returned an invalid finding status.");
  const result = { ruleId, status: status.value };
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (!descriptor) continue;
    if (
      !("value" in descriptor) ||
      (descriptor.value !== undefined && typeof descriptor.value !== "string")
    ) {
      return unknown(ruleId, "The check returned a finding with an invalid text field.");
    }
    if (descriptor.value !== undefined) result[field] = safeReportText(descriptor.value, max);
  }
  return result;
}

/** A missing or truncated result stays visible as a measurement gap. */
export function sanitizeFindings(input, expectedRuleId) {
  const ruleId = trustedRuleId(expectedRuleId);
  if (!Array.isArray(input) || input.length === 0)
    return [unknown(ruleId, "The check returned no valid finding list.")];
  const result = Array.from(input.slice(0, MAX_FINDINGS), (value) =>
    normalizeFinding(value, ruleId),
  );
  if (input.length > MAX_FINDINGS)
    result.push(
      unknown(
        ruleId,
        `The check returned ${input.length} findings; only the first ${MAX_FINDINGS} were retained.`,
      ),
    );
  return result;
}
