# Supported transfer rehearsal: current evidence

The maintained owned React/Vite fixture builds the original and changed booking component, exercises invalid input, pending state, failure/retry and confirmed success, applies the exact patch and inverse, and preserves a later edit to an unrelated file. These are owned-fixture/JSDOM observations, not a customer-browser trial.

The next inspection found a narrower test gap: explicit later-edit refusal covered the before snapshot only. The parameterized check now covers both TSX and CSS-module files in both before and after snapshots. A later edit must cause snapshot verification to reject before apply or rollback, while retaining the supplied edited content. This adds two negative cases without changing runtime behavior. It does not establish that an external recipient follows the verifier before acting.

Validation: 25 tests passed across source-trial-fixture.test.tsx and source-trial-return.test.ts. The maintained lint gate passed with zero errors and 11 existing warnings. Git environment variables were removed from the test child process; the repository Git configuration hash remained unchanged. Full logs are retained under /workspace/research/transfer-rehearsal.

Still needed for the broader goal: an actual fresh-recipient rehearsal using the generated package, rendered keyboard/narrow/zoom and failure-recovery observations, and a matched human-designed reference. No live customer app was changed, no broader adapter support was added, and no deployment or North Star equivalence is claimed.
