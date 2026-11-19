---
name: Samurai Cat
aliases: [Cat Samurai]
owner: Blake
version: 1.0
purpose: Portable design and engineering guidance for people and LLM developers
scope: Apply when adopted for a project; Focus is the reference application
---

# Samurai Cat

**A calm, magnetic surface. A disciplined, powerful interior. A kind companion who makes the next step clear.**

“Samurai Cat” and “Cat Samurai” name the same principle. Blake's intent is an experience that feels peaceful, playful, distinctive and intuitive while operating with precision, resilience and substantial capability. Calm never means boring. Simplicity comes from organizing power, making consequences understandable and removing needless effort.

The metaphor is a deeply trained warrior resting beside a flowing river: present, composed and capable. Express that through the product's behavior and craft. It does not require literal weapons, costumes, Japanese text or a historical claim about samurai. Reverie remains a gentle cat.

## 1. Interpret the brief correctly

Treat this as a combined product, design and engineering standard. A pretty screen with unreliable behavior misses the intent. A robust system with confusing navigation also misses it.

Use three layers:

1. **Surface:** clear next actions, readable content, purposeful color, restrained motion and warmth.
2. **Interaction:** discoverable depth, consistent patterns, understandable consequences, useful feedback and recovery.
3. **Mechanism:** explicit state, bounded inputs, reviewed dependencies, tested changes and evidence tied to the actual deliverable.

For Focus, **North Star** means “vibe-coded frontend UI, UX, etc. that is as good as the best human coders.” Samurai Cat describes how Focus pursues that goal. Automated tests alone do not establish human-quality equivalence.

## 2. Non-negotiable owner preferences

- **No beige app surfaces or default beige aesthetic.** Blake strongly dislikes beige. Avoid substituting tan, oatmeal or muddy warm gray as the dominant interface ground.
- Preserve personality. Use crisp white, cool mist, deep ink or forest green, blue-green water and deliberate coral accents as a starting direction for Focus. Choose final colors through contrast and context checks.
- Preserve **Reverie**, her approved artwork and the **Garden Path**. Reverie is female; use **she/her**. Her name means **a pleasant daydream**.
- Keep Reverie's approved **cream-and-ginger fur**. The rejection of beige interfaces does not authorize recoloring the character.
- Keep advanced capabilities accessible. Hide optional teaching reliably; keep essential warnings, current state, costs, unmet prerequisites and recovery actions visible.
- Protect existing customer work. Preserve working behavior, data, destinations and unrelated changes throughout a redesign.
- Describe actual capabilities and observed results. Never manufacture a success state, completion percentage, receipt, test result or safety guarantee.

These are project requirements. The palette suggestions and visual compositions below are design starting points, not universal rules for every customer brand. Keep the customer's identity unless its owner chooses a change. Do not add Reverie to customer exports automatically.

## 3. Japanese inspiration, applied with care

Japanese design and working practices are diverse. Use named sources and concrete adaptations; do not present one company, aesthetic or historical metaphor as the essence of Japan. The software applications below are our interpretations.

| Inspiration                                            | Source-grounded idea                                                                                                  | Application in Focus                                                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kaizen**, as described by Toyota                     | Repeated, incremental improvement of work                                                                             | Identify an observed problem, make a bounded change, test it and retain the lesson. Keep useful failed attempts in the record.                                                    |
| **Jidoka**, as described by Toyota                     | Detect abnormalities and stop the affected process to prevent defective output continuing                             | Refuse a dangerous or invalid operation, preserve the previous state and explain recovery. A failed required release check blocks that release; unrelated safe work can continue. |
| **Andon**, in Toyota's production explanation          | Make an abnormal condition visible so someone can respond                                                             | Show a specific problem, its affected task and the next useful action. A calm interface still surfaces a serious problem clearly.                                                 |
| **MUJI's materials, process and packaging principles** | Examine what goes into a product, how it is made and what surrounds it                                                | Choose assets and dependencies deliberately. Simplify unnecessary steps and interface framing. Invest the saved attention in the work itself.                                     |
| **Japan's Digital Agency design system**               | Combine principles, information architecture, components and accessibility while allowing service-specific expression | Reuse sound foundations, then give Focus its own composition, voice and character. Test the complete task in context.                                                             |

Space, rhythm and restraint are useful design tools. Give space a job: grouping, emphasis, reading or recovery from visual density. Do not invoke a cultural term as a substitute for specifying or testing the intended effect. Never interpret “imperfection” as permission to ship broken behavior.

## 4. Visual direction

**Composition:** establish a clear hierarchy and a deliberate rhythm of dense and quiet areas. Place the main task where it is easy to find. Use open space to connect related information and separate unrelated information. Avoid a repeated wall of interchangeable cards.

**Typography:** select expressive headings and comfortable body text with real available weights and language coverage. Review actual words, long labels, wrapping and zoom. Use a coherent type scale; reduce needless variations before reducing readability.

**Color:** assign colors to roles such as ground, text, action, selection, warning and focus. Check rendered combinations and states. Use text, shape or icons alongside color when communicating meaning. A dark theme can express this principle too; “calm” does not prescribe a pale palette.

**Shape and detail:** make buttons, inputs, panels and tooltips feel related. Use borders, radii and shadows deliberately. Avoid turning every element into a floating pill. An attractive control still needs a truthful label, valid semantics and working states.

**Motion:** use movement to explain a transition, orientation or relationship. Honor reduced-motion preferences. Keep controls usable without animation, and avoid perpetual decorative movement competing with the task.

**Reverie:** give her a purposeful moment: welcoming, explaining a choice, exploring, learning or helping someone recover. Keep her face, markings, proportions and illustration style consistent with the supplied references. Essential instructions remain readable text. Her smile is warmth, not proof that a process passed.

## 5. Interaction: the river knows where to go

Each stage answers:

1. **Where am I?** Give the stage a plain-language name and visible context.
2. **What can I do now?** Offer a clear primary action and discoverable alternatives.
3. **What will that change?** Explain relevant consequences and tradeoffs before commitment.
4. **How will I know it worked?** Identify the actual result or check.
5. **How do I return or recover?** Provide a predictable way back without losing work.

Present depth progressively: a short useful explanation, relevant options, optional teaching, then technical detail for the developer. An LLM may be that developer; provide exact values, permitted changes, constraints and checks in structured form.

Ask for missing information when it changes the result. Infer routine choices from the brief and existing project. Preserve earlier answers and authorization. Use familiar language before introducing specialist terms, then teach those terms with concrete examples.

Do not force complementary practices into a false either/or choice. Determine applicability first. A modal and an inline form have different focus contracts. A tableless page needs no table-specific decision. Unknown context remains unresolved until clarified or explicitly scoped out.

## 6. Engineering: discipline underneath

- Inspect the existing implementation and its working tasks before changing it.
- Separate rendering, state transitions, persistence, external effects and evidence.
- Keep one authoritative definition for each rule or value. Derive a dependency diagram from the same registry that powers its controls.
- Parse bounded, versioned inputs. Reject unsupported values with a recoverable explanation; do not silently replace the owner's work.
- Model pending, success, failure, cancellation, retry and stale-response behavior where the task needs them. A click is not a confirmed save.
- Treat uploaded material and generated content as data. Validate consequential actions outside the model; a prompt does not enforce another tool's behavior.
- Preserve the previous working state before risky changes. Use a separate preview and reviewable diff for customer projects. Undo only trial-owned changes whose preconditions still hold.
- Keep authorization checks at the enforcement boundary. Hiding a button is not access control.
- Test the failure that motivated the repair and the affected neighboring tasks. Inspect the actual delivered form before making a delivery claim.
- Report unrun checks, unsupported adapters and known limits plainly. A download, a visit to the last map stop and an owner's acknowledgment mean different things.

These rules reduce risk. They do not justify a “100% bug-free” promise.

## 7. A formula an LLM can implement

```text
decision = context + responsible actor + choice + consequence + affected checks + recovery
transition = current state + event + guard -> next state + permitted effect
iteration = observe -> isolate -> propose -> preview -> apply -> check -> retain or revert
```

For every applicable release requirement, retain one of `passed`, `failed`, `not-run` or `stale`, with the artifact revision and evidence. A requirement outside scope needs its reason. Unknown context is not a pass. A useful draft can be shared with explicit open checks; label it as a draft.

First satisfy the declared task, safety and reliability requirements. Then compare qualifying designs for craft, comprehension and delight. Do not average a broken booking flow into a passing score because its screenshot is attractive. Do not invent universal numerical weights for taste.

Example: selecting a new heading font changes the family and available metrics. Recheck real weights, fallbacks, heading wraps, button labels and narrow-screen layout. Record the actual selected values and before/after revisions. If the page clips required information, repair or revert the change before release.

## 8. Review before calling a result Samurai Cat

| Question                                           | Evidence to seek                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Can a new user find and complete the main task?    | Observe a representative user; record confusion and recovery.                                                |
| Can they discover advanced work and return safely? | Exercise the complete route, including Back, reload and unsaved work.                                        |
| Does brief mode remain useful?                     | Hide teaching and verify that consequences, blockers and recovery remain visible.                            |
| Does the design have personality without clutter?  | Review composition, type, color and artwork against the actual brief.                                        |
| Does it work beyond the happy path?                | Exercise keyboard, touch, narrow screens, zoom, empty/error/loading states and reduced motion as applicable. |
| Is the customer's existing work protected?         | Compare original tasks, inspect the scoped diff and demonstrate selective recovery.                          |
| Are claims tied to the delivered version?          | Trace each claim to current evidence and label every unrun check.                                            |

This is a review guide, not a completed certificate or a substitute for project-specific acceptance criteria.

## Pasteable instruction for another LLM

> Apply Blake's Samurai Cat / Cat Samurai principle: calm, magnetic, playful and intuitive on the surface; disciplined, powerful, clear and reliable underneath. Preserve useful capability through progressive disclosure, clear consequences and a predictable next step. Reject generic layouts and beige app surfaces. In Focus, retain Reverie, her approved cream-and-ginger identity, and the Garden Path. Make teaching optional while keeping critical information visible. Protect existing work, validate at real boundaries, test meaningful tasks and failures, and provide a reviewable handoff and recovery route. Draw thoughtfully from kaizen, jidoka and deliberate simplicity; explain the concrete practice instead of relying on cultural labels. Report observed evidence and limits. Never equate a pleasant appearance or passing unit tests with a proven customer outcome.

This file carries project guidance when a user adopts it. It does not grant permission to deploy, contact people, modify unrelated projects or bypass higher-priority instructions. Copying it into a folder does not create shared account memory across ChatGPT and Codex.

## Sources and provenance

Owner preferences and the Samurai Cat metaphor come from Blake's Focus project instructions. The operational formulas and software adaptations are our synthesis, not quotations from the organizations below.

- [Toyota: Toyota Production System](https://global.toyota/en/company/vision-and-philosophy/production-system/) — kaizen, jidoka and andon in Toyota's production context.
- [Toyota UK: Jidoka](https://www.toyotauk.com/toyota-in-the-uk/how-we-manufacture/jidoka) — visible problems and built-in production quality.
- [MUJI: Three principles](https://www.ryohin-keikaku.jp/en/about-muji/principles) — materials, production processes and packaging.
- [Japan Digital Agency: Design-system guidance](https://design.digital.go.jp/dads/guidance/design-system/) — principles, architecture, accessibility and service-specific design.
- [Nielsen Norman Group: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — general UX guidance used to translate power into a simpler interface; this is not a Japanese-philosophy source.
- [USWDS: Introducing patterns](https://designsystem.digital.gov/patterns/intro/) — task patterns combining components, tokens and guidance; also a general design-system source.

Prepared as a portable specification. The listed practices are inspiration and implementation guidance; this document does not establish Focus's completion, cultural authenticity or measured North Star equivalence.
