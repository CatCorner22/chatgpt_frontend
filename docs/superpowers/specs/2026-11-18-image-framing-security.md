# Responsive authored-image framing: review model

18 November 2026. This is a bounded, source-reviewed model for the image-framing increment, based on Focus revision `823466648c0ba488348f22b422e37049126084dd`. It is not a repository-wide security scan or a rendered visual audit. The supported browser is unavailable; source and automated checks cannot establish the appearance of every image in a real browser.

## Scope and trust boundary

The feature changes how an existing validated raster image fits inside the authored page's existing frame. It does not edit source image bytes, crop a new asset, add an image service, fetch remote content, accept arbitrary CSS or execute scripts. Uploaded-image type, size, digest, decode, storage and recovery checks remain unchanged.

The allowed controls are bounded: cover or contain, nine cover anchors, and an optional anchor override at viewports no wider than 760 CSS pixels. Contain keeps the whole image centered within the same frame at every width. It may leave visible space showing the existing frame background and any supported texture; it must not silently change frame geometry or choose an unrelated background. Cover may hide parts of an image. Neither option proves the intended subject remains readable or that the composition is visually successful.

Framing values are untrusted when read from saved/imported state. A pure normalizer must select only fixed fit/anchor values, discard unknown properties and never interpolate input strings into CSS. The renderer receives normalized settings and maps anchors to constant object-position values. CSS-wide inheritance keywords, arbitrary percentages, URLs, CSS functions, selectors and style fragments are not part of the supported input. The current normalizer may read a field through JavaScript object inheritance, but still accepts only the same fixed values and returns a fresh object; it does not accept prototype-supplied CSS text.

## Canonical state and image identity

Legacy pages use centered cover without a framing property. That exact default (`cover`, `center`, `same`) stays omitted in normalized state, rather than adding an explicit object to every historical page. Contain renders centrally but retains the owner's inactive cover positions for switching back. An explicitly enabled narrow position stays pinned even when it currently equals the main position; later main-position changes do not silently change that explicit override. These are intentional nondefault settings. Reading an old save or resetting all controls to the default must not change library, undo or launch change-detector fingerprints.

Framing belongs to the selected image identity. Removing an image omits framing. Selecting different image bytes resets it; selecting the same validated image digest preserves it. Missing-image recovery may retain framing for that same identity while exports remain subject to the existing missing-image guard. A delayed upload must compare its result with the current image selection and project, use the latest settings, and never restore a superseded frame or image.

The existing Studio update/undo and library pathways remain the source of persisted settings. Controls must not create a separate storage channel or a second unsynchronized framing state. Preservation through migrations, library export/import, undo/redo and project recovery is covered by the separately assigned persistence review.

## One renderer and export lifecycle

The authored HTML renderer owns the framing CSS for all supported compositions. Preview `srcDoc`, standalone HTML and the ZIP's editable stylesheet use that same generated result. The decorative fallback artwork remains unaffected when no valid owner image is rendered. The optional narrow override uses the existing 760-pixel layout breakpoint and must take effect after the main image rule without accidentally losing to composition selectors.

AuthoredPagePanel must pass framing into the renderer and include it in the actual memo dependencies. A control that updates saved settings but leaves the memoized preview/export stale is a correctness failure. The export snapshot must continue to include the complete current settings, image identity and loaded image. An asynchronous ZIP result for a different current frame must not download or acknowledge success. Owner/session and mounted-lifetime checks remain in force.

Replacement/removal handlers reset framing through the same normalized settings update. The image's descriptive text is still required; framing is not an alternative to image accessibility text or permission to publish the image. No framed-image result may bypass asset validation or make a missing-image export appear ready.

## Control behavior and honest guidance

Controls are fully controlled by the supplied normalized value. They must remain usable by keyboard, have visible labels and unique group/input identities when two instances are mounted, and honor a disabled state throughout all controls. Changing a fit must not leave an invisible anchor active for contain. Turning off the narrow override restores inheritance from the main framing, and resetting to the original default must omit the optional field.

Explain the visible consequences: cover fills the frame and can crop; contain shows the whole image within that frame; narrow framing applies by viewport width rather than proving a particular physical phone layout. Instructions may ask the owner to inspect the main and narrow previews, but must not claim automated visual approval.

## Required checks

- Malformed, unknown and injection-shaped framing input produces only canonical allowlisted settings and fixed CSS. The exact legacy default remains omitted; normalization is idempotent, and explicit narrow-position intent survives main-position changes.
- Every composition uses the same fit/anchor behavior; all nine cover anchors map correctly, contain stays centered, and the narrow override uses the intended media rule and cascade.
- The actual iframe/export memo responds to framing-only edits. Standalone HTML and ZIP stylesheet preserve the same generated framing; no remote asset or script is introduced.
- Image replacement/removal resets framing, same-image upload retains it, and missing-image recovery does not bypass existing export guards.
- Deferred ZIP work cannot deliver or acknowledge an outdated frame after settings, owner or mounted context changes.
- Controlled UI tests cover both fits, keyboard input, unique instances, disabled controls, override enable/reset and concise consequence copy. Persistence validation remains separately assigned.

## Scoped review outcome

Independent source review found no remaining material issue in the fixed framing helper, renderer, controls or AuthoredPagePanel integration. The actual memo includes framing, and the existing full-settings export snapshot rejects an in-flight ZIP when current framing differs. Replacement/removal reset the optional field while same-digest uploads preserve the latest choices. The fixed 1024-pixel and 320-pixel previews retain their widths inside a keyboard-focusable scrolling canvas; Fit remains the available-width view.

An independent focused run of the helper, page-settings, authored renderer, framing controls, authored panel and authored export suites passed **108 tests in six files** on 18 November 2026. The tests cover all five compositions, exact shared CSS, default output, selection updates and delayed export guards. Native control semantics and labels were source-reviewed; a rendered browser keyboard/visual exercise remains pending. The separately assigned persistence review and final integrated release checks supplement this scope. None of these checks establishes universal visual quality or customer application compatibility.
