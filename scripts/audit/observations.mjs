/** Installed before page scripts. This observes a bounded visit, not a lifetime score. */
export function installLayoutShiftObserver() {
  const state = {
    supported: false,
    startedAt: performance.now(),
    entryCount: 0,
    excludedRecentInput: 0,
    totalScore: 0,
    maxSessionScore: 0,
    sessionScore: 0,
    sessionStart: 0,
    lastShift: 0,
    samples: [],
    truncated: false,
    observer: null,
    consume: null,
  };
  window.__northStarLayoutShift = state;
  state.consume = (entries) => {
    for (const entry of entries) {
      state.entryCount++;
      if (entry.hadRecentInput) {
        state.excludedRecentInput++;
        continue;
      }
      state.totalScore += entry.value;
      if (
        state.sessionScore === 0 ||
        entry.startTime - state.lastShift >= 1000 ||
        entry.startTime - state.sessionStart >= 5000
      ) {
        state.sessionStart = entry.startTime;
        state.sessionScore = entry.value;
      } else state.sessionScore += entry.value;
      state.lastShift = entry.startTime;
      state.maxSessionScore = Math.max(state.maxSessionScore, state.sessionScore);
      if (state.samples.length < 100)
        state.samples.push({ value: entry.value, startTimeMs: entry.startTime });
      else state.truncated = true;
    }
  };
  if (
    typeof PerformanceObserver === "undefined" ||
    !PerformanceObserver.supportedEntryTypes.includes("layout-shift")
  )
    return;
  try {
    state.observer = new PerformanceObserver((list) => state.consume(list.getEntries()));
    state.observer.observe({ type: "layout-shift", buffered: true });
    state.supported = true;
  } catch {
    state.supported = false;
  }
}

export function readLayoutShiftObservation() {
  const state = window.__northStarLayoutShift;
  if (!state)
    return {
      supported: false,
      observationWindowMs: 0,
      reason: "The early observer was not available.",
    };
  if (state.observer) state.consume(state.observer.takeRecords());
  return {
    supported: state.supported,
    observationWindowMs: Math.round(performance.now() - state.startedAt),
    maxSessionScore: state.maxSessionScore,
    totalScore: state.totalScore,
    entryCount: state.entryCount,
    excludedRecentInput: state.excludedRecentInput,
    samples: state.samples,
    samplesTruncated: state.truncated,
    method:
      "Maximum session sum with a 1-second gap and 5-second session limit; recent-input entries excluded.",
  };
}

/** Snapshot diagnostics. These do not judge semantics or intent. */
export function observePage() {
  const key = (element) => {
    if (element.id) return `#${element.id}`;
    const pieces = [];
    let node = element;
    while (node && node.tagName !== "HTML") {
      const siblings = node.parentElement
        ? [...node.parentElement.children].filter((other) => other.tagName === node.tagName)
        : [node];
      pieces.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
      node = node.parentElement;
    }
    return pieces.join(">");
  };
  const visible = (element) => {
    if (![...element.getClientRects()].some((rect) => rect.width > 1 && rect.height > 1))
      return false;
    let node = element;
    while (node) {
      const style = getComputedStyle(node);
      if (
        style.display === "none" ||
        ["hidden", "collapse"].includes(style.visibility) ||
        Number(style.opacity) === 0 ||
        style.clipPath === "inset(50%)" ||
        /rect\(0px,? 0px,? 0px,? 0px\)/.test(style.clip)
      )
        return false;
      node = node.parentElement;
    }
    return true;
  };
  const controls = [
    ...document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="tab"]',
    ),
  ];
  const controlSamples = controls.slice(0, 1000).map((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      key: key(element),
      tag: element.tagName.toLowerCase(),
      label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 160),
      visible: visible(element),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
    };
  });
  const animations =
    typeof document.getAnimations === "function"
      ? document
          .getAnimations()
          .filter((animation) => animation.playState === "running" || animation.pending)
      : null;
  const animationSamples = (animations ?? []).slice(0, 100).map((animation) => {
    const timing = animation.effect?.getTiming();
    const target = animation.effect?.target;
    return {
      name:
        animation.animationName ||
        animation.transitionProperty ||
        animation.id ||
        "unnamed animation",
      target: target instanceof Element ? key(target) : "unknown target",
      playState: animation.playState,
      durationMs: typeof timing?.duration === "number" ? timing.duration : null,
      iterations: Number.isFinite(timing?.iterations) ? timing.iterations : null,
      infinite: timing?.iterations === Infinity,
    };
  });
  const clipping = [];
  let clippingCount = 0;
  for (const element of document.querySelectorAll(
    "p, h1, h2, h3, h4, h5, h6, li, label, button, a, td, th, div, section",
  )) {
    if (
      !visible(element) ||
      ![...element.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim())
    )
      continue;
    const style = getComputedStyle(element);
    const clipsX =
      ["hidden", "clip"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
    const clipsY =
      ["hidden", "clip"].includes(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
    if (clipsX || clipsY) {
      clippingCount++;
      if (clipping.length < 100)
        clipping.push({
          where: key(element),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          clipsX,
          clipsY,
        });
    }
  }
  const viewportWidth = document.documentElement.clientWidth;
  const documentWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body?.scrollWidth ?? 0,
  );
  return {
    layout: {
      viewportWidth,
      documentWidth,
      horizontalOverflowPx: Math.max(0, documentWidth - viewportWidth),
    },
    controls: {
      visibleCount: controlSamples.filter((control) => control.visible).length,
      totalCount: controls.length,
      samples: controlSamples,
      samplesTruncated: controls.length > 1000,
    },
    animations: {
      supported: animations !== null,
      activeCount: animations?.length ?? null,
      infiniteCount: animationSamples.filter((animation) => animation.infinite).length,
      samples: animationSamples,
      samplesTruncated: (animations?.length ?? 0) > 100,
    },
    textClipping: clipping,
    textClippingCount: clippingCount,
    textClippingTruncated: clippingCount > 100,
    media: [...document.querySelectorAll("audio, video")].map((element) => ({
      where: key(element),
      playing: !element.paused && !element.ended,
      muted: element.muted,
      currentTime: element.currentTime,
    })),
    actualPreferences: {
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      forcedColors: matchMedia("(forced-colors: active)").matches,
    },
  };
}

export const TEXT_SPACING_CSS = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-block-end: 2em !important; }
`;

/** Apply the inspection override to this disposable browser context only. */
export function applyTextSpacingOverride() {
  const elements = [...document.querySelectorAll("body, body *")];
  for (const element of elements) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
    element.style.setProperty("line-height", "1.5", "important");
    element.style.setProperty("letter-spacing", "0.12em", "important");
    element.style.setProperty("word-spacing", "0.16em", "important");
    if (element.tagName === "P") element.style.setProperty("margin-block-end", "2em", "important");
  }
  return {
    applied: true,
    elementsChanged: elements.length,
    method: "Inline important overrides in the disposable audit page.",
  };
}

export function compareControls(baseline, current) {
  const currentMap = new Map(current.samples.map((control) => [control.key, control]));
  return baseline.samples
    .filter((control) => control.visible && !currentMap.get(control.key)?.visible)
    .map((control) => ({
      where: control.key,
      label: control.label,
      reason: currentMap.has(control.key)
        ? "The control no longer has a visible box."
        : "The control was not found at its baseline identifier.",
    }));
}

export function findingsFromObservation(observations, scenario, baseline) {
  const findings = [];
  const overflow = observations.layout.horizontalOverflowPx;
  findings.push({
    ruleId: "browser-horizontal-overflow",
    status: overflow > 1 ? "fails" : "holds",
    where: scenario.id,
    measured: `${observations.layout.documentWidth}px page at ${observations.layout.viewportWidth}px viewport`,
    required: "No horizontal page overflow in this scenario.",
    ...(overflow > 1
      ? {
          fix: "Constrain the overflowing element without hiding content, then repeat this scenario.",
        }
      : {}),
  });
  const cls = observations.layoutShift;
  findings.push({
    ruleId: "browser-bounded-layout-shift",
    status: !cls.supported ? "could-not-measure" : cls.maxSessionScore > 0 ? "fails" : "holds",
    where: scenario.id,
    measured: cls.supported
      ? `Maximum session score ${cls.maxSessionScore} over ${cls.observationWindowMs}ms; ${cls.excludedRecentInput} recent-input entries excluded.`
      : cls.reason || "Layout-shift performance entries are unsupported.",
    required: "No observed unexpected layout shift in the bounded visit (project craft target).",
    ...(cls.supported && cls.maxSessionScore > 0
      ? { fix: "Reserve space for late-loading content and repeat the same observation window." }
      : {}),
  });
  if (scenario.textSpacing) {
    const count = observations.textClippingCount;
    findings.push({
      ruleId: "browser-text-spacing-clipping",
      status: count ? "fails" : "could-not-measure",
      where: scenario.id,
      measured: count
        ? `${count} visible text block(s) overflow a clipped box after spacing overrides.`
        : "No clipped text overflow detected; overlaps and lost content still require visual inspection.",
      required:
        "Text remains available after line 1.5, paragraph 2em, letter 0.12em, and word 0.16em overrides.",
      ...(count
        ? {
            fix: "Let the clipped text container grow with its content and repeat the spacing override.",
          }
        : {}),
    });
  }
  if (scenario.preferences.reducedMotion === "reduce") {
    const animation = observations.animations;
    findings.push({
      ruleId: "browser-reduced-motion-animations",
      status: !animation.supported || animation.activeCount > 0 ? "could-not-measure" : "holds",
      where: scenario.id,
      measured: !animation.supported
        ? "The browser does not expose animations."
        : `${animation.activeCount} running or pending animation(s) at the snapshot.`,
      required:
        "No non-essential animation while reduced motion is requested; the purpose of remaining animation requires a person.",
    });
  }
  if (scenario.preferences.forcedColors === "active") {
    const missing = baseline ? compareControls(baseline.controls, observations.controls) : [];
    observations.controls.disappeared = missing;
    findings.push({
      ruleId: "browser-forced-colors-control-presence",
      status:
        !baseline || baseline.controls.samplesTruncated || observations.controls.samplesTruncated
          ? "could-not-measure"
          : missing.length
            ? "fails"
            : "holds",
      where: scenario.id,
      measured: !baseline
        ? "No baseline snapshot available."
        : `${missing.length} baseline-visible control(s) missing or hidden; ${observations.controls.visibleCount} visible control boxes sampled.`,
      required:
        "Controls visible in the same-width baseline remain present in forced colors; perceivability still needs review.",
      ...(missing.length
        ? {
            fix: "Restore the missing control’s visible box in forced colors, then inspect its label and boundary.",
          }
        : {}),
    });
  }
  return findings;
}
