/** Measure the script-free output of renderAuthoredPage in an inert frame at its real CSS width.
 * Visible previews retain their opaque sandbox. Cancel on unmount or when the document changes.
 */
export function measureAuthoredViewport<T>(
  html: string,
  width: 320 | 1024,
  height: number,
  measure: (doc: Document) => T,
  onResult: (result: T) => void,
  onUnavailable: () => void,
): () => void {
  const frame = document.createElement("iframe");
  frame.title = `${width} px layout measurement`;
  frame.inert = true;
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.sandbox.add("allow-same-origin");
  frame.referrerPolicy = "no-referrer";
  frame.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;max-width:none;border:0;padding:0;opacity:0;pointer-events:none;z-index:-1`;

  let active = true;
  function close() {
    active = false;
    window.clearTimeout(timer);
    frame.onload = null;
    frame.remove();
  }
  function fail() {
    if (!active) return;
    close();
    onUnavailable();
  }
  const timer = window.setTimeout(fail, 10000);
  frame.onload = async () => {
    try {
      const doc = frame.contentDocument;
      if (!doc?.querySelector('meta[name="generator"][content="Focus authored page"]')) return;
      await doc.fonts.ready;
      if (!active || frame.contentDocument !== doc) return;
      if (doc.defaultView?.innerWidth !== width) return fail();
      const result = measure(doc);
      close();
      onResult(result);
    } catch {
      fail();
    }
  };
  const policy =
    "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; form-action 'none'; base-uri 'none'";
  if (html.includes("<head>")) {
    frame.srcdoc = html.replace(
      "<head>",
      '<head><meta http-equiv="Content-Security-Policy" content="' + policy + '">',
    );
    document.body.append(frame);
  } else {
    fail();
  }
  return close;
}
