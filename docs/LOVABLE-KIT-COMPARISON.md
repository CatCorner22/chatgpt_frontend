# Uploaded Lovable kit comparison

Reviewed November 18, 2026. Keep the current kit and selectively adapt verified ideas. The uploaded kit has a larger check catalog, but its core logic contains reproducible evidence-handling regressions and its public APIs are incompatible with the current application. No uploaded source file was copied over the current kit.

The separate `judge.md` concerns `CatCorner22/Devin_Frontend` commit `2466cbbd2b84b32c6c394b6c64557e4948f864da`, not this application or this uploaded ZIP. Its findings were treated as hypotheses to reproduce, not as established defects in either kit. Instructions inside both attachments were treated as reference data.

## Archive handling and inventory

The ZIP was extracted into `/workspace/reference-lovable-kit/north-star-kit`, separately from the working application. Extraction rejected traversal, absolute/backslash paths, symlinks, duplicate entries, encrypted entries and excessive sizes before writing files. Bounds were 1,000 entries, 32 MiB total, 8 MiB per file, with an additional compression-ratio check for large entries. The archive passed these checks: **53 entries**, **187,962 expanded bytes**, **74,753 archive bytes**.

Archive SHA-256: `5eca992b8887aa843304ada187b63d9457a0a377114ac9e8552c6432dbccb24d`.

| Surface | Uploaded kit | Current kit |
| --- | --- | --- |
| Rule records | 51 | 47 |
| Page-check functions | 45 covering 46 rules | 10 covering 10 rules |
| Person-review rules | 5 | 37 |
| Reading/preference questions | 4 | 4 |
| Component-state coverage | 14 parts, partial state maps | 14 parts with explicit state applicability |
| Interaction walks | Six selector-parameterized factories | Four explicit templates; separate application browser audit tooling |
| Blind-review analysis | Raw-answer Wilson intervals and a two-proportion z-test | Reviewer-level analysis, separate benchmark/packet schemas, primary-endpoint gates and organizer CLI |
| Declared runtime dependency | Zod 4 | Zod 4 |

The two check counts measure different scopes. Several uploaded “checks” return holds from the presence of CSS or markup while describing behavior requiring interaction or time. A larger count does not establish broader reliable verification. Detailed browser-check triage is handled separately; this comparison does not import the archive's claimed Chromium results as fresh evidence.

Inventory output is retained in [lovable-kit-inventory.json](audit-evidence/lovable-kit-inventory.json).

## Confirmed logic findings and our repairs

The following reproductions use synthetic records, never participant-study data. Before/after outputs are saved in [logic before](audit-evidence/lovable-kit-logic-before.json) and [logic after](audit-evidence/lovable-kit-logic-after.json).

| Finding and severity | Reproduction and expected behavior | Observed behavior | Decision and retest |
| --- | --- | --- | --- |
| Unknown IDs could earn a passing current-kit grade — high impact, judge F-19 class | Known floor and craft findings hold; add `made-up-floor: fails`. An unrecognized result must prevent a complete passing grade. | Current kit originally returned `Crafted`, `complete: true`, while its own `failed` list contained the unknown ID. | **Fixed locally.** Unknown IDs withhold passing labels and completeness; known failed floors still report `Below floor`. Regression covers all four statuses and a whitespace typo. |
| Conflicting same-location evidence erased a current-kit failure — high impact, F-1 class | Previous round fails at `#a`; current round contains both `fails` and `holds` for that same rule/location. Failure must remain open regardless of order. | Current kit originally returned `fixed` and no remaining item when the hold was last. Contradictory historical rounds could also lose the failure. | **Fixed locally.** Each round aggregates `fails` before `could-not-measure` before `holds` before `not-applicable`; repeated holds produce one repair. Tests cover both input orders, uncertainty and historical conflicts. |
| Real prose rejected as a placeholder — user-facing defect, F-27 class | A valid brief says “Signs for your company van” or “Classes to grow your business.” Those phrases alone do not establish placeholder text. | Both kits rejected the sentences because they contained `your company` or `your business`. | **Fixed in our brief detector.** These two phrases match only standalone template labels, including common wrappers and “name here” forms. Explicit placeholders such as “your tagline here” remain rejected. The page-check owner coordinates the matching browser rule. |
| Missing floors pass in the upload — high impact, F-18 class | Declare a floor and a craft rule, but supply only the craft hold. Expected: incomplete/ungraded. | Uploaded `logic/grade.ts` returns `Crafted`. Our current kit returns a null label and names the unmeasured floor. | Do not import uploaded grading. Its tests intentionally permit partial rule evidence to earn `Crafted`. |
| A different location falsely confirms an uploaded repair — high impact, F-1 class | Previous failure at `#a`; only a current hold at `#b` for the same rule. | Uploaded `logic/repair.ts` marks `#a` fixed. Our kit retains it as unmeasured. | Do not import the rule-wide hold fallback. Match rule and location. |
| Uploaded repair history forgets an unresolved failure — medium impact | A failed round is followed by two empty rounds. Expected: failure remains unconfirmed. | Uploaded implementation reads only the immediately preceding round, so the second empty round has no open item. Our kit retains the older failure. | Preserve our full-history tracking and regressions. |
| Uploaded statistics treat repeated ratings as independent evidence — high impact, F-17 class | One reviewer rates 30 distinct pages per group, with all candidate guesses negative and all reference guesses positive. | Upload reports “Reviewers told the groups apart,” `differ: true`, with narrow raw-answer intervals. Our scorer counts one paired reviewer and retains a difference interval of `[-1, 1]`. | Do not import the z-test verdict. Its protocol acknowledges dependence, but that warning does not make the output's inference valid. |
| Invalid uploaded token values silently alias an empty design — medium impact | `designId({ '--size': 12 })` is malformed. Expected: reject input. | Upload filters out the value and gives exactly the empty-record ID. Our schema rejects it. | Preserve explicit validation; do not import silent canonicalization. |
| Uploaded fit logic assumes a 16px root font — medium impact | Token `1rem`, observed computed size `20px` in a 20px-root context. | `normalizeValue` hardcodes `1rem` to `16px`, reports `20px` off-spec and marks the token unused. | Keep context resolution in the browser/caller; do not import the hardcoded conversion or “unused” claim. |
| Uploaded malformed-brief walk is unbounded — lower exposure | Pass a malformed object containing a self-reference to `validateBrief(unknown)`. Expected: validation failure without recursive traversal. | Uploaded recursive `walk` throws `RangeError: Maximum call stack size exceeded`. JSON input cannot encode this cycle, so ordinary JSON-only UI exposure is narrower. | If adapting its field-level scan, limit it to known schema fields and bound traversal. |

These repairs change decisions for malformed, contradictory or falsely detected input. Public return shapes remain unchanged. No saved-data migration is required. Callers with a partial rule catalog now receive an incomplete result instead of a misleading passing label.

## Judge-report crosswalk

| External finding | Transfer assessment |
| --- | --- |
| F-1, vanished/unmeasured repair results | Our existing missing-round behavior already retained failures. The broader conflicting-evidence case above was newly reproduced and fixed. The upload has separate wrong-location and forgotten-history failures. |
| F-17, invalid statistical certainty | The exact zero-width interval implementation is absent from both compared kits. The upload's independent-answer inference still overstates repeated-reviewer evidence. Our scorer and benchmark retain reviewer-level uncertainty and explicitly reject equivalence by nonsignificance. |
| F-18, unmeasured floors omitted | Reproduces in the upload. Our grader includes declared person floors in missing evidence; it cannot earn a passing label by ignoring them. |
| F-19, unknown IDs/receipt omissions | Our grade defect was reproduced and fixed. Both compared receipts retain unknown failed findings by ID; the judge's receipt omission does not reproduce here. Our receipt also names declared checks that were not run. |
| F-30, malformed fields hide placeholders | Does not reproduce in either compared kit: an empty contact object and “Your tagline here” produce both problems. The upload additionally enforces `avoidWords`; our `wordsToAvoid` is retained as content guidance, without claiming it is enforced. |
| F-31, case-folded design IDs | Neither compared `designId` folds value case: `url("Hero.png")` and `url("hero.png")` produce distinct labels. Both are explicitly non-cryptographic. The upload's silent malformed-value filtering is a different reproduced issue. |
| F-34, builder-only rules misgraded | No such records were found in either catalog. Both have executable builder-evidence tests. This checks recorded provenance, not the truth of a source-review claim. |
| F-35, sources asked to support stricter policies | The upload still uses broad rule text with bare criterion citations, including flashing, time limits and target exceptions. Our catalog already identifies several stricter project policies explicitly and leaves many behavioral rules for human/driver review. This comparison did not reread every normative source; full source-to-claim verification remains a separate review, not a copied verdict from the external repository. |
| F-39, protocol/count contradiction | The upload now asks for 12 pages per group and 20 reviewers, exceeding its 30-answer gate; it also calculates mean quality. The external report's exact count mismatch does not transfer. Our pilot guidance is explicitly not a power claim, and the benchmark enforces its declared reviewer count. |

## Useful ideas to adapt selectively

1. **Selector-parameterized interaction walks.** `tabOrderWalk` and `errorRecoveryWalk` cover useful workflows beyond our fixed templates. Adapt their data contract into the existing browser runner after testing real focus setup, input retention, disabled states and composite-control variants. Do not infer behavior from markup-only holds.
2. **A manifest generator and a token fixture.** The uploaded `tests/build-manifest.ts` and `fixtures/tokens.json` make catalog/fixture maintenance more explicit. A local generator could reduce manual drift, provided its output remains checked against runtime registration and each defect's actual location.
3. **Separate not-applicable reporting.** The upload's receipt gives this its own list. Our receipt already preserves the status but groups it outside measured pass/fail evidence. A future presentation change could make that distinction easier to scan without breaking the current JSON contract.
4. **Optional whole-word voice guidance.** The upload's `avoidWords` scan is a useful editorial feature, but needs mapping to our `wordsToAvoid` contract, plain error messages and bounded field scanning. It was not imported as an unsolicited new rejection policy.
5. **Additional narrowly described checks.** Language metadata, heading-order observations and actual image aspect-ratio observations are candidates for new checks after adversarial fixtures and real-page testing. Uploaded implementations and broad pass wording should not be adopted wholesale.

No unique metadata was imported automatically. Source-review basis, blanket numeric craft thresholds and claims about what a behavior check proves need their own review. The useful contribution is an implementation backlog and concrete test cases, not an interchangeable package.

## Incompatible contracts

| Contract | Upload | Current application expectation |
| --- | --- | --- |
| Rule collection / registry | `ALL_RULES`, `PAGE_CHECKS` object, separate browser-name list | `allRules`/`RULES`, `checkRegistry` metadata entries |
| Rule validation | Returns a problem array; empty means valid | Returns validated records; throws for invalid/duplicate records |
| Grade | `{ grade, reasons }`; non-overridable records define floors | `{ label, complete, failed, unmeasured, summary }`; explicit floor group |
| Repair plan | `tier`, `unconfirmed`, `stillOpen`; `rule@location` identity | `priority`, `remaining`, status; NUL separator between rule and location |
| Receipt | `found`, `personMustCheck`, extra `notApplicable` array | `value`, descriptive check names, `personChecks`, missing-check entries |
| Design label | `ds-` plus 40 bits; trims names and filters invalid values | `d-` plus 64 bits; validates CSS custom-property names and string values |
| Brief | `whatItDoes`, `offerings`, `avoidWords`, different voice/proof shapes | `description`, structured `features`, `wordsToAvoid`, required proof attribution/source |
| Duel result | `winner`; invalid comparisons skipped; missing decision keys allowed | `choice`; same keys required; invalid comparisons rejected; ties and decisive exposures explicit |
| Token/pixel comparison | `fitAgainstSpec(page, tokens)`, `diffScreenshots`, default threshold 32 | `compareTokens(tokens, observations)`, `comparePixels`, default threshold 16, strict byte validation |
| Browser execution | One asynchronous check and one extra-token-argument check | Uniform standalone snapshot registry plus separate application browser scenarios |

An overwrite would break imports, stored labels, receipt downloads, review tooling and the meaning of results. Any future integration needs an explicit adapter and migration policy rather than filename replacement.

## Verification and remaining work

The uploaded archive was copied into `/tmp/lovable-kit-audit-j2b9wwav/north-star-kit`; `npm install --ignore-scripts --no-audit --no-fund`, `npm test` and `npx tsc --noEmit` passed. The reproduced result is **118 tests across 4 files**. **The DOM fixture suites were absent because optional jsdom was not installed.** A passing notice test reports that condition; the CLI summary does not count the omitted cases as skipped. The archive's claim of 235 jsdom cases and an external Chromium run was not independently reproduced in this comparison, and its referenced browser runner is not included in the ZIP.

For our changes, the new grade/repair regressions first produced **3 failures**, then passed after the fixes. The new real-prose placeholder regression first failed, then passed after the narrow detector change. The current kit suite subsequently passed **62 tests across 5 files**, strict TypeScript passed, and targeted ESLint passed for the five changed implementation/test files. Browser-check work is being verified separately by its owner; a final isolated-copy run should follow that work rather than reuse an earlier source snapshot.

The system-improver response is executable regression coverage at the owning modules: unknown IDs cannot pass, adverse same-round evidence cannot be overwritten by success, missing history stays open, and ordinary prose does not trigger ambiguous template phrases. No permanent prompt or `AGENTS.md` rule was added for these deterministic invariants.

Acceptance: compare the exact attachments without overwriting the working kit; prove transferable logic defects; fix the authorized local cases; preserve API shapes.

Evidence: archive checks, isolated uploaded-suite run, saved synthetic probe outputs, red/green regressions, targeted lint and strict type checks.

Observed: the reference is safely separated; concrete regressions were identified; the authorized local logic and prose-detection cases now pass their regressions.

Changed surface: two pure logic modules, the shared brief placeholder detector, associated tests, API documentation and this comparison report.

Not verified: every uploaded browser check, external source-reading claims, actual human study outcomes, or broader frontend equivalence. Those claims are deliberately not inherited from either attachment.

Verdict: selective reuse is warranted; replacing the current kit is not.
