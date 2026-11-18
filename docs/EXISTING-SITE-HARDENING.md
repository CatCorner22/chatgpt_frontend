# Existing-project hardening

## Problem statement and impact

The owner requires Focus to improve existing websites and apps while protecting their working behavior and delivering something the recipient can use independently. The current pass tests the downloadable pack, its instructions, Studio intent, recovery, and the evidence shown after a trial. Customer personas (a small-business owner and an app maintainer) are assumptions used for review, not customer interviews.

## Environment and evidence preserved

Baseline: local branch `fix/root-cause-handoff`, commit `355ea21b7e6a1f1b6a74b343d7ffe1d6178f4802`, Node 24.22.1, npm 11.9.0, Chromium and Firefox on Linux. Original application and prior release archives remain available. Reproductions are in `artifacts/existing-site-hardening/`; filenames containing `before`, `baseline`, `BASELINE`, or `PAIR-REGRESSION` record the original failures, not the final result.

## Reproduction status

Observed in the actual downloaded existing-site ZIP: a global token example changed a customer page without opt-in, and the bridge made quiet text and fixed dark panels less readable. A controlled quiet-text example fell from 9.42:1 to 2.64:1. The independent customer fixture reproduced a fixed-panel drop from 15.27:1 to 1.18:1. Importing the original bridge without the marker was inert; activating it caused the regression; removing the marker restored the original appearance. This discriminates a mapping defect from a bad selected palette.

Other observed failures: natural briefs starting with “Redesign this” could not switch back to new-project mode; switching modes rewrote owner text; raw brand HTML could become active when exported Markdown was rendered; incomplete inventories could appear clean; relative resources used the pre-redirect URL; and an unreadable screenshot replaced a valid comparison image. Rescue's paid generation path was unavailable under the existing AI policy.

## Timeline and recent-change context

The preceding pass repaired library/history/image transfer. This pass began with existing-project customer acceptance and independent architecture, CSS and recipient-fixture reviews. Reproductions preceded corrections. A fresh dependency scan then identified Vite advisories and a remaining unpatched glob-matcher advisory; the dependency report records their separate resolution and limits.

## Ranked hypothesis matrix

| Symptom | Leading cause and discriminating test | Rejected alternative |
|---|---|---|
| Existing page recolors without opt-in | Apply only the downloaded DESIGN.md CSS block; its unprefixed `:root` values overwrite host variables | The correctly scoped bridge was not needed to cause this failure |
| Dark text becomes unreadable | Toggle the bridge on the same fixture with a valid Focus palette; incomplete pairs and inherited text change against fixed backgrounds | Selected-palette contrast alone cannot explain or prevent the rendered mismatch |
| Mode selector sticks or changes words | Natural “Redesign this…” brief satisfies detection but not the removal regex | Storage and radio-event delivery work; the inferred state contract is wrong |
| Markdown brand hides content | Render a brand containing a style tag as Markdown/HTML | No archive execution is involved; unescaped prose crosses into document markup |
| Inventory misses a changed destination | Place `data-href` or quoted `>` before real `href`, or exceed the inventory cap | The documented private-route limitation does not explain omitted public-source evidence |
| Relative resource is wrong after redirect | Fetch `/old` → `/shop/`, then resolve `checkout` | Fetch redirect guards work; the final address was discarded afterward |
| Bad screenshot erases good one | Replace a valid image with undecodable PNG bytes | The prior image is valid; replacement committed before decode |
| Redesign suggestions cannot run | Click the real panel under paused-AI policy | A local curated generator already supplies the needed visual directions |

## Root cause or unresolved causal set

These were separate boundary failures: new-build recipes leaked into existing-project output; generic theme variables were treated as though every customer component used matching color pairs; owner prose doubled as integration state; text was emitted into markup; and evidence lost its source bounds or redirect identity. Screenshot state committed before input validation. Rescue assumed an available paid generator despite the paused-AI policy. Each correction addresses its own observed cause.

Final real-consumer checks also separated rendered Markdown from raw handoff text. Broad punctuation encoding prevented autolinks but changed ordinary owner sentences in the downloaded source. The unchanged creation/export smoke caught this; escaping is now limited to autolink triggers while normal punctuation remains literal. The original smoke assertion was retained. A suspected long-button completeness defect was ruled out by a passing boundary test before any source change; the test remains as a guard.

## Targeted correction

- Explicit persisted integration intent controls the exported artifact and participates in undo, dirty status and library revisions. Legacy intent migrates once without changing the brief. The choice appears before design creation and at handoff.
- Existing-mode prescriptions contain scoped `--focus-*` values and preservation-only instructions. Preview copy, new navigation and generic app behavior recipes are omitted from that handoff. Supplied prose is escaped in both modes.
- Adding `data-focus-restyle` exposes namespaced values without remapping customer colors. A separately reviewed `data-focus-theme="semantic"` opt-in enables one compatible modern or legacy bridge. Complete mapped pairs include muted surfaces/text. No blanket wrapper paint, font, heading, radius, ring or native-control rule is emitted.
- Mixed fixed/semantic themes remain unchanged by default and require component review. Paired mappings are not a universal safety guarantee. A customer trial must measure actual contrast and tasks before broader application.
- Public-source inventories carry coverage metadata; legacy/partial evidence is not presented as complete. Final validated redirect addresses are used for relative source resources. Fetch bounds and private-address rejection remain in place.
- Screenshot replacement waits for a valid image and retains the previous one on error. Local curated Rescue preserves extracted copy, reports zero AI calls, and blocks a failed baseline handoff with a repair message.
- Phone-sized app specimens open in a readable phone layout; an explicitly selected desktop specimen has its own keyboard-accessible horizontal viewport.

## Regression and validation evidence

Final commands, counts, production-browser receipts and package identity are recorded in `artifacts/existing-site-hardening/RELEASE.json` and the adjacent release manifest. `scripts/test-existing-transfer.mjs` downloads the actual UI ZIP and applies it to independent plain HTML and React fixtures. It tests modern/legacy paired themes and mixed surfaces at 1280, 768 and 320 CSS pixels: default no-op, deliberate compatible palette change, native validation/submission, keyboard actions, route and React state, outside content/portals, original task inventory, contrast, exact style rollback and unchanged customer source bytes.

`scripts/test-integration-mode.mjs` covers visible existing intent, unchanged brief, undo/redo, reload, legacy switching, the actual ZIP and no paid generation. Library/history/recovery and working-page recipient tests remain release gates because the new intent participates in saved state. The collision refusal in the fixture is a recipient test procedure; the ZIP itself is not an installer and cannot prevent a person or another tool from overwriting an existing folder.

## Residual uncertainty and monitoring

No finite fixture matrix proves that every customer's app will remain correct. Fixed colors, inherited text, root-resolved aliases, Shadow DOM, portals, native controls, status colors and framework-specific theme systems need actual component and task review. Do not apply a semantic bridge to an incompatible wrapper. If a trial worsens a task, readability or layout, remove its semantic marker and scoped edits, restore only the trial's changes, and keep the original project.

The local creation and existing-project pack require no public URL, source upload, account or paid AI. The connected public URL checker still requires configured authentication; live Supabase, account sync, hosted monitoring/sharing, paid services, arbitrary customer applications, Safari/iOS, assistive-technology tasks and public deployment were not established by these local tests. Public source parsing is a bounded extraction, not a browser DOM or runtime behavior audit.

Codex Security skill guidance was consulted, but its managed scan tools and required shared reference were unavailable. The local reviews, malicious-input tests and dependency scan are not a managed Codex Security result. OpenAI Developers offered account/key onboarding, which was unnecessary under the paused-AI policy. Sites and Pages guidance was inspected; no destination was published or modified. Hugging Face tools were available but no model or remote compute was needed. Cursor Cloud & Deployment was not found through available tools, skill discovery or plugin search.

## Prevention recommendations

Keep the actual downloaded ZIP and customer task/rollback matrix as release gates. Keep explicit mode in every saved-state contract. Treat source completeness and rendered correctness as different evidence. Rescan dependencies before deployment, recheck the unpatched advisory, and validate the customer's own tasks and original backup before any broader rollout. Human-equivalent frontend quality still requires independent matched human review; the Audi and Firehouse references define preferences, not proof of equivalence.
