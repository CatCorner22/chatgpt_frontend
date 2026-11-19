# Garden workshop: guided choices that carry into delivery

The map stays simple. The workshop now uses plain labels—Page layout, Colors, Fonts, Text size and emphasis, Spacing, Buttons and corners—and explains a three-part sequence: choose a starting point, compare or fine-tune it, then check what reaches the deliverable. The craft stop links directly to buttons and corners. Existing optional lessons and “Keep it brief” remain available.

## Independent appearance choices

Under Buttons and corners, “Fine-tune buttons and corners” exposes the four supported action treatments and integer corner values from 0–28 pixels. Changing one preserves the other and all unrelated tokens, words and destinations. Pills retain a fully rounded action; underlined actions retain square edges. Some compositions deliberately keep images square. The UI explains these exceptions beside the controls.

Custom choices and presets run through the same constraint evaluator. Invalid values and current contrast failures reject without mutating the design. The decision graph reads the resulting tokens, and the parent Studio continues to own persistence, Undo and saved versions. No new storage format or independent settings cache was added.

## Delivery, stated at the point of choice

Each workshop section now shows its output scope:

- Authored websites use one renderer for preview, single-file HTML and editable HTML/CSS output. The existing page settings retain the action destination.
- Existing-app and app-specification choices are preferences for integration, not completed application features. They do not convert framework/language, replace handlers or implement data services. Target's source adapter remains limited to the supported React/Vite TSX + CSS-module pair.
- The existing-app short handoff now includes the selected button treatment, with instructions to preserve labels, destinations, handlers and states. It previously omitted that preference even though tokens.json carried it.

Supported language/framework choices must describe real deliverables. Adding a label for an unsupported language would not create a safe converter. Broader adapters and application behavior remain separate work requiring actual integration and recovery tests.

## Verification

Tests exercise custom controls through the actual library archive/write/read path and state migration, then inspect the shared authored renderer's HTML and editable CSS and the existing-app pack's tokens and short prompt. The matrix covers all four treatments at square, intermediate and maximum corner values. Additional checks cover invalid radii, unsupported treatments, contrast refusal, retained content/destinations, navigation away and back, and no export triggered by a control change.

Evidence is retained under `/workspace/research/transfer-rehearsal/resume-2026-11-19/`: `custom-controls-focused.log`, `custom-controls-navigation-final.log`, and `custom-controls-validation/`. A stale test label caught during the plain-language rename was corrected; the final navigation suite passed 113 tests across four files.

Browser initialization still fails with “the gaas-browser node_repl sandbox cannot be disabled.” DOM tests and generated-file assertions do not prove responsive rendering, real keyboard operation, screen-reader announcements, customer-app integration or human-quality equivalence. No deployment or new independent review was performed; the 68-run allowance remains exhausted.

Final validation: 1,465 tests across 117 files passed; lint passed with zero errors and 11 existing warnings; production build passed. These are builder-run checks, not independent release approval.
