import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildAuthoredPage, DEFAULT_PAGE_OPTIONS, type PageOptions } from "../lib/authored-page";
import { normalizeTokens, type Content } from "../lib/design";

const tokens = normalizeTokens({});
const content: Content = {
  brand: "Still Studio",
  headline: "Spaces for everyday life.",
  sub: "Architecture and interiors for homes and small businesses.",
  cta: "Discuss your project",
  features: [
    { title: "Homes", body: "New spaces, additions, and considered renovations." },
    { title: "Interiors", body: "Materials and furniture chosen together." },
  ],
  quote: "",
};
const options: PageOptions = {
  ...DEFAULT_PAGE_OPTIONS,
  actionUrl: "https://example.com/contact?from=studio&kind=home",
};
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const fontDataUrl = /url\("data:font\/woff2;base64,[A-Za-z0-9+/]+={0,2}"\)/g;
const framingImage = {
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
  alt: 'Workshop portrait by the owner & "Reverie"',
};

describe("authored page export", () => {
  it.each(["studio", "editorial", "product", "showcase", "journal"] as const)(
    "delivers the same bounded crop rules, original image data and alt text in each %s artifact",
    (composition) => {
      const result = buildAuthoredPage(tokens, content, {
        ...options,
        composition,
        image: framingImage,
        imageFraming: { fit: "cover", position: "top-right", narrowPosition: "bottom-left" },
      });
      const preview = parse(result.html);
      const editable = parse(result.files["index.html"]!);
      expect(result.html).toContain(`<style>${result.css}</style>`);
      expect(result.files["styles.css"]).toBe(result.css);
      expect(preview.querySelector("style")?.textContent).toBe(result.css.replaceAll("\r\n", "\n"));
      expect(editable.body.outerHTML).toBe(preview.body.outerHTML);
      expect(editable.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe(
        "./styles.css",
      );
      for (const page of [preview, editable]) {
        expect(page.querySelectorAll("img")).toHaveLength(1);
        const image = page.querySelector(".owner-image");
        expect(image?.getAttribute("src")).toBe(framingImage.src);
        expect(image?.getAttribute("alt")).toBe(framingImage.alt);
        expect(image?.getAttribute("width")).toBe("1200");
        expect(image?.getAttribute("height")).toBe("900");
      }
      expect(result.css).toMatch(
        /\.owner-image \{[^}]*object-fit: cover;[^}]*object-position: right top;/,
      );
      expect(result.css).toMatch(
        /@media \(max-width: 760px\) \{\s*\.owner-image \{ object-position: left bottom; \}/,
      );
      expect(result.files["README.txt"]).toContain("760 CSS pixels");
    },
  );

  it("shows each option with all its own details before the destination in both authored formats", () => {
    const features = [
      { title: "Wheel <basics>", body: "10 am · $48\nIncludes tools & firing." },
      { title: "釉薬のクラス", body: "2 pm · $56" },
      { title: "Open studio", body: "" },
    ];
    const built = buildAuthoredPage(
      tokens,
      { ...content, features },
      { ...options, composition: "comparison", language: "ja" },
    );
    for (const html of [built.html, built.files["index.html"]!]) {
      const doc = parse(html);
      const section = doc.querySelector(".option-comparison")!;
      expect(section.querySelector("h2")?.textContent).toBe("選択肢を比較");
      expect(
        [...section.querySelectorAll("li")].map((row) => ({
          title: row.querySelector("h3")?.textContent,
          body: row.querySelector("p")?.textContent ?? "",
        })),
      ).toEqual(features);
      expect(section.querySelector("basics, details, input, button")).toBeNull();
      expect(section.lastElementChild?.getAttribute("href")).toBe(options.actionUrl);
      expect(doc.querySelector("a[href^='https']")?.parentElement).toBe(section);
    }
    const withoutDestination = parse(
      buildAuthoredPage(tokens, content, { ...options, composition: "comparison", actionUrl: "" })
        .html,
    );
    expect(withoutDestination.querySelector(".option-comparison a")).toBeNull();
  });

  it("keeps a contained image centered regardless of dormant anchors or viewport", () => {
    const result = buildAuthoredPage(tokens, content, {
      ...options,
      composition: "showcase",
      image: framingImage,
      imageFraming: { fit: "contain", position: "right", narrowPosition: "bottom" },
    });
    expect(result.css).toMatch(
      /\.owner-image \{[^}]*object-fit: contain;[^}]*object-position: center center;/,
    );
    expect(result.css.match(/object-position:/g)).toHaveLength(1);
    expect(result.css).toContain(".showcase .owner-image { aspect-ratio: 21/9");
    expect(result.css).toContain(".showcase .owner-image { aspect-ratio: 4/3");
    expect(result.files["README.txt"]).toContain("whole image");
  });

  it("does not change the output for absent images or for default and invalid framing", () => {
    const baseline = buildAuthoredPage(tokens, content, { ...options, image: framingImage });
    const defaultFraming = { fit: "cover", position: "center", narrowPosition: "same" } as const;
    const hostile = {
      fit: "</style><script>",
      position: ["left"],
      narrowPosition: "url(https://example.com)",
    };
    for (const imageFraming of [defaultFraming, hostile as unknown as typeof defaultFraming]) {
      expect(
        buildAuthoredPage(tokens, content, { ...options, image: framingImage, imageFraming }),
      ).toEqual(baseline);
    }
    expect(
      buildAuthoredPage(tokens, content, {
        ...options,
        imageFraming: { fit: "contain", position: "left", narrowPosition: "bottom" },
      }),
    ).toEqual(buildAuthoredPage(tokens, content, options));
  });

  it.each(["studio", "editorial", "product", "showcase", "journal"] as const)(
    "uses the same renderer and CSS for the %s preview, standalone page, and editable source",
    (composition) => {
      const portable = normalizeTokens({
        headingFont: "Instrument Serif",
        bodyFont: "Instrument Sans",
      });
      const result = buildAuthoredPage(portable, content, { ...options, composition });
      const page = parse(result.html);
      const sourcePage = parse(result.files["index.html"]!);
      expect(result.files["styles.css"]).toBe(result.css);
      expect(page.querySelector("style")?.textContent).toBe(result.css);
      expect(sourcePage.querySelector("style")).toBeNull();
      expect(sourcePage.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe(
        "./styles.css",
      );
      expect(sourcePage.body.outerHTML).toBe(page.body.outerHTML);
      expect(result.files["README.txt"]).toContain("edit styles.css to change the page");
      expect(result.files["README.txt"]).toContain(
        "does\nnot change a previously downloaded standalone file",
      );
      expect(page.querySelector("body")?.className).toBe(composition);
      expect(page.querySelectorAll("h1")).toHaveLength(1);
      expect(page.querySelector("h1")?.textContent).toBe(content.headline);
      expect(page.querySelectorAll("script,iframe,link[rel=stylesheet]")).toHaveLength(0);
      expect(result.css.match(fontDataUrl) ?? []).toHaveLength(2);
      expect(result.css.replace(fontDataUrl, "")).not.toMatch(/@import|url\s*\(|local\s*\(/i);
      expect(buildAuthoredPage(portable, content, { ...options, composition })).toEqual(result);
    },
  );

  it.each(["showcase", "journal"] as const)(
    "keeps all owner content without manufacturing artwork or news in the %s layout",
    (composition) => {
      const supplied = { ...content, quote: "The rooms feel like us." };
      const result = buildAuthoredPage(tokens, supplied, { ...options, composition });
      const page = parse(result.html);
      for (const copy of [
        supplied.brand,
        supplied.headline,
        supplied.sub,
        supplied.cta,
        supplied.quote,
        ...supplied.features.flatMap((feature) => [feature.title, feature.body]),
      ]) {
        expect(page.body.textContent).toContain(copy);
      }
      expect(page.querySelector(".original-art, .visual, img, time")).toBeNull();
      expect(page.body.textContent).not.toMatch(
        /Audi|Firehouse|breaking news|trending|latest news|published on/i,
      );
      expect(result.readiness.some((note) => note.id === "composition")).toBe(false);
    },
  );

  it("lets a Showcase visitor reach every detail from its native feature index, including repeated titles", () => {
    const supplied = {
      ...content,
      features: [
        { title: "Spaces", body: "Homes." },
        { title: "Spaces", body: "Workplaces." },
        { title: "", body: "A detail still being named." },
      ],
    };
    const page = parse(
      buildAuthoredPage(tokens, supplied, { ...options, composition: "showcase" }).html,
    );
    const links = page.querySelectorAll('nav[aria-label="Explore this page"] a');
    expect(links).toHaveLength(3);
    const destinations = [...links].map((link) =>
      page.getElementById(link.getAttribute("href")!.slice(1)),
    );
    expect(new Set(destinations).size).toBe(3);
    destinations.forEach((destination, index) => {
      expect(destination?.textContent).toContain(supplied.features[index]!.body);
      expect(destination?.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("gives Showcase a real image stage before the lead copy when an owner image exists", () => {
    const image = {
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
      alt: "Our riverside workshop",
    };
    const page = parse(
      buildAuthoredPage(tokens, content, { ...options, composition: "showcase", image }).html,
    );
    const stage = page.querySelector(".hero figure");
    expect(stage).not.toBeNull();
    expect(stage?.querySelector("img")?.getAttribute("alt")).toBe(image.alt);
    expect(
      stage!.compareDocumentPosition(page.querySelector("h1")!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps an empty Showcase useful without empty category navigation", () => {
    const page = parse(
      buildAuthoredPage(
        tokens,
        { ...content, features: [] },
        { ...options, composition: "showcase", actionUrl: "" },
      ).html,
    );
    expect(page.querySelector('nav[aria-label="Explore this page"]')).toBeNull();
    expect(page.querySelector(".hero-sub")?.textContent).toBe(content.sub);
    expect(page.querySelector("#details, .action")).toBeNull();
  });

  it("gives Journal a lead and a separate section index pointing to numbered, named details", () => {
    const page = parse(
      buildAuthoredPage(tokens, content, { ...options, composition: "journal" }).html,
    );
    expect(page.querySelector(".journal-lead h1")?.textContent).toBe(content.headline);
    const index = page.querySelector('aside[aria-labelledby="page-index-title"]');
    expect(index?.querySelector("h2")?.textContent).toBe("On this page");
    expect(index?.querySelector("h1")).toBeNull();
    const links = index?.querySelectorAll("nav a") ?? [];
    expect(links).toHaveLength(content.features.length);
    for (const [position, link] of [...links].entries()) {
      const destination = page.getElementById(link.getAttribute("href")!.slice(1));
      expect(destination?.querySelector("h3")?.textContent).toBe(content.features[position]!.title);
      expect(destination?.querySelector(".feature-number")?.textContent).toBe(
        String(position + 1).padStart(2, "0"),
      );
      expect(destination?.textContent).toContain(content.features[position]!.body);
    }
    expect(page.querySelector(".site-header .brand")?.textContent).toBe(content.brand);
  });

  it("keeps a Journal with no sections readable without an empty sidebar", () => {
    const page = parse(
      buildAuthoredPage(
        tokens,
        { ...content, features: [] },
        { ...options, composition: "journal" },
      ).html,
    );
    expect(page.querySelector("aside")).toBeNull();
    expect(page.querySelector(".journal-lead h1")?.textContent).toBe(content.headline);
    expect(page.querySelector(".journal-lead .hero-sub")?.textContent).toBe(content.sub);
    expect(page.querySelector("#details")).toBeNull();
  });

  it("places only the owner's supplied Journal image with the lead", () => {
    const image = {
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
      alt: "An interior we designed",
    };
    const page = parse(
      buildAuthoredPage(tokens, content, { ...options, composition: "journal", image }).html,
    );
    expect(page.querySelector(".journal-lead img")?.getAttribute("src")).toBe(image.src);
    expect(page.querySelector(".journal-lead img")?.getAttribute("alt")).toBe(image.alt);
    expect(page.querySelectorAll("img")).toHaveLength(1);
    expect(page.querySelector("aside img, .original-art")).toBeNull();
  });

  it("gives product features native operable disclosures while studio uses visible editorial rows", () => {
    const product = parse(
      buildAuthoredPage(tokens, content, { ...options, composition: "product" }).html,
    );
    const studio = parse(buildAuthoredPage(tokens, content, options).html);
    expect(product.querySelectorAll("details > summary")).toHaveLength(2);
    expect(product.querySelector("details")?.open).toBe(true);
    expect(studio.querySelectorAll(".feature-row")).toHaveLength(2);
    expect(studio.querySelectorAll("details")).toHaveLength(0);
  });

  it("escapes owner content in text and metadata without creating executable elements", () => {
    const hostile = '</style><script>alert(1)</script><img src=x onerror="alert(1)"> & "';
    const page = parse(
      buildAuthoredPage(
        tokens,
        {
          ...content,
          brand: hostile,
          headline: hostile,
          sub: hostile,
          quote: hostile,
          features: [{ title: hostile, body: hostile }],
        },
        options,
      ).html,
    );
    expect(page.querySelectorAll("script,img,[onerror]")).toHaveLength(0);
    expect(page.querySelector("h1")?.textContent).toBe(hostile);
    expect(page.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(hostile);
    expect(page.querySelectorAll("style")).toHaveLength(1);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "//example.com",
    "https://user:password@example.com",
    "https://example.com/\nfoo",
    "mailto:person@example.com%0d%0aBcc:other@example.com",
    "tel:javascript",
    'https://example.com/"onmouseover="x',
  ])("does not emit unsafe action %s", (actionUrl) => {
    const result = buildAuthoredPage(tokens, content, { ...options, actionUrl });
    const page = parse(result.html);
    expect(page.querySelector(".action")?.getAttribute("href")).toBe("#details");
    expect(page.querySelector(".action")?.textContent).toContain("Explore details");
    expect(result.readiness.map((note) => note.id)).toContain("action");
  });

  it.each([
    "https://example.com/book?x=1&y=2",
    "https://Bookings.Example.org:443?slot=am&slot=pm",
    "https://classes.example.org:8443/artist/O'Brien/book?time=am",
    "http://example.com/about",
    "mailto:hello@example.com",
    "tel:+14155550100",
  ])("preserves working action %s", (actionUrl) => {
    const result = buildAuthoredPage(tokens, content, { ...options, actionUrl });
    expect(parse(result.html).querySelector(".action")?.getAttribute("href")).toBe(actionUrl);
    expect(result.readiness.map((note) => note.id)).not.toContain("action");
  });

  it("every internal navigation destination exists", () => {
    const page = parse(buildAuthoredPage(tokens, content, DEFAULT_PAGE_OPTIONS).html);
    for (const link of page.querySelectorAll('a[href^="#"]'))
      expect(page.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    expect(page.querySelector("#main")?.getAttribute("tabindex")).toBe("-1");
  });

  it("omits unsupplied proof and reports unfinished content without inventing claims", () => {
    const result = buildAuthoredPage(
      tokens,
      { brand: "", headline: "", sub: "", cta: "", features: [], quote: "" },
      DEFAULT_PAGE_OPTIONS,
    );
    const page = parse(result.html);
    expect(page.querySelector("blockquote")).toBeNull();
    expect(page.querySelectorAll("form,input")).toHaveLength(0);
    expect(result.readiness.map((note) => note.id)).toEqual(
      expect.arrayContaining(["brand", "headline", "details", "action", "fonts"]),
    );
    expect(page.body.textContent).not.toMatch(/testimonial|trusted by|reply within|customer|99%/i);
  });

  it("preserves supplied quotations and asks for human verification", () => {
    const result = buildAuthoredPage(
      tokens,
      { ...content, quote: "A place that feels like ours." },
      options,
    );
    expect(parse(result.html).querySelector("blockquote")?.textContent).toContain(
      "A place that feels like ours.",
    );
    expect(result.readiness.map((note) => note.id)).toContain("quote");
  });

  it("embeds a raster with explicit dimensions and preserves description as text", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=";
    const result = buildAuthoredPage(tokens, content, {
      ...options,
      image: { src, alt: 'The studio & its "garden"' },
    });
    const img = parse(result.html).querySelector("img");
    expect(img?.getAttribute("src")).toBe(src);
    expect(img?.getAttribute("alt")).toBe('The studio & its "garden"');
    expect(img?.getAttribute("width")).toBe("1200");
    expect(img?.getAttribute("height")).toBe("900");
    expect(result.readiness.map((note) => note.id)).not.toContain("image");
  });

  it.each([
    { src: "https://example.com/photo.png", alt: "Photo" },
    { src: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", alt: "SVG" },
    { src: "data:image/png;base64,PHN2Zz48L3N2Zz4=", alt: "Mislabeled SVG" },
    { src: "data:image/png;base64,iVBORw0KGgo=", alt: "" },
    { src: `data:image/png;base64,iVBORw0KGgoA${"A".repeat(2_800_000)}`, alt: "Oversized" },
  ])("omits invalid, external, undescribed, or oversized images", (image) => {
    const result = buildAuthoredPage(tokens, content, { ...options, image });
    expect(parse(result.html).querySelector("img")).toBeNull();
    expect(result.readiness.map((note) => note.id)).toContain("image");
  });

  it("reports any contrast correction and does not mutate the selected design", () => {
    const unreadable = {
      ...tokens,
      ink: tokens.bg,
      muted: tokens.bg,
      accentInk: tokens.accent,
      surface: "#000000",
    };
    const before = { ...unreadable };
    const result = buildAuthoredPage(unreadable, content, options);
    expect(unreadable).toEqual(before);
    expect(result.readiness.map((note) => note.id)).toEqual(
      expect.arrayContaining(["token-adjustments", "surface-contrast"]),
    );
    expect(result.css).toContain("--surface-ink: #ffffff");
  });

  it.each(["glow", "gloss"] as const)(
    "discloses omitted secondary colors, glass surfaces, and %s buttons",
    (buttonFinish) => {
      const selected = normalizeTokens({
        ...tokens,
        accent2: "#005577",
        card: "glass",
        buttonFinish,
        texture: "stars",
      });
      const result = buildAuthoredPage(selected, content, options);
      const note = result.readiness.find((item) => item.id === "finish-omissions");
      expect(note?.message).toContain("second accent #005577");
      expect(note?.message).toContain("glass card finish");
      expect(note?.message).toContain(`${buttonFinish} button finish`);
      expect(note?.message).toContain("stars background texture");
      expect(result.files["README.txt"]).toContain(note!.message);
      expect(selected).toEqual(
        normalizeTokens({
          ...tokens,
          accent2: "#005577",
          card: "glass",
          buttonFinish,
          texture: "stars",
        }),
      );
    },
  );

  it("discloses a glow texture and any composition override without claiming an exact layout match", () => {
    const result = buildAuthoredPage(
      normalizeTokens({ ...tokens, heroLayout: "poster", texture: "glow" }),
      content,
      options,
    );
    expect(result.readiness.find((item) => item.id === "finish-omissions")?.message).toContain(
      "glow background texture",
    );
    expect(result.readiness.find((item) => item.id === "composition-layout")?.message).toContain(
      "instead of the selected poster hero arrangement",
    );
    expect(result.files["README.txt"]).toContain("Earlier hero arrangement: poster");
  });

  it("does not report omitted effects when ordinary finishes and the corresponding layout are selected", () => {
    const result = buildAuthoredPage(
      normalizeTokens({ ...tokens, heroLayout: "split", texture: "none" }),
      content,
      options,
    );
    expect(result.readiness.map((item) => item.id)).not.toContain("finish-omissions");
    expect(result.readiness.map((item) => item.id)).not.toContain("composition-layout");
  });

  it("prioritizes bundled type before its local fallbacks and includes accommodation styles", () => {
    const result = buildAuthoredPage(
      normalizeTokens({ headingFont: "Space Grotesk", bodyFont: "Literata" }),
      content,
      options,
    );
    expect(result.css).toContain(
      '--heading: "Focus Space Grotesk v1", "Space Grotesk", system-ui, sans-serif',
    );
    expect(result.css).toContain('--body: "Focus Literata v1", "Literata", Georgia, serif');
    expect(result.css).toContain("prefers-reduced-motion: reduce");
    expect(result.css).toContain("forced-colors: active");
    expect(result.css).toContain("text-wrap: pretty");
    expect(result.css).toContain("font-variant-numeric: tabular-nums");
  });

  it("retains selected licenses and provenance alongside portable regular-weight headings", () => {
    const result = buildAuthoredPage(
      normalizeTokens({ headingFont: "Instrument Serif", bodyFont: "Instrument Sans" }),
      content,
      options,
    );
    expect(result.css).toContain("--heading-weight: 400");
    expect(result.css).toMatch(/h1, h2, h3 \{[^}]+font-weight: var\(--heading-weight\)/);
    expect(result.files["fonts/PROVENANCE.txt"]).toContain("Instrument Serif");
    expect(result.files["fonts/PROVENANCE.txt"]).not.toContain("Space Grotesk");
    for (const id of ["instrument-serif", "instrument-sans"]) {
      const license = result.files[`fonts/${id}-OFL.txt`];
      expect(license).toContain("SIL OPEN FONT LICENSE");
      expect(result.html).toContain(license);
      expect(result.files["styles.css"]).toContain(license);
    }
  });

  it.each([
    ["Instrument Serif", "Instrument Sans", "instrument-serif", "instrument-sans"],
    ["Space Grotesk", "IBM Plex Sans", "space-grotesk", "ibm-plex-sans"],
    ["Newsreader", "Literata", "newsreader", "literata"],
  ] as const)(
    "pairs the exact stylesheet and OFL notices in a %s and %s ZIP",
    async (headingFont, bodyFont, headingId, bodyId) => {
      const result = buildAuthoredPage(
        normalizeTokens({ headingFont, bodyFont }),
        content,
        options,
      );
      const zip = new JSZip();
      for (const [name, text] of Object.entries(result.files)) zip.file(name, text);
      const extracted = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array" }));
      const stylesheet = await extracted.file("styles.css")?.async("string");
      expect(stylesheet).toBe(result.css);
      expect(result.html).toContain(`<style>${stylesheet}</style>`);
      expect(parse(result.html).querySelector("style")?.textContent).toBe(
        stylesheet?.replaceAll("\r\n", "\n"),
      );
      expect(stylesheet?.match(fontDataUrl)).toHaveLength(2);
      const licensePaths = [`fonts/${headingId}-OFL.txt`, `fonts/${bodyId}-OFL.txt`];
      for (const path of [...licensePaths, "fonts/PROVENANCE.txt"]) {
        expect(await extracted.file(path)?.async("string")).toBe(result.files[path]);
      }
      expect(Object.keys(extracted.files).filter((path) => path.endsWith("-OFL.txt"))).toEqual(
        licensePaths,
      );
    },
  );

  it("identifies each mixed font outcome and keeps owner input out of font CSS", () => {
    const result = buildAuthoredPage(
      normalizeTokens({ headingFont: "DM Serif Display", bodyFont: "Instrument Sans" }),
      content,
      options,
    );
    const fonts = result.readiness.find((note) => note.id === "fonts")?.message;
    expect(fonts).toMatch(/Instrument Sans.*embedded|embedded.*Instrument Sans/i);
    expect(fonts).toMatch(/DM Serif Display.*fallback/i);
    expect(result.css).toContain('--heading: "DM Serif Display", Georgia, serif');
    expect(result.css).not.toContain("Focus DM Serif Display");
    const hostile = '";}body{background:url(https://example.com/font)}</style><script>';
    const malformed = buildAuthoredPage(
      { ...tokens, headingFont: hostile as typeof tokens.headingFont },
      content,
      options,
    );
    expect(malformed.html).not.toContain(hostile);
    expect(malformed.css.replace(fontDataUrl, "")).not.toMatch(/@import|url\s*\(|local\s*\(/i);
  });
});
