# Garden Path, Stratosphere and Field Guide design QA

final result: blocked

## Approved visual target and refinement

- Selected Garden Path concept: `/workspace/generated_images/exec-252a9375-13e2-40c7-ba79-23a4f624aec2.png`.
- User-approved kite and calmer river refinement: `/workspace/generated_images/exec-df0f3df6-ba99-4fb9-975a-160c3b7f5ca5.png`.
- Subsequent explicit user override: no beige. Implementation uses crisp white and cool mist surfaces, forest green controls, coral details and the generated transparent blue-green river. Reverie’s approved identity remains unchanged.
- Individual PNG assets were inspected. UI labels are real controls, not baked into map imagery.

## Implemented surfaces

Nine-stop Garden home, simplified shared navigation, calmer studio entry, optional lessons and remembered preferences; Stratosphere with six real design groups, live decision table and local interaction lab; a source-linked introductory Field Guide with practice decisions. Existing studio, Target, Telescope, Horizon and customer-export contracts remain available. See `docs/GARDEN-PATH-RELEASE.md` for behavioral coverage and limitations.

## Browser verification blocker

Browser initialization was attempted again during this release and failed with `the gaas-browser node_repl sandbox cannot be disabled`. Earlier managed preview also failed to open its relay. No browser workaround or alternate sandbox was used. The deployed owner-only implementation is not a customer-release signoff.

No implementation screenshot or rendered comparison is available. Automated tests, source review, asset inspection, build success and HTTP probes do not substitute for visual or browser acceptance.

## Acceptance still required

- Compare the actual page at 1440×1024, 800×1000, 390×844 and 320×740, including 200% zoom and reduced motion.
- Inspect map placement, long-label wrapping, contrast, responsive navigation, image transparency and absence of beige surfaces.
- Use keyboard-only navigation through map, radio choices, lesson controls, Tools/Help/account menus and real editor tasks. Confirm focus stays visible and lesson hiding returns focus.
- Exercise saved editor/import recovery, failed storage, Back/Forward, all nine stops and actual export/handoff. Inspect console/network failures.
- Exercise all three introductory practice stations, revise a choice, reset practice, search terms, toggle longer explanations, and follow source links. Practice must leave projects unchanged.
- Exercise Stratosphere changes, Undo, scope constraints, live map downloads, interaction examples and stale ZIP rejection.
- Perform the real customer trial and rollback demonstration separately; this redesign does not prove that result.
