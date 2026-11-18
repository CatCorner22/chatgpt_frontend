# Quotation fidelity and editor continuity

Source review and primary-source reading: 18 November 2026. Baseline: `2361898fb264443af14b9ceec2d65518cd9510ca` (v14). This note records the chosen contract and verification boundaries; it is not a browser or accessibility certification.

## Observed quotation defect

The authored renderer trims the supplied quote, independently removes leading straight/opening-curly marks and trailing straight/closing-curly marks, then adds a new curly pair. The two ends need not belong to one outer quotation. Consequently, the supplied text `She said "welcome"` becomes `“She said "welcome”`: a meaningful closing character is removed. Repeated outer marks are also collapsed. This is content alteration in the renderer, not a font or HTML-escaping problem.

A read-only reproduction invoked the v14 `buildAuthoredPage` and parsed its emitted HTML with jsdom. It observed:

| Supplied quote            | v14 blockquote text                                                       | Intended text after outer whitespace trimming |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| `She said "welcome"`      | `“She said "welcome”`                                                     | `She said "welcome"`                          |
| `Plain supplied words.`   | `“Plain supplied words.”`                                                 | `Plain supplied words.`                       |
| `“Curly supplied words.”` | `“Curly supplied words.”`                                                 | Unchanged                                     |
| `““Repeated marks””`      | `“Repeated marks”`                                                        | `““Repeated marks””`                          |
| `"`                       | `“”`                                                                      | `"`                                           |
| `“”`                      | `“”`                                                                      | Unchanged                                     |
| Whitespace only           | No quotation, quotation-readiness note or quote-dependent closing section | Unchanged                                     |

Existing quotation tests mostly use substring assertions with ordinary sentences; those do not detect added punctuation. The regression boundary needs exact quote text and explicit nested, one-sided and repeated marks.

## Chosen rendering and evidence contract

Use a small `getAuthoredQuote(unknown)` helper in the lightweight authored-content module: return the trimmed string, or an empty string for non-string input. Render the result through the existing HTML escape function inside the existing `blockquote` and paragraph. Do not strip, balance, normalize or synthesize quotation marks; do not add a `q` element or generated quotation punctuation. Preserve punctuation-only input literally. Omit whitespace-only input. Reuse the same helper result for quotation presence, the accuracy/permission reminder and the quote-dependent closing section.

This deliberately removes Focus's synthetic outer marks from ordinary unquoted text. The existing typography, section and semantic blockquote continue to distinguish the quotation. The owner retains control over punctuation; accuracy and permission still require human review.

Escaping must happen after this content decision. HTML-like source and character-reference-like text remain literal supplied text, never executable markup. Internal newlines and spaces remain in the emitted text; ordinary HTML parsing and CSS whitespace layout still apply. This contract does not promise identical input bytes in the rendered DOM or preserved visual line breaks.

For launch evidence, compare the trimmed supplied string with exactly what the historical renderer would have emitted as text:

```ts
const quote = getAuthoredQuote(value);
const changed = quote !== "" && quote !== `“${quote.replace(/^["“]+|["”]+$/g, "")}”`;
```

The historical expression is only a compatibility test; it must not shape the new rendered quote. Restrict the new evidence revision to authored new websites. Preserve the existing `authoredOutputRevision` calculation and append `authoredQuoteRevision: "quote-text-v1"` only when this exact comparison finds a change. Existing apps/sites receive no new quote revision. Empty/whitespace quotes, a single balanced curly pair, `“”` and `“ ”` retain their previous artifact identity, including existing `content-flow-v1` or `product-details-v1` identities. Repeated or mixed outer marks must not be mistaken for an unchanged balanced pair.

The revision belongs only to runtime evidence identity, not saved content, page settings, work hashes or public design IDs. Affected old page checks must not silently remain current, and pending checks for an older artifact must be discarded. No new evidence is earned merely by correcting the renderer.

## Editor focus policy

The selected Focus policy is to focus the new title after an accepted Add action; after Remove, focus the next remaining title, otherwise the previous title, otherwise Add a feature; after Remove quote, focus the quotation textarea. These targets are Focus's design choice, not a sequence mandated by WAI.

Keep a pending focus request tied to the expected content update and the originating control. Cancel a superseded request, closing or unmounting the editor, or receiving different content. Ordinary typing, unrelated parent updates and another editor instance must not steal focus. Delayed and cloned acceptance, rejected or different updates and two simultaneous editors need distinct tests.

The current `onChange: void` contract provides no explicit acknowledgment of a committed edit. Without a new signal, it cannot distinguish a delayed acceptance from an identical later external update. The implementation and release notes must retain that limit rather than imply an owner identity or commit token exists. The implementation owner is validating this policy separately; this note does not claim browser verification.

## Primary sources read

- [WHATWG: the blockquote element](https://html.spec.whatwg.org/multipage/grouping-content.html#the-blockquote-element) defines a block quotation from another source and gives paragraph-based examples without requiring synthetic outer quotation characters. This supports retaining the existing semantic wrapper; the exact trim-only content policy is Focus's design choice.
- [WHATWG: the q element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-q-element) describes inline quotation semantics and user-agent insertion of quotation punctuation. Substituting `q` would introduce different punctuation behavior and would not implement the chosen literal-text contract.
- [W3C Internationalization: character escapes](https://www.w3.org/International/questions/qa-escapes#security) explains escaping HTML syntax characters when displaying user text. Punctuation preservation does not remove the existing escaping boundary.
- [WAI APG: discernible and predictable keyboard focus](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus) explains that removing the active element can lose focus to the document body and recommends deliberate, logical focus management. This is guidance, not evidence that a particular implementation works in a browser.
- [WCAG 2.2 Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) explains preserving meaning and operability in sequential navigation. It does not mandate one universal next target or establish conformance from a unit test.

## Required checks and limits

Cover all five compositions with exact text assertions for ordinary, nested, straight, curly, repeated, unbalanced, multilingual, punctuation-only, HTML-like and whitespace-only input. Check standalone HTML and ZIP parity through the same renderer. Test quote presence, readiness and closing-section agreement, without inserting fake attribution or a fake action.

Evidence tests need changed and unchanged quotes across the legacy, content-flow and Product-detail branches; existing-app exclusions; current-evidence retention; and a complete delayed-response case that proves stale evidence is ignored rather than failing for an unrelated malformed result. Editor tests should exercise add/remove actions, the intended focus destinations and noninterference with unrelated renders and other instances.

The reproduction above is renderer and parsed-DOM evidence only. Actual browser rendering, keyboard navigation, screen-reader output, focus visibility, zoom, hydration and customer journeys remain separate checks. No browser workaround was used, and this note makes no visual-quality or accessibility-conformance claim.

Independent review of the frozen quotation source found no material defect. The two new quotation suites passed 31 tests. A separate read-only comparison loaded the v14 renderer from the recorded Git commit and the current renderer: 95 cases across all five compositions produced exactly the HTML equality/difference predicted by the lightweight helper (35 unchanged, 60 changed), with unchanged CSS and readiness. The same inputs passed 285 artifact checks across no-feature, title-only and described-feature branches, preserving the earlier revision independently. Five non-string helper inputs remained absent. These checks included repeated marks, literal markup, multilingual punctuation and internal CRLF; they did not execute customer code or a browser. Editor focus validation remains the separate implementation owner's responsibility.
