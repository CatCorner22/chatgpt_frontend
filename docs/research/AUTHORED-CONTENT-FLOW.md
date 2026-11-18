# Authored content flow

Primary guidance and local source read on 18 November 2026. This note supports a bounded renderer change; it does not establish visual usability, accessibility conformance, or customer task success. The acceptance plan separates automated structure checks from browser and visitor observations; completed checks are recorded in the release evidence.

## Observed source behavior

`src/components/ContentEditor.tsx` labels `content.sub` **Supporting sentence** and feature entries **What you offer**, with a request for real features or services. In baseline `5bda93a` of `src/lib/authored-page.ts`, the supporting sentence appears beside the headline only when nonempty features exist. Otherwise it moves below the hero action into Details. Details and its main-navigation link are emitted even with neither a supporting sentence nor feature content; an absent or invalid action URL also creates an “Explore details” fallback.

That makes the location of the headline's explanation depend on an unrelated content count. The proposed change should preserve the meaning of the existing fields, not generate marketing copy or new business claims.

## Relevant guidance and Focus implications

- [GOV.UK: Create a clear structure — Frontload your content and Break up the text with headings](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-structure/#frontload-your-content) puts important information first and recommends descriptive headings. It also says text between headings is not always necessary. **Focus implication:** place the supplied supporting sentence once with its headline, independent of feature count. This follows the field's defined role; it does not justify adding filler paragraphs or requiring every action on every site to follow explanatory text.
- [WAI: Understanding Meaningful Sequence — Intent](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html#intent) requires a programmatically determinable sensible sequence where order affects meaning, and explicitly recognizes that several sequences can be correct. **Focus implication:** preserve headline → supplied explanation → primary action in the hero's DOM as well as its intended visual grouping. Review every composition's CSS and narrow layout; source order alone cannot prove that the rendered sequence remains understandable.
- [WAI: Understanding Link Purpose in Context — Intent](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html#intent) connects a link's name and programmatic context with understanding its destination, and notes the usefulness of preceding context. [MDN: Anchor — Strong link text and onclick events](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#strong_link_text) likewise recommends descriptive link content and real navigation destinations. **Focus implication:** “Explore details” should lead to actual details. If there is no Details section, remove its navigation and fallback link together; do not substitute `#`, a missing fragment, or an inert element styled as an action. A valid supplied action remains available even when there are no features.
- [WAI: Headings — Overview and Heading ranks](https://www.w3.org/WAI/tutorials/page-structure/headings/#heading-ranks) describes headings as an outline and navigation aid. [MDN: Section — Usage notes](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/section#usage_notes) treats sections as meaningful document groupings, generally identified by headings, rather than merely styling wrappers. **Focus implication:** retain a meaningful Details heading and nested feature headings when there is feature content. Do not manufacture an otherwise empty named section just to preserve a template shape or anchor.
- [GOV.UK Design System: Button — How it works](https://design-system.service.gov.uk/components/button/#how-it-works) ties action wording to what actually happens. **Focus implication:** distinguish a real supplied action from an in-page exploration fallback. Missing or invalid action configuration must not imply booking, submission, or saving. This slice should not add a service backend or change navigation links into fake form controls.
- [UK Intelligence Community Design System: Empty state — When to use](https://design.sis.gov.uk/components/feedback-progress/empty-state/#when-to-use) recommends accurately communicating unavailable content and a useful next step. This is a separate government design system, not a GOV.UK-wide empty-state rule. **Focus inference:** keep missing-content guidance in the authoring/readiness interface where the owner can act on it. An exported marketing page can omit absent optional sections; it need not show editor instructions or fabricated offerings to its visitors.

## Proposed bounded behavior

| Supplied content                     | Intended output                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Supporting sentence, no features     | One hero explanation; no duplicate Details paragraph or empty Details section.                                          |
| Nonempty feature entries             | Details, feature navigation where the composition uses it, and valid matching anchors.                                  |
| Valid action destination             | Preserve the real action independently of whether Details exists.                                                       |
| Missing/invalid action, real Details | An accurately named in-page details fallback is available; authoring guidance still identifies the missing destination. |
| Missing/invalid action, no Details   | No invented primary action or dangling Details link; authoring guidance accurately describes the missing setup.         |
| Whitespace-only sentence/features    | Treat as absent; do not invent copy, feature titles for wholly empty rows, or claims that content is complete.          |

Quote and image behavior should remain unchanged. The increment concerns authored website output; it does not replace an existing customer application's DOM or prove its content hierarchy.

## Acceptance plan and evidence boundary

1. Across all five compositions, exercise sentence-only, features-only, both, and neither; include whitespace-only entries and long owner text. Verify the supplied sentence appears once in the page body and that text is preserved and escaped. A metadata description is separate from visible-body duplication.
2. Cross those cases with a valid action URL, an absent URL, and a rejected URL. Verify each fallback label matches its destination, every generated fragment resolves to real content, and omitted sections leave no empty navigation/hero-action wrappers. Preserve useful owner actions.
3. Inspect parsed DOM order, heading levels and accessible names. Compare preview, standalone HTML and editable ZIP from identical inputs. Verify missing-content/readiness and exported instructions describe the actual fallback behavior.
4. When rendered access is available, review wide and narrow layouts, 200% zoom, keyboard navigation and assistive-technology reading order. Check whether a first-time visitor can explain the offering and predict the action before following it. Check that removing Details does not leave unexplained spacing or numbering.
5. Record actual observations and failures. Structural tests and source guidance cannot establish attractive composition, understandable customer copy, or successful visitor tasks; those conclusions remain unverified until observed.
