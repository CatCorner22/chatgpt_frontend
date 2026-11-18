# North Star kit

A transferable collection of design rules, deterministic checks and honest evidence reports. The kit helps locate specific defects and prepare small repairs. It does not certify a page, establish legal compliance, or replace task testing with the intended users.

The runtime has one dependency: Zod 4. There are no app imports, AI calls, network calls, database calls or UI components. Pure logic receives its evidence as input. Page-check functions receive a `Document` and can be serialized individually into a browser page.

## Install and verify

Copy this entire folder into an empty directory, then run:

```sh
npm install
npm test
npm run typecheck
```

The tests use Vitest and TypeScript. The portable suite does not install a browser driver or pretend Node can measure browser layout. See `MANIFEST.json` and `HONEST-REPORT.md` for browser check coverage and the separate real-browser fixture evidence.

This package exports TypeScript source for a caller's bundler. `index.ts` is the public entry point. Importing an individual module is also supported by a relative source path. Browser hosts must provide an actual rendered page for layout checks; an inert parsed page produces measurement gaps.

## Folder map

| Path | Purpose |
| --- | --- |
| `types.ts`, `schemas.ts` | Shared records and validation |
| `data/` | Evidence-bearing rules, questions, state sheet and brief schema |
| `logic/` | Labels, grading, repair rounds, receipt, token/pixel comparison and preference counts |
| `page-checks/` | Standalone DOM/CSSOM functions and an injection registry |
| `fixtures/` | Local good/flawed pages with a named defect per implemented check |
| `blind-test/` | Review protocol and a bounded statistical scorer |
| `tests/` | Pure logic, rule and isolation regression tests |
| `MANIFEST.json` | Rules, implementation names, browser requirements and fixtures |
| `SOURCES.md` | Sources and how they were consulted |
| `HONEST-REPORT.md` | Tested scope, limitations and remaining human work |

## Public functions

### Validate records

```ts
import { allRules, validateRules, ruleRecordSchema, findingSchema,
  sourceRefSchema, tokensSchema } from './index';

validateRules(allRules); // Also rejects duplicate rule IDs and overridable floors.
ruleRecordSchema.parse(allRules[0]);
findingSchema.parse({ ruleId: 'floor-target-size', status: 'could-not-measure' });
sourceRefSchema.parse({ title: 'Builder judgement', basis: 'builder' });
tokensSchema.parse({ '--ink': '#17201c' });
```

`allRules` (also `RULES`), `neuroRules`, `stateRules`, `behaviorRules`, `craftRules` and `tellRules` are plain records. `neuroQuestions` describes four independent preference questions. `stateSheet` and `scriptedWalks` provide state requirements and driver-neutral interaction guidance. They are specifications, not proof that a page meets them.

### Validate real content

```ts
import { validateBrief } from './index';
const result = validateBrief({ businessName: 'Lorem ipsum' });
if (!result.valid) console.log(result.issues); // Paths and actionable messages.
```

`briefSchema` exposes the same Zod schema. A valid brief needs a business name, description, audience, main job, headline, 3–8 features, at least one contact method, sourced proof, three voice choices and words to avoid. Placeholder filtering does not verify the truth of the content. `findPlaceholder(text)` returns the first recognized placeholder phrase or `undefined`.

### Stable design label

```ts
import { designId } from './index';
const label = designId({ '--ink': '#17201c', '--space': '16px' });
```

Keys are sorted and values trimmed before hashing, so property insertion order does not change the label. Values are not otherwise semantically normalized. An empty token record has a deterministic label; malformed names or non-string values are rejected. The label is public and non-cryptographic. It proves nothing about authorship, integrity or ownership and can collide. It is intentionally distinct from historical application labels.

### Grade a defined scope

```ts
import { grade, allRules } from './index';
const result = grade(findings, allRules);
// result.label: 'Below floor' | 'Meets floor' | 'Crafted' | null
```

Pass the complete intended rule scope. Any failed floor yields `Below floor`. Missing floor evidence or an unknown rule ID yields `null`, with a reason; it cannot earn a passing label. A known failed floor still yields `Below floor` when other IDs are unknown, but the result is incomplete. `Crafted` requires positive measured craft evidence with no failed or unmeasured non-advisory page check in the supplied scope. It is a bounded check result, not a verdict on visual excellence. Human-review rules remain in the receipt.

### Make bounded repair rounds

```ts
import { repairPlan, allRules } from './index';
const plan = repairPlan(currentFindings, [firstRoundFindings], allRules);
// plan.items, plan.remaining, plan.fixed, plan.round, plan.stopped
```

Priority is failed floors, design-fit mismatches (`fit-`/`spec-` IDs), other measured rules, then advisory tells. Each item carries one smallest suggested change. Findings are matched by rule ID and location. A missing finding remains unresolved; only an explicit later `holds` can appear in `fixed`. Conflicting findings at the same location are combined within each round: failure takes precedence over unmeasured evidence, which takes precedence over a hold. A hold cannot erase adverse evidence from its own round, and repeated holds produce only one confirmed repair. After three previous repair rounds, `items` is empty, `stopped` is true and `remaining` preserves unresolved work.

### Produce the evidence receipt

```ts
import { receipt, allRules } from './index';
const report = receipt(findings, allRules);
// report.measured, report.couldNotMeasure, report.personChecks
```

Checks not run appear in `couldNotMeasure`. Not-applicable results stay outside the measured pass/fail list and retain their status. The human list includes every person-review rule plus reading aloud, factual review, screen-reader task testing and testing with the intended neurodivergent users.

### Compare tokens and pixels

```ts
import { compareTokens, comparePixels, contrastRatio } from './index';

compareTokens({ '--ink': '#fff' }, [
  { property: 'color', value: 'rgb(255, 255, 255)', where: 'h1' },
]);
comparePixels([0, 0, 0, 255], [20, 0, 0, 255], 16);
contrastRatio('#17201c', '#ffffff');
```

Token comparison recognizes whitespace, basic opaque hex/rgb equivalences and zero-unit equivalences. The caller must resolve `rem`, `em`, `calc()` and custom-property references in the same context first. `unobservedTokens` means no corresponding value was observed; it cannot prove a token is unused in every breakpoint, state or stylesheet. Equal computed values cannot establish that the page uses a particular custom property.

Pixel inputs are equal-length RGBA arrays with integer channels from 0 to 255. They must correspond to images of the same dimensions, which the caller checks before discarding image metadata. The output reports four mean absolute channel differences and the fraction of pixels with any channel difference strictly greater than the threshold. Empty images return zero counts and differences, not evidence of equivalent designs. This is not a perceptual similarity score. Contrast uses full-precision WCAG 2 relative luminance for opaque sRGB hex colors; do not round before applying a threshold.

### Run checks in a browser

```ts
import { checkRegistry, collectTokenObservations } from './index';

// Inside a real browser, using a Document supplied by the host:
const findings = checkRegistry.flatMap(entry => entry.run(pageDocument));
const observations = collectTokenObservations(pageDocument);
```

Each `entry.run` is standalone after TypeScript compilation; serialize that function individually through your existing browser driver's evaluation API. The registry and module imports stay in the caller. Never execute fixture text or submitted page text as code. Drivers are not dependencies of this kit. Individual exports are `checkAutoplay`, `checkVisibleLabels`, `checkReflow`, `checkTargetSize`, `checkImages`, `checkPlaceholderCopy`, `checkTabularNumbers`, `checkTextWrapping`, `checkJustification` and `checkTextContrast`.

For submitted or otherwise untrusted pages, run checks in an isolated browser world with its own built-ins and a host-enforced deadline for each check. Main-world execution lets the page replace APIs used by the checker. Return `could-not-measure` after an exception or timeout, preserve any earlier failures, and bound report values before rendering or copying them. The supplied application's implementation lives outside the portable kit in `scripts/audit/isolated-realm.mjs`; other consumers must provide equivalent runner controls. These controls protect execution boundaries, not the truth of every page state. See `BROWSER-TESTS.md` for the distinction between trusted fixtures and submitted pages.

Some rules need interaction, another viewport, emulated media preferences or observations over time. The static functions do not fake those results. `scriptedWalks` provides keyboard-testing guidance; a caller still needs to bind its selectors and drive real input. See the manifest for each rule's execution requirement.

### Count isolated preferences

```ts
import { validateDuel, preferences } from './index';
const a = { type: 'serif', density: 'airy' };
const b = { type: 'sans', density: 'airy' };
validateDuel(a, b); // Exactly one decision differs, and keys match.
preferences([{ a, b, choice: 'a' }, { a, b, choice: 'tie' }]);
```

Counts include comparisons, ties, exposures, decisive exposures and wins for each value. `winRate` is null when all exposures are ties. These are observations about the provided history, not a universal preference or a causal explanation.

### Score a blinded review

```ts
import { scoreBlindTest } from './index';
scoreBlindTest([
  { reviewerId: 'r1', pageId: 'p1', group: 'spec', judgedHuman: true, quality: 6 },
  { reviewerId: 'r1', pageId: 'p2', group: 'human', judgedHuman: true, quality: 6 },
]);
```

Read `blind-test/PROTOCOL.md` before collecting data. Raw shares and mean quality are descriptive. Intervals aggregate repeated ratings by reviewer and are conditional on the pages shown. They assume independent reviewers. An interval including zero does not establish equivalence. The kit does not conduct a study or manufacture answers.

### Prepare and evaluate a real benchmark

```ts
import { createBenchmarkPlan, createReviewerPacket, benchmarkManifestSchema,
  blindEvaluationBundleSchema, evaluateBenchmark } from './index';

const draft = createBenchmarkPlan(); // Six task briefs; no invented sample pages.
// Supply matched artifacts and verified human-reference provenance, then validate:
const organizer = benchmarkManifestSchema.parse(completedOrganizerManifest);
const reviewerPacket = createReviewerPacket(organizer, shuffledNeutralSampleIds);
// Keep the organizer file private; reviewers receive only reviewerPacket.
const answers = blindEvaluationBundleSchema.parse(importedReviewerAnswerBundle);
const report = evaluateBenchmark(organizer, answers.evaluations);
```

Collection interfaces can import `reviewerPacketSchema`, `blindEvaluationSchema` and `blindEvaluationBundleSchema` directly from `blind-test/reviewer.ts`, which contains no organizer mapping or group schema. Each answer uses a reviewer code and neutral sample ID, six anchored quality ratings, a task outcome and an origin guess. Image reviews must leave interaction null and task outcome not-tested.

The evaluator reports predefined quality/task noninferiority, absolute floors, and attribution equivalence separately. A draft, incomplete panel, wrong fixed reviewer count or missing endpoint cannot earn confirmation. Its simultaneous reviewer-level bounds are intentionally conservative and apply only to the supplied fixed page panel. A small pilot ordinarily remains inconclusive; it is not evidence of poor quality or proof of equivalence. See the protocol for a practical pilot and a separate confirmatory-study plan.
