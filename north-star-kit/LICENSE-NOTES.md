# License and provenance notes

The new implementation, rule paraphrases, fixtures, tests and explanatory text in this folder were authored for this project. No published rule-set text, external fixture, font, image pack or UI library was copied into the kit. The fixture mark is an original local SVG.

The stable-label implementation adapts the arithmetic approach used in the supplied project's design-label logic into a new sorted, flat-token format. The repair, grade and comparison logic are new implementations of the supplied requirements, with explicit handling of missing evidence. No source file is imported from the supplied application. Its archive did not include a project-wide license; this note does not invent a redistribution license or assert ownership of the owner's earlier work. The owner should choose distribution terms before publishing the kit as a third-party package.

Runtime dependency:

- Zod: MIT license. Installed dependency licensing remains in its package.

Development dependencies:

- Vitest: MIT license.
- TypeScript: Apache License 2.0.

Normative and advisory sources are linked in `SOURCES.md`. Rule descriptions are original paraphrases with source references. W3C specifications and notes are not bundled. Source review status is recorded per citation. The blind-test protocol explicitly identifies its unsourced builder recommendations and limits its statistical inference.

The code does not depend on APCA, `apca-w3`, external fonts, remote scripts, remote images, network services, browser drivers or commercial SDKs. A host can use its own browser driver to execute the standalone checks; such a driver's license and installation are the host's responsibility.
