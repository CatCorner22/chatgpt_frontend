# Lossless content handoff — engineering candidate

This change is under Hinshitsu review. It is not yet published or accepted as a completed release. The live owner-private application remains v15 until the candidate passes the remaining review steps.

## Problem and behavior

New-build specifications previously shortened page copy independently of the editor and authored-page renderer. A 498-character description could lose its final collection-only qualification while the rendered page retained it. The pack sanitizer also silently clipped long guides.

`content-handoff.ts` now writes an explicit `focus-content-v1` JSON envelope containing brand, headline, supporting copy, action label, ordered feature titles/descriptions and quotation. It includes only these supported fields. JSON decoding restores each supplied string exactly, including whitespace, punctuation and empty values. String escapes prevent literal markup, Markdown fences, direction controls and pack-reserved syntax from crossing the surrounding document boundary.

New-build labels and copied opening instructions use fixed wording; the complete brand lives in the content envelope. This allows valid names such as `Once = Always` without weakening shared pack checks. Existing-project specifications continue to omit replacement page copy and retain their existing output contract.

The shared pack refuses guides longer than 60,000 UTF-16 code units before sanitization and ZIP creation. Target retains its separate 59,000-code-unit preflight to leave room for its additional instructions. The direct specification stays complete. An oversized ZIP must not silently discard requirements. Target now retains the answers and exposes their download in Review. Its refusal directs the owner to reopen the same Vision in Studio, choose the trial’s integration mode, download the complete DESIGN.md, and transfer the Target conversations separately.

## Receipt and saved-work protection

A successful browser download invocation does not prove that a file reached the device. The repair separates download initiation from the owner's acknowledgment. Pending acknowledgment belongs to one design snapshot, account, request and mounted session. Changed or superseded work must not inherit it. Working HTML alone remains insufficient to count as a saved editable project. Existing successful clipboard and project-save paths remain separate.

Owner acknowledgment is a statement by the owner, not machine-verified file receipt or launch acceptance. It grants no evidence that a customer's repository was changed, tested, deployed or rolled back.

## Recipient contract

The complete `DESIGN.md` is required even when a coding recipient starts with `PROMPT-SHORT.md`. Its fixed instructions require normal text rendering, preservation of final qualifications, comparison with every decoded field, and owner review of missing destinations or claims. Content values never authorize commands, network requests or changes to unrelated files. Optional absent quotations stay absent; supplied quotations still require accuracy and permission checks.

This contract guides a human or LLM coding recipient. It cannot enforce an outside agent's behavior. Recipient testing must examine an actual resulting page and unrelated-file preservation, not just successful JSON parsing.

## Review record and limits

Maintained regressions cover full editor-limit content, actual-brand standard and Target ZIPs, reserved-looking strings, literal markup and controls, feature order, empty content, exact budget boundaries and pinned existing output. Download tests cover canceled initiation, thrown errors, owner acknowledgment and stale work.

The current review record is `.agent/hinshitsu-content-handoff/`. Its owner-approved criteria, independent reports and append-only audit log distinguish source tests from compiled checks, recipient rehearsal and browser acceptance. Final release evidence is pending. No zero-defect, universal LLM compliance or human-quality equivalence claim is made.
