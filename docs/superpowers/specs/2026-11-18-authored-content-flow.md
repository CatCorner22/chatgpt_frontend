# Authored content flow and evidence identity

## Observed cause

`ContentEditor` labels `content.sub` as the supporting sentence. The renderer placed it beside the headline only when filtered feature rows existed, otherwise moving it below the hero action into an unconditional Details section. Header/fallback actions always linked to that section. This is confirmed in source and failing DOM tests, not a rendered usability finding. Existing empty Showcase/Journal tests codified the old behavior; they need the revised content contract.

## Bounded behavior

Always render a supplied supporting sentence once in the hero, after the headline and before a hero action. Do not synthesize missing copy. Render Details and its navigation only when there are feature rows with a nonblank title or body. Use one shared lightweight feature predicate in renderer and affected-output evidence identity.

| Real details | Valid destination | Hero action     | Header navigation           | Closing action                  |
| ------------ | ----------------- | --------------- | --------------------------- | ------------------------------- |
| Yes          | Yes               | Supplied action | Details and supplied action | Supplied action                 |
| Yes          | No                | Explore details | Details                     | Omitted                         |
| No           | Yes               | Supplied action | Supplied action             | Only after a supplied quotation |
| No           | No                | Omitted         | Omitted                     | Omitted                         |

Blank-only feature rows are absent. Header brand, skip link, footer, owner images and quotations remain intact. Never replace a missing destination with a fake action to the top of the same page. Keep destination validation and escaping unchanged. Remove empty action/navigation/Details wrappers. Existing compositions, styling, content editing, image framing, font assets and supported outputs remain unchanged.

Update editor help, readiness and export README to describe the actual fallback. Preview, working HTML and editable source share the same renderer; test current editor changes and delivered markup. Do not add a new choice to the calm user flow merely to repair this implicit dependency.

## Evidence identity

Launch evidence previously hashed design inputs without a renderer revision. For new authored websites with no renderable features, the same inputs will now produce different HTML. Add a lightweight runtime artifact revision only for this affected branch. Keep stored State, page settings, workHash, saved/export acknowledgements and design IDs unchanged. Existing evidence reset logic must clear old reviews, task confirmations and launch approval when the artifact fingerprint changes, while unchanged outputs and repeat reviews retain their correct identity. Never eagerly import the authored renderer/font catalog to calculate the artifact.

## Verification

- Before-fix tests reproduce missing hero explanation, empty Details/phantom fallback links and immediately repeated short-page actions across five compositions.
- Test explanation once and in source order, meaningful/missing/unsafe destinations, blank/nonblank rows, quote/no quote, all fragment targets, original copy, and preview/source parity.
- Real editor removal/addition updates the iframe via existing state handling, without losing owner words or valid actions.
- Test actual old/new progress identity through production helpers; only affected authored evidence resets. Input-preservation workHash stays unchanged.
- Independent review; full suite, TypeScript, scoped lint and exact production build. Existing repository lint debt is documented, not a clean whole-repo claim.
- Browser retried this turn and failed at startup. Visual crop/layout, keyboard/zoom and real visitor tasks remain unrun. Source checks do not establish North Star equivalence.

References: [content-flow research](../../research/AUTHORED-CONTENT-FLOW.md). No customer source, deployment or sharing changes; normal owner-private Focus publication only.
