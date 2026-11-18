# Responsive image framing

Focus now lets the owner direct the framing of an uploaded image in the authored website: **Fill the frame** or **Show the whole image**, nine alignment choices, and an optional different alignment for small layouts. Controls stay inside **Add your own image**. Longer explanations remain closed until requested.

This closes a specific frontend craft gap: a centered crop cannot accommodate every subject when a wide layout becomes narrow. The owner can now choose the appropriate treatment while keeping one original image, its description and the existing composition. The original file is not edited. This is authored-page output; it does not restyle a customer's existing website or extend the React/Vite source-trial adapter to Next.js.

The preview now offers **Fit**, **1024 px** and **320 px**. Fixed sizes scroll inside the preview canvas when necessary. Fit still uses the available space and can show the small-screen layout. The narrow framing rule applies at page widths of 760 CSS pixels or less. The decision map records how composition changes frame shape and crop, with clear separation between declared settings and verified appearance.

## Preservation and delivery

- Default behavior stays centered cover, with byte-identical legacy renderer output across all five compositions. Canonical default framing stays absent from saved settings, so existing design/review identities do not change merely by opening a save.
- Nondefault framing travels through saved history, undo/redo, library versions and library backup restoration. It changes the design identity as intended. Backup tests retain a single unchanged image asset even when saved designs use different framing.
- Contain centers the whole image in the same frame; it may leave visible background or texture. Previous cover positions remain saved for switching back. Different image bytes reset framing; reattaching the identical image preserves it. Removing the image clears its framing.
- The preview, standalone HTML and editable ZIP use one renderer and the same CSS. The ZIP retains the original image and alt text, and the private source snapshot retains framing. An in-flight ZIP is discarded when framing changes before it finishes. Session/project/unmount guards remain in force.
- Descriptions and valid image bytes are still required. Framing controls remain disabled while the image is loading, missing or awaiting its description. Only fixed CSS values can be emitted; no remote image processing or new dependency is introduced.

## Evidence

The complete application suite passes **1,189 tests across 102 files**. Strict TypeScript passes. Independent review found no material defect and independently ran 108 relevant tests successfully. Additional tests cover persistence, decision-map scope and deterministic snapshots. A separate comparison against the published source confirmed 15 exact legacy renderer outputs across all five compositions. The actual panel/export tests check the preview document, delivered HTML blob and editable CSS, not only the settings object.

Changed TypeScript files pass ESLint and formatting. A repository-wide lint run remains red: 3,547 errors (3,546 formatting and one intentional control-character regex rule), plus 11 warnings. Its errors occur in 95 source files byte-identical to the published baseline and five ignored rehearsal files; none are from this increment. This is retained as lint debt, not represented as a clean whole-repository lint result. No broad formatting rewrite is included in this feature.

Logs are in `.agent/image-framing-*.log`; the final production-build/package and private-deployment results follow the source commit in `/workspace/deliverables/focus-image-framing-release.json`. The [research references](research/IMAGE-FRAMING-REFERENCES.md), [design contract](superpowers/specs/2026-11-18-image-framing.md) and [bounded security review](superpowers/specs/2026-11-18-image-framing-security.md) define the source basis and checks.

## Still required

The supported browser cannot start: `the gaas-browser node_repl sandbox cannot be disabled`. Actual image crops, keyboard scrolling, mobile layout, zoom and visual craft therefore remain unverified for this release. The references include a concrete unrun acceptance plan at 761px, 760px and narrow widths with an off-center subject. DOM/source/production-module tests cannot replace that review.

No customer repository or URL has been supplied for a real integration trial. No customer files, services or deployments were changed. This increment does not establish a complete customer redesign, zero defects, subject tracking or North Star equivalence. The developer may be an LLM: its handoff still requires actual raw files and separately reported build/task/browser/undo evidence, rather than accepting its prose as proof.

## Recovery

The code rollback baseline is private version 10, source `823466648c0ba488348f22b422e37049126084dd`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_a366b7504dd48191822c6daba0e7e3a2`. Redeploying it rolls back Focus code, not customer patches or data. Older code does not understand nondefault framing; preserve a current library backup before using an older version to avoid losing the new settings in subsequent saves. Normal image reset or undo is the less disruptive way to reverse a framing choice.
