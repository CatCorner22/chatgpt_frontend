# Source trial: preserve typed CSS-module builds

## Reproduced failure

A complete owned React/Vite project was created around the retained booking source, with its HTML entry point, React mounting and navigation, practice booking history, project build/type-check/test commands, and an exact `Booking.module.css.d.ts` declaration. It reuses installed Focus dependencies and contains no live services or customer data. The declaration names only the customer's four existing CSS classes.

The original project build passed. Applying the retained package's exact forward patch passed the package verifier, but the project's `tsc --noEmit && vite build` command failed: the new `styles.focusTrial_…` property did not exist in the exact type declaration. The inverse restored the original files and the build passed again. This is a real compatibility defect in generated output, even though earlier Vite-only compilation passed. Evidence: `/workspace/research/transfer-rehearsal/full-project-2026-11-19/initial-results.json`, `baseline-build.log`, `changed-build.log`, and `restored-build.log`.

## Bounded correction

New proposals append a literal, hash-derived scope class to the existing wrapper instead of looking up a new CSS-module export. The appended CSS uses `:global(.focusTrial_…)` for that scope marker, while each existing heading/body/action class remains local to its CSS module. The marker is constrained by the existing fixed-pattern validator and collision rejection. Selector specificity is retained. The current page background, base wrapper styles, words, handlers, validation, data operations and existing type declarations are unchanged.

The change remains a two-file proposal. It does not regenerate or weaken customer type declarations, broaden the accepted input syntax, convert a framework, or add permission to apply or deploy. The original package and its sealed verifier remain unchanged; new packages bind their own new file and patch hashes. Do not mix old/new proposal files, regenerate a patch under an old package, or use a new proposal to certify an older applied result.

## Checks

The maintained source-trial fixture now runs strict TypeScript against its unchanged exact CSS declaration before compiling each original, changed and restored component. Its existing task and style checks continue to use the actual Git-applied disk states. A neighbouring-instance regression confirms that the scope marker does not restyle an unmarked component using the same local role classes. The focused six-suite check passed 132 tests. Evidence: `maintained-regression-before.log` and `maintained-regression-after.log` in the rehearsal directory. The before run fails during setup at the strict compilation boundary; it does not represent eleven individual assertion failures.

A fresh package from the actual repaired Focus export functions was retained in `generated-current/`, then exercised in the complete project. The project's own build and two JSDOM task tests passed in four states: original, changed, changed with later unrelated work, and restored. Those tasks cover validation, pending and confirmed feedback, page navigation, retained practice history and an invalid attempt producing no record or external fetch. Later edits to either touched file caused the packaged verifier to refuse without changing the project or package. Exact reversal restored the original stylesheet build while preserving a later branding edit and a newly added note. Evidence: `current-rehearsal/commands.json`, the stage logs and `current-rehearsal/result.json`.

This supplements the earlier recovery evidence. It is a builder-owned full-project rehearsal using existing dependencies, not a real customer application, fresh install, independent recipient, live service or rendered-browser acceptance. No browser harness was used. The project ends with its original two trial files and the later unrelated work. The 68-run review allowance remains unchanged and no deployment occurred.

## Workflow lesson

The earlier fixture's library build skipped the consumer's strict CSS typings, so it could not expose this failure. Keep the consumer's actual build command and related declarations in transfer verification. A syntactically valid patch and a successful bundler pass do not establish a successful customer build. Use the final `validation/` logs and source hashes for the integrated Focus checks; browser acceptance and independent release approval remain outstanding.

Final integrated checks: 1,491 tests across 119 files passed, strict TypeScript passed, lint reported zero errors and 11 existing warnings, and the production Sites build/packaging check passed. All 460 captured source/test/script/kit hashes were unchanged across validation. The fresh rehearsal package's exporter hash matches the validated source.
