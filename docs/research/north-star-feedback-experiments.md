# North Star: experiments for an observable design loop

Research follow-up, 18 November 2026 America/New_York. Builder synthesis; experiments below have not run. No model training, external project instrumentation or paid generation was performed.

## Additional primary-source findings

- **Evaluate creation, edits and repairs separately.** DesignBench covers multiple frontend frameworks. Its failure taxonomy explicitly includes wrong-object edits, incomplete repairs and unrelated modifications. Focus needs to test that a repair removes the specific defect while preserving unaffected sections and behavior. A successful build alone is insufficient. [DesignBench author-maintained failure guide](https://github.com/WebPAI/DesignBench/blob/main/assets/Failure_Annotation_Guideline.md).
- **Inspect sections as well as the whole page.** Sony's WebGen-V implementation uses a structured, section-wise representation and feedback for refinement. This supports testing a structured review in Focus; it does not prove that the method improves Focus's output or every customer's design. [Author repository](https://github.com/sony/web_gen_v_bench).
- **Test actions against expected outcomes.** WebGen-Bench includes multi-file website tasks and manually refined functional test cases executed by a navigation agent. Its historical scores describe its tested models and setup, not today's universal capability ceiling. [NeurIPS 2025 paper record](https://papers.nips.cc/paper_files/paper/2025/hash/6841eed8bb6a2ec49e49235c8115efee-Abstract-Datasets_and_Benchmarks_Track.html).
- **Feedback and reversible checkpoints are promising mechanisms.** WebGen-Agent combines screenshot and interaction feedback with backtracking. Its appendix explicitly excludes response speed and complex network conditions. Borrow the experiment structure while retaining independent performance and failure tests. Reported benchmark improvements are not Focus results. [Paper, v1](https://arxiv.org/html/2509.22644v1).
- **Observe the failed transition.** TeleGen's October 2026 preprint reports gains from runtime telemetry and compressed repair briefs. Its limitations include instrumentation changing behavior and extra overhead. Its manual audit also distinguishes actual functional repairs from changes that merely help the evaluator see success. This is a hypothesis for an isolated preview, not permission to add logging to a customer's production app. [Preprint and limitations](https://arxiv.org/html/2610.04981v1).

## Concrete experiments

| Experiment              | Hold constant                                              | Change                                                 | Observe                                                                                 | Reject the change when                                                                 |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Structural alternatives | Brief, exact copy, asset, tokens and task                  | Studio, Journal and Product compositions               | Critical-fact retrieval, task completion, hierarchy and visual preference               | A required fact disappears, a task worsens, or only the evaluator score improves       |
| Section-level review    | Same frozen build and review budget                        | Whole-page critique versus page plus region critique   | Independently confirmed defects found and fixed, false positives and collateral changes | Extra findings are subjective duplicates or repairs damage neighboring content         |
| Evidence-led repair     | Same seeded failure and allowed file scope                 | Error-only feedback versus a bounded interaction trace | Original failure removed; unaffected tasks preserved; time and overhead                 | Instrumentation changes the task, leaks input or a narrow patch becomes a rewrite      |
| Map navigation          | Same available capabilities and saved design               | Tool menu versus contextual Garden stops               | Time to correct control, wrong destinations, assistance and saved-work preservation     | Users lose work, mistake visiting for completion, or cannot find the advanced controls |
| Human comparison        | Matched brief/assets/time constraints and frozen artifacts | Focus-guided output versus independent human work      | Blind craft ratings and real task outcomes separately                                   | Protocol/data are incomplete; do not announce equivalence from an inconclusive pilot   |

These are proposed comparisons, not invented experimental outcomes. Use a pilot to find workflow problems; reserve separate briefs for confirmation. Count actual participants rather than treating multiple ratings or model personas as independent people.

## Decision record the LLM builder can use

Each decision records `id`, owner-approved intent, selected option, affected components, prerequisites, source rationale, expected outcome and test. Each implementation attempt records base revision, exact diff, output revision, observed failure, retained evidence and selective rollback. A result has a declared type: configured, statically checked, browser observed, or customer observed. No conversion between types occurs merely because a score is high.

The model receives exact customer copy as data and the design instructions separately. If generic design advice conflicts with supplied wording, the model reports the conflict and requests an owner edit; it does not silently rewrite the copy. Failed or missing checks remain attached to the current artifact. A later edit invalidates relevant evidence instead of keeping an old green badge.

## Voice of Customer basis

| Perspective                       | Evidence status                                                                                         | Need                                                                | Observable completion                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Blake, lay owner                  | Real: requests calm Garden guidance, optional education, no beige, clear tradeoffs and reliable handoff | Know what to do next without learning every tool at once            | Reach a named control, understand its consequence, retain choices when returning                    |
| Colleague testing an existing app | Real requested role; device and expertise unspecified                                                   | Trial an improvement without harming the live app                   | Use an isolated preview, preserve required tasks and selectively undo the trial                     |
| LLM coding recipient              | Real: user says the developer will often be an LLM; individual model behavior unknown                   | Unambiguous scope, exact inputs, validation and stopping conditions | Produce a scoped diff and actual evidence; reject unsupported combinations without inventing a pass |

No simulated interview, customer quote, adoption claim or observed usability result is included. The two research memos are inputs to the build; they are not evidence that the Garden redesign is already implemented.
