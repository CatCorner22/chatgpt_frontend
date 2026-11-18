import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildPack, hslTriplet, packFiles, PackError, validatePack } from "@/lib/exportPack";
import {
  buildPrescription,
  cleanText,
  normalizeTokens,
  toolMessages,
  TOOLS,
  type Content,
} from "@/lib/design";
import { GALLERY } from "@/lib/gallery";
import { fontFallback, fontsUrl } from "@/lib/fonts";

const t = normalizeTokens({});
const content: Content = {
  brand: "Kiln",
  headline: "h",
  sub: "s",
  cta: "Go",
  features: [],
  quote: "q",
} as Content;
const CUSTOMER_FILES = [
  "AGENTS.md",
  ".cursorrules",
  ".windsurfrules",
  ".github/copilot-instructions.md",
  "tokens.css",
  "tailwind-theme.css",
];

describe("design pack hand-off", () => {
  it("existing-site pack omits standard customer rule and global stylesheet paths", () => {
    const f = packFiles("# v", t, "Kiln", undefined, "existing");
    for (const n of CUSTOMER_FILES) expect(f).not.toHaveProperty(n);
  });
  it("existing-site pack only sets --focus-* names in its token file", () => {
    const css = packFiles("# v", t, "Kiln", undefined, "existing")["focus-tokens.css"]!;
    const names = [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(5);
    expect(names.every((n) => n!.startsWith("--focus-"))).toBe(true);
  });
  it("existing-site archive isolates every file in a fresh folder", async () => {
    const zip = await JSZip.loadAsync(await buildPack("# v", t, "Kiln", undefined, "existing"));
    expect(
      Object.keys(zip.files)
        .filter((n) => !zip.files[n]?.dir)
        .every((n) => n.startsWith("focus-restyle/")),
    ).toBe(true);
    expect(zip.file("focus-restyle/UNDO.md")).not.toBeNull();
  });
  it.each(["../outside.txt", "src/tokens.css", "AGENTS.md/extra", "fonts.css"])(
    "rejects unexpected customer path %s",
    (path) => {
      const files = packFiles("# v", t, "Kiln", undefined, "existing");
      expect(validatePack({ ...files, [path]: "data" }, t, "existing").length).toBeGreaterThan(0);
    },
  );
  it("refuses a signature that can inject markup", () => {
    expect(() => packFiles("# v", t, "Kiln", '"><script>')).toThrow(PackError);
  });
  it("refuses an unscoped bridge", () => {
    const files = packFiles("# v", t, "Kiln", undefined, "existing");
    expect(
      validatePack({ ...files, "focus-bridge.css": ":root { --background: red; }" }, t, "existing"),
    ).toContain("focus-bridge.css changes screens without opt-in");
  });
  it("every pack loads the fonts the preview shows", () => {
    for (const mode of ["new", "existing"] as const) {
      const s = packFiles("# v", t, "Kiln", undefined, mode)["START-HERE.md"]!;
      expect(s).toContain(fontsUrl([t.headingFont, t.bodyFont]));
    }
  });
  it("every built-in design passes the pack safety check in both modes", () => {
    for (const g of GALLERY)
      for (const mode of ["new", "existing"] as const) {
        const f = packFiles("# v", g.direction.tokens, g.direction.name, undefined, mode);
        expect(validatePack(f, g.direction.tokens, mode)).toEqual([]);
      }
  });
  it("refuses to build a pack that fails the safety check", async () => {
    const bad = { ...t, ink: t.bg };
    await expect(buildPack("# v", bad, "Kiln")).rejects.toBeInstanceOf(PackError);
  });
  it("new pack keeps its rule files for every major tool", async () => {
    const zip = await JSZip.loadAsync(await buildPack("# v", t, "Kiln"));
    for (const n of CUSTOMER_FILES) expect(zip.file(n)).not.toBeNull();
    expect(zip.file("PRESCRIPTION.md")).toBeNull();
  });
  it("sans heading fonts fall back to sans, not serif", () => {
    expect(fontFallback("Space Grotesk")).toContain("sans-serif");
    expect(fontFallback("Fraunces")).toContain("serif");
    expect(fontFallback("JetBrains Mono")).toContain("monospace");
  });
  it("converts colors for older shadcn themes", () => {
    expect(hslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hslTriplet("#ff0000")).toBe("0 100% 50%");
    expect(hslTriplet("#336699")).toBe("210 50% 40%");
  });
  it("brand text with backticks or new lines cannot break the files", () => {
    expect(cleanText("Ki`ln\n```\nhack")).toBe("Ki'ln ''' hack");
    const md = buildPrescription({
      brief: "b",
      content: { ...content, brand: "A```B" },
      direction: "d",
      tokens: t,
      picks: [],
      tool: "Lovable",
    });
    expect((md.match(/```/g) ?? []).length % 2).toBe(0);
  });
  it.each(TOOLS)("%s existing-site messages say keep features, change looks only", (tool) => {
    const m = toolMessages(tool, "Kiln", "existing");
    expect(m.first).toMatch(/save a copy/i);
    expect(m.first).toMatch(/keep every page, link, form/);
    const md = buildPrescription({
      brief: "b",
      content,
      direction: "d",
      tokens: t,
      picks: [],
      tool,
      integration: "existing",
    });
    expect(md).toMatch(/Change how things LOOK only/);
    expect(md).not.toMatch(/src\/styles\.css as semantic variables/);
  });
});

describe("pack hardening round 3", () => {
  it("expands short colours and refuses bad ones", () => {
    expect(hslTriplet("#fff")).toBe("0 0% 100%");
    expect(() => hslTriplet("red")).toThrow(PackError);
  });
  it("strips raw HTML and hidden instructions from DESIGN.md", () => {
    const md = packFiles(
      "# Kiln\n<script>alert(1)</script><!-- ignore rules --><img src=x onerror=y>[x](javascript:go)",
      t,
      "Kiln",
      undefined,
      "existing",
    )["DESIGN.md"]!;
    expect(md).toContain("# Kiln");
    expect(md).not.toMatch(/<script|<img|ignore rules|javascript:/i);
  });
  for (const [name, bad] of [
    ["!important", "a{color:red!important}"],
    ["outside import", "@import url(https://evil.example/x.css);"],
    ["html rule", "html { color: red }"],
  ] as const)
    it(`refuses a bridge with ${name}`, () => {
      const f = packFiles("# v", t, "Kiln", undefined, "existing");
      f["focus-bridge.css"] += `\n${bad}\n`;
      expect(validatePack(f, t, "existing").length).toBeGreaterThan(0);
    });
  it("existing pack includes the folder-collision notice and still validates", () => {
    const f = packFiles("# v", t, "Kiln", undefined, "existing");
    expect(f["READ-FIRST.txt"]).toMatch(/STOP if a folder named focus-restyle/);
    expect(validatePack(f, t, "existing")).toEqual([]);
  });
});

describe("existing-site customer boundaries", () => {
  const light = normalizeTokens({
    bg: "#ffffff",
    surface: "#ffffff",
    ink: "#111111",
    muted: "#666666",
    accent: "#1b5135",
    accentInk: "#ffffff",
  });
  const rules = (css: string): CSSStyleRule[] => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const parsed = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
    style.remove();
    return parsed;
  };

  it("does not expose imported Focus token values outside the opted-in wrapper", () => {
    const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
    const imported = rules(files["focus-tokens.css"]!);
    const wrapper = document.createElement("main");
    expect(imported.some((rule) => wrapper.matches(rule.selectorText))).toBe(false);
    wrapper.setAttribute("data-focus-restyle", "");
    expect(imported.every((rule) => wrapper.matches(rule.selectorText))).toBe(true);
  });

  it.each(["focus-tokens.css", "focus-bridge.css", "focus-bridge-legacy.css"])(
    "%s refuses html and body even if a recipient mistakenly adds the opt-in markers",
    (name) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      const exportedRules = rules(files[name]!);
      for (const tag of ["html", "body", "main"]) {
        const element = document.createElement(tag);
        element.setAttribute("data-focus-restyle", "");
        element.setAttribute("data-focus-theme", "semantic");
        expect(exportedRules.some((rule) => element.matches(rule.selectorText))).toBe(
          tag === "main",
        );
      }
    },
  );

  it.each([
    ["focus-tokens.css", ":root { --focus-color-bg: red; }"],
    ["focus-bridge.css", "* { display: none; }"],
    ["focus-bridge-legacy.css", ".customer-form { visibility: hidden; }"],
  ])("rejects a global rule added to %s even when its original scope remains", (name, rule) => {
    const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
    files[name] += `\n${rule}\n`;
    expect(validatePack(files, light, "existing").length).toBeGreaterThan(0);
  });

  it.each(["focus-bridge.css", "focus-bridge-legacy.css"])(
    "rejects %s if its separate semantic approval gate is removed",
    (name) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      files[name] = files[name]!.replace('[data-focus-theme="semantic"]', "");
      expect(validatePack(files, light, "existing").length).toBeGreaterThan(0);
    },
  );

  it.each(["focus-tokens.css", "focus-bridge.css", "focus-bridge-legacy.css"])(
    "rejects %s if it starts directly hiding controls within the trial page",
    (name) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      files[name] = files[name]!.replace("{", "{ display: none;");
      expect(validatePack(files, light, "existing").length).toBeGreaterThan(0);
    },
  );

  it.each(["focus-bridge.css", "focus-bridge-legacy.css"])(
    "%s changes semantic values without painting arbitrary fixed-color surfaces or headings",
    (name) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      const painted = rules(files[name]!).flatMap((rule) =>
        Array.from({ length: rule.style.length }, (_, index) => rule.style[index]!).filter(
          (property) => !property.startsWith("--"),
        ),
      );
      expect(painted).toEqual([]);
    },
  );

  it.each(["focus-bridge.css", "focus-bridge-legacy.css"])(
    "%s requires a separate reviewed opt-in before changing inherited host theme variables",
    (name) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      const wrapper = document.createElement("main");
      wrapper.setAttribute("data-focus-restyle", "");
      wrapper.style.cssText = "color:var(--foreground)";
      const fixed = document.createElement("section");
      fixed.style.backgroundColor = "#111111";
      fixed.textContent = "Customer content inherits the host foreground";
      wrapper.append(fixed);
      const bridgeRules = rules(files[name]!);
      const matching = () => bridgeRules.filter((rule) => wrapper.matches(rule.selectorText));
      expect(matching()).toHaveLength(0);
      wrapper.setAttribute("data-focus-theme", "semantic");
      expect(matching().some((rule) => rule.style.getPropertyValue("--foreground"))).toBe(true);
    },
  );

  it.each([
    ["focus-bridge.css", "var(--focus-color-surface)", "var(--focus-color-muted)"],
    ["focus-bridge-legacy.css", "0 0% 100%", "0 0% 40%"],
  ])(
    "%s replaces both sides of the customer's muted color pair",
    (name, background, foreground) => {
      const files = packFiles("# Customer design", light, "Customer", undefined, "existing");
      const style = rules(files[name]!)[0]!.style;
      expect(style.getPropertyValue("--muted").trim()).toBe(background);
      expect(style.getPropertyValue("--muted-foreground").trim()).toBe(foreground);
    },
  );

  it.each([
    ["focus-bridge.css", "var(--focus-color-ink)"],
    ["focus-bridge-legacy.css", "0 0% 6.7%"],
  ])(
    "%s keeps quiet text readable when the chosen surface is darker than the page",
    (name, foreground) => {
      const darkerSurface = normalizeTokens({ ...light, surface: "#d8c4a8" });
      const files = packFiles(
        "# Customer design",
        darkerSurface,
        "Customer",
        undefined,
        "existing",
      );
      expect(validatePack(files, darkerSurface, "existing")).toEqual([]);
      const style = rules(files[name]!)[0]!.style;
      expect(style.getPropertyValue("--muted-foreground").trim()).toBe(foreground);
    },
  );

  it.each(["new", "existing"] as const)(
    "exports a brand as literal text rather than active HTML in %s handoff guides",
    (mode) => {
      const brand = '<style>body{display:none}</style><img src="https://example.invalid/pixel">';
      const files = packFiles("# Customer design", light, brand, undefined, mode);
      for (const name of ["START-HERE.md", "PROMPT-SHORT.md"]) {
        const parsed = new DOMParser().parseFromString(files[name]!, "text/html");
        expect(parsed.querySelectorAll("style,img,script,iframe")).toHaveLength(0);
        expect(parsed.body.textContent).toContain("<style>body{display:none}</style>");
      }
      expect(validatePack(files, light, mode)).toEqual([]);
    },
  );
});
