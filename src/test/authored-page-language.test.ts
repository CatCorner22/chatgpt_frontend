import { describe, expect, it } from "vitest";
import { buildAuthoredPage, type PageOptions } from "@/lib/authored-page";
import { normalizeTokens, type Content } from "@/lib/design";
import { PAGE_COMPOSITIONS } from "@/lib/page-compositions";

const tokens = normalizeTokens({});
const copy: Content = {
  brand: "木と土 & Co.",
  headline: "土にふれる、小さな週末",
  sub: "Learn with Aya — 「作ってみよう」",
  cta: "日程を見る",
  features: [{ title: "", body: "持ち物はエプロンだけ。" }],
  quote: "「My first bowl!」",
};
const actionUrl = "https://example.com/classes?site=ja&day=sunday";
const image = {
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII=",
  alt: "Aya holding a green bowl",
  credit: "写真：佐藤 Aya",
};

describe.each(PAGE_COMPOSITIONS)("Japanese authored $id", ({ id: composition }) => {
  it("delivers the selected language and the owner's words in both HTML formats", () => {
    const built = buildAuthoredPage(tokens, copy, {
      composition,
      actionUrl,
      language: "ja",
      image,
      relatedStory: {
        title: "次のお話 & Notes",
        url: "https://example.com/story",
        placement: "after-intro",
      },
    });
    const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
    const standalone = parse(built.html);
    const editable = parse(built.files["index.html"]!);
    expect(editable.body.innerHTML).toBe(standalone.body.innerHTML);
    expect(editable.documentElement.lang).toBe("ja");
    expect(standalone.documentElement.lang).toBe("ja");
    expect(built.html.includes(`<style>${built.files["styles.css"]}</style>`)).toBe(true);
    expect(editable.querySelector('link[rel="stylesheet"]')?.getAttribute("href")).toBe(
      "./styles.css",
    );
    expect(built.css).toContain("line-break: strict");
    expect(standalone.title).toBe(`${copy.brand} — ${copy.headline}`);
    expect(standalone.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      copy.sub,
    );
    expect(standalone.querySelector(".site-nav")?.getAttribute("aria-label")).toBe("メイン");
    expect(standalone.querySelector(".skip")?.textContent).toBe("本文へスキップ");
    expect(standalone.querySelector(".hero")?.getAttribute("aria-label")).toBe("はじめに");
    expect(standalone.querySelector(".hero-sub")?.textContent).toBe(copy.sub);
    const primary = standalone.querySelector(
      composition === "comparison" ? ".option-comparison > .action" : ".hero .action",
    );
    expect(primary?.getAttribute("href")).toBe(actionUrl);
    expect(primary?.querySelector("span")?.textContent).toBe(copy.cta);
    expect(standalone.querySelector(".owner-image")?.getAttribute("alt")).toBe(image.alt);
    expect(standalone.querySelector("figcaption")?.textContent).toBe(image.credit);
    expect(standalone.querySelector("#feature-1 h3")?.textContent).toBe("詳細 1");
    if (composition === "comparison") {
      expect(standalone.querySelector("#details-title")?.textContent).toBe("選択肢を比較");
      expect(standalone.querySelector(".option-list li p")?.textContent).toBe(
        copy.features[0]!.body,
      );
      expect(primary?.previousElementSibling?.className).toBe("option-list");
    } else {
      expect(standalone.querySelector("#details-title")?.textContent).toBe("詳しい内容");
      expect(standalone.querySelector(".section-number")?.textContent).toBe("02 / 詳細");
      expect(standalone.querySelector(".closing")?.getAttribute("aria-label")).toBe("次のステップ");
    }
    expect(standalone.querySelector(".quote-section")?.getAttribute("aria-label")).toBe("引用");
    expect(standalone.querySelector("blockquote")?.textContent).toBe(copy.quote);
    expect(standalone.querySelector(".related-story .eyebrow")?.textContent).toBe("関連記事");
    expect(standalone.querySelector(".related-story a")?.textContent).toBe("次のお話 & Notes");
    expect(standalone.querySelector(".footer-link")?.textContent).toBe("ページの先頭へ ↑");

    if (composition === "journal") {
      expect(standalone.querySelector("#page-index-title")?.textContent).toBe("目次");
      expect(standalone.querySelector(".journal-index a")?.textContent).toContain("詳細 1");
    }
    if (composition === "showcase")
      expect(standalone.querySelector(".feature-index")?.getAttribute("aria-label")).toBe(
        "このページの目次",
      );
    if (composition === "editorial")
      expect(standalone.querySelector(".hero .eyebrow")?.textContent).toBe("01 / はじめに");
  });
});

it("localizes fallback names and only renders actions with real destinations", () => {
  const blank = { ...copy, brand: "", headline: "", cta: "" };
  const options = { composition: "studio", language: "ja", actionUrl } as const;
  const withUrl = buildAuthoredPage(tokens, blank, options);
  const local = buildAuthoredPage(tokens, blank, { ...options, actionUrl: "" });
  const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
  expect(parse(withUrl.html).querySelector("h1")?.textContent).toBe("無題のプロジェクト");
  expect(parse(withUrl.html).querySelector(".action span")?.textContent).toBe("次へ");
  const link = parse(local.html).querySelector(".action");
  expect(link?.textContent).toBe("詳しく見る");
  expect(link?.getAttribute("href")).toBe("#details");
  expect(local.readiness.map((note) => note.id)).toContain("brand");
});

it("defaults old and unrecognized language preferences to the same English export", () => {
  const options = { composition: "studio", actionUrl } as const;
  const legacy = buildAuthoredPage(tokens, copy, options);
  for (const language of ["en", "fr", 'ja" dir="rtl'] as NonNullable<PageOptions["language"]>[]) {
    const result = buildAuthoredPage(tokens, copy, { ...options, language });
    expect(result).toEqual(legacy);
  }
  expect(legacy.html).toContain('<html lang="en">');
  expect(legacy.html).toContain("Skip to content");
  expect(legacy.css).not.toContain("line-break: strict");
});
