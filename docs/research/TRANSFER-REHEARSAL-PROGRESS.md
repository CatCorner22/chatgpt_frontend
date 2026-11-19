# Supported transfer rehearsal: current evidence

The maintained owned React/Vite fixture builds the original and changed booking component, exercises invalid input, pending state, failure/retry and confirmed success, applies the exact patch and inverse, and preserves a later edit to an unrelated file. These are owned-fixture/JSDOM observations, not a customer-browser trial.

The next inspection found a narrower test gap: explicit later-edit refusal covered the before snapshot only. The parameterized check now covers both TSX and CSS-module files in both before and after snapshots. A later edit must cause snapshot verification to reject before apply or rollback, while retaining the supplied edited content. This adds two negative cases without changing runtime behavior. It does not establish that an external recipient follows the verifier before acting.

Validation: 25 tests passed across source-trial-fixture.test.tsx and source-trial-return.test.ts. The maintained lint gate passed with zero errors and 11 existing warnings. Git environment variables were removed from the test child process; the repository Git configuration hash remained unchanged. Full logs are retained under /workspace/research/transfer-rehearsal.

Still needed for the broader goal: an actual fresh-recipient rehearsal using the generated package, rendered keyboard/narrow/zoom and failure-recovery observations, and a matched human-designed reference. No live customer app was changed, no broader adapter support was added, and no deployment or North Star equivalence is claimed.

## Actual exported verifier follow-through

The exported ZIP integration suite now also covers the rollback-drift scenario for both touched files. Each test creates the real package, applies its exact forward patch, confirms the after snapshot, introduces a later owner edit, and invokes the packaged Node verifier again. The verifier rejects, does not reveal the synthetic source sentinel through stdout/stderr, and leaves the entire package/project snapshot unchanged. This tests the recipient-facing executable rather than only the in-process snapshot function.

All 26 package integration tests passed; the maintained lint gate again completed with zero errors and 11 existing warnings. Logs: /workspace/research/transfer-rehearsal/recipient-package-tests.log and recipient-lint.log. The supported browser tool still fails during initialization with “the gaas-browser node_repl sandbox cannot be disabled”; no alternative browser workaround was attempted. Rendered acceptance remains unverified. These tests do not prevent a recipient from ignoring a failed verification or establish a fresh-recipient rehearsal.

## Retained artifact for the recipient

The production export functions now have a retained owned-fixture output at `/workspace/research/transfer-rehearsal/retained-43a43a7-attempt2/`: proposal.zip, its seven extracted package files, baseline source pair, unrelated-file sentinel, exact kickoff message and checksum manifest. The bundled Node verifier passed for the before snapshot; ZIP CRC and every extracted entry hash match. The baseline is still unmodified. This is preparation for a recipient rehearsal, not that rehearsal's result.

The local preparation script initially tried to save the export API's Blob directly through Node writeFile. It failed before writing files; inspection confirmed the initial directory was empty. The corrected attempt converts the Blob to bytes and uses a separate retained directory. App export code is unchanged. The fixture has an injected request callback, not a production service or standalone customer backend.

## Resumed retained-package rollback and test isolation

After the user resumed work, a builder-run replay verified the retained ZIP against its manifest and used the actual extracted verifier and patches in a fresh owned fixture. Both later-touched-file cases rejected without changing files. The exact inverse restored both source files byte-for-byte while preserving a later unrelated edit and a newly added file. The original retained artifact remained unchanged. Evidence, commands, fixture and replay script are in `/workspace/research/transfer-rehearsal/resume-2026-11-19/`. This supplements, but does not complete or replace, independent recipient run 68; no new independent review was launched.

A separate disposable reproduction demonstrated that inherited `GIT_DIR` and `GIT_WORK_TREE` redirect Git despite an explicit working directory. Source-trial test subprocesses now use a shared environment filter that removes `GIT_*`, `NODE_OPTIONS` and `NODE_PATH`. A regression initializes two disposable repositories and checks that the intended one is selected and the outside configuration remains unchanged. The filter preserves normal executable lookup and does not mutate the parent environment. It is not a sandbox for arbitrary project execution.

Validation: the baseline production build passed; after the test-harness repair, all 1,442 tests across 117 files passed. Lint reported zero errors and 11 existing warnings. The main repository Git configuration hash was unchanged. No production behavior or adapter support changed. Actual browser initialization still fails; rendered tasks, keyboard, zoom, customer integration, independent sign-off and release acceptance remain unverified. The saved 68-run independent-review allowance remains exhausted.

## Rebuilt recovery lifecycle

The maintained fixture previously compiled the original source and the in-memory proposed source; a separate test verified the inverse restored bytes. It now constructs an isolated Git project, checks and applies the exact forward patch, checks and applies the inverse, and compiles the source actually read from disk at all three stages. Snapshot verification runs before and after each transition.

The same invalid-input, pending-request, duplicate-submission, failure/retry and confirmed-success assertions now run against the restored build as well as the original and changed builds. The restored emitted CSS, wrapper classes and measured JSDOM style snapshot must equal the original. This closes a recovery-execution coverage gap; it is not a newly discovered production defect. The existing later-edit preservation/refusal tests remain in place.

The focused lifecycle suite passed 11 tests. Evidence: `/workspace/research/transfer-rehearsal/resume-2026-11-19/restored-lifecycle.log`; full-suite and lint results are in `rollback-lifecycle-validation/`. Browser initialization was retried and still failed before opening a page. No browser workaround, customer application execution, new independent review or deployment occurred. This remains builder-run owned-fixture evidence, not customer acceptance or a claim of human-design parity.
