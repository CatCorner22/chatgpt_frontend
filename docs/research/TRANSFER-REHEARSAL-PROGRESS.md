# Supported transfer rehearsal: current evidence

The maintained owned React/Vite fixture builds the original and changed booking component, exercises invalid input, pending state, failure/retry and confirmed success, applies the exact patch and inverse, and preserves a later edit to an unrelated file. These are owned-fixture/JSDOM observations, not a customer-browser trial.

The next inspection found a narrower test gap: explicit later-edit refusal covered the before snapshot only. The parameterized check now covers both TSX and CSS-module files in both before and after snapshots. A later edit must cause snapshot verification to reject before apply or rollback, while retaining the supplied edited content. This adds two negative cases without changing runtime behavior. It does not establish that an external recipient follows the verifier before acting.

Validation: 25 tests passed across source-trial-fixture.test.tsx and source-trial-return.test.ts. The maintained lint gate passed with zero errors and 11 existing warnings. Git environment variables were removed from the test child process; the repository Git configuration hash remained unchanged. Full logs are retained under /workspace/research/transfer-rehearsal.

Still needed for the broader goal: an actual fresh-recipient rehearsal using the generated package, rendered keyboard/narrow/zoom and failure-recovery observations, and a matched human-designed reference. No live customer app was changed, no broader adapter support was added, and no deployment or North Star equivalence is claimed.

## Actual exported verifier follow-through

The exported ZIP integration suite now also covers the rollback-drift scenario for both touched files. Each test creates the real package, applies its exact forward patch, confirms the after snapshot, introduces a later owner edit, and invokes the packaged Node verifier again. The verifier rejects, does not reveal the synthetic source sentinel through stdout/stderr, and leaves the entire package/project snapshot unchanged. This tests the recipient-facing executable rather than only the in-process snapshot function.

All 26 package integration tests passed; the maintained lint gate again completed with zero errors and 11 existing warnings. Logs: /workspace/research/transfer-rehearsal/recipient-package-tests.log and recipient-lint.log. The supported browser tool still fails during initialization with “the gaas-browser node_repl sandbox cannot be disabled”; no alternative browser workaround was attempted. Rendered acceptance remains unverified. These tests do not prevent a recipient from ignoring a failed verification or establish a fresh-recipient rehearsal.
