# Meaningful Product details and selective reminder rollback

This release corrects two reproduced defects: an authored Product feature could offer an empty expand control, and the standard existing-project pack could instruct a recipient to remove a reminder that predated the trial.

## Product content

A feature with a title and no description now remains a visible, numbered section. Features with real descriptions retain native disclosures; the first actual disclosure starts open even when title-only rows precede it. Feature IDs, order, fallback headings, text escaping and destinations are preserved. No JavaScript or custom disclosure behavior is added.

`hasAuthoredFeatureDescription` is shared by the renderer and the lightweight launch-artifact builder. Only new authored Product pages containing a title-only feature receive `authoredOutputRevision: product-details-v1`. Existing current reviews, task confirmations and launch approval for that changed output reset through the existing progress mechanism. Completion timestamps and unrelated records remain. The earlier no-feature `content-flow-v1` revision is retained. Saved content, page settings, work hashes and public design IDs do not change.

The preview and both page exports use the same renderer. Regression coverage includes editing a description into and out of existence, mixed static/disclosure content, whitespace, escaped owner text, export parity and affected versus unaffected evidence. The [research note](research/AUTHORED-PRODUCT-DISCLOSURES.md) records the source-backed reasoning and reproduction.

## Existing-project reminder

The optional rule-file reminder now leaves every pre-existing or ambiguous reminder untouched, including malformed or duplicate markers. A recipient may instead provide the design guides directly to its coding tool. Adding a fresh reminder requires recording the original file and the exact appended bytes, including separators and any renamed pack path.

Undo permits removal only of this trial's recorded, unchanged insertion with an unambiguous marker pair. Missing records, later edits or ambiguous markers require manual review against the backup. Later unrelated work must remain. The shared preservation rules and ADD, START, PRESERVE and UNDO guides agree. These are recipient instructions; Focus cannot enforce an external LLM's subsequent behavior.

The real-ZIP regression reproduces the old update/remove conflict and checks preservation of pre-existing reminders, later edits and unrelated work. It uses owned local fixtures, not a customer's application or rule files.

## Evidence and limits

Product and rollback regressions failed before their respective fixes. The full application suite passes 1,267 tests across 107 files; TypeScript passes, and repository lint passes with zero errors and eleven existing warnings. An independent source-renderer comparison retains exact output for 28 unaffected cases and changes only the two affected Product cases. The exact-commit build, production-renderer comparison and live publication checks are recorded separately in the release receipt under `/workspace/deliverables` and local `.agent` evidence. A separately prepared LLM recipient rehearsal is reported only after its results are observed.

The supported browser remains unavailable. Real rendered spacing, keyboard interaction, zoom, assistive-technology behavior and customer acceptance remain unrun. Static markup, source tests and an owned recipient rehearsal do not establish zero defects or North Star equivalence. Next.js source trials remain on the developer-guided path.
