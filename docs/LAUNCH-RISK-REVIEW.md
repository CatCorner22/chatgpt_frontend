# Local launch risk review

Reviewed 2026-11-18. Scope: the signed-out local workspace, first visit, saved-work return, refresh, common routes, and recovery from unavailable or damaged browser storage. This is not a production deployment or connected-account certification.

Applied `pilchard-forensic-audit`, `end-to-end-product-design`, `real-time-testing`, and `completion-evidence-gate`. The initial review was read-only; the primary agent then authorized the bounded Studio recovery fix described below.

## Outcome and actors

The owner must be able to describe a real project, select and edit a direction, export a usable artifact, and return to saved work without cloud credentials. A returning owner with damaged storage needs preserved original data and an honest recovery path. An operator configuring account features is outside the local-only acceptance scope.

| Lifecycle boundary | Observed evidence |
| --- | --- |
| First local visit | Home rendered without credentials or page errors. Local workspace context visible. |
| Create and use | Brief → directions → three choices → Vision completed. |
| Artifact handoff | Working HTML downloaded; new-work state and library entry persisted. |
| Refresh and return | Same design restored after refresh; My designs had one entry. |
| Broken saved data | A P1 data-loss defect was reproduced, fixed, and retested below. |
| Storage quota during recovery | Creation blocked, original bytes downloadable, retry resumes after writes become available. |
| Library archive failure | Current design still survives refresh; visible warning explains the separate archive failure. |
| New full-workspace backup/import | Owned by another implementation pass; not certified by this review. |

## Confirmed P1: creation silently continued after failed restoration — fixed

**Before:** place `{broken-json` in `refraction:v1`, refresh, enter a new ceramics brief, and select **Find my direction**. Directions appeared, but the primary storage key still contained the broken JSON. Refresh returned to a blank brief. The restoration catch returned before `setLoaded(true)` while editing remained visible; autosave therefore never ran. The same catch also treated archive failures as parsing failures.

**Changed surface:** `src/routes/index.tsx` Studio restore, save-warning and recovery UI; `src/lib/studio-recovery.ts`; `src/test/studio-recovery.test.ts`. The existing `accountSaveResult` integration was retained.

**After:** validate render-consumed state fields before migration. A malformed save is copied to a unique recovery key and read back before the primary save may be replaced. Original bytes remain downloadable on later visits. Recovery/storage failure exposes a blocked screen with original-data download and retry actions. The workspace is only exposed after a current-save write succeeds. Current-save and library writes report separate persistent errors; library failure no longer disables current-save persistence. Valid partial legacy states still pass to the existing migration.

**Browser evidence (Chromium, development server):**

- Syntax error `{broken-json`: exact original retained, new brief/directions survived reload, no page errors.
- Valid JSON with `content.features: null`: same result.
- Valid JSON with nonarray `history`: same result.
- Quarantine write throws `QuotaExceededError`: creation absent, original unchanged, downloaded recovery text exactly matched the original. Removing the injected fault and pressing **Try again** reopened creation.
- Library-key-only writes throw `QuotaExceededError`: selected design remained usable and survived refresh; the separate library warning was visible; no page errors.

## Other evidence and limitations

Fresh route checks returned HTTP 200 with no page errors for `/`, `/library`, `/quality`, `/review-room`, `/taste`, `/brands`, `/progress`, `/auth`, `/reset-password`, `/projects`, `/critic`, `/watchtower`, `/proof`, and `/showcase`. The client redirected `/projects` to the local account explanation as expected. The local create/export/return flow issued no server-function requests.

No new P0 was observed in this bounded pass. One optional-surface P2 was observed: `/taste` enabled **Create my portrait** without backend configuration and exposed a missing-Supabase-environment error after clicking. This was sent to the primary agent. The shared AI spending policy remains disabled; this review did not exercise a paid provider or a connected account.

## Completion evidence

- **Acceptance:** damaged primary data is preserved before replacement; new work survives refresh; a failed recovery write cannot expose silently unsaved creation; archive failure is distinguished from primary-save failure.
- **Evidence:** the browser scenarios above, 13 focused recovery tests, TypeScript, changed-file ESLint, and the full Vitest suite.
- **Observed:** all recovery scenarios passed; TypeScript and changed-file ESLint passed; **48 test files / 432 tests passed** in 13.77 seconds at this checkpoint.
- **Not verified here:** production build/server smoke, connected Supabase writes, live paid AI, cross-device accounts, and the concurrent workspace-backup feature. Those need their own evidence.
- **Verdict:** the reproduced local-save P1 is resolved at this checkpoint. This bounded result does not by itself assert the entire product is ready for deployment.


## Subsequent integrated hardening

The primary pass also repaired the optional Taste action: with paid AI paused, it saves inspirations locally without calling a backend. Whole-library corruption now receives the same original-byte protection as the current save, including recovery downloads and blocked-storage handling. A subsequent review reproduced stale toast Undo deleting a later restored library entry; the final release gate includes that correction in both the Library and Brands views. See `LAUNCH-READINESS.md` for the final integrated verdict rather than the earlier checkpoint counts above.
