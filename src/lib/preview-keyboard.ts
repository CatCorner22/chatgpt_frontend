/** The owner gate can temporarily hide the native Tab destination on return from an opaque frame. */
export type PreviewTabReturn = {
  frame: HTMLIFrameElement;
  backwards?: boolean;
  verified: boolean;
};

export function restorePreviewTab(value: PreviewTabReturn | null) {
  if (!value?.verified || value.backwards === undefined) return;
  const { frame, backwards } = value;
  const studio = frame.closest<HTMLElement>("[data-focus-hosted-studio]");
  if (
    !studio ||
    studio.hidden ||
    studio.inert ||
    !document.hasFocus() ||
    document.visibilityState !== "visible" ||
    document.activeElement !== document.body
  )
    return;

  // Focus uses document order for its controls. Let the browser skip controls hidden by a
  // closed details, responsive layout, disabled fieldset, or the current editor state.
  const controls = studio.querySelectorAll<HTMLElement>(
    "a[href], button, input, select, textarea, summary, [tabindex], iframe[data-focus-authored-preview]",
  );
  const index = Array.prototype.indexOf.call(controls, frame) as number;
  if (index < 0) return;
  const direction = backwards ? -1 : 1;
  for (let i = index + direction; i >= 0 && i < controls.length; i += direction) {
    const control = controls.item(i);
    if (
      control.tabIndex < 0 ||
      control.matches(":disabled") ||
      control.closest("[inert]") ||
      !control.getClientRects().length ||
      getComputedStyle(control).visibility !== "visible"
    )
      continue;
    control.focus();
    if (document.activeElement === control) return;
  }
}
