# Rendered-page fixture tests

`npm test` verifies pure functions, rule schemas, fixture coverage, the manifest, and detached-page behavior. It does not pretend a DOM parser can measure browser layout.

The supplied `BROWSER-TEST-RESULTS.json` records a separate Chromium run of all ten page checks, at 1280 × 900 and 320 × 900 CSS pixels. Each check was converted to a function string and injected separately into the page, proving that it requires no captured module values. Both widths found all ten planted defects in `flawed.html`. Neither width reported a failure on `good.html`.

The good fixture still returns two unknown findings: a snapshot cannot prove that scripts will never start media or that content survives zoom and every interaction. Unknown does not mean passing.

## Repeat in a browser-driver project

Keep the kit's runtime dependencies unchanged. Use the consuming project's existing Playwright installation and TypeScript loader/bundler. Serve the `fixtures` folder on a local HTTP server; the fixtures require no network resources outside that folder. The main-world pattern below is for these **trusted local fixtures only**, not arbitrary submitted pages:

```ts
import { chromium } from 'playwright';
import { checkRegistry } from './north-star-kit/page-checks';

const browser = await chromium.launch();
for (const width of [1280, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const fixture of ['good', 'flawed']) {
    await page.goto(`http://127.0.0.1:4173/${fixture}.html`);
    for (const check of checkRegistry) {
      // Functions accept Document, so adapt the Playwright page invocation.
      // The string is trusted kit code; never substitute uploaded page text here.
      const findings = await page.evaluate(`(${check.run.toString()})(document)`);
      const failures = findings.filter(finding => finding.status === 'fails');
      if (fixture === 'good' && failures.length) throw new Error(check.ruleId);
      if (fixture === 'flawed' && !failures.length) throw new Error(check.ruleId);
    }
  }
  await page.close();
}
await browser.close();
```

Do not compile these functions with instrumentation that adds module-level helpers. The kit targets ES2022. A normal TypeScript erasure leaves them self-contained.

## Running on submitted pages

Execute each trusted, compiled check in an isolated browser world rather than the page's main script world. In Chromium, a consuming driver can create that context with the debugging protocol's `Page.createIsolatedWorld` and evaluate the check in the returned execution context. The supplied application's runner implements this in `scripts/audit/isolated-realm.mjs`, outside the portable kit. Isolation prevents page replacements of main-world APIs from directly controlling the check's built-ins; it does not establish that every DOM state is truthful or observable.

Give every check a deadline enforced by the host, outside the inspected page's timers. An exception, closed context or timeout must produce `could-not-measure` and retain the cause; it must not disappear from the receipt or turn into a hold. Preserve failures already observed. Bound and normalize reported identifiers/text at the report boundary, and treat every page-derived value as data. Never execute page content, supplied findings or fixture text as code.

The kit contains no browser driver and cannot enforce these runner controls by itself. A consumer using only `page.evaluate` in the main world has not established this boundary. The application's separate audit suite exercises isolated execution, deadlines, report handling and hostile-page cases; those tests are not part of the dependency-minimal portable Vitest count.

## Limits that still need a person or a scripted walk

- Keyboard operation, focus return, Escape handling, and composite control navigation.
- Media started by scripts, carousels, flashing, time limits, and pause controls over time.
- Text spacing overrides, actual browser zoom, lost content, and theme changes.
- Image meaning, distortion, content truth, screen readers, and intended users' tasks.
- Contrast over images, gradients, transparency, filters, and non-sRGB colors.
- Whether a font actually implements tabular numerals and whether line endings read well.

Target sizing uses the kit's strict 24 × 24 CSS pixel project floor; it does not calculate the spacing and inline exceptions in the standard. The contrast measurement is restricted to direct text nodes over explicit, uniform, opaque sRGB backgrounds. Computed token observations do not prove that any particular CSS variable was referenced.
