# Build and evidence report

Prepared November 18, 2026. This is a bounded implementation report, not a certification of an application or a claim about human-level design quality.

## Implemented

The folder contains 47 validated rule records and evidence provenance; four preference questions; a control-state sheet and scripted interaction guidance; 10 measurable DOM/CSSOM checks; local good/flawed fixtures; a real-content schema; stable token labels; grade, repair and receipt functions; token and raw-pixel comparison; preference counts; and a blinded-review protocol with a pure statistical scorer. The other 37 rules explicitly require a person or a scripted interaction review.

The kit's only runtime dependency is Zod 4. Data and logic modules have no app, browser-global, filesystem, network, clock or random dependency. Page-check functions are individually serializable and use the `Document` supplied by a caller. Isolation tests cover import boundaries and forbidden runtime APIs.

## Verification

On November 18, 2026:

- The portable Vitest suite, including the benchmark extension and logic hardening, passed **62 tests across 5 files**. Tests cover records and source metadata, brief rejection, all pure logic functions, malformed inputs, evidence gaps, repair round stopping, one-decision comparisons, clustered reviewer counts, fixture coverage, check registration, runtime isolation, masked reviewer packets and conservative benchmark gates. New regressions cover unknown rule IDs, contradictory same-round evidence, historical failure retention and ordinary prose containing ambiguous placeholder phrases.
- Strict TypeScript compilation passed with `tsc --noEmit`.
- The final folder was copied into `/tmp/north-star-hardened-copy-mk2g9dj5/north-star-kit`, outside the application's dependency tree. `npm ci --ignore-scripts --no-audit --no-fund` installed only the three declared top-level packages and their transitive dependencies. `npm test` again passed **62 tests across 5 files**; `npm run typecheck` passed. Resolved top-level versions were Zod **4.6.7**, Vitest **4.1.12**, and TypeScript **5.9.3**. The lockfile is included. See `COPY-TEST-RESULTS.txt` for output.
- This isolated-copy verification followed the final logic and browser-check corrections. All 30 TypeScript implementation/configuration/test files matched the tested copy byte-for-byte afterward; source digests are recorded in `COPY-TEST-RESULTS.txt`. Later changes to handoff documents are outside that source-hash scope. The consuming application's separate Chromium regressions cover transparent backgrounds, clipped content, report text, coverage gaps and standalone placeholder behavior; those browser cases are not counted in the 62 portable tests.
- A separate real Chromium run injected each of the 10 compiled checks independently at **1280 × 900** and **320 × 900** CSS pixels. At each width, the flawed fixture produced **10 failed findings**, covering every planted defect; the good fixture produced **0 failed findings and 2 unknown findings**. The unknowns correctly retain the limits of autoplay and complete reflow evidence. See `BROWSER-TEST-RESULTS.json` and `BROWSER-TESTS.md` for scope and repeat instructions.

These tests prove the supplied pure-function cases, isolation assertions and fixture observations. They do not prove every possible input, page, browser or interaction. The kit does not bundle a browser driver; the real-browser checks run in the consuming environment separately from the dependency-minimal Vitest suite.

## Deliberate scope boundaries

- Static evidence cannot show that a page never plays media, flashes, changes context, loses input or moves later. These issues require a scripted observation or a person. A missing autoplay attribute does not prove that scripted playback cannot occur.
- On untrusted pages, direct consumers must execute checks in an isolated browser world with a host-enforced deadline per check. A page can replace APIs in its own main world; main-world execution examples apply only to trusted local fixtures. The supplied application's runner implements isolation and deadlines outside this kit in `scripts/audit/isolated-realm.mjs`. Timeouts and exceptions remain measurement gaps, never passing evidence.
- Detectable frames, open shadow hosts and custom-element hosts produce explicit coverage gaps; this does not amount to complete traversal of their contents. Closed roots attached to otherwise ordinary elements are not generally discoverable from a standard DOM snapshot.
- DOM snapshots cannot prove dialog focus trapping, Escape behavior, focus return, arrow-key behavior, full keyboard task completion, a visible high-contrast focus ring in every state, or usable error recovery. The state sheet and scripted walks specify the work; they are not execution results.
- Reflow measured at the current viewport does not prove 320-pixel reflow or 200% zoom. A host must establish those conditions and check for lost content as well as overflow. Spacing overrides, reduced motion, forced colors and high contrast require additional browser runs and human review where appropriate.
- Text contrast checks only measure supported opaque foreground/background combinations, walking through fully transparent backdrops when appropriate. Gradients, partial transparency, images and uncertain backgrounds must remain unmeasured, not guessed.
- Target checks report actual box dimensions under the kit's 24-pixel floor. They do not implement every exception in the underlying standard. This is a chosen design floor rather than a complete standard evaluation.
- Image metadata checks establish dimensions and alternative-text presence, not whether a description is accurate or an image is correctly considered decorative. Layout and image distortion require visual review.
- Placeholder detection and visual “tells” are heuristics. They warn rather than establish bad design or AI authorship. A valid content brief does not establish that testimony, contact information or numerical claims are true.
- Token comparison reports observed value agreement. It does not prove which custom property was referenced or that an unobserved token is globally unused. Relative units and expressions must be resolved by the host before comparison.
- Raw pixel differences are channel measurements. They do not measure perceived quality, semantics, visual equivalence or task success.
- A design label is public and non-cryptographic, can collide, and is not an authorship or integrity proof. This new flat-token label is not backward-compatible with historical application labels.
- A grade is conditional on the supplied rule scope. Missing floor evidence and unknown rule IDs withhold a passing label. A known failed floor still reports failure, with incomplete status when other IDs are unknown. “Crafted” describes the supplied measured scope; it does not establish taste, usability, legal compliance or suitability for a particular person.
- Repairs are matched by rule and location. Only explicit later passing evidence without conflicting same-round adverse evidence confirms a repair. After three previous repair rounds, the function stops prescribing and retains unresolved items.
- The blinded-review scorer has not been validated in a real participant study. Its intervals are conservative, assume independent reviewers and apply to the pages shown. It does not generalize across a population of pages, perform a power analysis or establish equivalence. Repeated ratings from one reviewer are aggregated first.

## Judgement calls and unbuilt measurements

### Benchmark extension

The benchmark extension adds six concrete matched-task briefs, separate organizer/reviewer JSON schemas, anchored quality ratings, honest task and attribution outcomes, answer-bundle validation and a pure analysis after collection. No participant, human-reference page or observed result is supplied. Its 13 regression tests use explicitly synthetic records only.

`evaluateBenchmark` checks quality and task noninferiority plus absolute floors, and separately checks attribution-rate equivalence. It uses 15 simultaneous reviewer-level intervals, reports task breakdowns, and withholds confirmation for drafts, incomplete records, unmet fixed collection targets and missing endpoints. Masking fields are separated, but the kit cannot verify actual author provenance, independence of people, external preregistration timing, asset hashes or successful blinding. A conservative interval may remain inconclusive long after a practical pilot; a broader confirmatory crossed reviewer/page analysis remains external work. The draft margins and pilot size are builder choices, not established standards.

Craft recommendations, conventional control-state descriptions, stylistic tells and suggested pilot sizes include builder judgement. Each rule's evidence and source basis identifies the distinction. No empirical claim that these choices work for all people with ADHD, autism or dyslexia is made.

Temporal measurements (including cumulative layout shift, flashing frequency and feedback latency), full animation controls, responsive/zoom/spacing interaction sweeps, complete stylesheet token-reference tracing, and automatic screen-reader or neurodivergent-participant testing are not implemented as certified checks. Their requirements remain visible as human or driver work. The kit does not contain a browser driver, audit arbitrary remote sites, generate UI, run AI, create accounts, charge money or publish findings.

The supplied document describes a broader research and test program. This folder implements the portable foundation and truthful bounded checks; it does not pretend that a single snapshot or fixture test completes that program.
