# Responsive image framing references

Primary documentation read on 18 November 2026. This is source research and an acceptance plan, not a rendered-page audit or a completed visual test.

## Source implications

- [MDN: `object-fit`, Values](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit#values) explains that `cover` preserves proportions while filling the image box and clipping overflow; `contain` preserves proportions while fitting the whole image, potentially leaving empty bands. **Focus implication:** offer “Fill the frame” and “Show the whole image.” Keep the existing frame dimensions in both modes. Showing the whole image does not mean removing the frame or stretching the image.
- [MDN: `object-position`, Syntax and Formal definition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-position#syntax) defines alignment inside the image box and a centered default. Uncovered areas show the element background. **Focus implication:** use nine bounded alignment choices for cover; explicitly center contain. Position is alignment, not a guaranteed subject tracker. A position change can have no visible effect along an axis that has no overflow.
- [W3C WAI: Informative Images, Overview and Examples 2–4](https://www.w3.org/WAI/tutorials/images/informative/) bases text alternatives on the image's purpose and conveyed information in context. **Focus implication:** framing must preserve the same uploaded bytes and existing alt text. Do not generate new alt text from a position choice or silently mark the image decorative. The owner must still review that the meaningful subject remains visible in the chosen crop; unchanged alt text alone does not establish an appropriate visual result.

## Bounded Focus behavior

The slice uses one uploaded image and its existing frame. It changes CSS fit/alignment only. It does not introduce a second mobile asset, `picture`/`srcset`, file resizing, compression, format conversion, or a performance claim.

Cover positions map to an explicit grid:

| Position      | `object-position` |
| ------------- | ----------------- |
| Top left      | `0% 0%`           |
| Top center    | `50% 0%`          |
| Top right     | `100% 0%`         |
| Center left   | `0% 50%`          |
| Center        | `50% 50%`         |
| Center right  | `100% 50%`        |
| Bottom left   | `0% 100%`         |
| Bottom center | `50% 100%`        |
| Bottom right  | `100% 100%`       |

Contain always uses `50% 50%`. The optional narrow override applies at viewport widths **at or below 760 CSS pixels**, matching the authored renderer's existing breakpoint. Without an override, the base choice applies at all widths. The breakpoint is a Focus product decision, not a universal size recommended by these sources.

Source inspection found the existing default image frame at `4/3`, the Showcase frame at `21/9` with a maximum block size, and the existing `max-width: 760px` media query in `src/lib/authored-page.ts`. Retain each template's frame rules; the effective frame can differ across templates and widths.

## Manual acceptance fixture — not run

Use an owned landscape photograph with a clearly identifiable subject near the upper-left edge and visible context near the opposite edge. Use the same unedited file throughout; record its hash and the exact alt text before starting. No new image is required for this research note.

1. In the existing `4/3` frame, compare left/center/right cover alignments using a sufficiently wide image. In the wider Showcase frame, compare top/center/bottom where the source image produces vertical overflow. Confirm the subject moves into view as expected; do not demand movement on a non-overflowing axis.
2. Select contain. Confirm all image edges are visible, the image is centered without distortion, and empty space retains the existing surface treatment. Compare frame bounds before and after.
3. Give base and narrow framing visibly different choices. Check 761px, 760px, and a practical narrow width such as 390px. Remove the override and confirm base framing resumes. Check the actual preview viewport, not merely a device label.
4. Compare preview, exported HTML, and editable ZIP at the same widths. Confirm identical source image bytes and alt text throughout, and confirm no extra image asset or remote image service was introduced.
5. Use the controls by keyboard, verify visible focus and announced selection, and review whether both crops still convey the intended information. Record screenshots and actual observations only when this review is performed.

Automated state/CSS/export checks can support the contract. They do not establish subject visibility, attractive composition, rendered accessibility, or browser acceptance.

## Product Design preflight availability

The cloud skill's read-only context reader is available at `skill://Plugin_fa77aec24fc08191bc6e57f377126d76/user-context/scripts/user_context_preflight.py`, via the `c1/user-context` package. Its documented local command is `python3 scripts/user_context_preflight.py`; it reads `$CODEX_HOME/state/plugins/product-design/user-context.md` (falling back to `~/.codex`) and emits JSON. No local copy was found in the bounded workspace, `/root/.codex`, and `/opt` search. The script was inspected, not executed. No saved-context or visual-audit result is claimed, and unavailable visual tooling does not prevent this source research.
