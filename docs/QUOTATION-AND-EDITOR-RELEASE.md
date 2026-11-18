# Preserve quoted text and keep editing focus predictable

The authored renderer previously removed leading and trailing quotation marks independently, then added a curly pair. That could corrupt a customer's actual words: `She said "welcome"` became `“She said "welcome”`. The content editor also left focus without an explicit destination when controls added or removed fields.

## Quotation text

Authored pages now trim surrounding whitespace and HTML-escape the supplied text inside the existing semantic blockquote. They do not strip, balance or add punctuation. Existing typography and spacing stay intact. Punctuation-only input remains literal; whitespace-only input stays omitted. Internal spaces and newlines remain in the generated source, while normal HTML parsing and whitespace layout still apply.

The lightweight `getAuthoredQuote` helper supplies the renderer's text and presence checks. The separate compatibility predicate compares that text with the exact v14 output solely to determine review invalidation. It never supplies new rendered content.

For affected new authored pages, `buildStudioLaunchArtifact` adds `authoredQuoteRevision: quote-text-v1` independently of the earlier content-flow and Product-detail revisions. Current reviews, task confirmations and launch approval reset through the existing progress mechanism. Unchanged quotation output, existing-project/app artifacts, saved content, page settings, work hashes and public design IDs retain their prior behavior. Completion timestamps and unrelated progress records remain.

## Editor continuity

For an accepted editing action, Add focuses the new feature title. Remove focuses the next remaining title, otherwise the previous title, otherwise Add a feature. Remove quote returns focus to the quotation textarea. The eight-feature limit and owner-controlled content model remain intact.

A transient request records the intended content update and initiating control. It is cancelled by a different update, ordinary typing, superseding key/pointer/focus intent, window blur, closing or unmounting. A cloned accepted value works. A new baseline-value object conservatively cancels the request; the same unchanged baseline object may wait for a delayed acceptance. No content state or saved schema is duplicated.

The existing `onChange: void` interface has no explicit acceptance token. It cannot distinguish delayed acceptance from a later identical external update when there is no intervening signal. These guards limit focus movement; they do not establish a new owner identity or transaction protocol. Native browser focus and visible focus behavior still need real-browser verification.

## Verification and boundaries

The quotation regressions failed before the fix in all five compositions. Focus regressions also failed before the editor change. Focused tests cover accepted and rejected updates, first/middle/last/only removals, Add at the eight-feature limit, quote removal, ordinary typing, multiple editor instances, superseded requests and unmounting. Independent source comparisons check quoted-text changes against the compatibility predicate and preservation of earlier output revisions.

The complete application suite passes 1,315 tests across 109 files. TypeScript passes; repository lint passes with zero errors and eleven existing warnings. Exact-commit production-renderer, initial asset-loading and live-publication results are recorded separately in `/workspace/deliverables` and local `.agent` release evidence. The [research note](research/QUOTATION-AND-EDITOR-CONTINUITY.md) records the primary references and scope.

The supported browser still fails during initialization. DOM focus assertions do not establish actual Tab order, focus visibility, assistive-technology behavior or customer task success. No customer application or source was changed, and Focus dependencies and permissions remain unchanged. This release does not establish North Star equivalence or zero defects.
