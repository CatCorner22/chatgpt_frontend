import test from 'node:test';
import assert from 'node:assert/strict';
import { runActions, validateActions } from './actions.mjs';

const plan = steps => ({ name: 'Check dialog', steps });

test('validates every supported action and returns a fresh plan', () => {
  const steps = [
    ...['focus', 'click', 'expect-focus', 'expect-focus-within', 'expect-visible', 'expect-hidden', 'expect-active-option'].map(action => ({ action, selector: '#target' })),
    { action: 'fill', selector: '#name', value: '' },
    { action: 'press', key: 'Shift+Tab' },
    { action: 'wait', ms: 0 },
    { action: 'expect-text', selector: '#notice', text: 'Saved' },
  ];
  const input = plan(steps);
  const result = validateActions(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.notEqual(result.steps, input.steps);
  assert.notEqual(result.steps[0], input.steps[0]);
});

test('rejects executable code, navigation, unknown fields, and malformed records', () => {
  for (const step of [
    { action: 'evaluate', source: 'alert(1)' },
    { action: 'goto', url: 'https://example.com' },
    { action: 'click', selector: '#x', source: 'alert(1)' },
    { action: 'press', key: 'Enter', selector: '#x' },
    { action: 'wait', ms: 5, name: 'unexpected' },
    null, [], 'click', {},
  ]) assert.throws(() => validateActions(plan([step])));
  assert.throws(() => validateActions({ ...plan([]), secret: 'unknown' }), /unsupported field/);
  assert.throws(() => validateActions({ name: 'a', steps: {} }), /array/);
  assert.throws(() => validateActions(plan(Array.from({ length: 51 }, () => ({ action: 'wait', ms: 0 })))), /at most 50/);
});

test('bounds selectors, text, keys, and explicit waiting time', () => {
  for (const selector of ['', ' ', 'a'.repeat(501)]) assert.throws(() => validateActions(plan([{ action: 'click', selector }])));
  assert.throws(() => validateActions(plan([{ action: 'fill', selector: '#x', value: 'x'.repeat(10001) }])));
  assert.throws(() => validateActions(plan([{ action: 'expect-text', selector: '#x', text: 'x'.repeat(2001) }])));
  for (const key of ['', 'x'.repeat(81), '\n']) assert.throws(() => validateActions(plan([{ action: 'press', key }])));
  for (const ms of [-1, 5001, 1.5, '50', NaN]) assert.throws(() => validateActions(plan([{ action: 'wait', ms }])));
  assert.throws(() => validateActions(plan(Array.from({ length: 4 }, () => ({ action: 'wait', ms: 5000 })))), /total/);
  assert.equal(validateActions(plan(Array.from({ length: 3 }, () => ({ action: 'wait', ms: 5000 })))).steps.length, 3);
});

test('stops immediately on an observed expectation failure', async () => {
  const calls = [];
  const page = {
    keyboard: { press: async key => calls.push(key) },
    locator: selector => ({ count: async () => 1, evaluate: async () => false, click: async () => calls.push(selector) }),
  };
  const result = await runActions(page, plan([{ action: 'press', key: 'Tab' }, { action: 'expect-focus', selector: '#first' }, { action: 'click', selector: '#later' }]), { timeoutMs: 1000 });
  assert.deepEqual(calls, ['Tab']);
  assert.equal(result.complete, false);
  assert.deepEqual(result.results.map(item => item.status), ['holds', 'fails']);
  assert.equal(result.results[1].index, 1);
});

test('reports an ambiguous selector or driver failure as unmeasured and stops', async () => {
  const page = { locator: () => ({ count: async () => 2 }) };
  const ambiguous = await runActions(page, plan([{ action: 'click', selector: '.many' }, { action: 'wait', ms: 1 }]));
  assert.equal(ambiguous.complete, false);
  assert.equal(ambiguous.results.length, 1);
  assert.equal(ambiguous.results[0].status, 'could-not-measure');
  const broken = await runActions({ locator: () => { throw new Error('Invalid selector'); } }, plan([{ action: 'focus', selector: '[' }]));
  assert.equal(broken.results[0].status, 'could-not-measure');
});

test('compares normalized text, omits entered values, and accepts removed hidden targets', async () => {
  const calls = [];
  const page = {
    waitForTimeout: async ms => calls.push(ms),
    locator: selector => ({
      count: async () => selector === '#removed' ? 0 : 1,
      fill: async value => calls.push(value),
      textContent: async () => '  Saved\n now  ',
    }),
  };
  const result = await runActions(page, plan([
    { action: 'fill', selector: '#name', value: 'private input' },
    { action: 'expect-text', selector: '#notice', text: 'Saved now' },
    { action: 'wait', ms: 5 },
    { action: 'expect-hidden', selector: '#removed' },
  ]));
  assert.equal(result.complete, true);
  assert.deepEqual(calls, ['private input', 5]);
  assert.equal(JSON.stringify(result).includes('private input'), false);
});

test('distinguishes a timed-out visibility expectation from a driver failure', async () => {
  const timeout = Object.assign(new Error('waiting'), { name: 'TimeoutError' });
  const page = { locator: () => ({ count: async () => 1, waitFor: async () => { throw timeout; } }) };
  const result = await runActions(page, plan([{ action: 'expect-visible', selector: '#notice' }]));
  assert.equal(result.results[0].status, 'fails');
  assert.equal(result.complete, false);
});

test('active-descendant expectation checks the actually focused owner', async () => {
  const element = { id: 'option-two', ownerDocument: {} };
  const active = { contains: candidate => candidate === element, getAttribute: name => name === 'aria-activedescendant' ? 'option-two' : null };
  element.ownerDocument.activeElement = active;
  const page = { locator: () => ({ count: async () => 1, evaluate: async (fn, action) => fn(element, action) }) };
  assert.equal((await runActions(page, plan([{ action: 'expect-active-option', selector: '#option-two' }]))).complete, true);
  element.ownerDocument.activeElement = { contains: () => false, getAttribute: () => null };
  assert.equal((await runActions(page, plan([{ action: 'expect-active-option', selector: '#option-two' }]))).results[0].status, 'fails');
  element.ownerDocument.getElementById = id => id === 'popup' ? { contains: candidate => candidate === element } : null;
  element.ownerDocument.activeElement = { contains: () => false, getAttribute: name => ({ 'aria-activedescendant': 'option-two', 'aria-controls': 'popup' })[name] ?? null };
  assert.equal((await runActions(page, plan([{ action: 'expect-active-option', selector: '#option-two' }]))).complete, true);
});
