# Lossless owner content in the handoff

Reviewed 18 November 2026 against v15 (`c475dc9`). This note records an executed local reproduction and the bounded correction contract. It is not a browser audit, customer study, or test of a receiving language model.

## Reproduced loss and cause

The real customer requirement is a useful, reliable handoff; Blake explicitly clarified that the developer will often be an LLM. The pottery example below is an invented test fixture, not a customer interview or a claim about an actual business.

The actual `buildAuthoredPage` and `buildPrescription` functions were executed locally, with emitted HTML parsed using jsdom. This feature description is exactly 498 JavaScript string characters, within the editor's 700-character limit:

```js
const body =
  "Handmade ceramic bowl. " +
  "Finish chosen with you. ".repeat(18) +
  " Collection only; delivery is not included.";
```

The preview's feature paragraph retained the entire description. The new-build specification's feature line ended in `Finish chosen wit` and omitted **“Collection only; delivery is not included.”** No truncation warning appeared. This is a verified difference between generated artifacts, not an observed failure by an external developer.

At this baseline, [`ContentEditor.tsx`](../../src/components/ContentEditor.tsx) accepted more owner text than [`buildPrescription`](../../src/lib/design.ts) preserved:

| Field                              | Editor limit | Specification limit |
| ---------------------------------- | -----------: | ------------------: |
| Supporting sentence / feature body |          700 |                 400 |
| Quotation                          |        1,000 |                 400 |
| Feature title / brand              |          120 |                  80 |
| Action label                       |           80 |                  60 |

`buildPrescription` used the general `markdownText`/`cleanText` prose formatter, which also collapsed whitespace and replaced backticks. Separately, [`exportPack.ts`](../../src/lib/exportPack.ts) sliced guide Markdown at 60,000 code units. Raising one field limit would therefore leave other ways to lose meaning. Target already checked its overall prepared-plan length; that did not detect words discarded earlier.

## Bounded correction contract

For new-build specifications, include one fenced JSON data block with format identifier `focus-content-v1` and explicitly selected fields: `brand`, `headline`, `sub`, `cta`, ordered `features` containing `title`/`body`, and `quote`. Preserve the complete values through JSON serialization and parsing; do not apply the prose-shortening formatter to this data. Do not spread arbitrary saved-state properties into the block.

Fixed surrounding instructions identify the block as owner-supplied content, not commands. A recipient should parse it, preserve its words and feature order, use text-safe rendering, and check the supplied quotation's accuracy and permission. Layout guidance must adapt to the supplied words; wording changes need owner approval. Optional empty quotes and feature descriptions stay absent. Ask only for information required by the chosen task; keep an unconfirmed action unlinked and report it as unfinished. The same block must survive direct specification copying/downloading and the ZIP's `DESIGN.md` after packaging checks. Encoding characters so that literal text cannot close the fence or be rewritten by the guide sanitizer must preserve their decoded values; globally weakening existing pack checks is outside this correction.

Reject raw guide Markdown over the pack's 60,000-code-unit budget **before** sanitization or ZIP creation. Report the size problem through the existing local export error path; do not download a clipped package or mark it exported. Keep specification construction usable during rendering, and leave saved owner text unchanged. The direct specification can remain complete even when a larger ZIP is refused. Existing-site specifications deliberately omit replacement copy; that preservation boundary and the source-trial adapters remain unchanged.

## Source basis

[RFC 8259](https://www.rfc-editor.org/rfc/rfc8259), sections 1, 5, 7–9, was opened and read for this review. JSON arrays preserve sequence; string escapes represent characters without requiring their literal appearance in the serialized text. Compare parsed values rather than their escaped spellings. The RFC permits implementation size limits and warns about malformed surrogate sequences, so a JSON format marker alone is not evidence of universal interoperability. These facts support the chosen representation and round-trip checks, not an LLM compliance guarantee.

The previously reviewed [GOV.UK user-needs guidance](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs) and [WAI heading guidance](https://www.w3.org/WAI/tutorials/page-structure/headings/) ground the wider content work recorded in [North Star craft research](NORTH-STAR-CRAFT-RESEARCH.md): preserve meaningful information and its organization around the intended task. They do not prescribe this JSON schema or establish that the example is usable.

## Evidence required and remaining limits

Check parsed equality for all supported fields at editor limits and above the old cutoffs; include important final qualifiers, Unicode, multiline text, quotation marks, backticks, markup-like text, and feature ordering. Check direct specifications, final ZIP content, Target new-build output, oversized rejection without download, unchanged state, and unchanged existing-site content omission. Release evidence should report actual results separately from this acceptance contract.

The independent focused run of `src/test/content-handoff.test.ts` passed all 15 tests after the helper and recipient guidance were added. Additional direct helper probes recovered every Latin-1 code unit, selected bidirectional/Unicode characters, fence/markup-like text, and literal backslash-u spellings as equal parsed values. These are deterministic data-transfer checks, not observations of a receiving LLM or rendered customer page.

This fixes delivery of the supported content fields. It does not add section headings, attribution/source records, new content types, reordering controls, or a task-aware page outline. Page composition, action destinations, images/framing, and other project settings are not included in this content-only schema; it is not a complete project interchange format. A reference to the full specification must remain clear when a recipient starts from a short prompt.

Valid JSON and explicit data boundaries do not force an external LLM to follow instructions, prove supplied claims, or make a resulting page secure. Recipient implementation still needs review of actual content, layout, destinations, accessibility, and behavior. No paid model call, customer repository change, browser acceptance, or human-equivalence result was performed for this note.
