# Focus: North Star definition and priorities

Reviewed 18 November 2026. This is a current-source product and architecture review, not a completed visual or user study. The supported browser cannot initialize, so no new rendered-screen or interactive acceptance result is claimed.

## Defined phrase

The user defines **North Star** as:

> vibe-coded frontend UI, UX, etc. that is as good as the best human coders

Use that meaning consistently. The standard includes visual craft, clear information architecture, successful user tasks, responsive behavior, complete interaction states, maintainable implementation and a reliable customer handoff. Unit-test counts, a token score, attractive branding, or inability to guess the source of an interface do not independently establish this standard.

## Current assessment

Focus has a substantial guided-design and handoff foundation: constrained design tokens, five authored page compositions, a shared preview/export renderer, explicit existing-site safeguards, version-bound launch records, interactive app specimens, a browser-audit runner and a blind-review toolkit. These are useful building blocks and should be strengthened rather than duplicated.

The current local generator chooses existing gallery directions (`src/lib/local-design.ts:28`). Paid AI remains explicitly paused (`src/lib/ai-policy.ts:2`). The content model is small (`src/lib/design.ts:75`): brand, headline, subhead, CTA, feature pairs and a quotation. The authored exporter accepts one image and selected fonts depend on local installation unless the recipient supplies a licensed setup (`src/lib/authored-page.ts:214`). These constraints limit bespoke information architecture and exact visual delivery. App preview states are local specimens; a preview does not supply a complete customer's application workflow.

No independent matched human-comparison result is supplied by the repository. The existing benchmark kit starts with empty real samples and synthetic tests. Passing software tests supports specific correctness claims; it does not establish human-level design quality.

## Highest-value improvements

| Priority | Improve                           | Concrete next deliverable                                                                                                                                                                                                                                | Acceptance evidence                                                                                                                                                                                                                    |
| -------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | A complete intended-user journey  | Choose one showcase website journey and one application journey; carry the same real content and task through brief, design, build, staging, review, correction and handoff.                                                                             | Intended users complete the primary task and recover from its failure path on phone, desktop and keyboard. The recipient can apply and selectively undo the update without losing unrelated work.                                      |
| 2        | Task-aware art direction          | Model page purpose, content hierarchy, proof, navigation and required states before choosing palette/type. Produce materially different compositions for the same real content, with reasons.                                                            | On held-out briefs, independent reviewers see structural alternatives, not just recolors. Each chosen layout supports the brief's actual task.                                                                                         |
| 3        | Exact delivery of visual choices  | Package licensed fonts, allow purposeful multiple images and mobile crops, and support selected design features consistently in preview and export. Extend beyond an initial screen to loading, empty, error, validation, success and permission states. | A clean device without installed fonts receives the intended typography. Export/preview differences are intentional and disclosed before selection. Real task and recovery behavior works in the delivered artifact.                   |
| 4        | Evidence tied to the actual build | Bind reviews to exact artifact hashes and target pages. Integrate the existing browser runner into an inspect–repair–recheck workflow with explicit failed and unmeasured states.                                                                        | A changed ZIP or wrong-page report cannot silently reuse old evidence. An injected overflow or broken recovery is found, corrected narrowly and rechecked without dropping content. A source scan never masquerades as a browser pass. |
| 5        | Existing-project compatibility    | Start from a read-only project snapshot and documented component/theme behavior; propose a scoped diff against a named base revision, then trial it on an isolated copy.                                                                                 | Original routes, forms, validation, permissions and data behavior remain intact; file collisions stop the transfer; rollback preserves later unrelated work. No direct trial on production.                                            |
| 6        | Real human comparison             | Run the blind-review workflow already present using permissioned, independent human work made to comparable briefs, assets and constraints.                                                                                                              | Report visual quality, task success and source attribution separately. Use pilot feedback to improve the system, then test new held-out briefs. Do not treat a statistically undetected difference as proof of equivalence.            |

Audi.com and Firehouse.com are user-supplied quality references. Use them to choose what to study; they are not automatically fair benchmark controls for unrelated briefs, and this review did not capture or audit their current interfaces.

## Immediate application of the review

The user requested the Focus / Vision / Horizon naming family and Telescope advanced tools during this review. The implementation scope is deliberately tied to useful behavior:

- **Focus:** the app and guided design studio.
- **Vision:** a project's design plan and handoff.
- **Horizon:** existing project progress and next steps, retaining `/progress` and historical data.
- **Telescope:** advanced local artifact inspection, exact-file receipt comparison, interaction-test planning and access to the existing quality/reviewer tools.
- **Target:** guided, project-specific preparation using a saved design, preservation tasks, an isolated trial and a rollback plan. Its validated design pack and prompts are preparation, not an automatic change to a customer app or proof of a successful upgrade.

Telescope's initial static inspection is not a rendered browser test, penetration test or production certification. Matching a report's file hash establishes which bytes it describes; it does not independently prove who performed the test or that its assertions are true. A manual test plan starts unrun.

The review also found an actionable launch-record flaw: the old gate accepted any review plus four confirmations, regardless of URL mismatch or unresolved failures. A pending review could also restore a stale URL after the address changed. Those defects belong in the current reliability work, not merely in a future roadmap. Preserve historical records and make all new readiness decisions explain their evidence and limits.

## Recommended next build after this update

Deliver one reference-quality customer journey from start to finish, with real content, bundled fonts, purposeful images, complete failure/recovery states and a verified handoff. Use actual reviewers and intended users to identify where it loses to excellent human work. Feed those findings back into composition and interaction decisions before adding more loosely connected tools or templates.

Browser infrastructure remains a prerequisite for claiming a completed visual/interactive acceptance pass. The [Product Design audit skill](skill://Plugin_fa77aec24fc08191bc6e57f377126d76/audit/SKILL.md) instructs: “Do not claim an audit if the actual flow could not be accessed and captured.” This document therefore records source-backed conclusions and proposed acceptance criteria, not screenshots or observations that could not be obtained.
