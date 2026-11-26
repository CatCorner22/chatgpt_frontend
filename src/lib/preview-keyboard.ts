/** During an opaque-frame exit, the window gets focus before the browser identifies the next
 * control. Conceal the Studio immediately but permit this native focus transfer for one turn. */
export function capturePreviewReturn(frame: HTMLIFrameElement) {
  const studio = frame.closest<HTMLElement>("[data-focus-hosted-studio]");
  if (!studio || studio.hidden || studio.inert) return null;
  let target: HTMLElement | null = null;
  let remember = true;
  studio.style.opacity = "0";
  studio.style.pointerEvents = "none";
  studio.setAttribute("aria-hidden", "true");
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  // Contain events at the document before React or any editor action sees them.
  const contain = (event: Event) => {
    if (!(event.target instanceof HTMLElement) || !studio.contains(event.target)) return;
    if (event.type === "focus" || event.type === "focusin") {
      if (remember && event.isTrusted && event.target !== frame) target = event.target;
    } else {
      event.preventDefault();
    }
    event.stopImmediatePropagation();
  };
  for (const name of [
    "focus",
    "focusin",
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "keydown",
    "keypress",
    "keyup",
    "beforeinput",
    "input",
    "change",
    "submit",
    "contextmenu",
  ])
    document.addEventListener(name, contain, options);
  return {
    verified: false,
    seal() {
      studio.inert = true;
      controller.abort();
    },
    forget() {
      remember = false;
      target = null;
    },
    release() {
      controller.abort();
      studio.style.removeProperty("opacity");
      studio.style.removeProperty("pointer-events");
      studio.removeAttribute("aria-hidden");
      if (
        this.verified &&
        target?.isConnected &&
        !studio.hidden &&
        !studio.inert &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        document.activeElement === document.body
      )
        target.focus();
    },
  };
}
