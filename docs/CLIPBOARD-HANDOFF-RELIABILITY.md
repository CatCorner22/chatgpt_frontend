# Clipboard handoff reliability

Copy feedback must describe a completed clipboard request from the current mounted control. It does not prove that a developer received the text, that files changed, or that a customer release passed.

## Reproduced failures

The shared `useCopied` hook allowed overlapping clipboard writes, retained the previous success label during a new pending write, and returned success after unmount. A late success could also create a timer after cleanup. Target's separate prompt controls likewise allowed two writes to overlap. Delayed-promise regression tests reproduced these failures before repair.

## Change

The shared hook accepts one outstanding write per hook instance. A concurrent request returns false without writing and tells the user to wait. Starting a new accepted request clears the old label and timer. A mounted-lifetime check suppresses late success, late failure feedback, timers and successful return values after unmount. The request lock releases on resolution or rejection.

Target accepts one outstanding prompt write, disables all prompt-copy buttons while it is pending, and displays a pending label for the selected prompt. Completion releases the controls for retry. Existing draft-revision and mounted checks still govern feedback. The textareas remain available for manual selection and copying. Copying does not prepare a package or establish launch acceptance.

These controls cannot cancel a browser clipboard write already in flight, coordinate clipboard changes from other apps, or prove the operating-system clipboard remains unchanged later. No clipboard permission workaround or automatic retry was added.

## Evidence and limits

Builder-run regression logs are saved under `/workspace/research/transfer-rehearsal/resume-2026-11-19/`: `copy-regression-before.log`, `target-copy-before.log` and `clipboard-focused-after.log`. The focused hook and Target suites passed 32 tests after repair. Full validation logs are in `clipboard-validation/`.

The full suite passed 1,448 tests across 117 files. Lint passed with zero errors and 11 existing warnings; the production build passed. The repository Git configuration hash was unchanged. The tests exercise delayed API promises and DOM state; they do not claim operating-system clipboard verification.

Browser initialization remains blocked by the supported tool. Real clipboard permissions, browser announcements and rendered keyboard behavior remain unverified. This is not independent audit or release approval; the existing 68-run independent-review allowance is exhausted. No deployment occurred.
