# Preserve the selected action treatment

Following the Garden customization work, inspection found two concrete discrepancies:

1. Underlined actions inherited the general corner radius in the style study, other page specimens and interaction lab, while authored HTML output uses square edges. The static component sheet also rendered its primary action as filled for outlined and underlined choices.
2. The optional source-change adapter always writes a filled action background. It accepted outlined and underlined design tokens without implementing those treatments, producing a different appearance from the selected design.

Delayed changes or broader framework support are not required to correct these discrepancies. Preview actions now use square edges for the underlined treatment. The component sheet primary example follows the selected treatment and computes its displayed label contrast against that treatment's background. Words, destinations and handlers are unchanged.

New source proposals now refuse outlined or underlined actions rather than silently substituting a filled treatment. The shared scope message appears before file selection in Target and disables proposal preparation; the core API independently rejects the unsupported treatment. The user can retain their preference and use the design pack for developer-guided integration, or deliberately select filled/pill styling. The workshop also discloses this adapter limit at the point of choice. No change to source-parser scope, contract format or previously retained packages was made.

## Evidence

`action-shape-before.log` in `/workspace/research/transfer-rehearsal/resume-2026-11-19/` records seven failing regressions before repair. `action-shape-after.log` records the initial focused repair. `action-shape-final-focused.log` records 70 passing checks after the component-sheet and early-message coverage was added. Full validation is in `action-shape-validation/`; use `final-tests.log` for the complete final test run. The earlier full run overlapped the last edits and is retained as intermediate evidence, not final validation.

Tests cover all four page specimens and the component sheet, interaction-lab styles/behavior, rejected source preparation without input mutation, and Target's pre-upload explanation and disabled preparation. These are DOM/generated-file checks, not rendered browser acceptance. Browser testing remains unavailable from the prior connection failure. No customer app was changed, no deployment occurred, and no independent review allowance was spent.

Final validation: 1,475 tests across 118 files passed; lint passed with zero errors and 11 existing warnings; production build passed. Independent release approval and real-browser acceptance remain outstanding.
