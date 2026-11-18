import test from 'node:test';
import assert from 'node:assert/strict';
import { compareControls, findingsFromObservation } from './observations.mjs';

const snapshot = () => ({ layout: { viewportWidth: 320, documentWidth: 320, horizontalOverflowPx: 0 }, layoutShift: { supported: true, maxSessionScore: 0, observationWindowMs: 1500, excludedRecentInput: 0 }, controls: { visibleCount: 1, samples: [{ key: '#save', visible: true, label: 'Save' }], samplesTruncated: false }, animations: { supported: true, activeCount: 0 }, textClippingCount: 0 });
const scenario = { id: 'test', textSpacing: false, preferences: { reducedMotion: 'no-preference', forcedColors: 'none' } };

test('preference comparison detects missing or hidden visible controls only', () => {
  const prior = { samples: [{ key: '#one', visible: true, label: 'One' }, { key: '#two', visible: true, label: 'Two' }, { key: '#hidden', visible: false, label: 'Hidden' }] };
  const current = { samples: [{ key: '#one', visible: false }] };
  assert.deepEqual(compareControls(prior, current).map((control) => control.where), ['#one', '#two']);
});

test('absence of detected clipping does not certify text spacing behavior', () => {
  const findings = findingsFromObservation(snapshot(), { ...scenario, textSpacing: true });
  assert.equal(findings.find((finding) => finding.ruleId === 'browser-text-spacing-clipping').status, 'could-not-measure');
});

test('remaining reduced-motion animations require a person to judge purpose', () => {
  const observed = snapshot(); observed.animations.activeCount = 1;
  const findings = findingsFromObservation(observed, { ...scenario, preferences: { ...scenario.preferences, reducedMotion: 'reduce' } });
  assert.equal(findings.find((finding) => finding.ruleId === 'browser-reduced-motion-animations').status, 'could-not-measure');
});

test('positive bounded CLS is reported without rounding it into zero', () => {
  const observed = snapshot(); observed.layoutShift.maxSessionScore = 0.0000001;
  const finding = findingsFromObservation(observed, scenario).find((finding) => finding.ruleId === 'browser-bounded-layout-shift');
  assert.equal(finding.status, 'fails');
  assert.match(finding.required, /bounded visit/);
});

test('truncated control samples cannot prove preference equivalence', () => {
  const observed = snapshot(); observed.controls.samplesTruncated = true;
  const findings = findingsFromObservation(observed, { ...scenario, preferences: { ...scenario.preferences, forcedColors: 'active' } }, snapshot());
  assert.equal(findings.find((finding) => finding.ruleId === 'browser-forced-colors-control-presence').status, 'could-not-measure');
});
