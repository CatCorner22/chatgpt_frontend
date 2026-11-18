# Product features should only disclose real content

18 November 2026. Source and generated-markup review against `04d76cc47a6bab93c7223c09d4c9405075d401d8`; browser access remains unavailable.

## Reproduced issue

The editor allows a feature title without a description. The shared feature filter correctly retains that meaningful title. The Product renderer, however, creates a native `details` element for every retained feature and opens the first row by index. With “Materials included” and an empty description followed by a described feature, the first empty disclosure opens and the actual content remains closed. The same defect reaches the preview, standalone HTML and editable page because they share this renderer.

The first regression exercises the real content editor and generated preview markup: the title is present, but the assertion that it has no disclosure control fails on the baseline. This is a structural reproduction, not an observed keyboard or visual test.

## Source basis and design decision

The [WAI disclosure pattern, About This Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/#about-this-pattern) describes a control paired with content whose visibility it changes. [MDN's details reference, usage notes](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details#usage_notes) explains that activating the summary reveals the remaining content. Both sections were read for this change. Neither source makes empty descriptions invalid owner content; using a noninteractive row for a title alone is Focus's product decision.

Keep titles without descriptions as numbered, visible sections. Use native disclosures only where a nonblank description exists, with the first actual disclosure initially open. Preserve original order, feature IDs, heading fallback, escaped text and destinations. Do not invent a description, drop a useful title, or add JavaScript controls.

The renderer and lightweight launch-artifact builder must share the same description predicate. Only new authored Product pages containing a title-only feature receive the new runtime output revision. Keep prior no-feature revision behavior and all unaffected evidence identities. Changing output invalidates its current review and launch confirmation; it does not alter saved inputs or establish that the new output was tested by the customer.

## Acceptance and limits

Check mixed, all-title, all-description, body-only and whitespace-only content; edit a description into and out of existence; compare preview, HTML and editable CSS; retain unrelated composition output. Verify changed-output review invalidation and unchanged saved-state identity. Inspect the exact production renderer separately from source tests.

Rendered spacing, keyboard interaction, focus, zoom and assistive-technology behavior remain unrun until the supported browser works. Native semantics and source tests do not establish full accessibility or North Star quality.
