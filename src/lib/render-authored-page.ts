import { actionDestination } from "./action-destination";
import { contrast, normalizeTokens, type Content, type Tokens } from "./design";
import { fixContrast } from "./engine";
import { PRODUCT_PRINT_CSS } from "./authored-product-print";
import {
  getAuthoredFeatures,
  getAuthoredQuote,
  hasAuthoredFeatureDescription,
} from "./authored-content";
import {
  AUTHORED_FONT_COVERAGE,
  buildSelectedFonts,
  type BundledFamily,
} from "./authored-font-styles";
import {
  compactImageFraming,
  getImageFramingCss,
  IMAGE_NARROW_BREAKPOINT,
  type ImageFraming,
} from "./image-framing";
import { isPageComposition, type PageComposition } from "./page-compositions";

type PageImage = { src: string; alt: string; credit?: string };
export type PageOptions = {
  composition: PageComposition;
  language?: "en" | "ja";
  actionUrl: string;
  image?: PageImage;
  relatedStory?: {
    title: string;
    url: string;
    placement: "after-intro" | "after-article";
    image?: PageImage;
    imageFraming?: ImageFraming;
  };
  imageFraming?: ImageFraming;
};

export const DEFAULT_PAGE_OPTIONS: PageOptions = { composition: "studio", actionUrl: "" };
export type PageReadiness = { id: string; message: string };

// Only Focus's own visitor-facing text belongs here. Owner copy is never translated.
const PAGE_LABELS = {
  en: {
    untitled: "Untitled project",
    continue: "Continue",
    exploreDetails: "Explore details",
    detail: "Detail",
    introduction: "Introduction",
    explorePage: "Explore this page",
    contents: "On this page",
    details: "Details",
    closerLook: "A closer look.",
    quotation: "Supplied quotation",
    related: "Related reading",
    nextStep: "Next step",
    mainNav: "Main",
    skip: "Skip to content",
    top: "Back to top ↑",
  },
  ja: {
    untitled: "無題のプロジェクト",
    continue: "次へ",
    exploreDetails: "詳しく見る",
    detail: "詳細",
    introduction: "はじめに",
    explorePage: "このページの目次",
    contents: "目次",
    details: "詳細",
    closerLook: "詳しい内容",
    quotation: "引用",
    related: "関連記事",
    nextStep: "次のステップ",
    mainNav: "メイン",
    skip: "本文へスキップ",
    top: "ページの先頭へ ↑",
  },
} as const;

const escape = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The first bytes verify the declared raster type; SVG and remote URLs are never embedded. */
function rasterImage(value: PageOptions["image"]): { src: string; alt: string } | null {
  if (!value || !text(value.alt)) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.src);
  if (!match) return null;
  const encoded = match[2]!;
  if (encoded.length % 4 !== 0 || encoded.length > 2_796_204) return null;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  if ((encoded.length / 4) * 3 - padding > 2 * 1024 * 1024) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: number[] = [];
  for (let i = 0; i < Math.min(encoded.length, 20); i += 4) {
    const n =
      (alphabet.indexOf(encoded[i]!) << 18) |
      (alphabet.indexOf(encoded[i + 1]!) << 12) |
      (Math.max(0, alphabet.indexOf(encoded[i + 2]!)) << 6) |
      Math.max(0, alphabet.indexOf(encoded[i + 3]!));
    bytes.push((n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  }
  const starts = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid =
    match[1] === "png"
      ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : match[1] === "jpeg"
        ? starts([255, 216, 255])
        : starts([82, 73, 70, 70]) && bytes.slice(8, 12).join(",") === "87,69,66,80";
  return valid ? { src: value.src, alt: text(value.alt) } : null;
}

function readableOn(ink: string, ground: string): string {
  if (contrast(ink, ground) >= 4.5) return ink;
  return contrast("#000000", ground) >= contrast("#ffffff", ground) ? "#000000" : "#ffffff";
}

function ornament(composition: PageOptions["composition"]): string {
  const shapes =
    composition === "studio"
      ? '<circle cx="320" cy="306" r="204" fill="var(--accent)"/><path d="M208 510V294a112 112 0 0 1 224 0v216z" fill="var(--surface)"/><path d="M246 510V306a74 74 0 0 1 148 0v204" fill="none" stroke="var(--surface-ink)" stroke-width="2"/><path d="M104 510h432" stroke="var(--surface-ink)" stroke-width="2"/>'
      : composition === "editorial"
        ? '<circle cx="320" cy="320" r="204" fill="none" stroke="var(--accent)" stroke-width="72"/><path d="M112 320h416M320 112v416" stroke="var(--surface-ink)" stroke-width="2"/><circle cx="320" cy="320" r="106" fill="var(--surface)" stroke="var(--surface-ink)" stroke-width="2"/>'
        : '<path d="M112 220h176v176H112zM352 220h176v176H352z" fill="var(--accent)"/><circle cx="200" cy="220" r="88" fill="var(--surface-ink)"/><path d="M352 220a88 88 0 0 1 176 0" fill="var(--surface-ink)"/><path d="M112 440h416M112 470h268" stroke="var(--surface-ink)" stroke-width="2"/>';
  return `<svg class="original-art" viewBox="0 0 640 640" width="640" height="640" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`;
}

/** One document for both the full preview and the downloadable page. No scripts or network assets. */
export function renderAuthoredPage(
  input: Tokens,
  content: Content,
  options: PageOptions,
  families: readonly BundledFamily[],
): {
  html: string;
  css: string;
  files: Record<string, string>;
  readiness: PageReadiness[];
} {
  const readiness: PageReadiness[] = [];
  const normalized = normalizeTokens(input);
  const t = fixContrast(normalized);
  const language = options.language === "ja" ? "ja" : "en";
  const labels = PAGE_LABELS[language];
  const composition = isPageComposition(options.composition) ? options.composition : "studio";
  if (composition !== options.composition)
    readiness.push({
      id: "composition",
      message: "An unknown composition was replaced with Studio.",
    });
  const compositionLayout = {
    studio: "split",
    editorial: "editorial",
    product: "stacked",
    showcase: "poster",
    journal: "editorial",
  }[composition];
  if (t.heroLayout !== compositionLayout)
    readiness.push({
      id: "composition-layout",
      message: `The ${composition} composition determines this page’s structure instead of the selected ${t.heroLayout} hero arrangement. Review the authored layout before publishing.`,
    });
  const omittedFinishes = [
    t.accent2 ? `second accent ${t.accent2}` : "",
    t.card === "glass" ? "glass card finish" : "",
    t.buttonFinish === "glow" || t.buttonFinish === "gloss"
      ? `${t.buttonFinish} button finish`
      : "",
    t.texture === "glow" || t.texture === "stars" ? `${t.texture} background texture` : "",
  ].filter(Boolean);
  if (omittedFinishes.length)
    readiness.push({
      id: "finish-omissions",
      message: `This authored page uses opaque surfaces and flat controls. It does not render these selected details: ${omittedFinishes.join(", ")}. They remain in your studio design; review the simpler finish before publishing.`,
    });
  const changed = (Object.keys(t) as (keyof Tokens)[]).filter((key) => input?.[key] !== t[key]);
  if (changed.length)
    readiness.push({
      id: "token-adjustments",
      message: `The page normalized or corrected these design values: ${changed.join(", ")}. Review the exported CSS before publishing.`,
    });
  const surfaceInk = readableOn(t.ink, t.surface);
  const surfaceMuted = readableOn(t.muted, t.surface);
  if (surfaceInk !== t.ink || surfaceMuted !== t.muted)
    readiness.push({
      id: "surface-contrast",
      message:
        "Text on the surface color uses a separate readable color. The original background and surface colors are preserved.",
    });
  const action = actionDestination(options.actionUrl);
  const image = rasterImage(options.image);
  if (options.image && !image)
    readiness.push({
      id: "image",
      message:
        "The image was omitted. Use an embedded PNG, JPEG, or WebP under 2 MiB with a meaningful description.",
    });
  const story = options.relatedStory;
  const storyDestination = actionDestination(story?.url);
  const storyTitle = text(story?.title);
  const storyReady = !!(storyTitle && storyDestination && /^https?:/i.test(storyDestination));
  const storyImage = rasterImage(story?.image);
  const storyCredit = text(story?.image?.credit);
  if (story && !storyReady)
    readiness.push({
      id: "story-link",
      message: "Give the related story a title and its full website address, or remove the story.",
    });
  if (story?.image && (!storyImage || !storyCredit))
    readiness.push({
      id: "story-image",
      message:
        "Add a readable story image, its description and a public credit, or remove the image.",
    });
  const storyFraming = getImageFramingCss(story?.imageFraming);
  const framing = image && compactImageFraming(options.imageFraming);
  const framed = framing ? getImageFramingCss(framing) : undefined;
  const brand = text(content.brand) || labels.untitled;
  const headline = text(content.headline) || brand;
  const sub = text(content.sub);
  const quote = getAuthoredQuote(content.quote);
  const features = getAuthoredFeatures(content.features);
  const firstDescription = features.findIndex(hasAuthoredFeatureDescription);
  const hasProductDisclosures = composition === "product" && firstDescription >= 0;
  const hasStaticProductFeatures =
    composition === "product" &&
    features.some((feature) => !hasAuthoredFeatureDescription(feature));
  const hasDetails = features.length > 0;
  const hasHeroAction = !!action || hasDetails;
  if (!action)
    readiness.push({
      id: "action",
      message: `${
        text(options.actionUrl)
          ? "The action destination is invalid. Use an http, https, mailto, or tel address."
          : "Add a real action destination when ready."
      } ${
        hasDetails
          ? "For now, the main link explores the page details."
          : "No action is shown until you add a valid destination or feature details."
      }`,
    });
  const actionLabel = action ? text(content.cta) || labels.continue : labels.exploreDetails;
  if (brand === labels.untitled || brand === PAGE_LABELS.en.untitled)
    readiness.push({ id: "brand", message: "Give this page its real project or business name." });
  if (!text(content.headline))
    readiness.push({ id: "headline", message: "Add a headline in your own words." });
  if (!sub && !features.length)
    readiness.push({
      id: "details",
      message: "Add real details about the work, service, or product before publishing.",
    });
  const allCopy = [
    brand,
    headline,
    sub,
    quote,
    ...features.flatMap((feature) => [feature.title, feature.body]),
  ].join(" ");
  if (
    /\b(?:lorem ipsum|your tagline here|sample (?:words|service|quote)|replace (?:them |with )?with|your business)\b/i.test(
      allCopy,
    )
  )
    readiness.push({
      id: "sample-copy",
      message: "Some text still looks like sample copy. Replace it with your own verified content.",
    });
  if (quote)
    readiness.push({
      id: "quote",
      message:
        "A supplied quotation appears on the page. Check its accuracy and permission before publishing.",
    });
  const fonts = buildSelectedFonts(t.headingFont, t.bodyFont, families);
  const fontNotes = [
    fonts.includedFamilies.length
      ? `Embedded fonts include ${fonts.includedFamilies.join(", ")}. ${AUTHORED_FONT_COVERAGE}`
      : "",
    fonts.missingFamilies.length
      ? `${fonts.missingFamilies.join(", ")} will use the installed typeface where available, with system fallback fonts.`
      : "",
  ];
  readiness.push({ id: "fonts", message: fontNotes.filter(Boolean).join(" ") });

  const leadCredit = image && text(options.image?.credit);
  const space = { airy: 1.25, balanced: 1, compact: 0.85 }[t.density];
  const link = readableOn(t.accent, t.bg);
  const css = `/* Focus authored page. The standalone HTML embeds this exact stylesheet.
   The editable source index.html loads styles.css. */
${fonts.css}:root {
  color-scheme: ${contrast(t.ink, "#000000") > contrast(t.ink, "#ffffff") ? "dark" : "light"};
  --bg: ${t.bg}; --surface: ${t.surface}; --ink: ${t.ink}; --muted: ${t.muted};
  --accent: ${t.accent}; --on-accent: ${t.accentInk}; --link: ${link};
  --surface-ink: ${surfaceInk}; --surface-muted: ${surfaceMuted};
  --heading: ${fonts.headingStack}; --body: ${fonts.bodyStack};
  --heading-weight: ${fonts.headingWeight};
  --radius: ${t.radius}px; --space: ${space};
  --type-small: 1rem; --type-body: 1.0625rem; --type-heading: ${Math.pow(t.scale, 2).toFixed(4)}rem;
  --type-display: ${Math.max(3.2, Math.pow(t.scale, 5.2)).toFixed(4)}rem;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-block-start: 1rem;${language === "ja" ? " line-break: strict;" : ""} }
body { margin: 0; background: var(--bg); color: var(--ink); font: 400 var(--type-body)/1.65 var(--body); }
body, button, input, textarea, select { font-size: max(16px, var(--type-body)); }
::selection { background: var(--ink); color: var(--bg); }
a { color: var(--link); text-underline-offset: .25em; }
a, summary { -webkit-tap-highlight-color: transparent; }
a:focus-visible, summary:focus-visible { outline: 3px solid var(--ink); outline-offset: 5px; }
.surface a:focus-visible, .surface summary:focus-visible { outline-color: var(--surface-ink); }
a:active { text-decoration-thickness: 2px; }
button, a, summary { touch-action: manipulation; }
img, svg { display: block; max-inline-size: 100%; block-size: auto; }
h1, h2, h3, p, blockquote { margin: 0; }
h1, h2, h3 { font-family: var(--heading); text-wrap: balance; font-weight: var(--heading-weight); }
h1, h2 { text-transform: ${t.headingCase === "uppercase" ? "uppercase" : "none"}; }
h1 { font-size: clamp(2.5rem, 5.7vw, var(--type-display)); line-height: 1.08; letter-spacing: ${t.headingCase === "uppercase" ? ".02em" : "-.035em"}; max-inline-size: 17ch; }
h2 { font-size: clamp(1.75rem, 3.2vw, ${Math.max(2.2, Math.pow(t.scale, 3.2)).toFixed(4)}rem); line-height: 1.2; letter-spacing: -.025em; }
h3 { font-size: var(--type-heading); line-height: 1.25; letter-spacing: -.015em; }
p, li, blockquote { text-wrap: pretty; }
p { max-inline-size: 65ch; }
.site-shell { max-inline-size: 1440px; padding-inline: clamp(1.25rem, 5vw, 5rem); margin-inline: auto; }
.site-header { display: flex; flex-wrap: wrap; gap: .75rem 2rem; align-items: center; justify-content: space-between; padding-block: 1.5rem; border-block-end: 1px solid var(--muted); }
.brand { display: inline-flex; gap: .7rem; align-items: center; min-block-size: 44px; min-inline-size: 44px; font-family: var(--heading); font-size: 1.375rem; font-weight: var(--heading-weight); color: var(--ink); text-decoration: none; overflow-wrap: anywhere; max-inline-size: 100%; }
.brand-mark { inline-size: 18px; block-size: 18px; border: 5px solid var(--accent); border-radius: 50%; flex-shrink: 0; }
.site-nav { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; align-items: center; }
.site-nav a, .footer-link { display: inline-flex; min-block-size: 44px; min-inline-size: 44px; align-items: center; color: var(--ink); font-size: 1rem; }
.site-nav a { text-decoration: none; }
.site-nav a:hover { text-decoration: underline; }
.skip { position: fixed; inset-block-start: .5rem; inset-inline-start: 1rem; z-index: 3; transform: translateY(-200%); padding: .75rem 1rem; background: var(--ink); color: var(--bg); }
.skip:focus { transform: none; }
.eyebrow, .section-number, .feature-number, .footer-note { font-size: 1rem; line-height: 1.5; font-variant-numeric: tabular-nums; }
.eyebrow { display: flex; align-items: center; gap: .75rem; color: var(--muted); margin-block-end: 1.75rem; }
.eyebrow::before { content: ""; inline-size: 2rem; border-block-start: 1px solid currentColor; }
.hero { padding-block: calc(4rem * var(--space)) calc(4.5rem * var(--space)); }
.hero-copy { min-inline-size: 0; }
.hero-sub { margin-block-start: 1.75rem; color: var(--muted); font-size: clamp(1.0625rem, 1.5vw, 1.25rem); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 1rem; margin-block-start: 2.25rem; }
.action { display: inline-flex; justify-content: center; align-items: center; gap: 1.25rem; min-block-size: 48px; min-inline-size: 44px; max-inline-size: 100%; padding: .8rem 1.4rem; border: 2px solid ${t.buttonStyle === "outline" || t.buttonStyle === "underline" ? "var(--link)" : "var(--accent)"}; border-radius: ${t.buttonStyle === "pill" ? "999px" : "var(--radius)"}; background: ${t.buttonStyle === "solid" || t.buttonStyle === "pill" ? "var(--accent)" : "var(--bg)"}; color: ${t.buttonStyle === "solid" || t.buttonStyle === "pill" ? "var(--on-accent)" : "var(--link)"}; text-decoration: none; line-height: 1.5; font-weight: 600; transition: box-shadow 160ms ease-out; }
.action:hover { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--ink); }
.action span:first-child { min-inline-size: 0; overflow-wrap: anywhere; }
.action-arrow { flex-shrink: 0; }
${t.buttonStyle === "underline" ? ".action { border-width: 0 0 2px; border-radius: 0; padding-inline: .25rem; }" : ""}
.visual { position: relative; min-inline-size: 0; margin: 0; background: var(--surface); color: var(--surface-ink); border-radius: var(--radius); }
.original-art { inline-size: 100%; aspect-ratio: 1; }
.owner-image { inline-size: 100%; aspect-ratio: 4/3; object-fit: ${framed?.fit ?? "cover"};${framed ? ` object-position: ${framed.position};` : ""} border-radius: var(--radius); }
.visual-caption { padding: 1rem 1.5rem; color: var(--surface-muted); font-size: 1rem; border-block-start: 1px solid var(--surface-muted); }
.studio .hero { display: grid; grid-template-columns: 1.1fr 1fr; align-items: center; gap: clamp(2rem, 6vw, 6rem); }
.studio .visual { align-self: stretch; display: grid; align-content: center; }
.section-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 2rem; align-items: start; margin-block-end: 2.5rem; }
.section-number { color: var(--muted); }
.details-section { border-block-start: 1px solid var(--muted); padding-block: calc(3.5rem * var(--space)); }
.feature-row { display: grid; grid-template-columns: 4rem minmax(0, .9fr) minmax(0, 1.3fr); gap: 1.5rem 2rem; padding-block: calc(2rem * var(--space)); border-block-start: 1px solid var(--muted); }
.feature-number { color: var(--muted); padding-block-start: .2rem; }
.feature-body { color: var(--muted); }
.detail-prose { margin-inline-start: auto; inline-size: min(100%, 65ch); color: var(--muted); }
.quote-section { margin-block: 1rem calc(4rem * var(--space)); padding: clamp(1.5rem, 5vw, 4rem); background: var(--surface); color: var(--surface-ink); border-radius: var(--radius); }
.quote-section blockquote { font-family: var(--heading); font-size: clamp(1.6rem, 3.6vw, 3rem); line-height: 1.35; max-inline-size: 36ch; }
.closing { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1.5rem 3rem; border-block-start: 1px solid var(--muted); padding-block: calc(2.5rem * var(--space)); }
.closing h2 { max-inline-size: 22ch; }
.site-footer { display: flex; flex-wrap: wrap; gap: .5rem 2rem; align-items: center; justify-content: space-between; padding-block: 1.5rem; border-block-start: 1px solid var(--muted); }
.footer-note { color: var(--muted); overflow-wrap: anywhere; max-inline-size: 100%; }
.editorial .hero { display: grid; grid-template-columns: minmax(0, .55fr) minmax(0, 1.8fr); gap: 2rem 4rem; }
.editorial .hero > .eyebrow { align-self: start; }
.editorial h1 { max-inline-size: 18ch; }
.editorial .hero .visual { grid-column: 1 / -1; margin-block-start: 1.5rem; }
.editorial .original-art { aspect-ratio: 2.4; max-block-size: 30rem; }
.editorial .owner-image { aspect-ratio: 2.1; }
.editorial .section-heading { grid-template-columns: minmax(0, .55fr) minmax(0, 1.8fr); gap: 2rem 4rem; }
.editorial .feature-list { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 4rem; }
.editorial .feature-row { display: block; padding-block: 2rem 3rem; }
.editorial .feature-row:nth-child(even) { margin-block-start: 4rem; }
.editorial .feature-number { display: block; margin-block-end: 1.25rem; }
.editorial .feature-body { margin-block-start: 1rem; }
.product .hero { text-align: center; padding-block-end: 2.5rem; }
.product .hero-copy { max-inline-size: 850px; margin-inline: auto; }
.product .eyebrow, .product .hero-actions { justify-content: center; }
.product h1, .product .hero-sub { margin-inline: auto; }
.product .hero .visual { max-inline-size: 920px; margin: 3.5rem auto 0; border: 1px solid var(--muted); }
.product .original-art { aspect-ratio: 2; max-block-size: 30rem; }
.product .owner-image { aspect-ratio: 16/9; }
.product .details-section { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 3rem; padding-block: calc(4rem * var(--space)); }
.product .section-heading { display: block; }
.product .section-number { display: block; margin-block-end: 1rem; }
.feature-disclosure { border-block-start: 1px solid var(--muted); }
.feature-disclosure:last-child { border-block-end: 1px solid var(--muted); }
.feature-disclosure summary { display: flex; align-items: baseline; gap: 1.25rem; min-block-size: 48px; padding-block: 1.5rem; cursor: pointer; list-style: none; }
.feature-disclosure summary::-webkit-details-marker { display: none; }
.feature-disclosure summary::after { content: "+"; margin-inline-start: auto; font-size: 1.5rem; flex-shrink: 0; }
.feature-disclosure[open] summary::after { content: "−"; }
.feature-disclosure summary h3 { flex: 1; }
.feature-disclosure .feature-body { padding-block-end: 1.75rem; padding-inline-start: 3rem; }
.feature-disclosure summary:hover h3 { text-decoration: underline; text-underline-offset: .2em; }
${hasStaticProductFeatures ? ".feature-static-heading { display: flex; align-items: baseline; gap: clamp(.75rem, 3vw, 1.25rem); padding-block: 1.5rem; }\n.feature-static-heading h3 { min-inline-size: 0; flex: 1; }\n" : ""}.product .quote-section { text-align: center; }
.product .quote-section blockquote { margin-inline: auto; }
.showcase .site-shell { max-inline-size: none; padding-inline: 0; }
.showcase .site-header, .showcase .hero-copy, .showcase .feature-index, .showcase .details-section, .showcase .quote-section, .showcase .closing, .showcase .site-footer { max-inline-size: 1440px; margin-inline: auto; padding-inline: clamp(1.25rem, 5vw, 5rem); }
.showcase .site-header { border-block-end: 0; }
.showcase .hero { padding-block: 0; }
.showcase .hero .visual, .showcase .owner-image { border-radius: 0; }
.showcase .owner-image { aspect-ratio: 21/9; max-block-size: 760px; }
.showcase .hero-copy { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); column-gap: clamp(2rem, 5vw, 5rem); padding-block: calc(3.5rem * var(--space)); }
.showcase .hero-copy .eyebrow { grid-column: 1 / -1; }
.showcase h1 { grid-column: 1; grid-row: 2 / span 2; max-inline-size: 17ch; }
.showcase .hero-sub { grid-column: 2; margin-block-start: 0; }
.showcase .hero-actions { grid-column: 2; align-self: start; margin-block-start: 1.75rem; }
.feature-index { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: 0 2rem; padding-block: .5rem 2rem; }
.feature-index a { display: flex; align-items: baseline; gap: .85rem; min-block-size: 52px; min-inline-size: 44px; padding-block: 1rem; border-block-start: 1px solid var(--muted); text-decoration: none; color: var(--ink); }
.feature-index a:hover span:last-child { text-decoration: underline; text-underline-offset: .25em; }
.feature-index .feature-number { flex-shrink: 0; }
.showcase .details-section { border-block-start: 0; }
.showcase .feature-row { grid-template-columns: 4rem minmax(0, 1fr) minmax(0, 1fr); }
.journal .site-header { display: flex; flex-direction: column; gap: 1.25rem; padding-block: 2rem 0; border-block-end: 3px double var(--ink); }
.journal .site-header .brand { justify-content: center; font-size: clamp(2rem, 5vw, 4.5rem); line-height: 1.1; letter-spacing: -.035em; text-align: center; }
.journal .brand-mark { display: none; }
.journal .site-nav { inline-size: 100%; justify-content: center; border-block-start: 1px solid var(--muted); padding-block: .5rem; }
.journal .hero { padding-block: calc(2.5rem * var(--space)); }
.journal-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 3rem; align-items: start; }
.journal-grid--solo { grid-template-columns: minmax(0, 1fr); }
.journal-grid--solo .journal-lead { max-inline-size: 52rem; }
.journal-lead { min-inline-size: 0; }
.journal .hero h1 { font-size: clamp(2.4rem, 4.4vw, var(--type-display)); max-inline-size: 22ch; }
.journal .hero-sub { font-size: 1.125rem; margin-block-start: 1.25rem; }
.journal .hero-actions { margin-block-start: 1.5rem; }
.journal .visual { margin-block-end: 1.75rem; border-radius: 0; }
.journal .owner-image { border-radius: 0; aspect-ratio: 16/10; }
.journal-index { min-inline-size: 0; padding-inline-start: 1.5rem; border-inline-start: 1px solid var(--muted); }
.journal-index h2 { font-size: 1.5rem; letter-spacing: -.015em; margin-block-end: 1rem; }
.journal-index nav { display: grid; }
.journal-index a { display: flex; align-items: baseline; gap: .85rem; min-block-size: 44px; min-inline-size: 44px; padding-block: 1.1rem; border-block-start: 1px solid var(--muted); color: var(--ink); text-decoration: none; }
.journal-index a:hover span:last-child { text-decoration: underline; text-underline-offset: .25em; }
.journal-index .feature-number { flex-shrink: 0; }
.journal .details-section { max-inline-size: calc(66.666666% - 2rem); padding-block: 2.5rem; }
.journal .section-heading { display: block; margin-block-end: 2rem; }
.journal .section-heading h2 { font-size: 2rem; }
.journal .section-number { display: block; margin-block-end: .75rem; }
.journal .feature-row { grid-template-columns: 2.5rem minmax(0, 1fr); column-gap: 1.25rem; row-gap: .75rem; }
.journal .feature-row .feature-body { grid-column: 2; }
.journal .quote-section { max-inline-size: calc(66.666666% - 2rem); border-radius: 0; }
${
  storyReady
    ? `.related-story { border-block-start: 1px solid var(--muted); padding-block: clamp(2rem, 5vw, 4.5rem); display: grid; align-items: center; gap: clamp(1rem, 3vw, 3rem); }
.related-story:has(figure) { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.related-story .eyebrow { margin-block-end: .65rem; }
.related-story h2 a { min-block-size: 44px; display: inline-block; max-width: 100%; }
.related-story figure { min-inline-size: 0; margin: 0; }
.related-story img { inline-size: 100%; aspect-ratio: 3/2; object-fit: ${storyFraming.fit}; object-position: ${storyFraming.position}; }
.related-story figcaption { margin-block-start: .5rem; color: var(--muted); font-size: 1rem; overflow-wrap: anywhere; }
.showcase .related-story { max-inline-size: 1440px; margin-inline: auto; padding-inline: clamp(1.25rem, 5vw, 5rem); }
@media (max-width: ${IMAGE_NARROW_BREAKPOINT}px) {
  .related-story:has(figure) { grid-template-columns: minmax(0, 1fr); }
  .related-story img { object-position: ${storyFraming.narrowPosition}; }
}
`
    : ""
}${leadCredit ? ".visual-caption { overflow-wrap: anywhere; }\n" : ""}/* Decorative texture never sits behind reading text. */
${t.texture === "grid" ? ".visual { background-image: linear-gradient(var(--surface-muted) 1px, transparent 1px), linear-gradient(90deg, var(--surface-muted) 1px, transparent 1px); background-size: 4rem 4rem; } .visual .original-art { background: var(--surface); margin: 1.25rem; inline-size: calc(100% - 2.5rem); }" : ""}
${t.texture === "grain" ? ".visual::before { content: ''; position: absolute; inset: 0; pointer-events: none; border: 1px dotted var(--surface-muted); border-radius: inherit; }" : ""}
@media (max-width: ${IMAGE_NARROW_BREAKPOINT}px) {
${framed && framed.narrowPosition !== framed.position ? `  .owner-image { object-position: ${framed.narrowPosition}; }\n` : ""}  .site-header { padding-block: 1rem; }
  .site-nav { column-gap: 1.1rem; }
  .hero, .studio .hero, .editorial .hero { grid-template-columns: minmax(0, 1fr); padding-block: 2.5rem; gap: 2rem; }
  .editorial .hero > .eyebrow { margin: 0; }
  .hero-actions { margin-block-start: 1.75rem; }
  .studio .visual { max-inline-size: 34rem; inline-size: 100%; }
  .section-heading, .editorial .section-heading { grid-template-columns: minmax(0, 1fr); gap: .75rem; }
  .feature-row { grid-template-columns: 2.25rem minmax(0, 1fr); column-gap: 1rem; }
  .feature-row .feature-body { grid-column: 2; }
  .editorial .feature-list { display: block; }
  .editorial .feature-row:nth-child(even) { margin-block-start: 0; }
  .product .details-section { grid-template-columns: minmax(0, 1fr); gap: 1rem; }
  .product .hero .visual { margin-block-start: 2.5rem; }
  .product .original-art, .editorial .original-art { aspect-ratio: 1.4; }
  .feature-disclosure .feature-body { padding-inline-start: 0; }
  .closing { align-items: start; flex-direction: column; }
  .showcase .hero-copy { display: block; padding-block: 2.5rem; }
  .showcase .hero-sub { margin-block-start: 1.5rem; }
  .showcase .hero-actions { margin-block-start: 1.75rem; }
  .showcase .owner-image { aspect-ratio: 4/3; }
  .showcase .feature-row { grid-template-columns: 2.25rem minmax(0, 1fr); }
  .journal .site-header { padding-block-start: 1.5rem; }
  .journal-grid { grid-template-columns: minmax(0, 1fr); gap: 2rem; }
  .journal-index { padding-inline-start: 0; border-inline-start: 0; border-block-start: 3px double var(--ink); padding-block-start: 1.25rem; }
  .journal .details-section, .journal .quote-section { max-inline-size: 100%; }
  .journal .hero h1 { font-size: clamp(2.15rem, 8vw, 3.5rem); }
}
@media (max-width: 380px) {
  h1 { font-size: clamp(2.15rem, 11vw, 2.6rem); }
  .site-shell { padding-inline: 1rem; }
  .site-nav { inline-size: 100%; justify-content: space-between; }
  .feature-disclosure summary { gap: .75rem; }
}
/* Text can expand and long words can wrap without clipping. */
h1, h2, h3, p, a, blockquote, summary { overflow-wrap: anywhere; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition: none; animation: none; }
}
@media (prefers-contrast: more) {
  .site-header, .details-section, .feature-row, .feature-disclosure, .closing, .site-footer { border-color: var(--ink); }
  .hero-sub, .feature-body, .section-number, .feature-number, .detail-prose, .eyebrow, .footer-note { color: var(--ink); }
}
@media (forced-colors: active) {
  .action, .visual, .quote-section { border: 1px solid CanvasText; }
  .brand-mark { border-color: CanvasText; }
  a:focus-visible, summary:focus-visible { outline-color: Highlight; }
  .original-art { forced-color-adjust: auto; }
}
${hasProductDisclosures ? PRODUCT_PRINT_CSS : ""}`;

  const actionLink = (className = "action") =>
    `<a class="${className}" href="${escape(action ?? "#details")}"><span>${escape(actionLabel)}</span><svg class="action-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><path d="M5 19 19 5M5 5h14v14"/></svg></a>`;
  const visual =
    !image && (composition === "showcase" || composition === "journal")
      ? ""
      : `<figure class="visual">${
          image
            ? `<img class="owner-image" src="${escape(image.src)}" alt="${escape(image.alt)}" width="1200" height="900" decoding="async">`
            : ornament(composition)
        }${image && text(options.image?.credit) ? `<figcaption class="visual-caption"><bdi>${escape(text(options.image?.credit))}</bdi></figcaption>` : ""}</figure>`;
  const intro = `<div class="hero-copy">${composition !== "editorial" && composition !== "journal" ? `<p class="eyebrow">${escape(brand)}</p>` : ""}<h1>${escape(headline)}</h1>${sub ? `<p class="hero-sub">${escape(sub)}</p>` : ""}${hasHeroAction ? `<div class="hero-actions">${actionLink()}</div>` : ""}</div>`;
  const featureLinks = features
    .map(
      (feature, index) =>
        `<a href="#feature-${index + 1}"><span class="feature-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span>${escape(text(feature.title) || `${labels.detail} ${index + 1}`)}</span></a>`,
    )
    .join("\n");
  const hero =
    composition === "editorial"
      ? `<section class="hero" aria-label="${labels.introduction}"><p class="eyebrow">01 / ${labels.introduction}</p>${intro}${visual}</section>`
      : composition === "showcase"
        ? `<section class="hero" aria-label="${labels.introduction}">${visual}${intro}</section>${features.length ? `<nav class="feature-index" aria-label="${labels.explorePage}">${featureLinks}</nav>` : ""}`
        : composition === "journal"
          ? `<section class="hero" aria-label="${labels.introduction}"><div class="journal-grid${features.length ? "" : " journal-grid--solo"}"><div class="journal-lead">${visual}${intro}</div>${features.length ? `<aside class="journal-index" aria-labelledby="page-index-title"><h2 id="page-index-title">${labels.contents}</h2><nav aria-labelledby="page-index-title">${featureLinks}</nav></aside>` : ""}</div></section>`
          : `<section class="hero" aria-label="${labels.introduction}">${intro}${visual}</section>`;
  const rows = features
    .map((feature, index) => {
      const number = String(index + 1).padStart(2, "0");
      const heading = text(feature.title) || `${labels.detail} ${index + 1}`;
      if (composition === "product") {
        if (!hasAuthoredFeatureDescription(feature))
          return `<section id="feature-${index + 1}" class="feature-disclosure" aria-labelledby="feature-${index + 1}-title"><div class="feature-static-heading"><span class="feature-number" aria-hidden="true">${number}</span><h3 id="feature-${index + 1}-title">${escape(heading)}</h3></div></section>`;
        return `<details id="feature-${index + 1}" class="feature-disclosure"${index === firstDescription ? " open" : ""}><summary><span class="feature-number">${number}</span><h3>${escape(heading)}</h3></summary><p class="feature-body">${escape(feature.body)}</p></details>`;
      }
      return `<section id="feature-${index + 1}" class="feature-row" tabindex="-1" aria-labelledby="feature-${index + 1}-title"><span class="feature-number" aria-hidden="true">${number}</span><h3 id="feature-${index + 1}-title">${escape(heading)}</h3>${text(feature.body) ? `<p class="feature-body">${escape(feature.body)}</p>` : ""}</section>`;
    })
    .join("\n");
  const details = hasDetails
    ? `<section id="details" class="details-section" aria-labelledby="details-title"><div class="section-heading"><span class="section-number">02 / ${labels.details}</span><h2 id="details-title">${labels.closerLook}</h2></div><div class="feature-list">${rows}</div></section>`
    : "";
  const quoteSection = quote
    ? `<section class="quote-section surface" aria-label="${labels.quotation}"><blockquote><p>${escape(quote)}</p></blockquote></section>`
    : "";
  const related = storyReady
    ? `<section class="related-story" aria-labelledby="related-story-title"><div><p class="eyebrow">${labels.related}</p><h2 id="related-story-title"><a href="${escape(storyDestination)}">${escape(storyTitle)}</a></h2></div>${storyImage && storyCredit ? `<figure><img src="${escape(storyImage.src)}" alt="${escape(storyImage.alt)}" width="720" height="480" loading="lazy" decoding="async"><figcaption>${escape(storyCredit)}</figcaption></figure>` : ""}</section>`
    : "";
  const relatedAfterIntro = story?.placement === "after-intro";
  const closing =
    action && (hasDetails || quote) && !(storyReady && !relatedAfterIntro)
      ? `<section class="closing" aria-label="${labels.nextStep}"><h2>${escape(actionLabel)}</h2>${actionLink()}</section>`
      : "";
  const navigation = hasHeroAction
    ? `<nav class="site-nav" aria-label="${labels.mainNav}">${hasDetails ? `<a href="#details">${labels.exploreDetails}</a>` : ""}${action ? `<a href="${escape(action)}">${escape(actionLabel)}</a>` : ""}</nav>`
    : "";
  const html = `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="Focus authored page">
  <meta name="description" content="${escape(sub || headline)}">
  <meta name="referrer" content="no-referrer">
  <title>${escape(brand)} — ${escape(headline)}</title>
  <style>${css}</style>
</head>
<body class="${composition}" id="top">
  <a class="skip" href="#main">${labels.skip}</a>
  <div class="site-shell">
    <header class="site-header"><a class="brand" href="#top"><span class="brand-mark" aria-hidden="true"></span>${escape(brand)}</a>${navigation}</header>
    <main id="main" tabindex="-1">${hero}${relatedAfterIntro ? related : ""}${details}${quoteSection}${relatedAfterIntro ? "" : related}${closing}</main>
    <footer class="site-footer"><span class="footer-note">${escape(brand)}</span><a class="footer-link" href="#top">${labels.top}</a></footer>
  </div>
</body>
</html>`;
  const sourceHtml = html.replace(
    `<style>${css}</style>`,
    '<link rel="stylesheet" href="./styles.css">',
  );
  const framingReadme = framed
    ? framed.fit === "contain"
      ? "\nThe whole image is centered within its layout frame. Update object-fit on\n.owner-image in styles.css to change how the image fits."
      : `\nTo adjust the crop, edit object-position on .owner-image in styles.css. The\nnarrow layout uses the media rule at ${IMAGE_NARROW_BREAKPOINT} CSS pixels or less.`
    : "";
  const sourceReadme = `FOCUS AUTHORED PAGE — EDITABLE SOURCE

Open index.html with styles.css beside it. The source HTML loads that stylesheet;
edit styles.css to change the page. Keep these two files together when hosting.

FILES AND CUSTOMER HANDOFF
- index.html: the editable page, including the supplied copy and embedded image.
- styles.css: the page's appearance; keep it beside index.html.${fonts.includedFamilies.length ? "\n- fonts/: source details and license notices for the fonts embedded in styles.css." : ""}
- focus-project.json: an archival studio snapshot for a developer. It is not an
  importable library backup. It may include earlier studio inputs and history;
  keep it private rather than uploading it to the public website.
- README.txt: these instructions.

Extract the whole ZIP before opening index.html. Send the ZIP for an editable
handoff, or the separate standalone HTML for a one-file preview. To publish this
static page, upload only index.html and styles.css to your static host. Open the
hosted address and confirm your actual links and images before sharing that URL.
No host, domain, contact service, or account is created by this download.

To continue editing in Focus on another browser or device, also use My designs
> Back up library, then My designs > Restore backup in the receiving browser.
That separate backup retains the library's designs, saved versions and images.
It can include other designs, so share it only with their intended recipient.
Keep the original backup until the restored design and its image have been checked.

To change words in this exported page, edit index.html. A supplied image is an
embedded data URL; a developer can replace its src with a local image filename,
keep an accurate alt description, and include that image file when hosting.${framingReadme}${storyReady ? "\nThe related-story section contains your reading order, story title and navigation\naddress. Preserve image descriptions, credits and any license conditions when editing." : ""}
Edits to exported files do not update the original Focus design.

The separate standalone HTML download embeds the same generated CSS. It needs
only one file and matches the initial full-page preview. Editing styles.css does
not change a previously downloaded standalone file, or your saved studio design.
Both forms are generated by the same page renderer, with the same content and CSS.

This is a static authored page with native links and disclosures, where present.
No scripts, font services, image services, accounts, or submission backend are
included. ${
    action
      ? "The action goes to the supplied destination."
      : hasDetails
        ? "Without a valid destination, the action explores this page’s supplied feature details."
        : "No action is shown because no valid destination or feature details were supplied."
  }

Composition: ${composition}${language === "ja" ? "\nPage language: Japanese (ja). Keep the html lang attribute and navigation labels in the language of the published page." : ""}
Earlier hero arrangement: ${t.heroLayout}${hasProductDisclosures ? "\n\nTo keep a paper or PDF copy, open the browser’s Print preview. Check that every\ndescription appears in order. If one is missing in your browser, open its\nsection on the page and print again." : ""}

REVIEW BEFORE PUBLISHING
${readiness.map((note) => `- ${note.message}`).join("\n")}

Check real copy, destinations, image descriptions, keyboard use, and the page on
phone and desktop. Automated checks do not establish overall usability or craft.
`;
  return {
    html,
    css,
    files: {
      "index.html": sourceHtml,
      "styles.css": css,
      "README.txt": sourceReadme,
      ...fonts.supportingFiles,
    },
    readiness,
  };
}
