import { describe, expect, it } from "vitest";
import { buildAuthoredPage } from "@/lib/authored-page";
import { normalizeTokens, type Content } from "@/lib/design";

const tokens = normalizeTokens({ headingFont: "Instrument Serif", bodyFont: "Instrument Sans" });
const content: Content = {
  brand: "River Studio",
  headline: "A studio for clay",
  sub: "Classes and tools for small workshops.",
  cta: "Book a class",
  features: [],
  quote: "",
};
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const render = (features: Content["features"]) =>
  buildAuthoredPage(tokens, { ...content, features }, { composition: "product", actionUrl: "" });

function numberedRows(page: Document): HTMLElement[] {
  return [...page.querySelectorAll<HTMLElement>('#details [id^="feature-"]')].filter((row) =>
    /^feature-\d+$/.test(row.id),
  );
}

function expectStaticRow(row: HTMLElement, heading: string, number: string) {
  expect(row.tagName).toBe("SECTION");
  expect(row.querySelector("h3")?.textContent).toBe(heading);
  expect(row.textContent?.trimStart().startsWith(number)).toBe(true);
  expect(row.hasAttribute("tabindex")).toBe(false);
  expect(row.getAttribute("role")).not.toBe("button");
  expect(row.querySelector("details, summary, button, [role=button], [tabindex]")).toBeNull();
}

describe("Product detail content", () => {
  it("shows every supplied title without empty disclosures or keyboard controls", () => {
    const first = 'Kiln access & "materials"';
    const second = "Intro <img src=x onerror=alert(1)>";
    const built = render([
      { title: first, body: "" },
      { title: " \n ", body: "\t" },
      { title: second, body: " \n\t " },
    ]);
    const page = parse(built.html);
    const rows = numberedRows(page);

    expect(rows.map((row) => row.id)).toEqual(["feature-1", "feature-2"]);
    expect(page.querySelector("#details")).not.toBeNull();
    expect(page.querySelector(".hero a[href='#details']")).not.toBeNull();
    expectStaticRow(rows[0]!, first, "01");
    expectStaticRow(rows[1]!, second, "02");
    expect(page.querySelector("script, img, [onerror]")).toBeNull();
  });

  it("opens the first body-bearing disclosure after earlier static rows and preserves the exported source", () => {
    const firstBody = 'Included: clay & "glaze" <supplies>.';
    const laterBody = "Bring a notebook <script>bad()</script> if you like.";
    const built = render([
      { title: "Opening hours", body: "" },
      { title: "", body: firstBody },
      { title: "Location", body: "\n\t " },
      { title: "Before arriving", body: laterBody },
    ]);
    const page = parse(built.html);
    const rows = numberedRows(page);
    const realDisclosures = [...page.querySelectorAll<HTMLDetailsElement>("#details details")];

    expect(page.querySelector("#details details[open]")?.id).toBe("feature-2");
    expect(realDisclosures.map((row) => [row.id, row.open])).toEqual([
      ["feature-2", true],
      ["feature-4", false],
    ]);
    expect(rows.map((row) => row.id)).toEqual(["feature-1", "feature-2", "feature-3", "feature-4"]);
    expectStaticRow(rows[0]!, "Opening hours", "01");
    expectStaticRow(rows[2]!, "Location", "03");
    for (const [index, body, title, number] of [
      [0, firstBody, "Detail 2", "02"],
      [1, laterBody, "Before arriving", "04"],
    ] as const) {
      const row = realDisclosures[index]!;
      const summary = row.querySelector(":scope > summary");
      expect(summary?.querySelector("h3")?.textContent).toBe(title);
      expect(summary?.textContent?.trimStart().startsWith(number)).toBe(true);
      expect(row.querySelector(":scope > p")?.textContent).toBe(body);
    }
    expect(page.querySelector("script, img, [onerror]")).toBeNull();

    const inlineCss = `<style>${built.css}</style>`;
    expect(built.html).toContain(inlineCss);
    expect(built.files["styles.css"]).toBe(built.css);
    expect(built.files["index.html"]).toBe(
      built.html.replace(inlineCss, '<link rel="stylesheet" href="./styles.css">'),
    );
    expect(parse(built.files["index.html"]!).body.outerHTML).toBe(page.body.outerHTML);
  });
});
