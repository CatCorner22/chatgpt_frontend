# Check returned source against a Target proposal

## Customer result

After a human or LLM developer returns the two files, the owner can select them inside the current Target proposal and learn whether both exactly match the proposed source, both match the original source, the change is partial, or either file differs. Focus checks actual selected bytes rather than accepting a model's claim. This is the next small contract-visible step toward North Star; it does not establish a working customer redesign.

Keep the existing four Target steps. Add a closed optional section beneath the proposal handoff. Show the two expected project paths and clear file labels. Explain that file selection cannot establish where a file lives in the repository or what is deployed. Inputs, comparison and result remain in mounted memory; no project/source storage, network processing, code execution or Launch updates.

## Four-lens order

1. End: the owner can distinguish proposed/original/partial/different and knows the next action. None means release approval. Original matches do not prove that a rollback happened.
2. Beginning: a current prepared proposal and its exact source hashes are required. Both raw files are size-bounded before reading and copied before asynchronous checks. Reopening after exit requires the same original files and saved design/plan to recreate the proposal; originals must be kept outside Focus.
3. System: owner, saved design, exact plan, original source, role confirmation and mounted lifetime must remain current. File replacement/cancellation/close invalidate pending reads/results. The pure helper revalidates its own private proposal snapshot. No new trusted receipt format or report importer is introduced.
4. Each line: reuse the source trial's proposal verification and existing context boundary. Keep returned-byte classification in a pure helper, UI state in a separate child and the parent responsible for current-proposal authority. Avoid a second Launch/evidence state model.

## Contract

`compareSourceTrialReturn(prepared, files)` receives exactly two `{path, bytes: Uint8Array}` records. Paths must match the proposal with no duplicates; order is immaterial. Snapshot inputs synchronously, validate bounded shapes, verify the prepared proposal, then hash the exact bytes without decoding or normalizing them. Limit each file to the larger expected original/proposed size, with a fixed absolute cap. A single differing byte, including newline/BOM changes, matters.

Per-file states are `proposed`, `original`, or `different`. Aggregate states are `proposed` when both match proposed bytes, `original` when both match original bytes, `partial` for a known before/after mixture, and `different` whenever either is unknown. No status named safe, ready, deployed, applied or rollback-complete is created. Display a stop/review action for partial/different; never suggest overwriting/reformatting files just to get a match.

Package instructions request the two exact current files plus the separate existing report with actual checks and uncertainties. Keep seven package files and the read-only verifier unchanged. Reported test outcomes remain reported; file equality does not bind the actual runtime, deployment or truth of a report. Returning only expected hashes would provide no independent measurement.

## Acceptance ledger

| Requirement                                                            | State   | Evidence                                                                          |
| ---------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Exact proposed/original/partial/different classification               | proved  | Real proposal and byte fixtures                                                   |
| Bounded/duplicate/wrong path/mutable input rejection                   | proved  | Core adversarial cases                                                            |
| Raw file intake, replacement, cancellation and late-result suppression | proved  | Component tests                                                                   |
| Owner/design/plan/source/role lifetime boundary                        | proved  | Parent integration and reviewer                                                   |
| Clear expected paths, outcomes, re-entry and handoff instructions      | proved  | Source/VoC review, package round trip                                             |
| Unchanged package verifier and seven-file layout                       | proved  | Existing extracted-ZIP checks                                                     |
| Integrated checks and exact private publication                        | pending | Root release receipt                                                              |
| Rendered browser and real customer trial                               | blocked | Managed relay times out; CUA sandbox cannot initialize; no customer repo supplied |

Browser infrastructure was retried after executor readiness on 18 November 2026 and remains blocked. No alternate browser control or customer-code execution is used. Meaningful independent implementation continues, so the North Star goal remains active.
