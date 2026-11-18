# Check what a coding assistant returns

Target now closes a missing part of the source-trial handoff. Beneath a prepared proposal, **Check files returned by your coding assistant** lets the owner select the actual TSX and CSS files returned by a human or LLM. Focus compares their exact bytes with the original and proposed snapshots.

| Result                   | What it establishes                                     | Next action                                                                            |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Both match the proposal  | These selected files contain the exact proposed source. | Request the actual isolated-preview, build, visitor-task and undo evidence.            |
| Both match the originals | These selected files contain the original source.       | Ask the sender which state the project is in. This does not prove undo happened.       |
| Different stages         | One matches the proposal and the other the original.    | Stop and have the pair reviewed together.                                              |
| Unexpected difference    | At least one matches neither snapshot.                  | Preserve the files and inspect the difference; do not overwrite them to force a match. |

The section starts closed and clears its selected bytes on close. It shows the exact intended paths and requires matching filenames, but a browser file picker cannot establish the files' real repository locations or which files are deployed. Nothing is executed, decoded, rendered as source, uploaded or stored. Launch history and test confirmations stay separate. A reported test result remains a report.

The original source trial is also temporary. After leaving it, the owner recreates the proposal using the same original files, saved design/values and Target plan. The handoff now tells the owner to keep those originals, and asks the recipient to return two complete raw files plus the existing separate evidence report. Seven package files and the read-only verifier remain in place. No durable receipt, report importer or additional framework adapter is introduced.

## Verification and discovered issues

The pure comparator validates and snapshots the current proposal and raw byte views before awaiting integrity checks. It enforces the exact two paths, duplicate/count checks, per-file and combined limits, and bounded proposal shape. It hashes only a typed-array view's own bytes. Newlines, byte-order marks, empty files and invalid UTF-8 are compared as bytes rather than normalized into a match. Unexpected large files are refused before reading instead of truncated.

Focused tests exposed a cross-realm typed-array issue: a genuine Uint8Array produced by the test environment's TextEncoder failed `instanceof Uint8Array`. The helper now uses intrinsic typed-array brand and byte-length accessors. This also refuses a forged own byte-length value instead of letting it bypass the size check. A separate focus assertion initially ran before React's effect; waiting for the required focus proves the eventual behavior without suppressing failures or changing application code.

The integrated application suite passes **1,137 tests in 99 files** (`.agent/source-return-full-tests.log`), with strict TypeScript, changed-file ESLint and whitespace checks passing. Core and child UI checks passed 40 tests; the parent source-trial suite passed 22, including actual original-byte comparison and invalidation when source or role confirmation changes. Independent source review found no remaining material issue in the comparator, lifecycle boundaries or result labels. Final build and publication evidence is recorded in the release receipt because it follows the source commit.

An independent LLM recipient used only the actual generated package and an owned isolated booking-page fixture, without seeing the implementation, tests or separate expected-results record. Exact forward application and reversal passed; the reviewed build ran successfully before, after and after reversal. The final raw returned files match the named originals, the rebuilt output matches the original build, and an unrelated later note remains intact. No patch was reapplied after reversal. Focus's actual new comparator classified the returned bytes as `original`; an independent hash check agreed. Browser and visitor tasks stayed explicitly unrun. The report and command log live in the ignored rehearsal directory, not in the customer deliverable. This is a handoff rehearsal, not a customer usability study or real application acceptance.

The rehearsal exposed a guide ambiguity between an unavailable browser preview and missing isolation. Instructions now separate authorized isolated checks from browser-dependent checks that must remain unrun. The original rehearsal bundle is preserved; the clarified bundle retains byte-identical patches and contract. No change to a touched source file or overwrite of later work was needed to complete this rehearsal.

The recipient's final guide review also clarified that reversal must preserve unrelated **later edits**, not restore unrelated work to its initial baseline. That wording has a failing-before/passing-after regression. All 24 extracted-package/verifier tests and changed-file lint passed again after this last text correction (`.agent/source-return-package-final.log`); the comparison logic and UI were unchanged.

## Evidence limits and next work

The managed preview again timed out waiting for its relay, and the supported browser again failed with `the gaas-browser node_repl sandbox cannot be disabled`. No alternate browser was used. Real browser keyboard/focus, mobile, zoom and visual acceptance remain pending. No customer repository has been supplied for an actual trial. The changes do not establish a complete redesign, zero bugs or North Star equivalence.

The [research note](research/SOURCE-RETURN-EVIDENCE.md) explains the distinction between source identity, build provenance and actual task evaluation. The [security model](superpowers/specs/2026-11-18-source-return-security.md) defines the trust boundaries. The [design specification](superpowers/specs/2026-11-18-source-return-design.md) contains the requirement ledger. Focus's next customer milestone still needs the actual isolated project and observed task/visual/rollback results.

## Publication and recovery

Publish only the exact committed, tested source with a byte-verified archive, retaining owner-only access. The final receipt is `/workspace/deliverables/focus-source-return-release.json`. The rollback baseline is version 9, source `3c8cfe429411ac999d23fd90738fa888e72e69cd`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_6017abba87208191915d2942fdc4a2f4`. Redeploying it rolls back Focus code, not customer patches or data.
