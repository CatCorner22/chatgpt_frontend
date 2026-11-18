# Stratosphere and Studio option-cache correction

18 November 2026. Source review and automated regression evidence; no new rendered-browser acceptance claim.

## Expected and observed behavior

Changing a design in Stratosphere must remain effective when its owner returns to the Studio questions. Answering a spacing question must not silently restore an earlier palette. Undo and Redo must show options derived from the restored design. A response from an abandoned question or direction request must not update the active design.

The reproduced failure started with cached density options whose full token snapshots contained blue `#1d4ed8`. The owner changed the accent to crimson `#b51f41` in Stratosphere, returned to density, and selected an answer. The old whole-token option silently replaced crimson with blue. A second reproduction generated crimson options, then used Undo on the same question: saved tokens were blue but the preview and selected answer still used crimson.

With an option request pending and no cache present, Undo also failed to request fresh options. The regression expected two requests across the design change and observed only one. Switching from pending regeneration to an already-cached question could leave the busy state active after abandoning the first request.

## Ranked hypotheses and root cause

1. **Derived option cache and request lifetime — confirmed.** Cached options contain complete token objects. Workshop edits and Undo/Redo retained old options; selecting an option replaced all tokens. Exam originally watched only the question index, so same-question token changes did not invalidate pending work. Async completion could also refill a cache after its component had unmounted.
2. **Token normalization — ruled out for the reproduction.** Persistence contained the newly selected crimson before answering; the old value returned specifically when committing a cached option. The same-step Undo reproduction likewise showed correct saved blue tokens before choosing a stale crimson option.
3. **Preview rendering — ruled out as the primary cause.** The selected stale token object was also written to persisted Studio state. This was a state/data error, not just a visual discrepancy.

## Narrow correction

- Workshop updates, Undo/Redo, and intentional previous-answer rewind discard derived question options. Saved designs, content and history remain intact; no historical records are migrated or rewritten.
- Exam request lifetime follows stable source values: design identity, question, tokens, purpose, brief and prior answers. The generated response is not part of that context. Optional taste hydration does not restart an already-started paid request.
- Exam cleanup invalidates obsolete requests on question/context changes and unmount. Brief cleanup similarly prevents abandoned direction generation from changing the saved stage. These checks suppress obsolete local completion; they do not claim to cancel server work or reverse provider charges.
- A cached destination resets busy/error state. Its controls remain usable when an earlier request is discarded.
- The prior-answer action is labelled **Revisit previous answer** and explicitly explains that it restores the earlier design and that Undo can bring the current design back. That rewind is intentional; the silent stale-option replacement was not.

## Regression evidence

Failing tests were run before their corresponding fixes: the initial five workshop/unmount/rewind regressions, the same-question Undo preview/commit reproduction, and the pending same-question Undo reproduction. The latter failure was `expected "vi.fn()" to be called 2 times, but got 1 times`.

The final Studio lifetime suite has **11 passing tests**, covering palette persistence after choosing, page-change invalidation, Undo and Redo on the same question, Undo while generation is pending, navigation into a cached question while regeneration is pending, abandoned Exam and Brief completions, explicit rewind semantics, and React StrictMode accepting the final request while ignoring an abandoned success or rejection. The tests mount the real Studio and Exam and inspect actual persistence, update, commit and cleanup paths; the workshop control, preview renderer and server calls are bounded test seams.

Focused verification passed **62 tests in four files**:

```sh
npx vitest run src/test/studio-workshop-lifetime.test.tsx src/test/studio-recovery.test.ts src/test/undo-versions.test.ts src/test/local-design.test.ts
npx eslint src/routes/index.tsx src/test/studio-workshop-lifetime.test.tsx
```

The supported browser could not initialize during this work. These JSDOM/source checks establish the tested state and async-lifetime behavior, not responsive rendering, visual quality or a full real-browser customer journey. Final integrated build and broader release checks are recorded separately in `STRATOSPHERE-RELEASE.md`.
