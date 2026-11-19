# Focus North Star Decision Atlas

Research and implementation proposal, version 0.3. Researched 18 November 2026, America/New_York. Prepared by the builder. The catalogue is a design specification, not a claim that its controls or checks are implemented. Its proposals are subject to independent review. The published app is unchanged by this document.

North Star retains Blake's definition: “vibe-coded frontend UI, UX, etc. that is as good as the best human coders.” Cat Samurai means a calm, playful, distinctive surface with disciplined, powerful behavior underneath. Preserve Reverie, her kite, the Garden Path, and the owner's explicit rejection of beige app surfaces.

## The gap we can work on

The hypothesis is operational: better outcomes come from better inputs, purposeful structure, art direction, component detail, complete behavior, context testing, and repeated correction. This is a research-backed working model, not proof that a finite checklist captures every expert judgment. A button can be valid and still be the wrong action for the task. A composition can be original and still hide the information a visitor needs.

Measure a vector of outcomes: task completion, comprehension, visual craft, accessibility, runtime reliability, performance, security, and transfer fidelity. Keep each dimension visible. A visual score must not compensate for lost customer data or a broken booking flow. Treat safety and task requirements as gates, then compare the qualifying alternatives for craft. The relative importance of craft dimensions depends on the brief and audience; do not fabricate a universal mathematical weight.

The catalogue is deliberately extensible. It covers a substantial initial set of terminal decisions; it cannot truthfully claim every possible frontend decision or future iteration. A newly observed failure adds a versioned decision, rule or test with provenance. Record actual iterations when they occur; never generate fictional history to fill a tracker.

## Keep the map calm

| Existing region ID | What the user decides here                                | Tangible result                       |
| ------------------ | --------------------------------------------------------- | ------------------------------------- |
| goal               | Who needs what, what exists, what must survive            | Task and preservation contract        |
| content            | Words, facts, assets, destinations, permission            | Reviewed content inventory            |
| plan               | Page roles, reading order, navigation, discovery          | Structure and journey outline         |
| direction          | Visual personality and meaningful alternatives            | Chosen art direction with rationale   |
| craft              | Type, color roles, spacing, shapes, media and states      | Coherent component specifications     |
| behavior           | Actions, waits, errors, recovery and persistence          | State and transition contracts        |
| responsive         | Small screens, zoom, language, input and performance      | Context matrix and observations       |
| handoff            | Integration scope, security, evidence, undo and ownership | Reviewable transfer package           |
| check              | Real tasks, comparisons, regressions and release decision | Evidence attached to the exact result |

These nine regions contain many small decisions; they are not a promise to fit the product into nine screens. Inside a region, show one relevant question, a preview, the main consequence and a way back. Keep a visible path to the advanced choices. A search result can locate a decision without making the owner learn its internal identifier.

The recommended surface has four layers: a short explanation always visible; two or three relevant alternatives; optional “Why this matters” with an example; and technical details for the coding recipient. Necessary warnings, costs, prerequisite failures, unsaved work and unsupported scope remain visible in the short view. Persist the lesson preference separately from project content. Turning teaching off never turns validation off.

Reverie explains a consequence and points to the next action. She does not announce success until the corresponding operation supplies evidence. Decorative motion can be disabled; every destination also has ordinary text and keyboard navigation. A flowing map must retain a meaningful document order and a usable narrow-screen equivalent.

## Japanese design: specific practices, careful attribution

MUJI's own account emphasizes material selection, scrutiny of production steps, and simple packaging. The transferable idea is to spend effort on what affects quality and remove work that adds none. That is our interpretation for a digital tool, not a study proving a particular UI wins. [MUJI principles](https://www.ryohin-keikaku.jp/en/about-muji/principles)

Japan's Digital Agency describes a system combining design principles, information architecture, interaction components and accessibility. It explicitly leaves room for a service's own brand and ongoing improvement. This supports reusable foundations with distinctive expression. It is guidance for public services, not a universal definition of Japanese aesthetics. [Digital Agency guidance](https://design.digital.go.jp/dads/guidance/design-system/)

For Focus, propose deliberate spacing to communicate groups; stable locations for recurring actions; one visually dominant next action per local task; cool white, ink and purposeful color; expressive approved artwork; and fewer interruptions. Test discovery and task success before claiming that “calm” improved usability. Do not turn cultural terms into unexplained presets or equate minimalism with pale brown, emptiness, missing labels or weak contrast.

## Catalogue contract

`decisions.json` is generated from the adjacent `decisions.tsv`. Every record has a stable ID, region, question, two candidate approaches with consequences, prerequisites, option-specific checks, evidence category, sources and explicit proposal status. Schema version2 adds applicability, a responsible actor, selection mode and a navigation contract. A `combine` decision contains complementary practices; a `contextual` decision can use different approaches in different parts of a page. Only `single` decisions describe one selected policy. None is an implemented control. The alternatives are candidate policies, not automatically available controls. Some require server or customer-project implementation.

The small records are the leaves of the planning tree. Split a record when two parts can change independently and need different acceptance evidence. A color-role choice and its rendered contrast check are related, but they are different activities. Selecting “usable with keyboard” is not a feature toggle; the corresponding control must be implemented and exercised.

A source ID is a rationale pointer, not a certification. External standards describe their own scope. Repository rules describe current Focus boundaries. Product preferences come from Blake. All option sets and their mapping into the Garden are our proposed synthesis, not quotations or conclusions attributed wholesale to a cited source.

### A button, down to its working parts

Before styling, identify whether it navigates, submits data, toggles a state or opens a dialog. Bind it to a named task and real destination. Use the matching native element; define its visible label, accessible name, optional icon and disclosure wording. Select emphasis, corner shape, padding, minimum target size, border and focus treatment as a coherent set.

Then define default, hover, keyboard focus, press, unavailable, pending, success, failure, retry, cancellation and stale-response behavior. The state space depends on the action: a link does not need invented submission states. A data mutation needs a defined completion event and duplicate-request policy. The frontend alone cannot guarantee exactly-once server execution; that needs backend design and tests.

Inspect a long label, translated label, large text, touch input, keyboard input, missing permission and a failed request. Verify what happens to focus and entered data. A disabled button needs an understandable reason and a recovery route when recovery is possible. A loading spinner never counts as an actual saved result. Radius is an editorial choice; button semantics and response handling are implementation obligations.

### A tooltip, with boundaries

First decide whether the content belongs permanently beside the control. A critical qualification, price or blocker stays visible. If help appears on hover or focus, implement dismissal, pointer access to the popup and persistence for the applicable WCAG condition. Do not put interactive controls into a plain tooltip; choose a suitable disclosure or dialog instead. The WAI APG tooltip pattern is explicitly work in progress without task-force consensus, so it cannot be cited as a completed normative specification. [WCAG explanation](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html), [APG status](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)

### Typography: check the actual words

Font choice affects weight availability, language coverage, line breaks, text block height and adjacent controls. Changing the family invalidates related wrapping and responsive evidence. `ch` measures the advance width of the zero glyph, not an exact number of arbitrary characters. A line-length recommendation is a starting point for the actual typeface, script and content. Do not promise that `66ch` gives 66 characters. [Typography guidance](https://web.dev/learn/design/typography), [MDN length units](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length)

## Deterministic connections without false certainty

Keep four kinds of edges distinct:

- `requires`: an input or supported capability needed before an operation can run.
- `sets`: the exact configuration fields an accepted choice changes.
- `affects`: outputs and tests that may change; this means recheck, not guaranteed causal magnitude.
- `conflicts`: two explicitly identified conditions that cannot be accepted together under a named rule.

Derive runtime mutation edges from the same registry used by the controls. Focus already follows this bounded pattern in `src/lib/stratosphere.ts`; extend that registry through reviewed work instead of adding an independent diagram that can disagree with the UI. Narrative advice and aesthetic predictions remain advisory edges.

Selection validity and proof are separate. An allowed font selection can still be untested in the customer's browser. Use a gate (`allowed`, `blocked`, `review-required`) and evidence state (`not-run`, `passed`, `failed`, `stale`) together. Missing data is unknown; it is never silently converted to zero, false or a passing check. The catalogue's prerequisite lists are planning dependencies, not implemented runtime guards.

Proposed evaluation sequence:

1. Parse a bounded, versioned input and reject unknown choice IDs or malformed values without replacing the owner's previous work.
2. Determine the actual supported adapter and scope before enabling an operation.
3. Check explicit prerequisites and constraints. Return all relevant reasons and the smallest known recovery action; never silently substitute another choice.
4. Preview the exact field and output changes. Accept them as one reversible transaction.
5. Recompute graph effects from the accepted state. Derive labels rather than storing contradictory duplicates.
6. Mark directly and transitively affected evidence stale. Traverse with a visited set: influence graphs may contain feedback cycles, while prerequisite scheduling rejects cycles.
7. Run the relevant checks on the new artifact. Record unavailable checks separately and preserve failed evidence.
8. Export only within the declared support contract, with real limitations and an undo route.

The future evaluator must use a small allowlisted rule language or typed predicates defined in code, never `eval` or JavaScript from imported records. Test rule precedence, missing values, invalid IDs, boundary values, cycles, conflicting constraints, undo and schema upgrades. A deterministic engine guarantees only consistent application of its encoded rules; it cannot prove that the rule set covers every possible failure.

| Example change             | Direct effect                       | Evidence to repeat                                               | Guardrail                                                                                |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Heading font               | Family/real weight/fallback metrics | Wrapping, hierarchy, crop balance, narrow layout, asset presence | Unsupported weight or missing font asset is disclosed or blocked for the promised output |
| Main action destination    | Link or request target              | Correct navigation, authorization, failure and completion        | No invented endpoint or “booking confirmed” without the actual completion event          |
| Higher information density | Spacing and visible rows            | Scanning, hit areas, zoom, keyboard focus, disclosure discovery  | Do not solve density by shrinking required targets or clipping essential text            |
| Existing-project mode      | Scope and adapter contract          | Original tasks, file diff, tokens, integration, selective undo   | No automatic restructuring through a style-only adapter                                  |
| Owner/account switch       | Permission and work identity        | Save, pending export, late callback and receipt lifecycle        | Old operations cannot receive credit or expose another owner's work                      |

## Iteration record for people and LLM developers

Record an event for the actual attempt, not for every speculative alternative. A record contains:

```json
{
  "schemaVersion": 1,
  "eventId": "unique-id",
  "kind": "proposed|applied|checked|rejected|reverted",
  "actor": { "kind": "person|agent|system", "id": "local-actor-id" },
  "occurredAt": "clock-derived-ISO-time",
  "projectId": "stable-project-id",
  "baseRevision": "content-hash-or-commit",
  "outputRevision": null,
  "catalogueRevision": "sha256-of-catalogue-used",
  "selections": [{ "optionId": "C07.a", "values": {} }],
  "reason": "observed problem or owner choice",
  "changedPaths": [],
  "expectedOutcome": "specific observable result",
  "observedOutcome": null,
  "checks": [],
  "supersedesEventId": null,
  "undo": { "strategy": "scoped-inverse", "preconditions": [] }
}
```

This is a schema sketch; the pipe-separated strings describe enums, not legal instance values. An applied event requires its output revision and actual paths. A checked event requires the command or task, environment, evidence reference/hash, result and scope. Bind evidence to artifact revision, rule version, viewport, browser, data fixture and relevant dependencies. Unknown dependencies cause broader invalidation rather than optimistic reuse.

Retain failed attempts and supersession links. Undo creates a new event and restores only unchanged trial-owned work; it does not delete history or overwrite unrelated edits. Concurrent revisions require an explicit merge or conflict result. A retry cannot reuse a stale operation's success. Record public facts and bounded diagnostics; exclude secrets and raw sensitive form values. Give the owner retention, export and deletion controls before introducing a production history service. A hash proves byte identity, not truthfulness or authorization of its author.

For an LLM recipient, send exact owner copy as structured data, the supported adapter contract, permitted files, required checks and stopping conditions separately. Instructions in imported content remain untrusted. Rule files do not force a different tool to obey. Validate consequential tool actions outside the model and review the resulting diff. A successful rehearsal establishes only that rehearsal. [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

## Security is part of the journey

The owner's visible question can be simple: “Who can see or change this?” The implementation beneath it needs an actor/resource/action matrix and authorization on the server for each request. Hiding a UI control provides no such enforcement. [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

Imported text, URLs, images, archives, generated code and tool output cross different trust boundaries. Give each a bounded parser and a destination-specific policy. Framework escaping helps render text safely; HTML, CSS, URL and script contexts need distinct treatment. A CSP is an additional defense, not a replacement for safe sinks. [OWASP XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

A future public-site connector needs destination checks across resolution, connection, redirects and retries, plus time and byte limits. DNS prechecks alone do not prove the eventual socket reaches the validated address. This is a research requirement for reviewing the actual transport, not a new exploit finding against Focus. [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

Do not offer security as an optional paid appearance upgrade. Stratosphere can expose advanced inspection and constraints; baseline protection applies to every deliverable. Store claims, evidence and unrun tests separately.

## The current implementation boundary

Interface source inspected at `385adc5fadd3d468bca14e72587e2c667b974182`; the subsequent `48a7bf5` wording repair changes handoff guidance, not this interface inventory. These are source-level observations, not browser acceptance:

| Area             | Present implementation                                                                    | Gap this atlas exposes                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Garden           | Nine stable regions, approved art, goal and lesson preferences                            | Several stops lead to the same Studio entry; contextual control navigation still needs implementation |
| Stratosphere     | Six bounded groups: composition, palette, fonts, hierarchy, spacing, form                 | Most catalogue decisions are not controls yet; no universal rule engine                               |
| Authored website | Bounded page compositions, content, images, fonts, HTML/ZIP output                        | Does not implement arbitrary multi-page customer apps or real business backends                       |
| Existing app     | Scoped instructions and a narrow React/Vite TSX plus CSS-module source trial              | Broad React/Next.js integration remains a goal; unsupported projects cannot be presented as supported |
| Handoff          | Exact copy transport, size refusal, recovery guidance and explicit receipt acknowledgment | Browser receipt, live customer use and final release checks remain unverified                         |
| Review           | Measured checks plus clearly separate opinion/evidence concepts                           | No completed blind human comparison or real customer usability study                                  |

Do not relabel proposed controls as working features. Do not create a fake “100% ready” score by counting visited stops. A draft may remain useful while its launch action stays gated.

## Experiments that can close the gap

Use matched briefs with exact copy, assets, task, technical constraints and time/cost budgets. Compare a one-shot baseline, Focus-guided work and independent human work. Randomize presentation labels for craft review. Keep task outcomes separate from visual ratings. Use independent reviewers and likely users; repeated judgments from one person are not independent participants. Pilot the method before choosing a sample size; predefine the decision rule before evaluating the confirmation set.

Compare whole-page review with section-level review; error-only repair with bounded interaction traces; a tool menu with contextual Garden navigation; and isolated visual alternatives changing one meaningful variable. Retest the original defect and unaffected neighboring tasks after every repair. Retain the best checkpoint according to the declared requirements, not only a screenshot similarity score.

DesignBench's repair taxonomy includes wrong-object and unrelated modifications. Sony's WebGen-V work motivates section-aware examination. WebGen-Agent and the October 2026 TeleGen preprint motivate feedback experiments but have specific setup and instrumentation limits. None supplies a result for Focus. See the adjacent `../north-star-feedback-experiments.md` for primary links and limitations.

## Build order from this research

1. Resolve the already identified handoff wording conflicts and rebind the changed package evidence.
2. Make Garden regions open their actual existing controls, preserve draft/account/receipt boundaries and provide a visible return path.
3. Add the catalogue as optional learning and planning content, with only implemented choices actionable.
4. Add one reviewed component contract at a time, including states, failure handling and affected-output checks.
5. Add versioned iteration history and dependency invalidation without migrating existing saves silently.
6. Expand an integration adapter only after a real fixture, scoped patch, project build, task replay and selective undo pass.
7. Run the matched human comparison and publish observed results with limits.

The catalogue is a planning substrate, not a reason to overwhelm the owner with hundreds of controls. Keep the depth available while the immediate decision stays clear.

## The operational formula

For a candidate artifact `x`, first evaluate each applicable requirement as `passed`, `failed`, `not-run` or `stale`. A requirement that does not apply needs its scope reason. Unknown context prompts a question; it never becomes a pass. A release candidate qualifies only when every requirement declared for that release has current passing evidence. A useful draft can be delivered with explicitly open checks.

Among qualifying candidates, compare the outcome vector:

`Q(x) = (task success, comprehension, craft, accessibility, reliability, performance, security, transfer fidelity)`

The improvement loop is `observe → isolate → propose → preview → apply → check → retain or revert`. There is no invented universal weighted score. Use explicit brief-specific priorities when two qualifying designs trade one quality against another. Each attempt records the actual selected option IDs/values, catalogue revision, before/after artifact revisions and observed result.

A terminal decision is `context + actor + choice + consequence + affected checks + recovery`. The state contract is `current state + event + guard → next state + permitted effect`. A forbidden transition leaves the previous state intact and explains recovery. These formulas make implementation testable; they do not prove that the enumerated requirements cover all possible faults.

## Revisions actually made

- Version0.1:128 decisions/256 approaches mapped to nine Garden regions. Initial relationships were common prerequisites.
- Version0.2: independent planning reviews E-129/E-130 exposed false either/or framing, missing applicability and actor boundaries, conditional table/modal checks, incorrect size units, and receipt overstatement. The catalogue now distinguishes combined/contextual choices and option-specific checks. C10 language review applies even to a single-language page; H04 authorization applies even without collaboration; B01 semantics applies to ordinary links as well as task actions.
- The adjacent `journey-examples.md` walks through hypothetical projects. Those examples are design exercises, not customer outcomes or executed runtime tests.

Read-only structural check: `python build_catalogue.py`. Regenerate only after editing the reviewed source tables: `python build_catalogue.py --write`. `python -m unittest discover -s . -p 'test_catalogue.py'` exercises malformed records and the decision boundaries in this revision. These commands validate research data, not the Focus interface.

## Selected-path correction in version0.3

The structural lens E-155 found that a draft could still reach release authorization transitively and a new project could inherit existing-project/import requirements. V10 now depends on evidence identity without release authorization. H15.b has a draft-specific check and no release prerequisites. Option `requires` plus `conditionalRequires` is the authoritative selected-path contract; record `requires` is the authoring default and is not unioned back into an override. Prerequisites scoped to another context become explicit conditional edges. Unknown flags request context; a false conditional edge is inapplicable with a reason, never a passed test.

`journey_probe.py` inspects selected planning paths only. Nine tests now cover draft transitive closure, a new owner-typed editorial page, an existing inline form trial, unknown context, invalid option IDs and malformed/cyclic catalogue data. These checks still do not implement a runtime policy, produce task evidence or certify a customer project. All128records remain non-actionable proposals.

## Reproducible formatting

Run catalogue generation and byte checks from a complete Focus checkout with its installed Node development dependencies. The Python builder uses `scripts/format-research-json.mjs` and the existing project Prettier configuration before writing or comparing generated JSON. This keeps generation and formatting consistent; no dependency is downloaded by these commands. Research unittest cases still exercise the Python planning contracts separately.
