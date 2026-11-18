# Target: an optional proposed source change

Status: implementation proposal, 18 November 2026. Source review only; no customer or browser acceptance is claimed.

## Intended result

Keep Target's four-step journey. At the final step, an owner with a supported existing React/Vite page can provide two local files, review an exact styling proposal, and download its forward and inverse patches with a change contract. The ordinary design ZIP and guided prompts remain useful whether or not the page supports this optional path.

**Real customer facts:** Blake is a lay user, wants a calm and intuitive interface, expects decisions to explain later outcomes, and selected GitHub — React or Next.js as the first customer platform. **Assumed review contexts:** a business owner provides a booking page; a developer colleague reviews and trials the change. These are not observed user studies.

This closes part of the gap described in `docs/research/CUSTOMER-VALUE-GAP.md`: it proposes actual source edits instead of making the recipient invent them from design values. It still does not connect to GitHub, run customer code, build the project, install dependencies, publish, or establish that a customer workflow is preserved.

## Placement and progressive disclosure

Add one closed optional panel in **Target → Prepare the handoff**, after the existing plan summary/download guidance and before the longer prompt list. Keep the first three steps and their draft schema unchanged.

- Panel label: **Include a proposed code change**.
- One-line explanation: “Have the page’s source files? Focus can prepare exact styling edits for a supported page, ready for your developer to review in a separate preview.”
- Show the panel only for the existing-app path and the current `react` platform selection. In other paths, retain the existing handoff; do not add a disabled feature teaser.
- Require the same selected saved design and complete trial plan as the normal handoff. Explain a missing prerequisite with a link/button to the relevant existing step; do not create a second form for the same answers.
- Keep this optional. Closing it must not clear Target answers or prevent the ordinary ZIP/prompts from working.

The current Target platform label combines React and Next.js. Before reading files, ask a small clarifying question **“What runs this page?”** with “React with Vite,” “Next.js,” and “I’m not sure.” Only the first supported adapter proceeds. Next.js and unsure answers show a developer-guided path without blocking Target. Treat this answer as owner-provided context, not verified framework detection; two files cannot establish the project's actual runtime.

## Three short actions inside the panel

### 1. Choose the page files

Use two separately labeled native file inputs: **Page file (.tsx)** and **Matching style file (.module.css)**. Accept exactly two bounded UTF-8 files. No archive, directory picker, drag-only control, server upload, network requests, execution, or autosave of source in this slice.

Ordinary file selection reveals a basename, not the path inside a repository. Require each normalized repository-relative path explicitly when it is not available from the selection. Label it **“Where this file lives in the project”**, with an example such as `src/pages/Booking.tsx`. Explain in optional help: “Your developer can find this in the project file list. Focus uses it to address the proposed edit; it has not fetched the file from GitHub.” Validate that the CSS import resolves to the selected style path. Do not invent a path from a filename.

Keep essential privacy copy short: “Read in this tab only. Choose source files without secrets or customer records.” Display filename, declared relative path and size. Offer **Replace file** and **Clear selected files**. Canceling a file picker leaves the previous selection intact; replacing one file invalidates its recognition, roles and proposal immediately.

Primary action: **Check whether this page is supported**. The engine uses real syntax parsing and a strict supported subset (architectural plan: Babel AST and PostCSS with source maps disabled), not arbitrary text replacement. It recognizes one native page wrapper and explicit classes/labels for heading, body and primary action. It never renders imported TSX or injects it into an iframe.

### 2. Review the proposed roles and edits

On recognition, show **“Source shape recognized”**, followed by a compact list using real source labels:

| Plain role      | What the owner sees                                        | Developer detail behind a disclosure                            |
| --------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Page area       | Recognized wrapper and selected page filename              | JSX element and CSS-module class                                |
| Main heading    | Actual static heading text                                 | Source class/reference                                          |
| Supporting text | Actual static text or an honest “text not identified” stop | Source class/reference                                          |
| Main action     | Actual static action label                                 | Button/link class and unchanged destination/handler description |

The owner confirms these are the intended parts of the page. This is a mapping confirmation, not a claim that the app is safe or tested. If more than one candidate or a dynamic/unresolved role prevents a deterministic mapping, stop this path and offer the normal handoff. Do not guess based on the prettiest candidate.

Explain the concrete effect using the engine's actual changed-property list, for example “The proposal adjusts this heading's size and this button's appearance.” Do not promise all selected Focus features are implemented if the adapter only supports a subset. Show unsupported or unchanged choices plainly.

Primary action: **Prepare proposed edits**. Display an exact escaped-text diff, a small file-change summary and the selected Focus design title. Never substitute a generic specimen for a preview of this customer's page. Label the diff **“Proposed source changes — page not run here.”** Keep code details available for the colleague; the plain summary should be useful without reading code.

### 3. Take the proposal to the preview

Primary action: **Download proposed code change**. Keep this label distinct from the existing design-specification ZIP button. The proposal package contains the exact forward patch, inverse patch, a bounded versioned change contract and short review/apply/undo instructions. Include hashes and source context necessary for precondition checks; the engine contract determines exact file names and contents.

Successful browser invocation says: **“Download started. Your developer can review these edits in the separate preview. Your project has not been changed.”** Do not claim the user received or applied the file merely because a download was invoked.

Next step: “Give the proposal to your developer with the Target trial plan. Check the existing tasks in the preview and demonstrate undo before reviewing a release.” The existing guided prompts remain available. Do not set launch history, emit a passed test, mark the ordinary pack as downloaded, or add a customer-readiness badge.

## Unsupported and failure paths

| Situation                             | Concise message and recovery                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js or unknown runtime            | “This first source-change format supports React with Vite and CSS modules. Use the design handoff below while your developer checks this project.”                           |
| Unsupported or ambiguous source shape | “This page needs a developer-guided integration.” Give the concrete reason, keep selected files visible, and offer **Use the design handoff**. No fallback page replacement. |
| Matching CSS file/path missing        | “The page imports a different style file. Choose that file and confirm its project path.” Keep the other file selected.                                                      |
| Invalid encoding, path or size        | Identify the affected input and the supported requirement. Keep the original Target draft and other valid input.                                                             |
| Source, mapping or plan changed       | “These inputs changed. Review and prepare a new proposal.” Remove old download eligibility immediately.                                                                      |
| Saved design changed elsewhere        | “The saved design changed. Reload designs and review the plan before preparing another proposal.” Do not silently adopt the new version.                                     |
| Owner/session cannot be verified      | “Your session needs verification before a proposal can be prepared or downloaded.” Use the existing session flow; no bypass.                                                 |
| Browser download failed               | “The proposal could not be downloaded. Your files and project are unchanged. Try again.” Clear any earlier success message.                                                  |

Errors belong to the optional panel, with a focused error summary and the affected field named. They must not overwrite unrelated Target save/recovery messages. A file-level refusal leaves the regular handoff usable.

## State and delivery boundary

Retain Target's current owner, draft-CAS, library reread, generation/revision, mounted and export checks (`src/routes/target.tsx`, especially `prepare`). Add no source bytes or role mapping to `TargetDraft`, the saved design library, local/session storage, launch records or account storage.

Prefer a separate in-memory component for source inputs, recognition, mapping and proposal. It receives an immutable selected-design/trial-plan context and a parent revalidation hook; it must not implement a second weaker version of Target's export verification. The parent remains the authority for the current saved design, current draft raw value and browser owner. The exact prop/API contract belongs to the engine/integration design, not this UX document.

- Capture owner, selected-entry snapshot, draft snapshot/revision, source bytes/paths, mapping and proposal generation at the start of each asynchronous operation.
- Invalidate synchronously on replacement, path edit, mapping edit, selected design/plan change, cancellation and unmount. Do not rely solely on an effect that runs after rendering new inputs.
- Revalidate owner and current stored design/draft before preparing and again immediately before every download. A lock, unreadable saved state, account change, stale generation or changed fingerprint rejects delivery.
- A late file read/hash/pack completion cannot restore old roles, download old bytes or announce success after a newer selection, cancellation, step change or unmount.
- Source input is deliberately ephemeral. Say **“Selected source files stay only in this open panel. Keep your originals; returning later requires selecting them again.”** Closing the disclosure may keep the mounted input state; leaving the final step/unmounting clears it. Do not add disruptive unload prompts for an unchanged original file that remains on the user's computer.
- A session lock follows the existing hidden-draft boundary. Never expose or export old-owner data to a new owner. Any proposal must be revalidated after access resumes.

Keep source-proposal status separate from Target's existing `prepared` flag. That flag currently describes the design pack; changing it could falsely mark a different artifact as delivered. If the sidebar needs clearer wording, name the artifact explicitly rather than combining evidence states.

## Acceptance cases for the implementation slice

1. The normal four-step Target path, damaged-draft recovery, partial library recovery, ordinary ZIP and prompt copying pass their existing regressions unchanged.
2. New-project/non-React paths do not acquire a source requirement. Existing React owners can decline or close the panel and finish the normal handoff.
3. Next.js/unsure selections cannot invoke the unsupported adapter. The UI never labels source recognition as project/framework compatibility.
4. A supported owned fixture shows actual source labels and mapped classes, produces real allowed TSX/CSS changes, and downloads the exact forward/inverse proposal and contract. No customer data, handlers, destinations or unrelated source spans are rewritten.
5. Invalid/oversized/ambiguous files and mismatched paths fail with useful messages. No customer code executes, source is uploaded, or source/roles are written to storage.
6. Replacement reads completing out of order, repeated preparation, cancel/retry, path/role changes and unmount cannot revive or deliver an old proposal.
7. A stored design/draft change, owner change or lock before/during preparation or just before download refuses the stale operation. A failed retry clears earlier success. Original Target answers remain intact.
8. With the panel closed, step navigation and keyboard focus remain sensible. Each file input, path and role confirmation has a visible label matching its accessible name; all actions work through native controls. Diff regions wrap or scroll independently on narrow screens.
9. Fixture forward/inverse application checks exact preimages and preserves unrelated files. A changed touched file produces a conflict instead of overwriting newer work. These engine checks do not imply runtime or customer acceptance.
10. Source-level, fixture-build and component-test results are recorded separately from browser, real customer task and rollback evidence. With browser access unavailable, the UI is not declared visually or interactively accepted.

The customer milestone still needs the actual repository and preview. This increment earns a narrower claim: **Focus can prepare an exact, reviewable source-change proposal for the supported shape.**
