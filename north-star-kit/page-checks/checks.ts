import type { Finding } from "../types";

/** Native media only. Script-started media and advancing carousels need observation. */
export function checkAutoplay(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const media = Array.from(page.querySelectorAll("audio[autoplay], video[autoplay]"));
    if (!media.length)
      return [
        {
          ruleId: "floor-no-autoplay",
          status: "could-not-measure",
          measured:
            "No native autoplay attribute found; script-started media and carousels were not observed.",
          required: "No media or carousel starts without a request.",
        },
      ];
    return media.map((el, index) => ({
      ruleId: "floor-no-autoplay",
      status: "fails",
      where: el.id
        ? `#${reportText(el.id)}`
        : `${el.tagName.toLowerCase()}[autoplay] (${index + 1})`,
      measured: "Native autoplay attribute present",
      required: "Playback starts on request",
      fix: "Remove autoplay and offer a visible play control.",
    }));
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "floor-no-autoplay",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** A visible associated label, not just an accessible name, is this check's scope. */
export function checkVisibleLabels(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "floor-visible-labels",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const visible = (el: Element) => {
      if (!Array.from(el.getClientRects()).some((rect) => rect.width > 1 && rect.height > 1))
        return false;
      let ancestor: Element | null = el;
      while (ancestor) {
        const style = view.getComputedStyle(ancestor);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          style.clipPath === "inset(50%)" ||
          /rect\(0px,? 0px,? 0px,? 0px\)/.test(style.clip)
        )
          return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    };
    const fields = Array.from(
      page.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]), select, textarea',
      ),
    ).filter(visible);
    if (!fields.length)
      return [
        {
          ruleId: "floor-visible-labels",
          status: "not-applicable",
          measured: "No visible native form fields.",
        },
      ];
    return fields.map((field, index) => {
      const labels: Element[] = [
        ...Array.from(field.labels ?? []),
        ...(field.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .filter(Boolean)
          .map((id) => page.getElementById(id))
          .filter((el): el is HTMLElement => !!el),
      ];
      const label = labels.find((el) => visible(el) && !!el.textContent?.trim());
      return {
        ruleId: "floor-visible-labels",
        status: label ? "holds" : "fails",
        where: field.id ? `#${reportText(field.id)}` : `field ${index + 1}`,
        measured: label
          ? "Visible associated text label found"
          : "No visible associated text label found",
        required: "A visible label associated with each field",
        fix: label ? "" : "Add a persistent visible label and associate it with this field.",
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "floor-visible-labels",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** Reports only the current viewport. The caller must repeat at 320px and 200% zoom. */
export function checkReflow(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view || !page.documentElement.clientWidth)
      return [
        {
          ruleId: "floor-reflow",
          status: "could-not-measure",
          measured: "A layout-capable browsing context is required.",
        },
      ];
    const width = page.documentElement.clientWidth;
    const scroll = Math.max(page.documentElement.scrollWidth, page.body?.scrollWidth ?? 0);
    if (scroll > width + 1)
      return [
        {
          ruleId: "floor-reflow",
          status: "fails",
          where: "page",
          measured: `${scroll}px content at ${width}px viewport`,
          required: "No horizontal page overflow",
          fix: "Constrain the overflowing content to the viewport and retest without hiding it.",
        },
      ];
    const clipped: Finding[] = [];
    for (const element of Array.from(page.querySelectorAll("body *"))) {
      if (clipped.length >= 20) break;
      if (element.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      const rect = element.getBoundingClientRect();
      const style = view.getComputedStyle(element);
      if (
        rect.width <= 1 ||
        rect.height <= 1 ||
        style.visibility !== "visible" ||
        style.opacity === "0"
      )
        continue;
      const meaningful =
        /^(INPUT|SELECT|TEXTAREA|BUTTON|IMG)$/.test(element.tagName) ||
        Array.from(element.childNodes).some(
          (node) => node.nodeType === 3 && !!node.textContent?.trim(),
        );
      if (!meaningful || (rect.left >= -1 && rect.right <= width + 1)) continue;
      let ancestor = element.parentElement;
      while (ancestor) {
        const ancestorStyle = view.getComputedStyle(ancestor);
        const box = ancestor.getBoundingClientRect();
        if (
          ["auto", "scroll"].includes(ancestorStyle.overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth + 1
        )
          break;
        if (
          ["hidden", "clip"].includes(ancestorStyle.overflowX) &&
          (rect.right > Math.min(width, box.right) + 1 || rect.left < Math.max(0, box.left) - 1)
        ) {
          clipped.push({
            ruleId: "floor-reflow",
            status: "fails",
            where: element.id
              ? `#${reportText(element.id)}`
              : `${element.tagName.toLowerCase()} beyond a clipped edge`,
            measured: `Meaningful content from ${rect.left.toFixed(1)}px to ${rect.right.toFixed(1)}px is clipped at the ${width}px viewport.`,
            required: "Content remains reachable without hiding overflow.",
            fix: "Reflow this content or give the wide data region an operable scrolling control instead of clipping it.",
          });
          break;
        }
        ancestor = ancestor.parentElement;
      }
    }
    if (clipped.length) return clipped;
    return [
      {
        ruleId: "floor-reflow",
        status: "could-not-measure",
        where: "page",
        measured: `No horizontal overflow at ${width}px; zoom and lost content still require a browser walk.`,
        required: "Reflow at 320 CSS px and 200% zoom with all content available.",
      },
    ];
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "floor-reflow",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** A strict project target-size rule. Inline and spacing exceptions are not assessed. */
export function checkTargetSize(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "floor-target-size",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const elements = Array.from(
      page.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="switch"], [role="tab"]',
      ),
    ).filter((el) => {
      const s = view.getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length > 0;
    });
    if (!elements.length)
      return [
        {
          ruleId: "floor-target-size",
          status: "not-applicable",
          measured: "No visible pointer controls.",
        },
      ];
    return elements.map((el, index) => {
      const rect = el.getBoundingClientRect();
      const holds = rect.width >= 24 && rect.height >= 24;
      return {
        ruleId: "floor-target-size",
        status: holds ? "holds" : "fails",
        where: el.id ? `#${reportText(el.id)}` : `control ${index + 1}`,
        measured: `${rect.width.toFixed(1)} × ${rect.height.toFixed(1)} CSS px`,
        required: "24 × 24 CSS px (strict project floor)",
        fix: holds ? "" : "Increase this control’s hit area to at least 24 by 24 CSS pixels.",
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "floor-target-size",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** Reserves image space; visual distortion and decorative intent still need review. */
export function checkImages(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const images = Array.from(page.querySelectorAll("img"));
    if (!images.length)
      return [
        { ruleId: "craft-image-dimensions", status: "not-applicable", measured: "No images." },
      ];
    return images.map((el, index) => {
      const width = Number(el.getAttribute("width"));
      const height = Number(el.getAttribute("height"));
      const reserved = width > 0 && height > 0;
      const alternative = el.hasAttribute("alt");
      const holds = reserved && alternative;
      return {
        ruleId: "craft-image-dimensions",
        status: holds ? "holds" : "fails",
        where: el.id ? `#${reportText(el.id)}` : `image ${index + 1}`,
        measured: `Width/height attributes: ${reserved ? `${width} × ${height}` : "missing or invalid"}; alt attribute: ${alternative ? "present" : "missing"}`,
        required: "Positive intrinsic dimensions and an alt attribute",
        fix: holds
          ? ""
          : "Set this image’s intrinsic width and height, and provide appropriate alt text (empty for decoration).",
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "craft-image-dimensions",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** Heuristic warning: quoted examples may legitimately contain these phrases. */
export function checkPlaceholderCopy(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    // Kept inside the function so the browser can run it without a module closure.
    const phrases = [
      "lorem ipsum",
      "your tagline here",
      "your headline here",
      "your business",
      "your company",
      "empower your workflow",
      "insert text here",
      "placeholder text",
      "john doe",
      "jane doe",
    ];
    const findings: Finding[] = [];
    const walk = (node: Node) => {
      if (
        node.nodeType === 1 &&
        /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test((node as Element).tagName)
      )
        return;
      if (node.nodeType === 3) {
        const content = node.textContent ?? "";
        const normalized = content.toLowerCase().replace(/\s+/g, " ").trim();
        const hit = phrases.find((phrase) => {
          if (phrase !== "your company" && phrase !== "your business")
            return normalized.includes(phrase);
          // Inline fragments must be judged in their whole prose block.
          const block = node.parentElement?.closest(
            "p, li, h1, h2, h3, h4, h5, h6, label, td, th, blockquote, div",
          );
          const text = (block?.textContent ?? content).toLowerCase().replace(/\s+/g, " ").trim();
          const label = text
            .replace(/^[[\]{}()<>"'“”‘’]+/, "")
            .replace(/[[\]{}()<>"'“”‘’.!?]+$/, "")
            .trim();
          return [phrase, `${phrase} name`, `${phrase} here`, `${phrase} name here`].includes(
            label,
          );
        });
        if (hit) {
          const el = node.parentElement;
          findings.push({
            ruleId: "tells-placeholder-copy",
            status: "fails",
            where: el?.id ? `#${reportText(el.id)}` : (el?.tagName.toLowerCase() ?? "text node"),
            measured: reportText(content, 160),
            required: "Specific, reviewed content",
            fix: "Replace this stock phrase with the owner’s real words, or explain why it belongs here.",
          });
        }
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    };
    if (page.body) walk(page.body);
    return findings.length
      ? findings
      : [
          {
            ruleId: "tells-placeholder-copy",
            status: "holds",
            measured: "No phrase from the small placeholder list found.",
            required: "Specific, reviewed content",
          },
        ];
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "tells-placeholder-copy",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** Only numeric table cells and explicitly marked counters are in scope. */
export function checkTabularNumbers(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "craft-tabular-numerals",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const elements = Array.from(page.querySelectorAll("td, th, [data-counter]")).filter(
      (el) => /\d/.test(el.textContent ?? "") && el.getClientRects().length > 0,
    );
    if (!elements.length)
      return [
        {
          ruleId: "craft-tabular-numerals",
          status: "not-applicable",
          measured: "No numeric table cells or marked counters.",
        },
      ];
    return elements.map((el, index) => {
      const s = view.getComputedStyle(el);
      const declared =
        s.fontVariantNumeric.includes("tabular-nums") ||
        /["']tnum["'](?:\s+(?:1|on))?/.test(s.fontFeatureSettings);
      return {
        ruleId: "craft-tabular-numerals",
        status: declared ? "holds" : "fails",
        where: el.id ? `#${reportText(el.id)}` : `numeric cell ${index + 1}`,
        measured: `font-variant-numeric: ${s.fontVariantNumeric}; font-feature-settings: ${s.fontFeatureSettings}`,
        required: "An explicit tabular-numeral request (font support remains a visual check)",
        fix: declared ? "" : "Request tabular numerals for aligned numeric values.",
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "craft-tabular-numerals",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

export function checkTextWrapping(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "craft-text-wrap",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const elements = Array.from(page.querySelectorAll("h1, h2, h3, h4, h5, h6, p")).filter(
      (el) => el.getClientRects().length > 0 && !!el.textContent?.trim(),
    );
    if (!elements.length)
      return [
        {
          ruleId: "craft-text-wrap",
          status: "not-applicable",
          measured: "No visible headings or paragraphs.",
        },
      ];
    return elements.map((el, index) => {
      const expected = /^H[1-6]$/.test(el.tagName) ? "balance" : "pretty";
      const s = view.getComputedStyle(el);
      const actual = s.getPropertyValue("text-wrap-style") || s.getPropertyValue("text-wrap");
      return {
        ruleId: "craft-text-wrap",
        status: !actual ? "could-not-measure" : actual.includes(expected) ? "holds" : "fails",
        where: el.id ? `#${reportText(el.id)}` : `${el.tagName.toLowerCase()} ${index + 1}`,
        measured: actual || "This browser does not expose text wrapping style.",
        required: `text-wrap: ${expected}`,
        fix: actual.includes(expected)
          ? ""
          : `Use text-wrap: ${expected} for this text block, then inspect its line endings.`,
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "craft-text-wrap",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

export function checkJustification(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "neuro-no-justification",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const elements = Array.from(page.querySelectorAll("p, li, blockquote, dd, dt")).filter(
      (el) => el.getClientRects().length > 0 && !!el.textContent?.trim(),
    );
    const bad = elements.filter((el) => view.getComputedStyle(el).textAlign === "justify");
    return bad.length
      ? bad.map((el, index) => ({
          ruleId: "neuro-no-justification",
          status: "fails",
          where: el.id ? `#${reportText(el.id)}` : `text block ${index + 1}`,
          measured: "text-align: justify",
          required: "Natural word spacing with one ragged edge",
          fix: "Use start alignment instead of justified text.",
        }))
      : [
          {
            ruleId: "neuro-no-justification",
            status: elements.length ? "holds" : "not-applicable",
            measured: elements.length
              ? "No justified prose blocks found."
              : "No visible prose blocks.",
          },
        ];
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "neuro-no-justification",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}

/** Limited to opaque sRGB text over uniform opaque sRGB backgrounds. */
export function checkTextContrast(page: Document): Finding[] {
  const inspect = (): Finding[] => {
    const reportText = (value: string, limit = 239) =>
      value
        .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    const view = page.defaultView;
    if (!view)
      return [
        {
          ruleId: "floor-text-contrast",
          status: "could-not-measure",
          measured: "No rendered browsing context.",
        },
      ];
    const rgb = (color: string): number[] | null => {
      const match = color.match(
        /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
      );
      if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const luminance = (color: number[]) =>
      color
        .map((v) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const nodes = Array.from(page.querySelectorAll("body *")).filter(
      (el) =>
        !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName) &&
        el.getClientRects().length > 0 &&
        Array.from(el.childNodes).some((n) => n.nodeType === 3 && !!n.textContent?.trim()),
    );
    if (!nodes.length)
      return [
        {
          ruleId: "floor-text-contrast",
          status: "not-applicable",
          measured: "No visible text nodes.",
        },
      ];
    return nodes.map((el, index) => {
      const style = view.getComputedStyle(el);
      const foreground = rgb(style.color);
      let background: number[] | null = null;
      let unsupported = false;
      let ancestor: Element | null = el;
      while (ancestor) {
        const s = view.getComputedStyle(ancestor);
        if (
          s.backgroundImage !== "none" ||
          Number(s.opacity) < 1 ||
          s.filter !== "none" ||
          s.mixBlendMode !== "normal"
        )
          unsupported = true;
        if (!background) {
          const color = s.backgroundColor;
          // Transparent pixels contribute no color, regardless of their RGB channels.
          // Forced colors may serialize a transparent surface as white with alpha zero.
          const rgba = color.match(
            /^rgba?\(\s*[\d.]+[, ]+[\d.]+[, ]+[\d.]+\s*[,/]\s*([\d.]+)\s*\)$/,
          );
          const fullyTransparent =
            color === "transparent" || (rgba !== null && Number(rgba[1]) === 0);
          if (!fullyTransparent) {
            background = rgb(color);
            if (!background) unsupported = true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      const where = el.id ? `#${reportText(el.id)}` : `text element ${index + 1}`;
      if (unsupported || !foreground || !background)
        return {
          ruleId: "floor-text-contrast",
          status: "could-not-measure",
          where,
          measured:
            "Text or backdrop uses unsupported compositing/color, or has no explicit opaque background.",
          required: "Measure the final rendered text and backdrop.",
        };
      const a = luminance(foreground),
        b = luminance(background);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const weight = Number.parseFloat(style.fontWeight);
      const required = size >= 24 || (size >= 18.6667 && weight >= 700) ? 3 : 4.5;
      return {
        ruleId: "floor-text-contrast",
        status: ratio >= required ? "holds" : "fails",
        where,
        measured: `${ratio.toFixed(3)}:1 (comparison uses full precision)`,
        required: `${required}:1`,
        fix:
          ratio >= required
            ? ""
            : "Adjust the text or its background until the required contrast ratio is met.",
      };
    });
  };
  const findings = inspect();
  const boundaries =
    typeof page.querySelectorAll === "function"
      ? Array.from(page.querySelectorAll("*")).filter(
          (element) =>
            element.tagName === "IFRAME" ||
            element.tagName === "FRAME" ||
            !!element.shadowRoot ||
            String(element.tagName ?? "").includes("-"),
        )
      : [];
  if (boundaries.length)
    findings.push({
      ruleId: "floor-text-contrast",
      status: "could-not-measure",
      where: "Embedded content",
      measured:
        "Frames, open shadow roots, or custom elements may contain content outside this document-only check.",
      required:
        "Inspect each embedded document and component; closed shadow content cannot be reliably enumerated through the standard DOM.",
    });
  return findings;
}
