import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { loadChecks, runAudit } from '../north-star-audit.mjs';
import { parseArgs } from './options.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Chromium contrast skips zero-alpha RGB surfaces but keeps partial alpha and gradients unmeasured', { timeout: 30000 }, async () => {
  const check = (await loadChecks()).find((entry) => entry.ruleId === 'floor-text-contrast');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><style>
      html { background: rgb(255,255,255); color: rgb(17,17,17); font: 16px system-ui; }
      body { background: rgba(255,255,255,0); }
      #white { background: rgba(255,255,255,0); }
      #colored { background: rgba(125,75,25,0); }
      #partial { background: rgba(255,255,255,0.5); }
      #gradient { background: linear-gradient(white, #ddd); }
      #low { color: rgb(190,190,190); background: rgba(255,255,255,0); }
    </style></head><body><p id="white">White alpha zero</p><p id="colored">Colored alpha zero</p><p id="partial">Partial alpha</p><p id="gradient">Gradient</p><p id="low">Low contrast through transparent surface</p></body></html>`);
    const findings = await page.evaluate(`(${check.source})(document)`);
    const status = (id) => findings.find((finding) => finding.where === `#${id}`)?.status;
    assert.equal(status('white'), 'holds');
    assert.equal(status('colored'), 'holds');
    assert.equal(status('partial'), 'could-not-measure');
    assert.equal(status('gradient'), 'could-not-measure');
    assert.equal(status('low'), 'fails');
  } finally { await browser.close(); }
});

test('Chromium reports no failures for the good fixture while retaining unknowns', { timeout: 90000 }, async () => {
  const out = await mkdtemp(join(tmpdir(), 'north-star-good-'));
  try {
    const report = await runAudit(parseArgs(['--file', join(projectRoot, 'north-star-kit/fixtures/good.html'), '--out', out, '--settle-ms', '350']));
    assert.equal(report.summary.failureCount, 0);
    assert.ok(report.summary.unknownCount > 0);
    for (const scenario of report.scenarios) {
      assert.equal(scenario.observations.layout.horizontalOverflowPx, 0);
      assert.ok(scenario.findings.some((finding) => finding.ruleId === 'floor-no-autoplay' && finding.status === 'could-not-measure'));
    }
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('Chromium finds every planted kit defect across the six scenarios', { timeout: 90000 }, async () => {
  const out = await mkdtemp(join(tmpdir(), 'north-star-flawed-'));
  try {
    const report = await runAudit(parseArgs(['--file', join(projectRoot, 'north-star-kit/fixtures/flawed.html'), '--out', out, '--settle-ms', '350']));
    const ids = ['floor-no-autoplay', 'floor-visible-labels', 'floor-reflow', 'floor-target-size', 'craft-image-dimensions', 'tells-placeholder-copy', 'craft-tabular-numerals', 'craft-text-wrap', 'neuro-no-justification', 'floor-text-contrast'];
    assert.equal(report.scenarios.length, 6);
    for (const scenario of report.scenarios) {
      for (const id of ids) {
        // Forced colors intentionally changes the flawed color, so that original contrast defect may disappear.
        if (id === 'floor-text-contrast' && scenario.id === 'forced-colors') continue;
        assert.ok(scenario.findings.some((finding) => finding.ruleId === id && finding.status === 'fails'), `${scenario.id}: ${id}`);
      }
      assert.ok((await stat(join(out, scenario.screenshots.fullPage))).size > 0);
    }
    assert.equal(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')).kind, 'north-star-browser-audit');
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('Chromium records real CLS, hidden labels, forced-color disappearance, spacing clipping, and keyboard actions', { timeout: 90000 }, async () => {
  const out = await mkdtemp(join(tmpdir(), 'north-star-runtime-'));
  try {
    const report = await runAudit(parseArgs(['--file', join(projectRoot, 'scripts/audit/fixtures/runtime.html'), '--actions', join(projectRoot, 'scripts/audit/fixtures/runtime-actions.json'), '--out', out, '--settle-ms', '450']));
    const scenario = (id) => report.scenarios.find((entry) => entry.id === id);
    assert.ok(scenario('desktop-1440').observations.layoutShift.maxSessionScore > 0);
    assert.ok(scenario('phone-320').findings.some((finding) => finding.ruleId === 'floor-visible-labels' && finding.status === 'fails'));
    assert.ok(scenario('forced-colors').findings.some((finding) => finding.ruleId === 'browser-forced-colors-control-presence' && finding.status === 'fails'));
    assert.ok(scenario('text-spacing').findings.some((finding) => finding.ruleId === 'browser-text-spacing-clipping' && finding.status === 'fails'));
    assert.ok(scenario('reduced-motion').observations.animations.activeCount > 0);
    assert.ok(scenario('reduced-motion').findings.some((finding) => finding.ruleId === 'browser-reduced-motion-animations' && finding.status === 'could-not-measure'));
    for (const entry of report.scenarios) assert.equal(entry.observations.actions.complete, true);
  } finally { await rm(out, { recursive: true, force: true }); }
});
