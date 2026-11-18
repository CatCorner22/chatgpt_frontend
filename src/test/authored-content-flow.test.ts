import { describe, expect, it } from "vitest";
import { buildAuthoredPage } from "@/lib/authored-page";
import { normalizeTokens, type Content } from "@/lib/design";

const compositions = ["studio", "editorial", "product", "showcase", "journal"] as const;
const tokens = normalizeTokens({});
const content: Content = {
  brand: "River Studio",
  headline: "Make room for a slower morning",
  sub: "Small-group pottery classes beside the river, open to complete beginners.",
  cta: "Choose a class",
  features: [],
  quote: "",
};
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

// These catch the source branch that relocates the introduction when the last
// feature is removed, and dangling/empty navigation when a section is absent.
describe.each(compositions)("%s authored content flow", (composition) => {
  it.each([
    { name: "no features", features: [] },
    { name: "blank feature rows", features: [{ title: "  ", body: "\n" }] },
    {
      name: "a real feature",
      features: [{ title: "Saturday mornings", body: "Materials included." }],
    },
  ])("keeps the supplied explanation once beside its headline with $name", ({ features }) => {
    const built = buildAuthoredPage(
      tokens,
      { ...content, features },
      { composition, actionUrl: "https://example.com/classes" },
    );
    for (const html of [built.html, built.files["index.html"]!]) {
      const page = parse(html);
      const copy = page.querySelector(".hero-copy")!;
      const lead = copy.querySelector(".hero-sub");
      expect(lead?.textContent).toBe(content.sub);
      expect(
        [...page.querySelectorAll("p")].filter((p) => p.textContent === content.sub),
      ).toHaveLength(1);
      expect(
        copy.querySelector("h1")!.compareDocumentPosition(lead!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        lead!.compareDocumentPosition(copy.querySelector(".action")!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(page.querySelector(".hero .action")?.textContent).toContain(content.cta);
      expect(page.querySelector(".hero .action")?.getAttribute("href")).toBe(
        "https://example.com/classes",
      );
    }
  });

  it.each(["", "javascript:alert(1)"])(
    "omits empty sections and fallback actions when there is no destination (%s)",
    (actionUrl) => {
      const built = buildAuthoredPage(tokens, content, { composition, actionUrl });
      const page = parse(built.html);
      expect(
        page.querySelector(
          "#details, .hero-actions, .action, .site-nav, .feature-index, .journal-index, .closing",
        ),
      ).toBeNull();
      expect(page.querySelector("h1")?.textContent).toBe(content.headline);
      expect(page.querySelector(".hero-sub")?.textContent).toBe(content.sub);
      expect(page.querySelector(".site-header .brand")?.textContent).toBe(content.brand);
      expect(page.body.textContent).not.toContain("A closer look.");
      expect(page.body.textContent).not.toContain("Explore details");
      expect(built.readiness.find((note) => note.id === "action")?.message).toMatch(
        /omitted|not shown|no action/i,
      );
      expect(built.files["README.txt"]).not.toContain("it explores this page’s details.");
      for (const link of page.querySelectorAll('a[href^="#"]')) {
        expect(page.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
      }
    },
  );

  it("preserves a real action without fabricating a details section", () => {
    const page = parse(
      buildAuthoredPage(tokens, content, { composition, actionUrl: "mailto:studio@example.com" })
        .html,
    );
    expect(page.querySelector("#details")).toBeNull();
    expect(
      [...page.querySelectorAll(".site-nav a, .action")].map((link) => link.getAttribute("href")),
    ).toEqual(["mailto:studio@example.com", "mailto:studio@example.com"]);
    expect(
      [...page.querySelectorAll(".site-nav a, .action")].every((link) =>
        link.textContent?.includes(content.cta),
      ),
    ).toBe(true);
  });

  it("avoids an immediate repeat of the action on a short page but retains it after a quotation", () => {
    const short = parse(
      buildAuthoredPage(tokens, content, { composition, actionUrl: "https://example.com/classes" })
        .html,
    );
    expect(short.querySelector(".closing")).toBeNull();
    const quoted = parse(
      buildAuthoredPage(
        tokens,
        { ...content, quote: "A welcoming place to learn." },
        { composition, actionUrl: "https://example.com/classes" },
      ).html,
    );
    expect(quoted.querySelector(".closing .action")?.getAttribute("href")).toBe(
      "https://example.com/classes",
    );
    expect(
      quoted
        .querySelector("blockquote")!
        .compareDocumentPosition(quoted.querySelector(".closing")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps native details navigation for actual supplied features", () => {
    const features = [
      { title: "", body: "Materials included." },
      { title: "Saturday mornings", body: "" },
    ];
    const page = parse(
      buildAuthoredPage(tokens, { ...content, features }, { composition, actionUrl: "" }).html,
    );
    expect(page.querySelector("#details")?.textContent).toContain("Materials included.");
    expect(page.querySelector("#details")?.textContent).toContain("Saturday mornings");
    expect(page.querySelector("#details")?.textContent).not.toContain(content.sub);
    expect(page.querySelector(".hero .action")?.getAttribute("href")).toBe("#details");
    for (const link of page.querySelectorAll('a[href^="#"]')) {
      expect(page.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    }
  });

  it("does not invent an explanation or details when both are absent", () => {
    const built = buildAuthoredPage(
      tokens,
      { ...content, sub: " \n ", quote: "The studio gave me space to learn." },
      { composition, actionUrl: "" },
    );
    const page = parse(built.html);
    expect(page.querySelector(".hero-sub, #details, .action")).toBeNull();
    expect(page.querySelector("blockquote")?.textContent).toContain(
      "The studio gave me space to learn.",
    );
    expect(built.readiness.some((note) => note.id === "details")).toBe(true);
  });
});
