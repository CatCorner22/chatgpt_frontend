# Restore the maintained-source lint gate

Focus's repository-wide lint command was failing before new work began. Its 3,547 errors mixed maintained-source formatting, generated files, local rehearsal artifacts, and one deliberate control-character check. That noise made the command ineffective as a development gate, including when the developer is an LLM.

This maintenance change formats an explicit inventory of 88 maintained files, excludes local `.agent` evidence from linting/formatting, and protects generated output from formatting. The seven generated Supabase files retain their semantic ESLint rules; only their formatting rule is disabled. The generated route tree remains outside lint. The two generated MCP route files remain unmodified and outside formatting. The byte-stable authored-font and design-direction catalogs are also explicitly excluded from formatting; the font generator's exact-output check passes.

The OAuth return-path validator intentionally refuses control characters before URL parsing can normalize them. Its regex and runtime behavior are preserved; a local, documented `no-control-regex` exception records that intent. No rule is disabled repository-wide to accommodate it.

## Change review

Before formatting, a TypeScript 5.9.3 comparison captured source ASTs, emitted JavaScript structure, comments and ten protected generated-file hashes. The formatter ran only on the explicit maintained-file inventory. The original conservative comparison records five representation differences: four JavaScript arrow-parameter parser flags and one native paragraph's adjacent JSX text segments. A supplemental comparison accounts for these exact changes, with mutation controls, while retaining the original report. All 88 files are accounted for. The paragraph's visible text and static server markup match; hydration markup adds one text-separator comment. Identical DOM text-node segmentation is not claimed. The two catalog hashes were subsequently checked against the original commit, bringing generated-byte protection to twelve files.

The cleanup does not add a product feature, widen source-trial support, change customer handoff claims, or update dependencies. The separately researched Next.js experiment is recorded in [the assessment](research/NEXT-SOURCE-TRIAL-ASSESSMENT.md). Next.js stays on the developer-guided path until an adapter and its browser evidence meet the [proposed boundary](superpowers/specs/2026-11-18-next-source-trial-boundary.md).

## Verification scope

Release evidence is retained locally under `.agent/lint-gate-*` and the release receipt in `/workspace/deliverables`. The complete application suite passes 1,250 tests across 105 files. The portable kit passes 62 tests; the nonbrowser audit suite passes 24, and the benchmark suite passes four. Both TypeScript projects pass. Repository lint passes with zero errors and eleven existing warnings: ten React Refresh export warnings and one LaunchPanel dependency warning. This patch does not suppress those warnings or change LaunchPanel's fingerprint-based behavior. The exact-commit production build and post-build generated-file hashes are recorded separately in the release receipt.

The actual browser integration suite remains unrun because the supported browser fails during initialization. Parsing, DOM tests, compilation and HTTP checks do not establish rendered quality, hydration, accessibility or customer-task success. No North Star equivalence or zero-defect claim follows from this maintenance release.

Future changes should run `npm run lint` without accepting the former baseline errors. Investigate newly introduced failures. Regenerate protected files through their owning tool; do not broadly format or edit them to quiet the gate. Local evidence and immutable customer handoff bundles are not application source.
