# Closing the existing-app delivery gap

Reviewed 18 November 2026. This is a source review and proposed implementation slice, not customer acceptance or an executed repository trial.

## Customer facts and review contexts

- **Real:** Blake describes himself as a lay user, wants choices and their later consequences explained, prefers a calm and intuitive experience, and expects a useful frontend improvement without breaking the customer's working app.
- **Real:** The selected first delivery platform is GitHub — React or Next.js. Paid AI spending is paused. No customer repository or isolated customer preview is available for this review.
- **Assumed review context:** A small-business owner brings a working booking page and wants a more coherent appearance while keeping booking intact. The owner can choose a page and compare results but needs plain-language instructions.
- **Assumed review context:** A developer colleague receives the output and needs the exact proposed edits, their base version, checks, remaining uncertainty, and a selective way to undo the trial.

These contexts are not interviews or observed usability sessions. Browser acceptance remains blocked by the available browser infrastructure.

## What the current code delivers

| Boundary             | Current evidence                                                                                                                                                | Missing link to customer value                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target               | `src/lib/target.ts` validates the saved design and bounded owner answers, then produces a design pack and five inspect/implement/test/rollback/release prompts. | It does not inspect customer source, identify a compatible component, or produce the requested source change. A human or another coding tool must interpret the prose. |
| Existing-site pack   | `src/lib/exportPack.ts` emits scoped values and optional semantic bridges with preservation and undo instructions.                                              | A variable file can be valid and have no visible effect. Whether actual components consume the values correctly is not established by the pack.                        |
| Telescope            | `src/lib/telescope.ts` identifies exact built HTML/ZIP bytes, inventories files and references, and generates an explicitly unrun task plan.                    | A built-artifact hash does not establish the source base, allowed file changes, correct integration, or a demonstrated rollback.                                       |
| Browser/review tools | Existing runners, preservation fixtures, review packets and launch records provide useful mechanisms.                                                           | Their results need binding to the exact proposed source change and built artifact. Fixture success does not establish a customer journey or excellent design.          |

The next major improvement should close one of these links. Adding another checklist without a source change would make preparation clearer but would not fulfill “improve my existing app.”

## Recommended next slice: one source-aware trial patch

Produce a **download-only proposed restyle of one supported existing React page**, with a machine-readable change contract and exact inverse patch. Keep it within Target's existing workflow; do not add another main product area.

Start with a deliberately narrow adapter: a React/Vite page using an imported CSS module, a single identifiable page wrapper and explicitly identifiable heading, body and primary-action classes. Begin with owned local fixtures. The implementation may accept customer-selected source files only after the same bounded intake and adapter checks exist. React and Next.js must not be treated as interchangeable; a Next.js adapter needs its own project/build fixture before being offered.

This is a proposed supported shape, not a claim that current customer apps have it. If an adapter cannot identify the page or prove its limited editing contract, return “This page needs a developer-guided integration” with the reason and retain the existing handoff option. Do not guess, weaken the checks, or silently fall back to replacing the page.

### Smallest complete path

1. **Read a snapshot.** Accept only selected source files or a bounded, inspected archive in memory. Inventory names and exact bytes; compute per-file hashes. Never run scripts, install uploaded dependencies, evaluate source, fetch referenced resources, or write to GitHub. Exclude secrets, dependency folders, build output and unrelated customer records from the requested snapshot.
2. **Recognize support.** Parse the selected TSX/CSS and identify the exact component and style references. Use a real syntax parser or a deliberately tiny documented grammar that rejects ambiguity; do not use broad search-and-replace on arbitrary source. Reject dynamic/spread class composition, unresolved imported components, inline/important overrides, existing trial-marker collisions and styles outside the adapter's covered shape.
3. **Map real roles.** Show the page and the actual visible heading/action labels for confirmation. Connect the selected Focus values to specific existing style roles. Pair foreground/background changes. A token-only file that no rendered element consumes is not an implemented improvement.
4. **Generate the proposed change.** Make the smallest scoped TSX/CSS edit: an isolated wrapper modifier and its explicit role styles, preserving the customer's text, elements, links, handlers, field names, validation and data calls. Leave routes, dependencies, global styles, authentication and configuration untouched. Show the exact diff and a plain description of its effect. Do not claim a preview of the actual app unless it was built and rendered.
5. **Deliver reviewable files.** Download the forward patch, inverse patch, change contract and short instructions. The exported patch is a proposal for an isolated working copy, not a completed GitHub edit or release. Check preimages before applying; reject mismatched files or marker/path collisions.
6. **Bind the later evidence.** A recipient's build/task/rollback report identifies the contract digest, resulting source revision and built artifact hash. A source/build/design change makes old results stale. An uploaded statement remains recipient-reported evidence; hashing it does not verify that its claims are true.

## Change contract: useful because it binds a real patch

Use a versioned, strictly validated record with:

- Selected design identity and normalized design fingerprint.
- Adapter name/version and explicit supported scope.
- Snapshot digest; optional repository/base commit supplied by the owner, labeled unverified unless independently checked.
- A bounded file list: normalized relative path, operation, expected-before SHA-256, expected-after SHA-256, and patch digest. No arbitrary executable commands embedded in the contract.
- The exact role mapping and changed visual properties.
- Preserved source invariants checked by the adapter, plus behavioral invariants still needing execution.
- Required tasks with stable IDs, expected outcomes and initial `not-run` status.
- Rollback inputs and conflict behavior. Undo must preserve unrelated files; if a touched file changed after the trial, stop for selective review rather than overwriting it.
- Separate states for `prepared`, `static-checks-complete`, `recipient-reported`, and `needs-browser-review`. No universal “safe” badge or automatic publication approval.

A contract-only first commit is a valid prerequisite. It should not be presented as the completed customer-facing slice until it accompanies an actual source-aware proposal.

## What can be proved without a customer repository

| Check             | Local evidence that is possible                                                                                                                                                                                                  | Limit                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Intake            | Reject traversal, duplicates, symlinks, excessive expansion, ambiguous encodings and oversized text; no execution/network/storage mutation. Reuse the existing archive hardening rather than inventing a permissive second path. | Does not establish the completeness or truth of an owner's snapshot.                         |
| Exact edits       | Golden fixtures and syntax-level assertions show only allowed imports/class references/style declarations changed; words, destinations, handlers, fields and source outside those spans remain identical.                        | Source preservation alone does not prove runtime preservation.                               |
| Visible effect    | Build an owned React/Vite fixture using repository tooling; assert the added styles are actually emitted and consumed. When browser access returns, compare computed styles and before/after screenshots at fixed widths.        | Build/CSS assertions do not establish visual quality, layout fitness or customer usability.  |
| Behavior          | Run owned fixture tasks, including success, invalid input and failure recovery, before and after the change. Use test data and no external side effects.                                                                         | Component tests are narrower than real browser tests; neither fixture proves a customer app. |
| Conflict handling | Refuse stale preimages, double application, unsupported structure and changed design fingerprints.                                                                                                                               | A refusal is an expected supported outcome, not a successful redesign.                       |
| Selective undo    | Forward then inverse yields the original touched bytes. Unrelated file edits survive. Later edits to touched files cause an explicit conflict, never blanket restoration.                                                        | Real repository conflicts and customer workflow recovery still need a trial.                 |
| Evidence binding  | Wrong-contract, wrong-source, wrong-artifact and stale reports cannot count for the proposed change; missing tasks remain unrun.                                                                                                 | A manually supplied report is not independently verified execution evidence.                 |

Do not install or execute code from an uploaded customer snapshot as part of these tests. Use owned fixtures only. Do not add a Next.js compatibility claim merely because a TSX transformation passes a React fixture.

## Plain-language customer completion criteria

- The owner can tell which existing page is supported, what will change and what remains unverified.
- The developer receives an exact diff against known bytes, rather than having to invent an implementation from design tokens.
- The isolated fixture actually changes appearance while retaining its declared task behavior.
- Applying to a changed base stops with a useful explanation. Undo removes the trial and preserves unrelated work.
- Focus distinguishes “proposal prepared,” “checks run on this fixture,” and “customer trial verified.”

The subsequent customer milestone still requires the actual repository, isolated preview, realistic content, relevant failure/permission flows, phone/desktop/keyboard/zoom checks and an observed handoff/rollback. Only that trial can support a claim about that customer's app. This slice moves Focus from describing a change toward producing one; it does not establish the entire redesign, zero defects, or North Star equivalence.
