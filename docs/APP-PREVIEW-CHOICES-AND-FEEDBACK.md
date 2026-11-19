# App preview choices and practice feedback

Blake's requirements are that choices remain consistent through previews and delivery, and that each Garden step is understandable to a lay user. This slice applies the ongoing Root Cause Debugger, Real-Time Testing, Four-Lens Build and Voice of Customer workflow recorded in `SKILL-WORKFLOW.md`. It is builder verification, not another independent review run.

## Reproduced causes and repairs

The app specimen used an always-filled primary button and capped button, field and panel corners at eight pixels, independent of the chosen action treatment and corner value. Primary actions now respect filled, outlined, pill and underlined treatments. Pills remain fully rounded and underlined actions stay square; ordinary actions, fields and panels use the selected corner value. Primary actions have explicit 44-pixel minimum dimensions. Chart bars retain their intentionally smaller corner treatment. The existing readable text-color helper applies to unfilled action labels.

The settings and sign-in specimens shared one `saved` flag in their parent. Saving settings and then selecting Sign in displayed a completed sign-in without an attempt; the reverse showed saved settings. Editing sign-in details also left its old success message visible. Each form now owns its feedback, and editing either form clears that feedback (including the settings checkbox). Leaving a form removes its practice state and fields together; changing the design while staying in the form preserves the current exercise. The sign-in example explains before input that users should use made-up details and that it does not access an account.

## Acceptance ledger

| Need or boundary                               | Check                                                                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected appearance stays visible              | All four action treatments, square and maximum corners, settings/sign-in/create/retry actions; applicable field and panel corners.                        |
| A success message belongs to its own operation | Settings-to-sign-in and sign-in-to-settings transitions through the real preview selector; changed details; leave and reopen sign-in.                     |
| Small visual changes preserve the task         | Unfinished settings input survives token changes; create and retry still produce feedback and become disabled.                                            |
| Invalid practice input is not confirmed        | Empty required workspace name and invalid email through the native button submission path; input retained.                                                |
| Practice does not become a customer operation  | Fetch and storage-write spies stay unused during the two form exercises. No authentication, customer integration, export or Launch evidence code changed. |

These component tests execute under JSDOM. They do not establish real-browser focus behavior, native validation announcements, visual quality or customer-app correctness. The forms remain local examples, not exported account or settings functionality. No real password, customer record or account was used.

## Evidence and limits

Evidence lives under `/workspace/research/transfer-rehearsal/resume-2026-11-19/`:

- `app-preview-before.log`: nine failing checks and one passing check before repair. It includes an overly literal zero-radius expectation (`0px` versus React's `0`), corrected in the final tests; the actual appearance and feedback failures are preserved separately in that log.
- `app-preview-after.log`: intermediate results, including the remaining zero-radius expectation mismatch. Not a final gate.
- `app-preview-final-focused.log`: 79 passing checks across four files, including 12 new app-preview checks and related appearance/export coverage.
- `app-preview-validation/`: final full test, lint and production build logs, exit codes, and hashes taken before and after validation to detect edits during the run.

The supported browser was retried in this slice and still failed initialization with “the gaas-browser node_repl sandbox cannot be disabled.” Rendered acceptance remains outstanding. No deployment, customer-source application or new independent review occurred. The exhausted 68-run allowance remains unchanged. These repairs do not establish North Star parity or release readiness.

Final validation: 1,490 tests across 119 files passed; lint passed with zero errors and 11 existing warnings; production build passed. Component and test-file hashes were unchanged across that validation run.
