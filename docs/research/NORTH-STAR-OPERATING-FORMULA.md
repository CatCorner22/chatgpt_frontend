# The North Star operating formula

Research synthesis and implementation plan. North Star means frontend design, UI and UX as good as the best human coders. This document specifies a process for closing that gap; it does not claim Focus has already reached it.

## 1. Define the comparison before optimizing

Compare three outputs made from the same task, content, assets and constraints: a one-shot baseline, Focus-guided work and independent expert work. Record time, tools, cost and revision opportunities. Review task outcomes separately from visual preference. Randomize presentation labels when comparing craft. Actual customer tasks and likely users matter more than a developer's impression of their own output.

Represent quality as a vector:

```text
Q = [task success, comprehension, visual craft, accessibility,
     reliability, performance, security, transfer fidelity]

gap_i = expert outcome_i - Focus outcome_i
```

Use a difference only where the measures have comparable units and a defined direction. For failure rates or response times, reverse the improvement direction explicitly. Subjective ratings carry reviewer and sampling uncertainty. There is no defensible universal conversion between a beautiful hero and a broken checkout. Keep protected behavior and release requirements as gates.

## 2. Model each decision as a small contract

```text
D = {
  question, context, applicable_when, responsible_actor,
  approaches, selection_mode, consequences,
  required_inputs, permitted_changes,
  affected_outputs, affected_checks, recovery
}
```

Distinguish three selection modes: one project policy; complementary practices that can combine; and context-specific alternatives that may coexist in different parts of a page. Determine applicability before asking for a selection. Unknown context produces a question, not a passing default.

A decision is sufficiently small when it can change independently and has a distinguishable consequence or acceptance check. “Make the button good” is too broad. Element semantics, visible wording, target size, emphasis, focus appearance, pending behavior and completion event are distinct but related decisions.

## 3. Separate four graphs

| Graph         | Meaning                                     | Failure to prevent                                                   |
| ------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| Prerequisites | Inputs needed to make an applicable choice  | A draft inherits a release-only requirement through an indirect edge |
| Mutations     | Fields actually changed by a control        | A diagram and its control describe different changes                 |
| Effects       | Outputs/checks potentially affected         | A font change keeps stale wrapping evidence                          |
| Authority     | Who can perform an action on which resource | A hidden button is mistaken for server authorization                 |

The complete selected path is the validation unit. A list of locally valid edges can still form an invalid journey. Follow conditional edges with the actual context. Reject prerequisite cycles. Allow a separate effects graph to contain feedback loops, traversed with a visited set. A narrative prediction about taste is advisory; a typed mutation edge can be exact.

Focus's current Stratosphere registry provides bounded actual mutation/dependency behavior. The 128-question research atlas remains planning guidance. Do not promote its prose to executable policy or infer unsupported customer capabilities from its presence.

## 4. Specify states before decorating them

For each real interaction, define:

```text
(state, event, guard) -> (next_state, permitted_effect)
```

Include only relevant states. An ordinary link needs a real destination, native semantics and navigation checks; it does not need invented submission success. A mutation may need idle, validating, pending, succeeded, failed, canceled and stale-result handling. Define the source of truth for completion. A UI callback alone cannot establish an external transaction or exactly-once server execution.

Keep invariants explicit: rejected choices preserve the prior design; stale callbacks cannot credit changed work; canceling a preview cannot publish it; a late account-switch response cannot expose the earlier account's data. Test transitions and races, not just the initial screenshot.

## 5. Turn craft into inspectable decisions

| Layer       | Decisions                                                                  | Observable review                                                                     |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Task        | Audience, primary action, necessary information, preserved behavior        | A person completes the named task and understands the result                          |
| Content     | Exact words, facts, image permission, destinations, language               | Complete content survives rendering and transfer; unknown facts stay unresolved       |
| Structure   | Reading order, sections, navigation, disclosure, discovery                 | The task remains findable without memorizing hidden controls                          |
| Composition | Scale, alignment, grouping, density, rhythm, media balance                 | Hierarchy and emphasis support the brief across real content lengths                  |
| Typography  | Family, real weights, script coverage, measure, leading, wrapping          | Long labels, fallback fonts, large text and narrow views remain usable                |
| Color       | Semantic roles, contrast, selected/focus/error distinctions                | Actual rendered combinations communicate meaning beyond color alone                   |
| Components  | Semantics, shape, padding, target, icon, focus, disabled explanation       | Native behavior, accessible names and the intended interaction remain intact          |
| Behavior    | Waiting, errors, retry, persistence, concurrency, recovery                 | Failed and interrupted tasks preserve work and provide a useful route forward         |
| Delivery    | Scope, artifact identity, recipient instructions, actual integration, undo | The recipient can use the exact artifact and demonstrate protected tasks and recovery |

Button radius is a taste decision within a system. Focus containment is a pattern-specific behavior requirement. Do not treat both as interchangeable style toggles. Use the relevant source's scope and exceptions rather than converting every guideline into an unconditional gate.

## 6. Apply one bounded iteration

```text
observe an actual problem
record the baseline and protected tasks
choose the smallest useful change
validate supported scope and required inputs
preview the exact effect
apply as a reversible transaction
invalidate directly and transitively affected evidence
run the relevant checks on the resulting artifact
retain the improvement, repair it, or revert it
record what happened and what remains unknown
```

Record catalogue revision, option IDs and values, before/after artifact revisions, actor, actual changed paths, evidence and recovery preconditions. Preserve failed attempts. A reverted attempt is history, not an event to erase. Separate “visited,” “chosen,” “implemented,” “checked,” “delivered” and “accepted.”

## 7. Test intelligently without inventing certainty

The combinations grow rapidly: even 20 independent binary choices have 1,048,576 combinations. Arbitrary real-world apps add networks, devices, content, time and concurrent events. A finite menu does not prove universal freedom from defects.

Reduce the problem through bounded adapters, compositional contracts, property/invariant tests, boundary cases and targeted interaction coverage. Use pairwise or risk-led combinations as a sampling strategy, not exhaustive proof. Add realistic full journeys and inspect the delivered artifact in its actual environment. Preserve the original customer tasks as regression obligations.

The user's “never make things worse” objective becomes a release contract for known protected behavior plus a recovery strategy. If evidence is missing, label it missing and keep the affected consequential action gated. Do not substitute a reassuring character, a score or a rule file for that evidence.

## 8. Current evidence and next experiments

The research catalogue contains 128 questions across nine Garden regions and 256 candidate approaches. At planning-repair revision `6909eef`, 15 research tests cover structure, option-specific checks, conditional applicability, conflicting selections, operation completion and complete draft/new/existing paths. Reproduce the count from the repository root with `python -B -m unittest discover -s docs/research/north-star-atlas -p test_catalogue.py`. Their scope is the catalogue; they do not test an exported customer's app.

The latest review exposed a transitive draft-to-release dependency and new-page requirements pointing at existing-project work. Those relationships were corrected and now have regression fixtures. This demonstrates why path-level checks belong alongside atom-level checks.

Next empirical experiments: compare general tool menus with contextual Garden entry; compare whole-page review with section-focused review; compare error-only repair with bounded interaction traces; compare two art directions while holding content and task fixed. Predefine what result changes the implementation. Keep losses and inconclusive results in the record.

Source rationale and limits are in [the Decision Atlas](north-star-atlas/README.md), its 32-source registry, and [Samurai Cat](../SAMURAI-CAT-THEME.md). The new surface/depth research also uses [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [USWDS task patterns](https://designsystem.digital.gov/patterns/intro/). These sources inform the process; none reports a result for Focus.
