# Rendered-page audit runner

The browser runner lives in `scripts/`, outside the portable kit. It uses the app's existing `playwright-core` and TypeScript development dependencies. The kit keeps its original dependency limits.

Use Node 22.12 or newer and an installed Chromium browser. The default executable is `/usr/bin/chromium`; set `CHROMIUM_PATH` or pass `--executable` for another path.

```sh
npm run audit:browser -- --file north-star-kit/fixtures/good.html --out artifacts/north-star/good
npm run audit:browser -- --url http://localhost:3000 --out artifacts/north-star/app
npm run test:audit
```

`--file` serves the selected HTML file and its local assets through a temporary loopback server. It refuses hidden paths, directory traversal, and symlinks outside the file's directory. `--url` accepts a loopback HTTP(S) address by default. Remote pages and cross-origin resources require the explicit `--allow-remote` flag. The browser uses a fresh context per scenario, without saved credentials; service workers and WebSockets are disabled.

Other options:

| Option | Meaning |
| --- | --- |
| `--settle-ms 1500` | Observation delay after navigation and, if supplied, after the interaction walk; 0–10000 ms. |
| `--timeout-ms 15000` | Per-navigation, action, and screenshot timeout; 1000–60000 ms. |
| `--actions path.json` | A validated declarative interaction walk; no JavaScript expressions. |
| `--out artifacts/north-star-audit` | Output directory; rerunning there replaces that run's files. |
| `--help` | Print all CLI options. |

## What the runner records

Each run opens six independent visits:

1. 320 × 900 CSS pixels.
2. 768 × 900 CSS pixels.
3. 1440 × 900 CSS pixels.
4. 768px with `prefers-reduced-motion: reduce`.
5. 768px with forced colors active.
6. 320px with line height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em.

The ten kit functions run against each rendered page. A TypeScript AST selects their actual declarations and erases types to ES2022. Each function is injected separately, without importing app code into the page.

Additional observations use `browser-` rule IDs. They record horizontal overflow, text overflow inside clipped boxes, running animations, controls that disappear relative to the same-width baseline, uncaught page errors, blocked resources, and the outcomes of supplied interaction steps. Each scenario has a full-page screenshot when capture succeeds.

A `PerformanceObserver` starts before page scripts. The runner records layout-shift entries during the bounded visit, excludes entries marked `hadRecentInput`, and reports the largest session sum using a one-second gap and five-second session limit. It reads this result before applying audit text-spacing overrides, so the inspector's changes do not become page-load defects. A nonzero score fails the kit's strict “no observed shift” craft target; this is not a claim about a particular external grading threshold.

## Interaction walks

The same walk runs separately in each scenario. It stops at the first failed expectation or measurement gap. An executed click or key press only proves that the driver performed that input; add expectations to verify its result.

```json
{
  "name": "Open booking details with a keyboard",
  "steps": [
    { "action": "focus", "selector": "#details-toggle" },
    { "action": "press", "key": "Enter" },
    { "action": "expect-visible", "selector": "#details" },
    { "action": "expect-focus", "selector": "#details-toggle" }
  ]
}
```

Supported actions: `focus`, `click`, `fill`, `press`, `wait`, `expect-focus`, `expect-focus-within`, `expect-visible`, `expect-hidden`, `expect-active-option`, and `expect-text`. Plans allow at most 50 steps; selectors, strings, and explicit waits are bounded. Active-option checks inspect actual keyboard focus or its owning control's `aria-activedescendant`.

The tested example is `scripts/audit/fixtures/runtime-actions.json`. Its HTML fixture deliberately includes a late layout shift, a visually hidden field label, an animation that continues in reduced motion, a control hidden in forced colors, and text that clips under spacing overrides.

## Outputs and interpretation

`report.json` follows the `north-star-browser-audit` version 1 contract and can be imported into the app's Quality lab. It includes the target, timestamps, browser version, settings, scenario findings and observations, screenshot filenames, counts, and limitations. `README.md` summarizes the artifact directory. Screenshot paths are relative to that directory.

Counts include repeated findings across scenarios. A zero failure count does not mean that everything passed: unknown findings and the report's limitations remain part of the result. No bounded visit establishes content truth, complete keyboard operation, screen-reader behavior, or suitability for the intended users.

Actual 200% browser zoom is not measured. A narrower viewport, device scale factor, and CSS zoom are not substitutes. Forced colors and reduced motion are emulated; a visible control rectangle does not establish perceivable labels or boundaries. A snapshot with no animations does not prove that none will start later. Text-spacing diagnostics do not prove that no content overlaps or disappears. Compare screenshots and complete real tasks before interpreting these observations as design quality.

## Verification

`npm run test:audit` runs Node tests for CLI boundaries, local-file serving, declarative walks, observation interpretation, and the scenario matrix. It also launches Chromium on the kit's flawed fixture and the runtime fixture. These integration tests confirm that planted defects are detected and that interaction expectations execute. Temporary test artifacts are removed after each test; explicit CLI runs preserve reviewable reports and screenshots in the requested output directory.
