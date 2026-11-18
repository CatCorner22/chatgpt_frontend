import type { Content, Direction, Tokens } from "./design";
import { normalizeTokens } from "./design";
import { createLocalDirections } from "./local-design";
import { fixContrast } from "./engine";

export type RescueSource = { url: string; excerpt: string; content: Content };
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

// Extract actual copy, never fabricate a testimonial, service or business claim.
export function rescueSource(html: string, url: string): RescueSource {
  const clean = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const title = plain(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 120);
  const headline = plain(clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? title).slice(0, 300);
  const paragraphs = [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => plain(m[1] ?? "").slice(0, 1000))
    .filter(Boolean);
  const features = [...clean.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .slice(0, 3)
    .map((m) => ({ title: plain(m[1] ?? "").slice(0, 120), body: "" }));
  const cta =
    [...clean.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((m) => plain(m[2] ?? ""))
      .find((s) => s.length > 0 && s.length < 40) ?? "";
  return {
    url,
    excerpt: plain(clean).slice(0, 6000),
    content: {
      brand: title || new URL(url).hostname,
      headline,
      sub: paragraphs[0] ?? "",
      cta,
      features,
      quote: "",
    },
  };
}

export function rescueBrief(source: RescueSource, experience: "website" | "app") {
  return `Redesign this ${experience}: ${source.url}. Preserve all existing content, routes, records, validation and working behavior. Change visual presentation only. Do not invent prices, testimonials or services.\nExisting page text (bounded excerpt, not the complete page):\n${source.excerpt}`;
}

/** Match authored looks locally; the caller keeps the extracted source copy. */
export function rescueDirections(source: RescueSource, experience: "website" | "app"): Direction[] {
  return createLocalDirections(
    source.excerpt,
    { audience: "", tone: "", experience },
    source.content.brand,
  ).directions.map((direction) => ({
    ...direction,
    tokens: fixContrast({
      ...direction.tokens,
      buttonStyle:
        direction.tokens.buttonStyle === "underline" ? "solid" : direction.tokens.buttonStyle,
    }),
  }));
}

export function rescueStudio(
  source: RescueSource,
  direction: { name: string; tokens: Tokens },
  experience: "website" | "app",
) {
  return {
    version: 2,
    integration: "existing" as const,
    stage: "rx",
    brief: rescueBrief(source, experience),
    content: source.content,
    tokens: normalizeTokens(direction.tokens),
    direction: direction.name,
    directions: [],
    stepIndex: 0,
    picks: [],
    history: [],
    cache: {},
    aiCalls: 0,
    fix: true,
    recheck: [],
    projectId: null,
    savedHash: null,
    purpose: { audience: "", tone: "", experience },
    nav: experience === "app" ? "bottom-tabs" : "top-menu",
  };
}
