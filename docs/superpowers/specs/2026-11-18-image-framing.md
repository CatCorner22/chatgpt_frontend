# Responsive image framing

Focus's North Star is frontend design and usability as good as the best human coders. This increment addresses an evidenced source limitation: every uploaded authored image previously used centered `cover`, even as composition frames changed across screen sizes. It does not establish visual quality or customer integration success.

## Delivery contract

- Keep controls in the existing image section: fill the frame, show the whole image, nine fixed anchors, optional separate anchor at page widths up to 760px, and reset.
- Add a 1024px preview beside Fit and 320px so both responsive framing rules can be inspected. Fixed preview widths scroll inside the stage, without widening the surrounding app. These are inspection tools, not test results.
- Use the original validated image and description. No pixel editing, second asset, remote fetch, new dependency, or script in exported pages.
- The shared renderer applies the same CSS to preview, working HTML and page ZIP, for all five existing compositions. Preserve frame ratios and all content.
- `contain` centers the full image at both sizes and may leave surface-colored space. Saved cover anchors remain dormant until fill is selected again.
- Persist only nondefault framing. Legacy/default page settings keep their prior serialized identity and Launch fingerprint. A changed framing is a design change and invalidates any stale ZIP/export evidence as existing identity rules require.
- Replacing an image with a different content ID clears its old framing. Reattaching the identical image preserves framing. Removing clears framing. Undo and library backup/restore preserve the corresponding complete page state.
- Controls are unavailable until the selected asset has loaded and has a description; errors remain visible. Values use finite allowlists, never arbitrary CSS.
- The decision map records declared framing and its dependency on composition. It must distinguish declared settings from validated assets, rendered appearance and customer integration.

## Verification and evidence

Core: malicious/unknown input normalization; default byte-identical output; all compositions; cover/contain/anchors; shared HTML/CSS/ZIP output; original asset and alt retention.

UI/integration: controlled accessible labels; independent instances; loading/missing/description guards; current preview memo; reset omission; same/different image replacement including pending edits; remove; fixed width selection; stale asynchronous ZIP rejection.

Persistence: migration, undo, launch/work hashes, library versions and backup deduplication preserve or invalidate the correct identities, without duplicating image bytes.

Release: independent review, full suite, TypeScript, lint and production build. Native browser currently cannot start (`the gaas-browser node_repl sandbox cannot be disabled`), so rendered/device acceptance remains open. A source or DOM test cannot establish actual crop appearance, keyboard scrolling, responsive layout or visual parity. Owner-private publication only; no customer files or deployments touched.

Research: [primary references](../../research/IMAGE-FRAMING-REFERENCES.md). Security obligations: [review](2026-11-18-image-framing-security.md).
