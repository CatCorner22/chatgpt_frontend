# Garden Path, Stratosphere and Field Guide design QA

final result: blocked

## Approved visual target and refinement

- Selected Garden Path concept: `/workspace/generated_images/exec-252a9375-13e2-40c7-ba79-23a4f624aec2.png`.
- User-approved kite and calmer river refinement: `/workspace/generated_images/exec-df0f3df6-ba99-4fb9-975a-160c3b7f5ca5.png`.
- Subsequent explicit user override: no beige. Implementation uses crisp white and cool mist surfaces, forest green controls, coral details and the generated transparent blue-green river. Reverie’s approved identity remains unchanged.
- Individual PNG assets were inspected. UI labels are real controls, not baked into map imagery.

## Implemented surfaces

Nine-stop Garden home, simplified shared navigation, calmer studio entry, optional lessons and remembered preferences; Stratosphere with six real design groups, live decision table and local interaction lab; a source-linked introductory Field Guide with five practice decisions and a revisable, hideable choices summary. Authored pages embed the selected licensed Latin fonts for all three Stratosphere pairs. Existing studio, Target, Telescope, Horizon and customer-export contracts remain available. See `docs/GARDEN-PATH-RELEASE.md` and `docs/PORTABLE-TYPOGRAPHY-RELEASE.md` for behavioral coverage and limitations.

## Browser verification blocker

Browser initialization was attempted again during this release and failed with `the gaas-browser node_repl sandbox cannot be disabled`. Earlier managed preview also failed to open its relay. No browser workaround or alternate sandbox was used. The deployed owner-only implementation is not a customer-release signoff.

No implementation screenshot or rendered comparison is available. Automated tests, source review, asset inspection, build success and HTTP probes do not substitute for visual or browser acceptance.

## Acceptance still required

- Compare the actual page at 1440×1024, 800×1000, 390×844 and 320×740, including 200% zoom and reduced motion.
- Inspect map placement, long-label wrapping, contrast, responsive navigation, image transparency and absence of beige surfaces.
- Use keyboard-only navigation through map, radio choices, lesson controls, Tools/Help/account menus and real editor tasks. Confirm focus stays visible and lesson hiding returns focus.
- Exercise saved editor/import recovery, failed storage, Back/Forward, all nine stops and actual export/handoff. Inspect console/network failures.
- Exercise all five introductory practice stations, revise a choice, reset practice, search terms, hide/reopen the choices summary, toggle longer explanations, and follow source links. Practice must leave projects unchanged. Check all station names remain visible on narrow screens and match their accessible labels.
- In a clean browser without the selected fonts installed, check actual font loading in the sandboxed preview and downloaded pages. Inspect all three pairs, real weights, long labels, line wrapping, non-Latin fallbacks, loading and failure. Export parity tests do not prove rendered typography.
- Exercise Stratosphere changes, Undo, scope constraints, live map downloads, interaction examples and stale ZIP rejection.
- In Target step 4, open the optional source trial; use the file-request prompt, confirm actual roles, inspect the declaration comparison and diff, and download the proposal. Exercise unsupported/unknown setup, malformed inputs, replacement, cancellation, step exit, account changes and loading failure/retry. Confirm ordinary handoff remains usable. Check long paths, labels and the diff on narrow screens and with keyboard/zoom.
- Hand the actual source-trial ZIP and kickoff to a human or LLM recipient in an authorized isolated project. Observe complete-file verification, exact application, actual project checks and visitor tasks, evidence return and selective reversal. Test a changed touched file causing a stop; retain unrelated edits. A model's success statement alone is not evidence.
- Open Target's returned-file check, select the recipient's two actual files, and inspect proposed/original/mixed/different outcomes. Verify visible result focus, file-path wrapping, cancellation, replacement, clearing, close/reopen and context-change recovery on desktop and mobile. Check that an original match is not described as a proven undo and no result changes Launch history.
- Perform the real customer trial and rollback demonstration separately; this redesign does not prove that result.
