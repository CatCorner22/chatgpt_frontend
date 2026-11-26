import { archiveDesign, readLibrary, writeLibrary } from "@/lib/library";
import { EMPTY, migrate } from "@/lib/studio-state";
import { packFiles } from "@/lib/exportPack";
import { describe, expect, it } from "vitest";
import { normalizeTokens, contrast } from "@/lib/design";
import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import { buildAuthoredPage } from "@/lib/authored-page";
import { DEFAULT_IMAGE_FRAMING, IMAGE_POSITIONS } from "@/lib/image-framing";
import {
  STRATOSPHERE_GROUPS,
  evaluateStratosphereForm,
  deriveStratosphereGraph,
  evaluateStratosphereCandidate,
  selectedStratosphereOption,
  type StratosphereInput,
} from "@/lib/stratosphere";

function input(): StratosphereInput {
  return {
    tokens: normalizeTokens({
      bg: "#ffffff",
      surface: "#eef4fa",
      ink: "#17202b",
      muted: "#475569",
      accent: "#1d4ed8",
      accentInk: "#ffffff",
      headingFont: "DM Serif Display",
      bodyFont: "Karla",
      scale: 1.22,
      radius: 6,
      density: "balanced",
      heroLayout: "split",
      buttonStyle: "solid",
      texture: "none",
    }),
    page: {
      ...DEFAULT_PAGE_SETTINGS,
      actionUrl: "https://example.test/book",
      imageAlt: "Owner words",
    },
    purpose: { audience: "general public", tone: "", experience: "website" },
    integration: "new",
    nav: "top-menu",
  };
}
const content = {
  brand: "Real studio",
  headline: "A considered first page",
  sub: "Words supplied by the owner.",
  cta: "Book a visit",
  features: [{ title: "Useful service", body: "A clear description." }],
  quote: "",
};

describe("Stratosphere transitions", () => {
  it.each(["solid", "outline", "pill", "underline"] as const)(
    "keeps custom %s controls through save/reopen and both delivery formats",
    (style) => {
      for (const radius of [0, 7, 28]) {
        const before = input();
        const shaped = evaluateStratosphereForm(before, "buttonStyle", style);
        expect(shaped.accepted).toBe(true);
        const rounded = evaluateStratosphereForm(
          { ...before, tokens: shaped.tokens },
          "radius",
          radius,
        );
        expect(rounded.accepted).toBe(true);
        const records = new Map<string, string>();
        const storage = {
          getItem: (key: string) => records.get(key) ?? null,
          setItem: (key: string, value: string) => {
            records.set(key, value);
          },
        };
        const saved = {
          ...EMPTY,
          ...before,
          content,
          tokens: rounded.tokens,
          libraryId: "custom-controls",
        };
        writeLibrary(archiveDesign([], saved, "2026-11-19T00:00:00Z"), storage);
        const restored = migrate(readLibrary(storage)[0]!.state);
        expect(restored.tokens).toEqual(rounded.tokens);
        expect(restored.page.actionUrl).toBe(before.page.actionUrl);
        expect(restored.content).toEqual(content);
        const built = buildAuthoredPage(restored.tokens!, restored.content!, restored.page);
        expect(built.files["styles.css"]).toBe(built.css);
        expect(built.html).toContain(built.css);
        expect(built.html).toContain('href="https://example.test/book"');
        expect(built.css).toContain(`--radius: ${radius}px`);
        expect(built.css).toContain(
          `border-radius: ${style === "pill" ? "999px" : "var(--radius)"}`,
        );
        if (style === "underline")
          expect(built.css).toContain("border-width: 0 0 2px; border-radius: 0");
        const pack = packFiles(
          "# Owner's design",
          restored.tokens!,
          "Owner",
          undefined,
          "existing",
        );
        expect(JSON.parse(pack["tokens.json"]!)).toEqual(restored.tokens);
        expect(pack["PROMPT-SHORT.md"]).toContain(`Preferred action treatment: ${style}`);
        expect(pack["PROMPT-SHORT.md"]).toContain("handler and states unchanged");
        expect(
          deriveStratosphereGraph({ ...before, tokens: restored.tokens! }).snapshot.tokens.radius,
        ).toBe(radius);
      }
    },
  );

  it.each([-1, 29, 1.5, NaN, Infinity])(
    "refuses unsupported custom radius %s without changing the input",
    (radius) => {
      const before = input();
      const result = evaluateStratosphereForm(before, "radius", radius);
      expect(result.accepted).toBe(false);
      expect(result.tokens).toBe(before.tokens);
      expect(result.page).toBe(before.page);
    },
  );

  it("preserves other choices and enforces existing contrast guards for custom controls", () => {
    const before = input();
    const changed = evaluateStratosphereForm(before, "radius", 13);
    expect(changed.changedFields).toEqual(["tokens.radius"]);
    expect(changed.tokens).toEqual({ ...before.tokens, radius: 13 });
    expect(changed.page).toEqual(before.page);
    expect(evaluateStratosphereForm(before, "buttonStyle", "unsupported").accepted).toBe(false);
    const lowContrast = {
      ...before,
      tokens: { ...before.tokens, accentInk: before.tokens.accent },
    };
    expect(evaluateStratosphereForm(lowContrast, "radius", 13).accepted).toBe(false);
  });

  it.each([
    ["card", "mirror"],
    ["buttonFinish", "laser"],
    ["accent2", "not-a-color"],
    ["scale", Number.POSITIVE_INFINITY],
  ])(
    "refuses an unsupported current %s value without silently normalizing the design",
    (field, value) => {
      const before = input();
      (before.tokens as unknown as Record<string, unknown>)[field] = value;
      const result = evaluateStratosphereCandidate(before, "spacing", "airy");
      expect(result.accepted).toBe(false);
      expect(result.issues.some((issue) => issue.id === `invalid-tokens.${field}`)).toBe(true);
      expect(result.tokens).toBe(before.tokens);
      expect(deriveStratosphereGraph(before).issues.some((issue) => issue.kind === "invalid")).toBe(
        true,
      );
    },
  );

  it.each([
    ["studio", "split"],
    ["editorial", "editorial"],
    ["product", "stacked"],
    ["showcase", "poster"],
    ["journal", "editorial"],
  ])("selects %s as one compatible composition/hero transition", (option, hero) => {
    const before = input();
    const result = evaluateStratosphereCandidate(before, "composition", option);
    expect(result.accepted).toBe(true);
    expect(result.page.composition).toBe(option);
    expect(result.tokens.heroLayout).toBe(hero);
    expect(result.page.actionUrl).toBe(before.page.actionUrl);
    expect(result.page.imageAlt).toBe("Owner words");
    const built = buildAuthoredPage(result.tokens, content, result.page);
    expect(built.html).toContain(`class="${option}"`);
    expect(built.readiness.some((finding) => finding.id === "composition-layout")).toBe(false);
  });

  it("applies every registered choice only to its declared fields and preserves frozen input", () => {
    expect(STRATOSPHERE_GROUPS).toHaveLength(6);
    for (const group of STRATOSPHERE_GROUPS) {
      expect(group.options.length).toBeGreaterThanOrEqual(3);
      for (const option of group.options) {
        const before = input();
        Object.freeze(before.tokens);
        Object.freeze(before.page);
        Object.freeze(before.purpose);
        Object.freeze(before);
        const snapshot = JSON.stringify(before);
        const result = evaluateStratosphereCandidate(before, group.id, option.id);
        expect(result.accepted, `${group.id}/${option.id}`).toBe(true);
        expect(JSON.stringify(before)).toBe(snapshot);
        const expectedFields: string[] = option.changes.map((change) => change.field);
        for (const field of result.changedFields) expect(expectedFields).toContain(field);
        for (const change of option.changes) {
          const [owner, key] = change.field.split(".") as ["tokens" | "page", string];
          expect((result[owner] as unknown as Record<string, unknown>)[key]).toEqual(change.value);
        }
        const unchanged = (owner: "tokens" | "page") =>
          Object.entries(before[owner]).filter(
            ([key]) => !expectedFields.includes(`${owner}.${key}`),
          );
        for (const owner of ["tokens", "page"] as const)
          for (const [key, value] of unchanged(owner))
            expect((result[owner] as unknown as Record<string, unknown>)[key]).toEqual(value);
        expect(
          selectedStratosphereOption(
            { ...before, tokens: result.tokens, page: result.page },
            group.id,
          ),
        ).toBe(option.id);
      }
    }
  });

  it("changes generated CSS for font, hierarchy, spacing and form choices", () => {
    const before = input();
    for (const [group, option, css] of [
      ["fonts", "editorial", '--heading: "Focus Instrument Serif v1"'],
      ["hierarchy", "expressive", "--type-heading: 2.1025rem"],
      ["spacing", "airy", "--space: 1.25"],
      ["form", "rounded", "border-radius: 999px"],
    ] as const) {
      const result = evaluateStratosphereCandidate(before, group, option);
      expect(result.accepted).toBe(true);
      expect(buildAuthoredPage(result.tokens, content, result.page).css).toContain(css);
    }
  });

  it.each(["existing", "app"])(
    "blocks composition changes for %s output without changing any data",
    (scope) => {
      const before = input();
      if (scope === "existing") before.integration = "existing";
      else before.purpose.experience = "app";
      const result = evaluateStratosphereCandidate(before, "composition", "journal");
      expect(result.accepted).toBe(false);
      expect(
        result.issues.some((issue) => issue.kind === "scope" && issue.severity === "block"),
      ).toBe(true);
      expect(result.tokens).toBe(before.tokens);
      expect(result.page).toBe(before.page);
      expect(result.changedFields).toEqual([]);
      expect(evaluateStratosphereCandidate(before, "spacing", "airy").accepted).toBe(true);
    },
  );

  it.each([
    ["missing", "airy"],
    ["spacing", "missing"],
    ["__proto__", "constructor"],
  ])("refuses unknown registry values %s/%s", (group, option) => {
    const before = input();
    const result = evaluateStratosphereCandidate(before, group, option);
    expect(result.accepted).toBe(false);
    expect(result.issues.some((issue) => issue.kind === "invalid")).toBe(true);
    expect(result.tokens).toBe(before.tokens);
    expect(result.page).toBe(before.page);
  });

  it("blocks low-contrast surface text even when background contrast passes; a safe palette repairs the candidate", () => {
    const before = input();
    before.tokens.surface = "#17202b";
    expect(contrast(before.tokens.ink, before.tokens.bg)).toBeGreaterThan(4.5);
    const rejected = evaluateStratosphereCandidate(before, "fonts", "editorial");
    expect(rejected.accepted).toBe(false);
    expect(
      rejected.issues.some(
        (issue) => issue.id === "contrast-ink-surface" && issue.kind === "measured",
      ),
    ).toBe(true);
    expect(rejected.tokens).toBe(before.tokens);
    const graph = deriveStratosphereGraph(before);
    expect(graph.nodes.find((node) => node.id === "group:fonts")?.available).toBe(false);
    expect(graph.nodes.find((node) => node.id === "group:palette")?.available).toBe(true);
    expect(graph.edges.find((edge) => edge.id === "composition-hero")?.blocked).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.from === "group:palette" &&
          edge.to === "group:fonts" &&
          edge.kind === "requires" &&
          edge.blocked,
      ),
    ).toBe(true);
    const repaired = evaluateStratosphereCandidate(before, "palette", "cloud-blue");
    expect(repaired.accepted).toBe(true);
    expect(contrast(repaired.tokens.ink, repaired.tokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(before.tokens.surface).toBe("#17202b");
  });

  it("checks every palette's supplied role pairs without silently correcting the chosen colors", () => {
    const palettes = STRATOSPHERE_GROUPS.find((group) => group.id === "palette")!;
    for (const option of palettes.options) {
      const result = evaluateStratosphereCandidate(input(), "palette", option.id);
      expect(result.accepted).toBe(true);
      for (const [foreground, background] of [
        ["ink", "bg"],
        ["ink", "surface"],
        ["muted", "bg"],
        ["muted", "surface"],
        ["accentInk", "accent"],
      ] as const)
        expect(
          contrast(result.tokens[foreground], result.tokens[background]),
        ).toBeGreaterThanOrEqual(4.5);
      expect(result.issues.some((issue) => issue.severity === "block")).toBe(false);
    }
  });

  it("keeps purpose advice distinct from actual authored control constraints", () => {
    const before = input();
    before.purpose = {
      ...before.purpose,
      device: "mostly phones",
      audience: "older adults",
      reading: "a lot to read",
    };
    const underline = evaluateStratosphereCandidate(before, "form", "understated");
    expect(underline.accepted).toBe(true);
    expect(underline.issues.some((issue) => issue.kind === "advisory")).toBe(true);
    expect(JSON.stringify(underline.issues)).not.toMatch(/29px|small tap targets/);
    expect(buildAuthoredPage(underline.tokens, content, underline.page).css).toContain(
      "min-block-size: 48px",
    );
    const compact = evaluateStratosphereCandidate(before, "spacing", "compact");
    expect(compact.accepted).toBe(true);
    expect(
      compact.issues.some((issue) => issue.kind === "advisory" && issue.severity === "note"),
    ).toBe(true);
  });
});

describe("Stratosphere graph and output boundaries", () => {
  it("traces a Japanese language selection only to authored website output", () => {
    const current = input();
    const languageOutput = (graph: ReturnType<typeof deriveStratosphereGraph>) =>
      graph.nodes.find((node) => node.id === "output:page-language");
    expect(languageOutput(deriveStratosphereGraph(current))).toBeUndefined();

    current.page.language = "ja";
    const website = deriveStratosphereGraph(current);
    expect(website.snapshot.page.language).toBe("ja");
    expect(languageOutput(website)).toMatchObject({
      available: true,
      value: expect.stringContaining("Japanese (ja)"),
    });
    expect(website.edges.find((edge) => edge.id === "profile-page-language")).toMatchObject({
      to: "output:page-language",
      fields: expect.arrayContaining(["page.language"]),
      blocked: false,
    });
    for (const other of [
      { ...current, integration: "existing" as const },
      { ...current, purpose: { ...current.purpose, experience: "app" as const } },
    ]) {
      const graph = deriveStratosphereGraph(other);
      expect(languageOutput(graph)?.available).toBe(false);
      expect(graph.edges.find((edge) => edge.id === "profile-page-language")?.blocked).toBe(true);
    }
  });

  it("describes default authored image framing without treating an image reference as verified bytes", () => {
    const current = input();
    current.page.imageId = "a".repeat(64);
    const graph = deriveStratosphereGraph(current);
    const framing = graph.nodes.find((node) => node.id === "output:image-framing")!;
    expect(framing).toMatchObject({ kind: "output", available: true, selectedOptionId: null });
    expect(framing.value).toContain("object-fit: cover; object-position: center center");
    expect(framing.value).toContain("at or below 760px: center center");
    expect(framing.value).toContain("Image bytes and visual result are not verified");
    expect(graph.snapshot.page).not.toHaveProperty("imageFraming");
    expect(graph.edges.find((edge) => edge.id === "composition-image-framing")).toMatchObject({
      from: "group:composition",
      to: "output:image-framing",
      kind: "affects",
      blocked: false,
      fields: ["page.composition", "page.imageFraming", "page.imageId", "page.imageAlt"],
    });
    expect(graph.edges.find((edge) => edge.id === "composition-image-framing")?.reason).toMatch(
      /frame ratio.*crop/,
    );
    expect(graph.issues.some((issue) => issue.id === "browser-unverified")).toBe(true);
  });

  it.each([
    ["top-left", "left top"],
    ["top", "center top"],
    ["top-right", "right top"],
    ["left", "left center"],
    ["center", "center center"],
    ["right", "right center"],
    ["bottom-left", "left bottom"],
    ["bottom", "center bottom"],
    ["bottom-right", "right bottom"],
  ] as const)(
    "reports the %s cover anchor and its independent narrow override",
    (position, css) => {
      expect(IMAGE_POSITIONS).toContain(position);
      const current = input();
      current.page.imageId = "b".repeat(64);
      current.page.imageFraming = { fit: "cover", position, narrowPosition: "bottom-right" };
      const framing = deriveStratosphereGraph(current).nodes.find(
        (node) => node.id === "output:image-framing",
      )!;
      expect(framing.value).toContain(`object-fit: cover; object-position: ${css};`);
      expect(framing.value).toContain("at or below 760px: right bottom");
    },
  );

  it("reports contain as centered at every width despite retained cover anchors", () => {
    const current = input();
    current.page.imageId = "c".repeat(64);
    current.page.imageFraming = {
      fit: "contain",
      position: "top-left",
      narrowPosition: "bottom-right",
    };
    const graph = deriveStratosphereGraph(current);
    const framing = graph.nodes.find((node) => node.id === "output:image-framing")!;
    expect(framing.value).toContain("object-fit: contain; object-position: center center");
    expect(framing.value).toContain("at or below 760px: center center");
    expect(framing.value).not.toMatch(/left top|right bottom/);
    expect(graph.snapshot.page.imageFraming).toEqual(current.page.imageFraming);
  });

  it.each(["existing", "app", "missing-image", "blank-description"])(
    "does not apply image framing for %s even when choices are retained",
    (scope) => {
      const current = input();
      current.page.imageId = "d".repeat(64);
      current.page.imageFraming = { fit: "cover", position: "left", narrowPosition: "right" };
      if (scope === "existing") current.integration = "existing";
      if (scope === "app") current.purpose.experience = "app";
      if (scope === "missing-image") current.page.imageId = null;
      if (scope === "blank-description") current.page.imageAlt = " \n\t ";
      const graph = deriveStratosphereGraph(current);
      const framing = graph.nodes.find((node) => node.id === "output:image-framing")!;
      expect(framing.available).toBe(false);
      expect(framing.value).toMatch(/^Not applied:/);
      expect(framing.value).not.toContain("object-fit:");
      expect(graph.edges.find((edge) => edge.id === "composition-image-framing")?.blocked).toBe(
        true,
      );
      expect(graph.snapshot.page.imageFraming).toEqual(current.page.imageFraming);
    },
  );

  it("canonicalizes and detaches nested framing snapshots while omitting explicit legacy defaults", () => {
    const current = input();
    current.page.imageId = "e".repeat(64);
    const legacy = deriveStratosphereGraph(current);
    expect(
      JSON.stringify(
        deriveStratosphereGraph({
          ...current,
          page: { ...current.page, imageFraming: { ...DEFAULT_IMAGE_FRAMING } },
        }),
      ),
    ).toBe(JSON.stringify(legacy));
    current.page.imageFraming = { fit: "cover", position: "top", narrowPosition: "left" };
    const graph = deriveStratosphereGraph(current);
    const reordered = {
      ...current,
      page: {
        ...current.page,
        imageFraming: { narrowPosition: "left", position: "top", fit: "cover" },
      },
    } as StratosphereInput;
    expect(JSON.stringify(deriveStratosphereGraph(reordered))).toBe(JSON.stringify(graph));
    graph.snapshot.page.imageFraming!.position = "bottom";
    expect(current.page.imageFraming.position).toBe("top");
    expect(JSON.stringify(deriveStratosphereGraph(current))).not.toBe(JSON.stringify(legacy));
  });

  it("uses bounded framing CSS and does not evaluate invalid current designs", () => {
    const current = input();
    current.page.imageId = "f".repeat(64);
    current.page.imageFraming = {
      fit: "cover; color:red",
      position: "url(https://example.test/image)",
      narrowPosition: "left; background:red",
    } as unknown as NonNullable<typeof current.page.imageFraming>;
    const bounded = deriveStratosphereGraph(current);
    expect(bounded.nodes.find((node) => node.id === "output:image-framing")?.value).toContain(
      "object-fit: cover; object-position: center center",
    );
    expect(bounded.snapshot.page).not.toHaveProperty("imageFraming");
    expect(JSON.stringify(bounded)).not.toMatch(/color:red|background:red|example.test\/image/);
    current.tokens.scale = Number.POSITIVE_INFINITY;
    const invalid = deriveStratosphereGraph(current);
    expect(invalid.nodes.find((node) => node.id === "output:image-framing")).toMatchObject({
      available: false,
      value: "Invalid current values; image framing not evaluated.",
    });
  });

  it("distinguishes embedded authored fonts from local fallbacks and customer-app references", () => {
    const current = input();
    const pair = evaluateStratosphereCandidate(current, "fonts", "editorial");
    const authored = { ...current, tokens: pair.tokens };
    const note = deriveStratosphereGraph(authored).issues.find(
      (issue) => issue.id === "font-availability",
    )!;
    expect(note.message).toContain("Embedded font files: Instrument Serif, Instrument Sans");
    expect(note.message).not.toContain("Local font installation or fallback:");
    expect(note.message).toContain("browser check");
    const fallback = deriveStratosphereGraph(current).issues.find(
      (issue) => issue.id === "font-availability",
    )!;
    expect(fallback.message).toContain(
      "Local font installation or fallback: DM Serif Display, Karla",
    );
    const customer = deriveStratosphereGraph({ ...authored, integration: "existing" }).issues.find(
      (issue) => issue.id === "font-availability",
    )!;
    expect(customer.message).not.toContain("Embedded font files");
    expect(customer.message).toContain("customer policy");
  });

  it("connects actual content to review advice without imposing a headline-length compatibility limit", () => {
    const before = { ...input(), content: { ...content, headline: "🐈".repeat(130), cta: "" } };
    const selected = evaluateStratosphereCandidate(before, "hierarchy", "expressive");
    expect(selected.accepted).toBe(true);
    const graph = deriveStratosphereGraph(before);
    expect(graph.nodes.find((node) => node.id === "context:content")?.value).toContain(
      "130 characters; features: 1; action label: not supplied",
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.from === "context:content" &&
          edge.to === "group:hierarchy" &&
          edge.kind === "advisory" &&
          !edge.blocked,
      ),
    ).toBe(true);
    expect(
      graph.issues.some((issue) => issue.id === "content-action" && issue.severity === "note"),
    ).toBe(true);
    expect(graph.snapshot.content).toEqual(before.content);
    graph.snapshot.content!.features[0]!.title = "Changed detached record";
    expect(before.content.features[0]!.title).toBe("Useful service");
  });

  it("derives deterministic live values, field edges and selection from the same transitions", () => {
    const before = input();
    const graph = deriveStratosphereGraph(before);
    const chosen = evaluateStratosphereCandidate(before, "spacing", "airy");
    const next = deriveStratosphereGraph({ ...before, tokens: chosen.tokens, page: chosen.page });
    expect(next.nodes.find((node) => node.id === "group:spacing")?.value).toContain(
      "tokens.density: airy",
    );
    expect(
      next.edges.some((edge) => edge.from === "group:spacing" && edge.kind === "affects"),
    ).toBe(true);
    expect(next).not.toEqual(graph);
    const reversed = {
      ...before,
      tokens: Object.fromEntries(Object.entries(before.tokens).reverse()) as typeof before.tokens,
    };
    expect(JSON.stringify(deriveStratosphereGraph(reversed))).toBe(JSON.stringify(graph));
    expect(graph.snapshot.page.actionUrl).toBe("https://example.test/book");
    expect(graph.snapshot.nav).toBe("top-menu");
    expect(JSON.stringify(graph)).not.toMatch(/createdAt|timestamp|ready to launch/);
    for (const edge of graph.edges) {
      expect(graph.nodes.some((node) => node.id === edge.from)).toBe(true);
      expect(graph.nodes.some((node) => node.id === edge.to)).toBe(true);
      expect(edge.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("reports omitted finishes and font availability without claiming those choices were rendered", () => {
    const before = input();
    before.tokens.card = "glass";
    before.tokens.buttonFinish = "gloss";
    before.tokens.texture = "stars";
    before.tokens.accent2 = "#00ffaa";
    const graph = deriveStratosphereGraph(before);
    expect(graph.issues.some((issue) => issue.id === "authored-omissions")).toBe(true);
    expect(graph.issues.some((issue) => issue.id === "font-availability")).toBe(true);
    expect(graph.issues.some((issue) => issue.id === "browser-unverified")).toBe(true);
    expect(graph.snapshot.tokens.card).toBe("glass");
    expect(graph.snapshot.tokens.texture).toBe("stars");
  });

  it("exposes scope restrictions in the graph using the candidate's same blocking reason", () => {
    const before = input();
    before.integration = "existing";
    const result = evaluateStratosphereCandidate(before, "composition", "product");
    const graph = deriveStratosphereGraph(before);
    expect(graph.profile).toBe("existing-specification");
    expect(graph.nodes.find((node) => node.id === "output:hierarchy")?.value).toContain(
      "--focus-text-h2:",
    );
    expect(graph.nodes.find((node) => node.id === "output:spacing")?.value).toBe(
      "--focus-space-unit: 1rem",
    );
    expect(
      graph.edges.some(
        (edge) => edge.to === "group:composition" && edge.kind === "requires" && edge.blocked,
      ),
    ).toBe(true);
    expect(
      graph.issues.some(
        (issue) => issue.id === result.issues.find((issue) => issue.kind === "scope")?.id,
      ),
    ).toBe(true);
    expect(graph.issues.some((issue) => issue.id === "existing-application")).toBe(true);
  });
});
