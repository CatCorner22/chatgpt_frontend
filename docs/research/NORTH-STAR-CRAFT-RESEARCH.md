# Operational craft rules for the North Star

**Sources inspected: 18 November 2026 (UTC).** This is public-source research and a read-only review of the current implementation. No browser acceptance run, customer trial, independent quality rating, or human-equivalence result was performed for this document.

The North Star remains frontend UI and UX as good as the best human coders. The useful gap is not a missing collection of effects. It is the work needed to turn a design into a coherent, faithfully delivered experience: task and content decisions, adaptation to actual conditions, complete behavior, and correction based on observation.

## What the current source establishes

The [North Star review](../NORTH-STAR-REVIEW.md) already identifies these gaps. At the research baseline (v7), the [content model](../../src/lib/design.ts) contained a headline, subhead, CTA, feature pairs, and a quotation. [Page settings](../../src/lib/page-settings.ts) allowed one image and no separate mobile crop. The [authored renderer](../../src/lib/authored-page.ts) was shared by preview and export, but relied on installed fonts or local fallbacks. Its output was a static page with links and native disclosures, not a complete customer application. [Stratosphere](../../src/lib/stratosphere.ts) distinguished configured choices from verified behavior. The subsequent [portable typography implementation](../PORTABLE-TYPOGRAPHY-RELEASE.md) addresses the specific font-delivery gap for six families; the acceptance criteria below remain the standard for rendered verification.

These are useful foundations. The rules below describe concrete additions and acceptance criteria; they do not imply that every existing feature is absent or defective.

## Seven operational rules

### 1. Organize the page around a task and the information needed to complete it

**Source basis — research guidance and semantic structure.** GOV.UK recommends learning what actual or likely users need and treating unsupported suggestions as assumptions. WAI explains how headings communicate content organization. [Learning about users and their needs](https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs); [Headings](https://www.w3.org/WAI/tutorials/page-structure/headings/).

**Implementation decision.** Add an explicit primary task and an ordered content outline to a new-page brief. Each section has a purpose, actual content, and a relationship to the next action. Distinguish owner-supplied facts from placeholders. In an existing-app restyle, preserve current structure and record proposed structural changes separately.

**Acceptance criterion.** Using the same real content, inspect the heading outline, DOM reading order, and action destination. Every required detail remains present; placeholder claims are flagged before handoff. A reviewer can trace why each section is needed. Task success requires a separate observed trial.

### 2. Preserve reading order and function when the available space changes

**Source basis — accessibility requirement.** WCAG 2.2 SC 1.4.10 addresses reflow without loss of information or functionality at the specified equivalent viewport sizes, with exceptions for content requiring two-dimensional layout. For vertically scrolling content, the reference width is 320 CSS pixels. [Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

**Implementation decision.** Define a meaningful single-column order before arranging wider layouts. Allow content-driven wrapping, and avoid fixed heights that clip text. Keep necessary two-dimensional comparisons in a deliberate region rather than forcing the entire page to scroll sideways.

**Acceptance criterion.** Run the delivered page at 320 CSS pixels and at 400% zoom from a 1280-CSS-pixel-wide viewport. Required content and controls remain readable and operable. Record any justified two-dimensional exception. Test around each layout breakpoint; the keyboard sequence must still match the task.

### 3. Make image crops an explicit content decision

**Source basis — browser capabilities and implementation guidance.** `srcset` supports alternate resolutions of an image; `<picture>` can select a different crop or source for a context. Its shared alternative text must remain accurate across the selected images. [The picture element](https://web.dev/learn/design/picture-element).

**Implementation decision.** Extend the existing single-image model with an optional narrow-screen crop or focal point, preserving the original. Use the same assets and crop rules in preview and export. Choose imagery because it explains the offering or demonstrates real work; do not fabricate proof or testimonials.

**Acceptance criterion.** At wide and narrow widths, inspect the exported image and confirm the intended subject remains visible. Verify source selection, aspect ratios, alternative text, and asset presence in the ZIP. Missing crop data uses a documented fallback. Whether a crop is evocative or elegant remains an editorial judgment, not a computed pass.

### 4. Deliver the chosen typography as an asset, not just a family name

**Source basis — font behavior and licensing.** Web fonts need usable font resources; delivery and `font-display` affect rendering and substitution. OFL redistribution has conditions, including accompanying copyright and license information. [Optimize web fonts](https://web.dev/learn/performance/optimize-web-fonts); [MDN: font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/font-display); [Official SIL Open Font License](https://openfontlicense.org/open-font-license-official-text/).

**Implementation decision.** Package verified, licensed WOFF2 assets for a bounded set of supported font choices. Share the font manifest between preview and exports. Set an explicit display strategy and readable fallback. Include required weights and language coverage; avoid indiscriminate preloading.

**Acceptance criterion.** On a clean recipient environment without the selected fonts installed, verify the actual rendered families and weights. With external requests blocked, the package still supplies its promised fonts. When a font deliberately fails, text remains readable. Inspect wrapping and layout shifts during loading; a family-name string alone is insufficient evidence.

### 5. Specify successful, waiting, empty, and unsuccessful states before calling an interaction complete

**Source basis — feedback guidance and accessibility requirement.** WAI recommends understandable submission feedback and correction instructions. SC 4.1.3 addresses programmatically determinable status messages, including waiting, results, and errors, when they do not receive focus or change context. [User Notification](https://www.w3.org/WAI/tutorials/forms/notifications/); [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Implementation decision.** For each real customer action, define the request, pending state, success condition, failure recovery, and relevant empty state. Preserve useful input after recoverable failures. Use native controls and appropriate status semantics. Keep the local interaction demo explicitly separate from implemented customer behavior.

**Acceptance criterion.** In the actual build, exercise a successful task, invalid input, an unsuccessful request, and retry. Confirm no early success message, accidental duplicate operation, or unnecessary loss of answers. Test keyboard focus and status announcements with assistive technology. Static markup cannot demonstrate that these transitions work.

### 6. Reserve space and load assets according to their role

**Source basis — browser behavior and performance guidance.** Image dimensions or aspect-ratio information reserve space before decoding. Native lazy loading can defer off-screen images; loading priority is a separate concern from visual crop selection. [Images: performance features and aspect ratio](https://web.dev/learn/html/images).

**Implementation decision.** Preserve explicit image geometry when adding responsive media. Load the initial informative hero without lazy loading; defer appropriate later images. Keep a declared asset budget for each output profile and include only resources actually used by that page.

**Acceptance criterion.** With cache cleared and a documented network profile, record requests and layout movement. Images must not displace the main action when they appear; the hero must not wait for scrolling. Inspect broken-image and delayed-asset behavior. Record measured transfer sizes and timing instead of asserting that a particular format or attribute guarantees speed.

### 7. Review the delivered task, repair the observed problem, then repeat the relevant check

**Source basis — usability research method.** Moderated usability testing observes actual or likely users attempting specific, believable tasks. Task wording should not reveal the required clicks. Findings help identify problems in language, layout, and understanding. [Using moderated usability testing](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing).

**Implementation decision.** Bind each review to the exact output revision, task, browser, viewport, and conditions. Use the existing review tools to record the observation, proposed correction, and retest. Keep visual judgment, task outcomes, and technical failures as separate evidence. A changed artifact needs a relevant new check.

**Acceptance criterion.** Produce an observation-to-change-to-retest record for one real journey, including a recovery path. Retest the problem and affected neighboring behavior. Label guided assistance and incomplete tasks honestly. A participant study requires real participants; automated or self-review results must never be relabelled as customer research or human-quality equivalence.

## What is fact, recommendation, and taste?

| Category                      | Examples                                                                                                                               | Appropriate evidence                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Technical fact or requirement | A font resource is available; a file has the expected bytes; a status message has appropriate semantics; the reflow criterion applies. | Source inspection, artifact checks, and relevant browser or assistive-technology observations.                                       |
| Contextual recommendation     | Lead with booking details for a booking task; supply a mobile crop; package a small font set; test a failure path.                     | Stated purpose, explicit tradeoff, and observation of the actual task.                                                               |
| Editorial taste               | A serif feels appropriate; a crop is compelling; the page has pleasing rhythm.                                                         | Reasoned critique using the real content, followed by comparison or user observation where useful. A token score does not settle it. |

WAI Understanding pages explain the referenced WCAG criteria; they do not certify this application. Standards guidance does not mean that one layout, font category, or density is universally best. Use MDN’s descriptor reference for exact `font-display` semantics rather than assuming an unspecified browser strategy from a general performance explainer.

## Recommended next small feature: portable typography in authored output

**Product judgment:** this is the highest-confidence bounded improvement to the current customer artifact. It closes an observed source-level delivery gap: the studio lets a person select typography, but the recipient may see another font. The likely benefit is more faithful hierarchy, wrapping, and spacing; its magnitude has not been measured. This does not replace the larger need for task-specific content and complete journeys.

Start with one licensed heading/body pairing already represented in Focus’s allowed families. Verify the exact asset licenses before including it. Add a manifest containing family, weight/style coverage, asset paths, hashes, and license references. Make preview, standalone HTML, and editable ZIP consume that same manifest. Preserve earlier saves and explicitly identify font choices that remain fallback-only. The change must not alter a customer repository or the existing-app trial’s scope.

The concrete completion evidence should be:

1. The downloadable ZIP contains the declared font files and required license notices; manifest hashes match the actual bytes.
2. The standalone HTML contains everything its typography promise requires, or clearly declares a different supported packaging mode before download.
3. A clean browser without locally installed copies renders the declared family and weights from the delivered assets, with external network access blocked.
4. Long real headings, body copy, and action labels remain usable at narrow widths and zoom; delayed or missing fonts have a readable fallback.
5. Preview and export use the same selected font assets and content. Any remaining difference is stated and reviewed rather than hidden behind a generic readiness badge.

After this bounded fix, the next structural investment should be a task-aware content outline and purposeful image slots. That work changes what the page communicates. Additional theme presets alone would not resolve the documented delivery and workflow gaps.

## Research record and limits

All public links above were opened through the web research tool on the inspection date; relevant sections were read. Local files were inspected read-only. Search results were used for discovery, not as substitutes for the cited pages. The Google Fonts FAQ redirect returned no readable page content, so it is not relied upon here; licensing guidance comes from the opened official OFL text and still requires per-asset verification.

The acceptance criteria are proposed checks, not completed results. This document changes no product code, artwork, branding, paid-AI policy, release status, or customer project.
