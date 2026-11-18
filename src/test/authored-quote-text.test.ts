import { describe, expect, it } from "vitest";
import { buildAuthoredPage, type PageOptions } from "@/lib/authored-page";
import { normalizeTokens, type Content } from "@/lib/design";

const tokens = normalizeTokens({ headingFont: "Instrument Serif", bodyFont: "Instrument Sans" });
const content: Content = {
  brand: "River Studio",
  headline: "A studio for clay",
  sub: "Beginner classes in small groups.",
  cta: "Book a class",
  features: [],
  quote: "",
};
const destination = "https://example.com/book?from=studio&class=clay";
const compositions = ["studio", "editorial", "product", "showcase", "journal"] as const;
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const render = (
  quote: string,
  composition: PageOptions["composition"] = "studio",
  actionUrl = destination,
) => buildAuthoredPage(tokens, { ...content, quote }, { composition, actionUrl });

describe("authored quotation text", () => {
  it.each(compositions)(
    "delivers exact escaped quotation text in %s preview and source",
    (name) => {
      const quote =
        ' \n“Rae said "Try it."” 🧑🏽‍🎨\nIt\'s our <img src=x onerror=bad()> & <script>bad()</script>. \t ';
      const built = render(quote, name);
      const inlineCss = `<style>${built.css}</style>`;
      expect(built.html).toContain(inlineCss);
      expect(built.files["styles.css"]).toBe(built.css);
      expect(built.files["index.html"]).toBe(
        built.html.replace(inlineCss, '<link rel="stylesheet" href="./styles.css">'),
      );
      for (const html of [built.html, built.files["index.html"]!]) {
        const page = parse(html);
        const blockquote = page.querySelector("blockquote")!;
        expect(page.querySelectorAll("blockquote")).toHaveLength(1);
        expect(blockquote.textContent).toBe(quote.trim());
        expect(page.querySelector("script, img, [onerror]")).toBeNull();
        expect(page.querySelector(".hero .action")?.getAttribute("href")).toBe(destination);
        const closing = page.querySelector(".closing")!;
        expect(closing.querySelector("a")?.getAttribute("href")).toBe(destination);
        expect(
          blockquote.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      expect(built.readiness.some((note) => note.id === "quote")).toBe(true);
      expect(built.readiness.some((note) => note.id === "action")).toBe(false);
    },
  );

  it.each([
    ["unmarked", "It was a joy."],
    ["straight", '"It was a joy."'],
    ["curly", "“It was a joy.”"],
    ["nested", '“"It was a joy."”'],
    ["unbalanced opening", "“It was a joy."],
    ["unbalanced closing", 'It was a joy."'],
    ["apostrophes", "‘It’s a joy,’ I said."],
    ["emoji and internal whitespace", "🎨  Our studio.\nWelcome back!"],
    ["punctuation only", '"”!?'],
    ["single punctuation mark", '"'],
  ])("preserves %s quotation text without adding or removing punctuation", (_label, quote) => {
    const built = render(` \n ${quote}\t `);
    expect(parse(built.html).querySelector("blockquote")?.textContent).toBe(quote);
    expect(built.readiness.some((note) => note.id === "quote")).toBe(true);
  });

  it("omits a blank quotation and keeps a valid main action without a closing repeat", () => {
    const built = render(" \n\t ");
    const page = parse(built.html);
    expect(page.querySelector("blockquote, .closing")).toBeNull();
    expect(page.querySelector(".hero .action")?.getAttribute("href")).toBe(destination);
    expect(built.readiness.some((note) => note.id === "quote")).toBe(false);
  });

  it.each(["", "javascript:alert(1)"])(
    "retains supplied literal punctuation when an action is unavailable (%j)",
    (actionUrl) => {
      const quote = '"';
      const built = render(quote, "product", actionUrl);
      const page = parse(built.html);
      expect(page.querySelector("blockquote")?.textContent).toBe(quote);
      expect(page.querySelector(".hero .action, .closing, #details")).toBeNull();
      expect(built.readiness.map(({ id }) => id)).toEqual(
        expect.arrayContaining(["quote", "action"]),
      );
    },
  );
});
