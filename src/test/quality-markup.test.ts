import { describe, expect, it } from "vitest";
import { inertMarkup } from "@/lib/quality-markup";

describe("inert markup inspection", () => {
  it("neutralizes resource URLs without losing image and media evidence", () => {
    const doc = new DOMParser().parseFromString(
      inertMarkup(
        `<img SRC = "https://example.test/a" width="20" height="30" alt="Cup"><video autoplay src="https://example.test/v"></video><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe><svg><image xlink:href="https://example.test/s" /></svg>`,
      ),
      "text/html",
    );
    expect(doc.querySelector("[src],[srcset],[srcdoc],[href]")).toBeNull();
    expect(doc.querySelector("image")?.getAttribute("xlink:href")).toBeNull();
    expect(doc.querySelector("img")?.getAttribute("width")).toBe("20");
    expect(doc.querySelector("img")?.getAttribute("alt")).toBe("Cup");
    expect(doc.querySelector("video")?.hasAttribute("autoplay")).toBe(true);
  });
  it("removes executable and styling text, including unfinished raw text", () => {
    const doc = new DOMParser().parseFromString(
      inertMarkup(
        `<style>@import 'https://example.test/s';</style><script>alert('Lorem ipsum')</script><p style="background:url(https://example.test/a)">Actual words</p><script>unfinished`,
      ),
      "text/html",
    );
    expect(doc.querySelector("script,style,[style]")).toBeNull();
    expect(doc.body.textContent).toBe("Actual words");
  });
  it("keeps label relationships and placeholder defects for the checks", () => {
    const doc = new DOMParser().parseFromString(
      inertMarkup('<label for="name">Your name</label><input id="name"><p>Lorem ipsum</p>'),
      "text/html",
    );
    expect(doc.querySelector("label")?.htmlFor).toBe("name");
    expect(doc.body.textContent).toContain("Lorem ipsum");
  });
});
