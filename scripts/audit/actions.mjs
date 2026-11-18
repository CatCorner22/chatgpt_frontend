const SELECTOR_ACTIONS = new Set(['focus', 'click', 'expect-focus', 'expect-focus-within', 'expect-visible', 'expect-hidden', 'expect-active-option']);
const SUPPORTED_ACTIONS = new Set([...SELECTOR_ACTIONS, 'fill', 'press', 'wait', 'expect-text']);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${label} must be an object.`);
  }
}

function fields(value, allowed, label) {
  const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
  if (unexpected.length) throw new Error(`${label} contains unsupported field: ${unexpected[0]}.`);
}

function text(value, label, maximum, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'a nonempty string'} of at most ${maximum} characters.`);
  }
  return value;
}

/** Plans contain driver actions and expectations only, never caller-supplied code. */
export function validateActions(input) {
  record(input, 'Browser walk');
  fields(input, ['name', 'steps'], 'Browser walk');
  const name = text(input.name, 'Browser walk name', 200).trim();
  if (!Array.isArray(input.steps) || input.steps.length > 50) throw new Error('Browser walk steps must be an array with at most 50 entries.');
  let waitTotal = 0;
  const steps = input.steps.map((step, index) => {
    const label = `Step ${index + 1}`;
    record(step, label);
    if (!SUPPORTED_ACTIONS.has(step.action)) throw new Error(`${label} has an unsupported action.`);
    if (SELECTOR_ACTIONS.has(step.action)) {
      fields(step, ['action', 'selector'], label);
      return { action: step.action, selector: text(step.selector, `${label} selector`, 500) };
    }
    if (step.action === 'fill') {
      fields(step, ['action', 'selector', 'value'], label);
      return { action: step.action, selector: text(step.selector, `${label} selector`, 500), value: text(step.value, `${label} value`, 10000, true) };
    }
    if (step.action === 'expect-text') {
      fields(step, ['action', 'selector', 'text'], label);
      return { action: step.action, selector: text(step.selector, `${label} selector`, 500), text: text(step.text, `${label} text`, 2000, true) };
    }
    if (step.action === 'press') {
      fields(step, ['action', 'key'], label);
      const key = text(step.key, `${label} key`, 80);
      if (/[\u0000-\u001f\u007f]/.test(key)) throw new Error(`${label} key cannot contain control characters.`);
      return { action: step.action, key };
    }
    fields(step, ['action', 'ms'], label);
    if (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 5000) throw new Error(`${label} wait must be an integer from 0 to 5000 milliseconds.`);
    waitTotal += step.ms;
    return { action: step.action, ms: step.ms };
  });
  if (waitTotal > 15000) throw new Error('Browser walk explicit waits cannot total more than 15000 milliseconds.');
  return { name, steps };
}

const normalizeText = value => value.replace(/\s+/g, ' ').trim();
const errorText = error => String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 500);

/** Stops at the first failed or unmeasurable step so later actions cannot hide it. */
export async function runActions(page, input, { timeoutMs = 15000 } = {}) {
  const plan = validateActions(input);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('Action timeout must be an integer from 1 to 60000 milliseconds.');
  const results = [];
  for (const [index, step] of plan.steps.entries()) {
    const result = { index, action: step.action, status: 'holds', detail: '' };
    try {
      if (step.action === 'wait') {
        await page.waitForTimeout(step.ms);
        result.detail = `Waited ${step.ms} ms; no behavior is asserted by this step.`;
      } else if (step.action === 'press') {
        await page.keyboard.press(step.key);
        result.detail = `Sent ${step.key}; the next expectation must check its result.`;
      } else {
        const locator = page.locator(step.selector);
        const count = await locator.count();
        if (count === 0 && step.action === 'expect-hidden') {
          result.detail = 'No matching element is present in the page.';
        } else if (count !== 1) {
          result.status = 'could-not-measure';
          result.detail = `Expected one element for ${step.selector}; found ${count}. Check the walk’s setup and selector.`;
        } else if (step.action === 'focus' || step.action === 'click') {
          await locator[step.action]({ timeout: timeoutMs });
          result.detail = `${step.action === 'focus' ? 'Focused' : 'Clicked'} ${step.selector}; the next expectation must check its result.`;
        } else if (step.action === 'fill') {
          await locator.fill(step.value, { timeout: timeoutMs });
          result.detail = `Filled ${step.selector}; the entered value is omitted from this report.`;
        } else if (step.action === 'expect-visible' || step.action === 'expect-hidden') {
          const state = step.action === 'expect-visible' ? 'visible' : 'hidden';
          try {
            await locator.waitFor({ state, timeout: timeoutMs });
            result.detail = `${step.selector} is ${state}.`;
          } catch (error) {
            if (error?.name !== 'TimeoutError') throw error;
            result.status = 'fails';
            result.detail = `${step.selector} did not become ${state} within ${timeoutMs} ms.`;
          }
        } else if (step.action === 'expect-text') {
          const observed = normalizeText((await locator.textContent({ timeout: timeoutMs })) ?? '');
          const expected = normalizeText(step.text);
          result.status = observed === expected ? 'holds' : 'fails';
          result.detail = observed === expected ? 'Text matches exactly after whitespace normalization.' : 'Text does not match the expected text after whitespace normalization; content is omitted from this report.';
        } else {
          const observation = await locator.evaluate((element, action) => {
            const active = element.ownerDocument.activeElement;
            if (action === 'expect-focus') return active === element;
            if (action === 'expect-focus-within') return !!active && element.contains(active);
            if (active === element) return true;
            // The focused owner must identify this specific element as active.
            // DOM ownership or an explicit aria-owns relationship is required.
            if (!active || !element.id || active.getAttribute('aria-activedescendant') !== element.id) return false;
            const owns = (active.getAttribute('aria-owns') ?? '').split(/\s+/).filter(Boolean);
            const controls = (active.getAttribute('aria-controls') ?? '').split(/\s+/).filter(Boolean);
            return active.contains(element) || owns.includes(element.id) || controls.some(id => element.ownerDocument.getElementById(id)?.contains(element));
          }, step.action);
          result.status = observation ? 'holds' : 'fails';
          result.detail = observation ? `${step.action} matched ${step.selector}.` : `${step.action} did not match the page’s actual keyboard position for ${step.selector}.`;
        }
      }
    } catch (error) {
      result.status = 'could-not-measure';
      const detail = errorText(error);
      result.detail = `The driver could not complete this step: ${step.action === 'fill' && step.value ? detail.split(step.value).join('[entered value omitted]') : detail}`;
    }
    results.push(result);
    if (result.status !== 'holds') break;
  }
  return { results, complete: results.length === plan.steps.length && results.every(result => result.status === 'holds') };
}
