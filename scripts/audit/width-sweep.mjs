import { resolve } from "node:path";
import { safeReportText } from "./report-values.mjs";

// Runs in the isolated page world. All bounds apply before data leaves the page.
function startSweep() {
  const widths = new Set();
  let rulesRead = 0;
  let sheetsUnavailable = 0;
  let sheetLimitReached = false;
  const visited = new Set();
  function visitRules(rules) {
    for (let index = 0; index < rules.length && rulesRead < 4000; index++) {
      const rule = rules[index];
      rulesRead++;
      if (rule instanceof CSSMediaRule) {
        // CSSOM normalizes classic media queries. Capture simple pixel queries in either range syntax.
        const matches = rule.conditionText.matchAll(
          /\(\s*(?:(?:min-|max-)?width\s*(?::|[<>]=?|=)\s*(\d+(?:\.\d+)?)px|(\d+(?:\.\d+)?)px\s*(?:[<>]=?|=)\s*width)\s*\)/gi,
        );
        for (const match of matches) {
          const width = Number(match[1] ?? match[2]);
          if (width >= 320 && width <= 1440) widths.add(width);
        }
      }
      if (rule instanceof CSSImportRule && rule.styleSheet) visitSheet(rule.styleSheet);
      else if (rule.cssRules) visitRules(rule.cssRules);
    }
  }
  function visitSheet(sheet) {
    if (visited.has(sheet)) return;
    if (visited.size >= 256) {
      sheetLimitReached = true;
      return;
    }
    visited.add(sheet);
    try {
      visitRules(sheet.cssRules);
    } catch {
      sheetsUnavailable++;
    }
  }
  for (const sheets of [document.styleSheets, document.adoptedStyleSheets ?? []]) {
    for (const sheet of sheets) {
      if (rulesRead >= 4000 || sheetLimitReached) break;
      visitSheet(sheet);
    }
  }
  window.__focusSweep = { path: location.href, active: document.activeElement };
  return {
    boundaries: [...widths].sort((a, b) => a - b).slice(0, 12),
    omittedBoundaries: Math.max(0, widths.size - 12),
    rulesRead,
    ruleLimitReached: rulesRead >= 4000,
    sheetsUnavailable,
    sheetLimitReached,
  };
}

function sampleWidth() {
  const state = window.__focusSweep;
  if (!state || location.href !== state.path) throw new Error("The page changed during resizing.");
  const root = document.documentElement;
  const viewport = root.clientWidth;
  const documentWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
  const label = (element) => {
    if (element.id) return `#${element.id.slice(0, 150)}`;
    const tag = element.localName;
    const parent = element.parentElement;
    if (!parent) return tag;
    let position = 1;
    for (let other = element.previousElementSibling; other; other = other.previousElementSibling) {
      if (other.localName === tag) position++;
    }
    return `${parent.id ? `#${parent.id.slice(0, 120)}` : parent.localName} > ${tag}:nth-of-type(${position})`;
  };
  const candidates = [];
  if (documentWidth > viewport + 1 && document.body) {
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let i = 0; i < 2000 && candidates.length < 4; i++) {
      const element = walk.nextNode();
      if (!element) break;
      const rect = element.getBoundingClientRect();
      if (rect.height > 0 && (rect.right + scrollX > viewport + 1 || rect.left + scrollX < -1))
        candidates.push(label(element));
    }
  }
  const previous = state.active;
  const current = document.activeElement;
  const isControl = (element) => element && element !== document.body && element !== root;
  const focusBefore = isControl(previous) ? label(previous) : null;
  state.active = current;
  return {
    width: innerWidth,
    viewport,
    documentWidth,
    candidates,
    focusBefore,
    focusAfter: isControl(current) ? label(current) : null,
    focusChanged: Boolean(focusBefore && previous !== current),
  };
}

function sequence(boundaries) {
  const widths = new Set([320, 375, 390, 480, 600, 768, 900, 1024, 1280, 1440]);
  for (const boundary of boundaries) {
    const lower = Math.floor(boundary);
    const upper = Math.ceil(boundary);
    for (const width of [lower - 1, lower, upper, upper + 1]) {
      if (width >= 320 && width <= 1440) widths.add(width);
    }
  }
  return [...widths].sort((a, b) => b - a);
}

/** Inspect the same task state after its desktop screenshot; never replay a submitted action. */
export async function runWidthSweep(page, realm, { out, timeoutMs }) {
  const findings = [];
  const samples = [];
  let capturedFailure = false;
  let discovery = null;
  let widths = [];
  try {
    discovery = await realm.call(startSweep);
    widths = sequence(discovery.boundaries);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const sample = await realm.call(sampleWidth);
      if (sample.width !== width) throw new Error(`Chromium did not reach ${width}px.`);
      samples.push(sample);
      let screenshot = "";
      if (
        !capturedFailure &&
        (sample.documentWidth > sample.viewport + 1 || (sample.focusChanged && !sample.focusAfter))
      ) {
        capturedFailure = true;
        const name = `resize-${width}px.png`;
        try {
          await page.screenshot({ path: resolve(out, name), timeout: timeoutMs });
          sample.screenshot = name;
          screenshot = ` Open ${name} for this width.`;
        } catch (error) {
          findings.push({
            ruleId: "browser-screenshot",
            status: "could-not-measure",
            where: `${width}px`,
            measured: safeReportText(error.message),
            required: "Capture the resized page for visual review.",
          });
        }
      }
      if (sample.documentWidth > sample.viewport + 1) {
        const locations = sample.candidates.map((value) => safeReportText(value, 180)).join(", ");
        findings.push({
          ruleId: "browser-resize-overflow",
          status: "fails",
          where: `${width}px${locations ? ` · inspect ${locations}` : ""}`,
          measured: `The document spans ${sample.documentWidth}px in ${sample.viewport}px of available space.${screenshot}`,
          required: "Keep the whole page within the viewport while its contents reflow.",
          fix: "Inspect the crossing boxes at this width. Adjust the layout and repeat the walk.",
        });
      }
      if (sample.focusChanged) {
        findings.push({
          ruleId: "browser-resize-focus",
          status: sample.focusAfter ? "could-not-measure" : "fails",
          where: `${width}px · ${safeReportText(sample.focusBefore, 180)}`,
          measured: sample.focusAfter
            ? `Focus moved to ${safeReportText(sample.focusAfter, 180)} during resizing. Check whether it is the intended replacement.`
            : `The focused element lost focus to the document during resizing.${screenshot}`,
          required: "Keep the visitor's keyboard position usable across layout changes.",
          fix: "Keep the focused control mounted or move focus to its equivalent in the new layout.",
        });
      }
    }
    if (!findings.some((item) => item.ruleId === "browser-resize-overflow")) {
      findings.push({
        ruleId: "browser-resize-overflow",
        status: "holds",
        where: "Desktop width sweep",
        measured: `No horizontal page overflow at ${samples.length} sampled widths from 320px to 1440px.`,
        required: "Keep the whole page within the viewport at each sampled width.",
      });
    }
    if (!findings.some((item) => item.ruleId === "browser-resize-focus")) {
      const hadFocus = samples.every((sample) => sample.focusBefore !== null);
      findings.push({
        ruleId: "browser-resize-focus",
        status: hadFocus ? "holds" : "could-not-measure",
        where: "Desktop width sweep",
        measured: hadFocus
          ? `Focus stayed on ${safeReportText(samples[0].focusBefore, 180)} across the sampled widths.`
          : "There was no focused control across the entire sweep. End the keyboard walk with focus on a meaningful control.",
        required: "Keep the visitor's keyboard position usable across layout changes.",
      });
    }
  } catch (error) {
    findings.push({
      ruleId: "browser-resize-incomplete",
      status: "could-not-measure",
      where: "Desktop width sweep",
      measured: `${samples.length} widths recorded. ${safeReportText(error.message)}`,
      required: "Keep the same document open and repeat the responsive check.",
    });
  }
  return { observations: { discovery, plannedWidths: widths, samples }, findings };
}
