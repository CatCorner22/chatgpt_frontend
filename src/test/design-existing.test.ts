import { afterEach, describe, expect, it } from "vitest";
import { buildPrescription, markdownText, normalizeTokens, type Content } from "@/lib/design";

const content: Content = {
  brand: "Alder",
  headline: "A sample headline",
  sub: "Sample supporting copy",
  cta: "Try the sample",
  features: [{ title: "Sample feature", body: "Sample feature copy" }],
  quote: "",
};
const tokens = normalizeTokens({
  bg: "#f6f1e7",
  headingFont: "Fraunces",
  radius: 16,
  card: "glass",
  buttonFinish: "glow",
});
const prescription = (integration: "existing" | "new") =>
  buildPrescription({
    brief: "Give our existing appointment screen a quieter visual style.",
    content,
    direction: "Quiet editorial",
    tokens,
    picks: [],
    tool: "Cursor",
    integration,
    experience: "app",
    nav: "bottom-tabs",
  });
function emittedCss(markdown: string) {
  return [...markdown.matchAll(/```css\s*\n([\s\S]*?)```/g)].map((match) => match[1]!).join("\n");
}
function appendStyle(css: string) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}
afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  for (const root of [document.documentElement, document.body]) {
    root.removeAttribute("data-focus-restyle");
    root.removeAttribute("data-focus-theme");
  }
});

describe("existing-site prescription CSS", () => {
  it("keeps its actual CSS inactive when trial markers are mistakenly applied to html and body", () => {
    for (const root of [document.documentElement, document.body]) {
      root.setAttribute("data-focus-restyle", "");
      root.setAttribute("data-focus-theme", "semantic");
    }
    appendStyle(emittedCss(prescription("existing")));
    for (const root of [document.documentElement, document.body]) {
      expect(getComputedStyle(root).getPropertyValue("--focus-color-bg")).toBe("");
    }
  });
  it("does not overwrite customer root values when its actual CSS example is loaded", () => {
    appendStyle(":root { --color-bg: #112233; --radius: 3px; --font-body: system-ui; }");
    const css = emittedCss(prescription("existing"));
    expect(css.trim().length).toBeGreaterThan(0);
    appendStyle(css);
    const root = getComputedStyle(document.documentElement);
    expect(root.getPropertyValue("--color-bg").trim()).toBe("#112233");
    expect(root.getPropertyValue("--radius").trim()).toBe("3px");
    expect(root.getPropertyValue("--font-body").trim()).toBe("system-ui");
  });
  it("makes design values available only to the opted-in wrapper and withdraws them on undo", () => {
    const wrapper = document.createElement("section");
    wrapper.setAttribute("data-focus-restyle", "");
    const originalPage = document.createElement("section");
    document.body.append(wrapper, originalPage);
    appendStyle(emittedCss(prescription("existing")));
    expect(getComputedStyle(wrapper).getPropertyValue("--focus-color-bg").trim()).toBe("#f6f1e7");
    expect(getComputedStyle(wrapper).getPropertyValue("--focus-radius").trim()).toBe("16px");
    expect(getComputedStyle(document.documentElement).getPropertyValue("--focus-color-bg")).toBe(
      "",
    );
    expect(getComputedStyle(originalPage).getPropertyValue("--focus-color-bg")).toBe("");
    wrapper.removeAttribute("data-focus-restyle");
    expect(getComputedStyle(wrapper).getPropertyValue("--focus-color-bg")).toBe("");
  });
  it("keeps the new-build token contract at the root", () => {
    appendStyle(emittedCss(prescription("new")));
    expect(getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim()).toBe(
      "#f6f1e7",
    );
  });
});

describe("design handoff text boundaries", () => {
  it.each(["new", "existing"] as const)(
    "keeps supplied prose inert when the %s handoff is displayed by an HTML-capable viewer",
    (integration) => {
      const markdown = buildPrescription({
        brief: "Business brief <style>body{display:none}</style>",
        content: {
          ...content,
          brand: 'Alder <img src="https://example.invalid/brand">',
          headline: '<img src="https://example.invalid/headline">',
          sub: '<iframe src="https://example.invalid/sub"></iframe>',
          cta: '<img src="https://example.invalid/button">',
          features: [
            {
              title: '<img src="https://example.invalid/feature">',
              body: "<style>form{display:none}</style>",
            },
          ],
          quote: '<img src="https://example.invalid/quote">',
        },
        direction: '<iframe src="https://example.invalid/direction"></iframe>',
        tokens,
        picks: [
          {
            step: '<img src="https://example.invalid/step">',
            label: "<style>input{display:none}</style>",
            reason: '<iframe src="https://example.invalid/reason"></iframe>',
          },
        ],
        checks: [
          {
            name: '<img src="https://example.invalid/check">',
            value: "<style>a{display:none}</style>",
            ok: true,
            grade: '<iframe src="https://example.invalid/grade"></iframe>',
          },
        ],
        tool: "Cursor",
        integration,
      });
      const displayed = new DOMParser().parseFromString(markdown, "text/html");
      expect(displayed.querySelectorAll("style,img,iframe,script")).toHaveLength(0);
      if (integration === "new") {
        const block = /^```json\n([\s\S]*?)^```$/m.exec(markdown);
        expect(block).not.toBeNull();
        expect(JSON.parse(block![1]!).content.brand).toBe(
          'Alder <img src="https://example.invalid/brand">',
        );
      } else {
        expect(displayed.body.textContent).toContain('<img src="https://example.invalid/brand">');
      }
      expect(displayed.body.textContent).toContain("<style>body{display:none}</style>");
    },
  );
  it("does not interpolate an unsupported runtime tool value into the handoff", () => {
    const markdown = buildPrescription({
      brief: "A small workshop",
      content,
      direction: "Quiet",
      tokens,
      picks: [],
      tool: '<img src="https://example.invalid/tool">' as "Cursor",
    });
    const displayed = new DOMParser().parseFromString(markdown, "text/html");
    expect(displayed.querySelectorAll("img,script,style,iframe")).toHaveLength(0);
    expect(displayed.body.textContent).not.toContain("undefined");
  });
});

describe("literal URL-like prose", () => {
  it.each(["https://example.invalid/pixel", "www.example.invalid", "studio@example.invalid"])(
    "keeps %s as recoverable text without Markdown autolink syntax",
    (value) => {
      const encoded = markdownText(value);
      expect(encoded).not.toMatch(/https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]+/i);
      const displayed = new DOMParser().parseFromString(encoded, "text/html");
      expect(displayed.body.textContent).toBe(value);
      expect(displayed.querySelectorAll("a,img,style,iframe,script")).toHaveLength(0);
    },
  );
});

describe("ordinary prose in downloaded Markdown", () => {
  it.each(["new", "existing"] as const)(
    "retains sentence punctuation in the %s brief and direction",
    (integration) => {
      const brief = "Opening hours: 9 to 5. Keep the booking task.";
      const direction = "Quiet editorial: warm and clear.";
      const markdown = buildPrescription({
        brief,
        content: { ...content, brand: "Alder Co." },
        direction,
        tokens,
        picks: [],
        tool: "Cursor",
        integration,
      });
      expect(markdown).toContain(brief);
      expect(markdown).toContain(direction);
      expect(markdown).toContain("Alder Co.");
    },
  );
  it("keeps the owner's exact ordinary headline in the new-build content handoff", () => {
    const headline = "Make something with your hands.";
    const markdown = buildPrescription({
      brief: "Pottery classes: evenings and weekends.",
      content: { ...content, headline },
      direction: "Warm and personal.",
      tokens,
      picks: [],
      tool: "Cursor",
      integration: "new",
    });
    expect(markdown).toContain(headline);
  });
});
