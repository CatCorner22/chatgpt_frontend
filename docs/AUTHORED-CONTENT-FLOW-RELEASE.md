# Keep the explanation with the headline

Removing the last feature or service no longer moves the page's supporting sentence below its main action. All five authored compositions now keep that sentence once with its headline. Pages omit absent Details sections and their links, preserve valid actions, and avoid immediately repeating an action at the bottom of a short page. A closing action still appears after real feature details or a supplied quotation.

Missing or rejected destinations lead to actual feature details when those exist. Otherwise the page omits the action; it does not invent a booking button, an empty destination or a jump back to the same introduction. Editor help, readiness messages and the exported README describe that behavior. The existing URL validation and escaping remain intact.

The change follows the role of Focus's **Supporting sentence** field, not a rule that all website actions must follow a paragraph. [Primary guidance](research/AUTHORED-CONTENT-FLOW.md) supports meaningful sequence, descriptive navigation and truthful empty content. No new option is required from the owner. Existing images, framing, font files, design values and saved words are retained.

## Reviews must match the generated output

The investigation also found that launch evidence previously depended only on saved design inputs. A renderer change could therefore leave an earlier page's review attached to different newly generated HTML.

A lightweight runtime output revision now changes the evidence fingerprint only for affected **new authored websites without renderable features**. The renderer and fingerprint use the same trimmed-feature predicate. Existing-app specifications, app output and authored pages with real features keep their previous artifact identity. Saved project state, library content, work hashes, public design IDs and export acknowledgements do not gain a revision field.

On opening an affected design, existing progress logic clears its current reviews, task confirmations and launch approval so it can be reviewed again. This includes stored review text in that current evidence record; no separate review archive is added. Completion dates and unrelated records remain. A pending successful review for the previous output is discarded. A successful current review still records normally. Input preservation and review evidence remain distinct.

## Verification

The full application suite passes **1,250 tests across 105 files**, including 61 new cases. TypeScript and ESLint for all ten changed TypeScript files pass with no errors or warnings. The existing whole-repository lint debt remains documented in the image-framing release; this is not a claim that whole-repository lint is clean.

Before implementation, 35 of 45 new renderer cases failed against the old behavior; seven editor interaction cases and the targeted evidence cases also reproduced their respective gaps. Independent review passed all 61 renderer, editor and evidence tests. It caught a weak stale-response test fixture; the final test uses a complete successful response and a positive control proving that the same response records evidence when current.

Tests cover all five compositions; empty, blank and meaningful features; real, missing and rejected action destinations; supplied quotations; explanation order and uniqueness; fragment targets; real editor add/remove behavior; shared preview/editable source; and affected/unaffected evidence identity. The production bundle, packaging and deployment checks follow the source commit and are recorded in `/workspace/deliverables/focus-content-flow-release.json`. Core logs are `.agent/content-flow-full-tests.log`, `.agent/content-flow-types-final.log` and `.agent/content-flow-scoped-lint.json`.

The supported browser was retried after environment readiness and still could not start. Real layout, keyboard navigation, zoom, assistive-technology and visitor-task acceptance remain unrun for this release. DOM tests and production module checks establish structure and artifact behavior, not visual craft or North Star equivalence. No customer repository or URL has been supplied for a live integration trial. Customer source and deployments were not touched.

## Delivery and recovery

This is authored website output, not a new adapter for modifying existing React or Next.js applications. Preview, standalone HTML and editable source share one renderer. The LLM/human developer handoff still requires actual raw files and separately observed build, browser, task and undo evidence; a recipient's success statement is not proof.

The private code rollback baseline is version 11, source `5bda93a131aa5321b239dbca66d83fc4701670a1`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_eec36f0be2848191839fabd6c651de47`. A code rollback restores the prior renderer and requires its own fresh checks; it does not restore current review records already cleared, reverse customer patches, or change user project content.
