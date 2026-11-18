# Portable typography and the welcome trail

## What changes for a recipient

The three Stratosphere type pairs now carry their licensed font resources into authored pages: Instrument Serif / Instrument Sans, Space Grotesk / IBM Plex Sans, and Newsreader / Literata. Previously these pages named the selected families but relied on the recipient having them installed. The shared renderer now embeds only the selected families in the stylesheet used by the preview, standalone HTML and editable ZIP.

The ZIP includes original OFL notices and source provenance. Standalone HTML retains the complete notices in its embedded stylesheet. These are unchanged official WOFF2 files, with recorded source URLs and hashes. Instrument Serif uses its actual normal 400 weight; the other five families cover normal 400–600. Bundled coverage is limited to the included Latin subsets. Other characters and unbundled families still use fallbacks, which the interface explicitly describes.

This applies to authored static pages. It does not change existing-app Target packs, specimen font loading or the customer project's font policy. No customer repository is written. It does not turn an authored page into a complete booking service or application.

## Engineering evidence

The deterministic generator verifies fixed paths, byte limits, font headers, pinned license sources, hashes, recorded weight and glyph metadata, and safe CSS notice content. The generated catalog is **485,113 bytes**, below its 1 MiB cap. Runtime rendering makes no remote font request and introduces no asynchronous export step. Existing revision, owner-lock, mount-lifetime and iframe sandbox protections remain intact.

Independent source/asset review confirmed six decoded WOFF2 hashes, exact character maps, variation axes, embedded copyright, and byte-identical pinned OFL notices. Regression tests cover all three pairs, selected-only/deduplicated embedding, hostile names, invalid assets/licenses, actual ZIP round trips and exact source CSS parity. HTML-parser newline normalization is distinguished from preservation of the original license bytes.

The catalog's minified data alone is about 483 KB, or 356 KB with gzip. Review identified that importing it with the Garden route would impose that cost before a visitor needed it. The authored panel now loads as a separate feature; Stratosphere's availability notes use small metadata without font bytes. The parent Studio retains its state while the panel loads. A failed import stays within the panel, with a retry and save-before-refresh guidance. Export still runs synchronously after the real panel mounts; no download control exists in its loading or failure state. Each exported page includes only its selected fonts. Final build evidence records the actual chunk boundary; these byte counts are not measured page-load times.

## Introductory learning

The existing Field Guide is the welcome/orientation page. Five practice stops explain starting scope, first impressions, behavior, fonts/images and careful handoff. Nineteen terminology entries cite twenty-two sources; Focus's own feature names have a separate legend. A revisable, hideable choices summary keeps later consequences visible between stops. Practice choices do not mutate designs, projects, customer source or launch evidence. The user can keep explanations short and revisit choices freely. Research provenance is recorded in [Field Guide sources](FIELD-GUIDE-SOURCES.md).

## Verification limits

The integrated application suite passes **1,009 tests in 93 files**, including fifteen Field Guide interaction cases and the new lazy-panel loading/retry cases. TypeScript, changed-file ESLint, deterministic font-catalog verification, harness syntax checks and whitespace checks pass. The full test log is `.agent/typography-welcome-full-tests.log`. Build and deployed-byte checks are recorded in the final release receipt because they follow the source commit.

The supported browser failed to initialize with `the gaas-browser node_repl sandbox cannot be disabled`. No alternate browser was used. The authored browser harness now targets the actual Studio route and includes embedded-face loading, license and stylesheet assertions, but was syntax-checked only in this environment. Those assertions are preparation, not a browser pass.

Still required: clean-device rendering, actual iframe font loading, line wrapping, layout during font loading, zoom/reflow and keyboard checks, and an actual customer trial. Automated tests and asset hashes do not establish visual quality, universal reliability or North Star equivalence. Current acceptance requirements remain in [design QA](../design-qa.md).

## Release and recovery

Publication uses the exact committed source and verified build archive. The deployment receipt beside the archive records the source SHA, archive hash, saved version, deployment result and read-only live checks. Preserve owner-only sharing. The rollback baseline is version 7, source `933a89697171eb05c850b3108d0b8f90afe559ea`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_9adff99ce4b081918355e976b58a1f3b`. Redeploying it changes application code, not user data or published Git history.
