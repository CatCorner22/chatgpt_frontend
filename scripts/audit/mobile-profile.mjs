// An explicit laboratory condition. Durations remain relative to the host Chromium runs on.
export const MOBILE_PROFILE = Object.freeze({
  latencyMs: 150,
  downloadKbps: 1600,
  uploadKbps: 750,
  cpuSlowdown: 4,
});

export async function applyMobileProfile(page) {
  const session = await page.context().newCDPSession(page);
  const { latencyMs, downloadKbps, uploadKbps, cpuSlowdown } = MOBILE_PROFILE;
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: latencyMs,
    downloadThroughput: (downloadKbps * 1000) / 8,
    uploadThroughput: (uploadKbps * 1000) / 8,
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
}

export function installMobileObservers() {
  const state = { lcpMs: null, eventCount: 0, maxEventMs: null, observers: [] };
  window.__focusMobileTimings = state;
  function watch(type, consume, options) {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver((list) => consume(list.getEntries()));
    observer.observe({ type, buffered: true, ...options });
    state.observers.push({ type, consume, observer });
  }
  watch("largest-contentful-paint", (entries) => {
    for (const entry of entries) state.lcpMs = Math.round(entry.startTime);
  });
  watch(
    "event",
    (entries) => {
      for (const entry of entries) {
        if (!entry.interactionId) continue;
        state.eventCount++;
        state.maxEventMs = Math.max(state.maxEventMs ?? 0, Math.round(entry.duration));
      }
    },
    { durationThreshold: 16 },
  );
}

export function readMobileTimings() {
  const state = window.__focusMobileTimings;
  if (!state) throw new Error("The early timing observers were unavailable.");
  for (const { observer, consume } of state.observers) consume(observer.takeRecords());
  const navigation = performance.getEntriesByType("navigation")[0];
  const observed = (value) => (value > 0 ? Math.round(value) : null);
  return {
    timeOrigin: performance.timeOrigin,
    observedMs: Math.round(performance.now()),
    responseStartMs: observed(navigation?.responseStart),
    domContentLoadedMs: observed(navigation?.domContentLoadedEventEnd),
    firstContentfulPaintMs: observed(
      performance.getEntriesByName("first-contentful-paint", "paint")[0]?.startTime,
    ),
    largestContentfulPaintMs: state.lcpMs,
    eventTimingSupported: state.observers.some((item) => item.type === "event"),
    interactionEventCount: state.eventCount,
    maxInteractionEventMs: state.maxEventMs,
  };
}
