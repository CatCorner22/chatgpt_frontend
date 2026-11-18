# Target returned-file comparison: bounded security model

18 November 2026. This is a source-reviewed change model for the next Target increment, based on Focus revision `3c8cfe429411ac999d23fd90738fa888e72e69cd`. It does not claim a customer repository audit, customer execution evidence or browser acceptance. The earlier [source-trial model](2026-11-18-source-trial-security.md) records the parser, package and recipient-verifier boundaries and the unavailable Codex Security workflow references; those limitations still apply. No shared security cache is being changed.

## Selected scope and customer value

An owner may select two returned files while the exact prepared proposal is still open. Focus compares their raw bytes with the two original and proposed file identities already validated by that proposal. This closes one concrete handoff gap: the owner can distinguish the expected source outputs from mixed, original or different returned files without trusting an LLM's assertion that it applied the change.

This slice does not import a report, trust a recipient receipt, add signatures, persist source or establish a new Launch evidence type. Closing the source panel clears its source and proposal. To compare later, the owner must recreate the same proposal from the original selected source and the intended design/plan. If those inputs differ, the new proposal is a different comparison context; no previous result follows it automatically.

## Trust boundaries

The only independently observed fact is the hash of the selected local file bytes. The browser file picker does not prove those bytes are the active repository files, the build input or the deployed output. Two files cannot prove the surrounding application, services, permissions, browser behavior, task results or unrelated files remained unchanged.

Recipient file names, code, comments and labels remain untrusted data. No source import is resolved and no selected code is executed, rendered as HTML, sent to a server, saved in browser/account storage or included in telemetry. Hash failures and validation errors must not reveal source fragments. Source file selection is not authority to run commands or follow instructions embedded in the file.

The already prepared proposal is the comparison reference. Its current owner, exact plan/design context, source revision and role confirmation remain required. An imported contract or a recipient-supplied list of expected hashes must not replace that reference. The contract alone does not bind all owner answers: preview, task and rollback context lives in the sealed trial plan. Keeping this comparison attached to the current proposal avoids inventing a partially bound receipt model.

## Exact bytes and bounds

Read exactly one file for each declared role: TSX and matching CSS module. The UI shows the intended path from the prepared proposal; that path describes the selection slot rather than independently verifying a filesystem location. Preserve the existing narrow file-size policy, allowing only the bounded growth already accepted by source-trial preparation, and enforce the combined limit too.

Check declared size before reading and actual byte length afterwards. Hash raw bytes with SHA-256, without newline conversion, whitespace trimming, Unicode normalization, decoding/re-encoding or source parsing. A byte-order mark, changed line ending or invalid text remains a byte difference; it cannot be silently normalized into a match. A typed-array view must include only its own `byteOffset` and `byteLength`, not unrelated bytes in its backing buffer.

Copy the selected byte views and the validated expected identity before the first asynchronous operation. Later mutation of a caller-owned array, backing buffer or proposal must not change the comparison in flight. Reject unsupported or oversized inputs rather than truncating them. No filesystem write or patch application is part of the helper.

## Result contract and truthful labels

| Classification | Required byte facts                                                             | What the UI may say                                                       |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Proposed       | Both selected files match their exact proposed hashes and byte sizes.           | These selected files match the proposed source bytes.                     |
| Original       | Both selected files match their exact original hashes and byte sizes.           | These selected files match the original source bytes.                     |
| Partial/mixed  | Each file matches a known snapshot, but one is original and the other proposed. | The files match different expected stages. Review them before continuing. |
| Different      | At least one selected file matches neither expected snapshot.                   | At least one file differs from the original and proposed versions.        |

An original match does not prove a rollback was performed; the files may never have been changed. A proposed match does not prove a patch was applied to the intended repository. A mixed result does not establish how it arose. No match counts as a build, task, keyboard, responsive, visual, deployment or release check. Repeated comparisons do not increase completion or launch totals.

No result may automatically apply an inverse, repair a mismatch, overwrite a file, expand the patch, alter the original contract or mark a pending test as passed. Different bytes are a review condition, not permission to force a match.

## Asynchronous lifecycle

Each file read and comparison captures a monotonically invalidated generation and the current proposal/context. Replacement, clearing files, changed proposal props, withdrawn role confirmation, cancellation, leaving the step, closing the panel or unmount must invalidate pending work. The live owner guard and parent proposal verifier run before and after asynchronous work. A hosted session lock must block completion even if the selected files and account label appear unchanged.

Read completion for an older file cannot replace a newer selection. A rejected current operation clears any previous success message. A stale success or error cannot restore an old comparison or update the new context. The comparison is local and may be cancelled, but WebCrypto/file reads already started need not be physically interrupted; their late results are ignored.

## Evidence model boundary

Do not convert the result into `ReviewEvidence.kind: "page"`, call `addEvidence`, set Launch task confirmations or clear measured failures. The existing Launch model represents fetched-page measurements and screenshot opinion with a distinct gate; importing a source-hash match there would create false measured evidence. Its non-cryptographic `launchFingerprint` is a change detector, not an artifact-authentication primitive.

The result can point the owner to the remaining isolated-preview task checks. Any later recipient report would need a separately designed, bounded schema and explicit recipient-reported status. Even an unsigned report with correct hashes can be fabricated from the package, and its timestamp or test statements would not establish execution. That feature is outside this slice.

## Required regression evidence

- Exact proposed/original/mixed/different pairs; empty files, single-byte, line-ending, BOM and whitespace changes remain differences, never matches.
- Oversized, wrong-count/wrong-slot and combined-limit inputs are refused before a false result; byte-array subviews and deferred mutation use the intended frozen bytes.
- Deferred reads and hashes cannot update after replacement, cancellation, prop/context changes, owner lock, owner change or unmount; stale failures do not erase newer results.
- UI wording distinguishes selected-file identity from repository state and execution; no Launch/storage/network/source-evaluation path is called.
- Ordinary source-trial preparation, package validation and download guards remain intact. Package instructions accurately explain returning the exact two files and the need to retain originals for reopening.

## Scoped review outcome

Independent source review found no remaining material issue in the final comparator, ReturnPanel, parent capture guard or package-return instructions. The comparator accepts native unsigned byte views across realms using intrinsic type and length checks, copies only the bounded view, and validates the original proposal before classifying results. The UI invalidates pending work before disclosure closure or proposal replacement and rechecks the live parent/owner boundary before showing a result.

An independent run of `src/test/source-trial-return.test.ts` and `src/test/source-trial-return-ui.test.tsx` passed all **40 tests** on 18 November 2026. This is focused component/helper evidence. Final integrated results, build evidence and any remaining browser limitation belong in the release record; this review does not replace customer acceptance.
