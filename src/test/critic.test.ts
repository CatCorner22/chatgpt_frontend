import { describe, expect, it } from "vitest";
import { analyzePage, safeUrl } from "@/lib/critic";

const get = (html: string, css = "", id: string) =>
  analyzePage(html, css).findings.find((f) => f.id === id)!;

describe("design critic", () => {
  it("blocks local and private addresses", () => {
    for (const u of [
      "localhost",
      "http://127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "169.254.169.254",
      "ftp://a.com",
      "intranet",
    ])
      expect(safeUrl(u)).toBeNull();
  });
  it("accepts a bare public domain as https", () => {
    expect(safeUrl("example.com")?.toString()).toBe("https://example.com/");
  });
  it("flags images without descriptions", () => {
    expect(get('<img src="a.png"><img src="b.png" alt="b">', "", "alt").ok).toBe(false);
  });
  it("requires exactly one main heading", () => {
    expect(get("<h1>a</h1><h1>b</h1>", "", "h1").ok).toBe(false);
    expect(get("<h1>a</h1>", "", "h1").ok).toBe(true);
  });
  it("flags Inter as a generic default face", () => {
    expect(get("", "body{font-family: Inter, sans-serif}", "generic").ok).toBe(false);
  });
  it("flags the stock purple gradient", () => {
    expect(
      get("", ".hero{background: linear-gradient(90deg, #7c3aed, #3b82f6)}", "gradient").ok,
    ).toBe(false);
  });
  it("flags stock marketing words", () => {
    expect(get("<p>Unlock seamless growth</p>", "", "cliche").ok).toBe(false);
  });
  it("scores a clean page higher than a careless one", () => {
    const good = analyzePage(
      '<html lang="en"><meta name="viewport" content="width=device-width"><h1>Wheel classes in Portland</h1><img alt="mug" src="m.jpg"><a>Book a class</a>' +
        "<p>word </p>".repeat(90),
      "h1{font-family:Fraunces}",
    ).score;
    const bad = analyzePage(
      "<h1>x</h1><h1>y</h1><img src=a><a>Learn more</a><p>Unlock seamless</p>",
      "a{font-family:Inter}.b{background:linear-gradient(#7c3aed,#000)}",
    ).score;
    expect(good).toBeGreaterThan(bad);
  });
});

import { compareToPrescription } from "@/lib/critic";
describe("prescription match", () => {
  it("matches fonts by name and short hex colors", () => {
    const r = compareToPrescription(
      { fonts: ["fraunces", "karla"], colors: ["#fff", "#111111"] },
      {
        headingFont: "Fraunces",
        bodyFont: "Karla",
        bg: "#ffffff",
        ink: "#111111",
        accent: "#b4441f",
      },
    );
    expect(r.matched).toBe(4);
    expect(r.items.find((i) => i.name.startsWith("Button and link"))!.ok).toBe(false);
  });
});
describe("color reading", () => {
  it("reads rgb() colors as hex", () => {
    expect(analyzePage("", "a{color: rgb(10, 37, 64)}").facts.colors).toContain("#0a2540");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DesignPreview } from "@/components/DesignPreview";
import { normalizeTokens, type Tokens } from "@/lib/design";
import { GENERIC_AI_PAGE, wrapPreview } from "@/lib/proof";
describe("proof", () => {
  it("a Focus preview outscores the generic AI page and keeps heading order", () => {
    const t = normalizeTokens({ headingFont: "Fraunces", bodyFont: "Karla" } as Tokens);
    const c = {
      brand: "Kiln",
      headline: "Make something",
      sub: "Classes in Portland for beginners and regulars alike, every week.",
      cta: "Book a class",
      features: [{ title: "A", body: "b" }],
      quote: "q",
    };
    const ours = analyzePage(
      wrapPreview(renderToStaticMarkup(createElement(DesignPreview, { t, c })), "Kiln", [
        "Fraunces",
        "Karla",
      ]),
      "",
    );
    const generic = analyzePage(GENERIC_AI_PAGE, "");
    expect(ours.score).toBeGreaterThan(generic.score);
    expect(ours.findings.find((f) => f.id === "order")!.ok).toBe(true);
    expect(ours.findings.find((f) => f.id === "generic")!.ok).toBe(true);
  });
});
import { fitterBrief } from "@/lib/critic";
describe("fitter", () => {
  it("puts high-severity problems first and includes prescription mismatches", () => {
    const f = analyzePage("<h1>a</h1><h1>b</h1><img src=x>", "").findings;
    const b = fitterBrief("x.com", f, ["Heading font: Fraunces"]);
    expect(b.indexOf("[high]")).toBeLessThan(b.indexOf("[medium]"));
    expect(b).toContain("Use Heading font: Fraunces");
  });
  it("returns nothing when there is nothing to fix", () => {
    expect(fitterBrief("x.com", [], [])).toBe("");
  });
});
describe("escaped markup", () => {
  it("reads fonts from inline styles with escaped quotes", () => {
    const f = analyzePage('<p style="font-family:&quot;Karla&quot;, sans-serif">x</p>', "").facts
      .fonts;
    expect(f).toEqual(["karla"]);
  });
});

import { usabilityFindings } from "@/lib/critic";
describe("ease-of-use checks from the evidence brief", () => {
  const get = (html: string, css = "", id = "") =>
    usabilityFindings(html, css).find((f) => f.id === id)!;
  it("flags an icon-only button and passes a labelled one", () => {
    expect(get("<button><svg></svg></button>", "", "icon-label").ok).toBe(false);
    expect(get('<button aria-label="Close"><svg></svg></button>', "", "icon-label").ok).toBe(true);
  });
  it("flags placeholder used as the only label", () => {
    expect(get('<input placeholder="Email">', "", "placeholder-label").ok).toBe(false);
    expect(
      get(
        '<label for="e">Email</label><input id="e" placeholder="you@x.com">',
        "",
        "placeholder-label",
      ).ok,
    ).toBe(true);
  });
  it("flags removed focus outline without replacement", () => {
    expect(get("<a>x</a>", "a{outline:none}", "focus").ok).toBe(false);
    expect(get("<a>x</a>", "a{outline:none} a:focus-visible{outline:2px solid}", "focus").ok).toBe(
      true,
    );
  });
  it("flags shame wording on decline", () => {
    expect(get("<button>No thanks, I hate saving money</button>", "", "shame").ok).toBe(false);
    expect(get("<button>Not now</button>", "", "shame").ok).toBe(true);
  });
});

import { shortPrompt } from "@/lib/exportPack";
describe("design pack carries the ease-of-use rules", () => {
  it("short prompt asks for labelled icons and real field labels", () => {
    const p = shortPrompt(normalizeTokens({}), "Shop");
    expect(p).toContain("words beside every icon");
    expect(p).toContain("real labels above form fields");
  });
});

import { briefFindings, analyzePage as ap2 } from "@/lib/critic";
describe("second evidence brief checks", () => {
  const get = (html: string, id: string, css = "") =>
    briefFindings(html, css).find((f) => f.id === id);
  it("needs a page language, and dir=rtl for Arabic", () => {
    expect(get("<html><body>x</body></html>", "page-language")!.ok).toBe(false);
    expect(get('<html lang="ar"><body>x</body></html>', "page-language")!.ok).toBe(false);
    expect(get('<html lang="ar" dir="rtl"><body>x</body></html>', "page-language")!.ok).toBe(true);
  });
  it("flags blocked password paste", () => {
    expect(get('<input type="password" onpaste="return false">', "password-paste")!.ok).toBe(false);
    expect(get('<input type="password">', "password-paste")!.ok).toBe(true);
  });
  it("flags buttons under 24px", () => {
    expect(get('<button style="width:16px;height:16px">x</button>', "tap-size")!.ok).toBe(false);
    expect(get('<button style="width:24px;height:24px">x</button>', "tap-size")!.ok).toBe(true);
  });
  it("flags a form with more than 12 fields", () => {
    const f = (n: number) => `<form>${"<input>".repeat(n)}<input type="submit"></form>`;
    expect(get(f(13), "form-length")!.ok).toBe(false);
    expect(get(f(12), "form-length")!.ok).toBe(true);
  });
  it("flags errors shown before typing", () => {
    expect(get('<input aria-invalid="true">', "early-error")!.ok).toBe(false);
  });
  it("possible issues never change the score", () => {
    const a = ap2('<html lang="en"><body><p>hi</p></body></html>', "").score;
    const b = ap2(
      '<html lang="en"><body><p>hi</p><div class="cookie-banner">c</div></body></html>',
      "",
    ).score;
    expect(b).toBe(a);
  });
  it("short pack carries the wait and translation rules", async () => {
    const { shortPrompt: sp } = await import("@/lib/exportPack");
    const p = sp(normalizeTokens({}), "Shop");
    expect(p).toContain("Cancel");
    expect(p).toContain("buttons wrap");
  });
});

describe("fonts set through custom properties", () => {
  it("counts --font-heading / --font-body values as the page's fonts", async () => {
    const { analyzePage, compareToPrescription } = await import("@/lib/critic");
    const r = analyzePage(
      '<style>:root{--font-heading:"Playfair Display", serif;--font-body:"Literata", sans-serif}</style>',
      "",
    );
    expect(r.facts.fonts).toEqual(["playfair display", "literata"]);
    expect(
      compareToPrescription(r.facts, {
        headingFont: "Playfair Display",
        bodyFont: "Literata",
        bg: "#000",
        ink: "#000",
        accent: "#000",
      }).matched,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("whole-site check", () => {
  it("collects same-site pages only, without files, anchors or duplicates", async () => {
    const { sameSiteLinks } = await import("@/lib/critic");
    const html =
      '<a href="/about">a</a><a href="/about#x">b</a><a href="https://other.com/x">c</a><a href="/menu.pdf">d</a><a href="#top">e</a><a href="https://shop.example.com/">f</a>';
    expect(sameSiteLinks(html, "https://shop.example.com/")).toEqual([
      "https://shop.example.com/about",
    ]);
  });
  it("names the page whose fonts differ from most of the site", async () => {
    const { siteDrift } = await import("@/lib/critic");
    const p = (url: string, fonts: string[]) => ({
      url,
      fonts,
      colors: ["#111111", "#ffffff"],
      score: 90,
    });
    const d = siteDrift([p("/", ["fraunces"]), p("/a", ["fraunces"]), p("/b", ["inter"])]);
    expect(d.map((x) => x.url)).toEqual(["/b"]);
    expect(siteDrift([p("/", ["fraunces"])])).toEqual([]);
  });
});
