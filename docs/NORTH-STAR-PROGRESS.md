# Moving toward the North Star

November 18, 2026 — second implementation pass

Later work is recorded in [Launch verification](LAUNCH-READINESS.md), including five compositions, preservation/recovery fixes and the attachment reviews. The sections below record the earlier pass.

The target is frontend work that independent reviewers judge as strong as work by talented human designers and coders, with no reliable source distinction under a fair comparison. Technical checks remove defects; they cannot establish that result by themselves.

## What changed in this pass

### A working page, not only instructions

The studio now offers a shared authored-page renderer. Its Studio, Editorial, and Product compositions arrange information differently. The actual preview document is also the downloadable standalone HTML. A separate source ZIP provides an HTML file linked to editable CSS, plus a project-state JSON file and any embedded owner image.

The pages use semantic navigation and native interactive disclosures. An owner supplies the real action destination and optional image. An absent destination becomes an honest link to page details. Copy, image descriptions and quotations stay owner-controlled. Unsupported finishes and contrast adjustments are disclosed. Local font fallbacks keep the document independent of external font services; faithful custom-font embedding is still future work.

The original design-spec workflow remains available under **Design specification & handoff tools**. A token copy does not mark the full design preserved. Custom page settings stay pending after a specification-only export. The page source ZIP contains the project settings and owner image so the actual source can be retained.

### Tests on actual rendered output

`npm run audit:browser -- --file path/to/index.html --out artifacts/my-audit` runs real Chromium outside the dependency-minimal portable kit. It covers 320, 768 and 1440 CSS pixels, reduced motion, forced colors, a text-spacing override, bounded layout-shift observation, and supplied interaction steps. It records screenshots, conditions, failures and unknowns. Quality lab imports the receipt without fetching its target or screenshot URLs.

The supplied three example exports have been audited across all six scenarios. All recorded zero failed findings. Unknowns remain for runtime autoplay guarantees, complete reflow/lost-content guarantees, and a text-spacing overlap gap. See `artifacts/north-star/` for the actual evidence. These are controlled example pages, not a claim about every design or browser.

Launch evidence now includes content, page composition, destination, image identity, navigation and experience. Material changes invalidate previous confirmations. An old asynchronous review cannot restore evidence for a superseded build.

### A usable independent-review workflow

The portable kit now provides matched-task benchmark planning, separate organizer and reviewer schemas, six anchored quality dimensions, and evaluation logic. The app's Review room imports a neutral packet, preserves its planned order, records actual ratings locally, and downloads complete or explicit partial answer bundles. Images cannot receive invented interaction results.

The organizer CLI creates a six-task draft, prepares a reviewer packet, and combines downloaded answers. It records quality comparisons, absolute floors, reported task completion and source-attribution comparisons separately. A small pilot can remain inconclusive even when the designs look similar. No independent human reference pages or participant responses have been fabricated.

See `BENCHMARK-REVIEW.md` for the workflow and `AUDIT-RUNNER.md` for rendered checks.

## What would justify the next claim

1. Supply real benchmark briefs, content and assets, plus independent human-built references under comparable constraints. Mask source clues and freeze both outputs before collecting answers.
2. Recruit reviewers who did not create either output, including relevant end users. Collect primary ratings and task outcomes before revealing source labels.
3. Inspect where candidates lose: composition, typography, content, interaction, responsive behavior, or distinctiveness. Fix those specific weaknesses and use new, held-out tasks to check whether the improvement transfers.
4. Plan a confirmatory comparison with predefined practical margins and enough independent reviewers and projects. Lack of a statistically detected difference does not establish equivalence.

The three authored compositions are a starting system, not bespoke art direction for every brief. Rich application states, end-to-end business behavior, custom imagery and typography, broad browser/assistive-technology testing, actual zoom testing, and intended-user studies remain necessary. The benchmark spans more task types than this pass's standalone page renderer currently implements; that exposes future work rather than pretending coverage.

## Verification records

- App unit tests, strict TypeScript, and production build: `artifacts/APP-TESTS.txt`, `TYPECHECK.txt`, `BUILD.txt`.
- Existing studio smoke tests: `artifacts/BROWSER-SMOKE.json`.
- Exact preview/export parity, linked sources, persistence, native keyboard controls, and mobile/text-spacing cases: `artifacts/authored-pages/RESULTS.json`.
- Real image upload, invalid-MIME recovery and reload persistence: `artifacts/authored-pages/IMAGE-RESULTS.json`.
- Browser-audit runner tests: `artifacts/AUDIT-TESTS.txt`.
- Benchmark CLI tests: `artifacts/BENCHMARK-TESTS.txt`.
- Portable-kit tests and independent copy/install proof: `north-star-kit/COPY-TEST-RESULTS.txt` and `HONEST-REPORT.md`.

Synthetic ratings used by UI and statistical tests are test fixtures, never study evidence. Cloud accounts, paid AI, deployment and live customer data were not enabled or changed.
