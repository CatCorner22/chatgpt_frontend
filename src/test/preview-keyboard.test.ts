import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePreviewReturn } from "@/lib/preview-keyboard";

describe("the hosted preview's native keyboard return", () => {
  afterEach(() => document.body.replaceChildren());

  it("conceals the Studio and contains input until inert takes over even when focus changes again", () => {
    const studio = document.createElement("div");
    studio.setAttribute("data-focus-hosted-studio", "");
    const frame = document.createElement("iframe");
    const action = document.createElement("button");
    const activate = vi.fn();
    action.addEventListener("click", activate);
    studio.append(frame, action);
    document.body.append(studio);

    const capture = capturePreviewReturn(frame)!;
    expect(studio.style.opacity).toBe("0");
    expect(studio.style.pointerEvents).toBe("none");
    expect(studio).toHaveAttribute("aria-hidden", "true");
    action.click();
    capture.forget();
    action.click();
    expect(activate).not.toHaveBeenCalled();

    capture.seal();
    expect(studio.inert).toBe(true);
    studio.hidden = true;
    capture.release();
    expect(studio.hidden).toBe(true);
    expect(studio.inert).toBe(true);
    expect(document.activeElement).not.toBe(action);
    expect(studio.style.opacity).toBe("");
  });
});
