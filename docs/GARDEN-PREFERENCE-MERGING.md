# Garden preferences across tabs

## Customer problem and cause

An older Garden tab saved its entire in-memory preference record when the user moved to a different stop or toggled lessons. If another tab had already saved a newer goal, lesson depth or path position, the older record replaced those unrelated choices. This affected Garden preferences, not customer source files or design tokens.

Three reproductions established the cause: navigating after another tab changed goal/depth; toggling depth after another tab changed position; and retrying a failed local depth save after another tab changed goal. All three failed before the change. They distinguish stale whole-record replacement from invalid storage parsing or a failed render.

## Correction

Each Garden action reads the latest valid preferences and merges only its explicit fields plus any local fields whose saves have not been confirmed. Successful saves clear that pending set; failures retain it. A lesson toggle does not move the visible map stop even if another tab has saved a different position. Explicit navigation still chooses the new stop. Existing warnings and in-tab usability remain available when storage fails.

This is a read/merge/write improvement, not an atomic cross-tab transaction or live synchronization service. Simultaneous writes between the read and write can still race. An explicit choice of the same field takes precedence over the saved value. Invalid or unreadable saved preferences retain the existing in-tab fallback behavior. No project data or launch evidence is read or changed.

## Verification ledger

- Reproduced before repair: three failures, 18 passing tests in `garden-preferences-before.log`.
- After repair: 68 tests passed across Garden home, preference validation and Stratosphere component tests in `garden-preferences-after.log`.
- Full unchanged-source validation: see `garden-preferences-validation/`.

All logs are under `/workspace/research/transfer-rehearsal/resume-2026-11-19/`. The tests simulate sequential actions from different tabs using the same storage; they are not live multi-tab browser observations. Supported browser access remains unavailable. No independent review, deployment or customer-app change occurred.

Final validation: all 1,478 tests across 118 files passed; lint passed with zero errors and 11 existing warnings; production build passed. The edited component and test hashes were identical before and after the validation run. These are builder checks, not independent release approval.
