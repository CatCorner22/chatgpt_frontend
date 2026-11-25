import { createHash } from "node:crypto";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  buildPrescription,
  EXISTING_PACK_PLACEMENT,
  normalizeTokens,
  TOOLS,
  type Content,
} from "@/lib/design";
import { buildPack, packFiles, PackError } from "@/lib/exportPack";
import type { LibraryEntry } from "@/lib/library";
import {
  EMPTY_TARGET_DRAFT,
  prepareTargetPack,
  TARGET_LIMITS,
  TargetPreparationError,
  type TargetDraft,
} from "@/lib/target";

const tokens = normalizeTokens({});
const copyThatNeedsEscaping: Content = {
  brand: "  Quill & Finch 🪶  ",
  headline: "  Book “the corner” & try 'today'  \n  ```\n## Untrusted copy\n```  ",
  sub: '<!-- owner copy --><script>example()</script><img src="x" onerror="example()">',
  cta: " ",
  features: [
    { title: "", body: "  " },
    {
      title: "<b>Examples</b>",
      body: '\t@import url("https://example.invalid/example.css"); color: red !important;',
    },
    { title: "Browser examples", body: "[example](jAvAsCrIpT:example())\r\n<iframe>" },
    {
      title: "ملحوظة 🧭",
      body: "Left\u202Eright\u2067marked\u2069\u202C\n\u061Cالعربية \u200EEnglish \u200Fעברית",
    },
    { title: "Backslashes", body: String.raw`Literal \u003c and \" followed by < and an &amp;` },
  ],
  quote: '  “It’s ready,” she said.\n"Really?" 🪶  ',
};

function withEndMarker(length: number, ending: string) {
  return `${"x".repeat(length - ending.length)}${ending}`;
}

const editorLimitCopy: Content = {
  brand: withEndMarker(120, " [full brand]"),
  headline: withEndMarker(240, " [full headline]"),
  sub: withEndMarker(700, " [full supporting text]"),
  cta: withEndMarker(80, " [full action label]"),
  features: Array.from({ length: 8 }, (_, i) => ({
    title: withEndMarker(120, ` [feature ${i + 1}]`),
    body: withEndMarker(700, ` [description ${i + 1}]`),
  })),
  quote: withEndMarker(1000, " [full quotation]"),
};

function prescription(
  content: Content,
  tool: Parameters<typeof buildPrescription>[0]["tool"] = "Cursor",
  integration: "new" | "existing" = "new",
  authoredPage?: unknown,
  experience?: "app" | "website",
) {
  return buildPrescription({
    content,
    tool,
    integration,
    authoredPage,
    experience,
    tokens,
    brief: "A workshop booking page",
    direction: "Quiet editorial",
    picks: [],
  });
}

function readContent(markdown: string) {
  const blocks = [...markdown.matchAll(/^```json[\t ]*\r?\n([\s\S]*?)^```[\t ]*$/gm)];
  expect(blocks).toHaveLength(1);
  const [block] = blocks;
  const source = block![1]!;
  return { source, data: JSON.parse(source) as unknown, guidance: markdown.replace(block![0], "") };
}

async function readPackDesign(markdown: string, brand: string, mode: "new" | "existing" = "new") {
  const zip = await JSZip.loadAsync(await buildPack(markdown, tokens, brand, undefined, mode));
  const path = mode === "existing" ? "focus-restyle/DESIGN.md" : "DESIGN.md";
  const file = zip.file(path);
  expect(file).not.toBeNull();
  return file!.async("string");
}

describe("new-build Content handoff", () => {
  it.each(TOOLS)(
    "gives authoritative owner copy precedence over wording advice for %s",
    async (tool) => {
      const content = {
        ...editorLimitCopy,
        headline: "Make a bowl that feels like yours.",
        cta: "Reserve a workshop place for next Saturday",
      };
      const markdown = await readPackDesign(prescription(content, tool), content.brand);
      const { data, guidance } = readContent(markdown);
      expect(data).toEqual({ format: "focus-content-v1", content });
      expect(guidance).toContain("Preserve authoritative owner copy exactly.");
      expect(guidance).toContain("report the conflict for owner review");
      expect(guidance).toContain("Preserve supplied title and button wording");
      expect(guidance).not.toContain("uses the same verb as the main button");
      expect(guidance).not.toContain("Fix anything that does not hold.");
    },
  );

  it("describes coding-tool rule files as guidance requiring review in the actual ZIP", async () => {
    const markdown = prescription(editorLimitCopy, "GitHub Copilot");
    const zip = await JSZip.loadAsync(await buildPack(markdown, tokens, editorLimitCopy.brand));
    const start = await zip.file("START-HERE.md")!.async("string");
    const design = await zip.file("DESIGN.md")!.async("string");
    expect(start).toContain("review each resulting change against DESIGN.md");
    expect(start).toContain("these files do not enforce compliance");
    expect(start).not.toContain("keep coding tools on the design for every later edit");
    expect(design).toContain("review each resulting change against this Vision");
    expect(design).not.toContain("so every suggestion follows it");
  });

  it.each(["Cursor", "Lovable", "Human developer"] as const)(
    "preserves every editor-limit field in the %s Prescription and ZIP",
    async (tool) => {
      const markdown = prescription(editorLimitCopy, tool);
      expect(markdown).toContain(`## Tool instruction (${tool})`);
      const copied = readContent(markdown);
      expect(copied.data).toEqual({ format: "focus-content-v1", content: editorLimitCopy });
      const downloaded = readContent(await readPackDesign(markdown, editorLimitCopy.brand));
      expect(downloaded.source).toBe(copied.source);
      expect(downloaded.data).toEqual({ format: "focus-content-v1", content: editorLimitCopy });
    },
  );

  it("keeps a decisive qualifier beyond the old 400-character cutoff", () => {
    const content = {
      ...editorLimitCopy,
      sub: withEndMarker(498, " Eligible only for existing members with a current booking."),
    };
    const { data } = readContent(prescription(content));
    expect(data).toEqual({ format: "focus-content-v1", content });
  });

  it("retains literal markup, fence text, punctuation, whitespace, and direction controls as JSON data", async () => {
    const markdown = prescription(copyThatNeedsEscaping);
    const { source, data } = readContent(markdown);
    expect(data).toEqual({ format: "focus-content-v1", content: copyThatNeedsEscaping });
    expect(source).not.toMatch(/`|<|>|javascript:|!important|@import\s|\sonerror\s*=/i);
    expect(source).not.toMatch(/\p{Bidi_Control}/u);
    expect(source).toContain("\\u0060");
    expect(source).toContain("\\u003c");
    expect(source).toMatch(/\\u202e/i);
    const downloaded = readContent(await readPackDesign(markdown, copyThatNeedsEscaping.brand));
    expect(downloaded.source).toBe(source);
    expect(downloaded.data).toEqual(data);
  });

  it("round-trips ASCII, literal escape sequences, and Unicode separators through the ZIP", async () => {
    const ascii = Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join("");
    const content = {
      ...copyThatNeedsEscaping,
      sub: `${ascii}\u2028Line separator\u2029Paragraph separator 🧭`,
      quote: String.raw`\u003c \n \\ \" \u202e` + "\\",
    };
    const downloaded = readContent(await readPackDesign(prescription(content), content.brand));
    expect(downloaded.data).toEqual({ format: "focus-content-v1", content });
    expect(downloaded.source).not.toMatch(/[\u2028\u2029]/);
  });

  it("preserves explicitly empty fields and a blank quote without fabricating copy", async () => {
    const content: Content = { brand: "", headline: "", sub: "", cta: "", features: [], quote: "" };
    const markdown = prescription(content);
    const { data, guidance } = readContent(await readPackDesign(markdown, content.brand));
    expect(data).toEqual({ format: "focus-content-v1", content });
    expect(guidance).toMatch(/\bask\b/i);
    expect(guidance).toMatch(/(?:\b(?:missing|blank|empty)\b|\bneeded content\b)/i);
    expect(guidance).toMatch(/(?:do not|never|don't)\s+invent/i);
  });

  it("gives the recipient text handling and publishing instructions outside the supplied data", () => {
    const { guidance } = readContent(prescription(copyThatNeedsEscaping));
    expect(guidance).toMatch(/(?:data|copy)[^\n]{0,120}(?:instructions|execut)/i);
    expect(guidance).toMatch(/(?:React text|text nodes?|normal escaping)/i);
    expect(guidance).toMatch(/(?:raw HTML|dangerouslySetInnerHTML)/i);
    expect(guidance).toMatch(/\bcommands?\b/i);
    expect(guidance).toMatch(/(?:URLs?|destinations?)/i);
    expect(guidance).toMatch(/permission[^\n]{0,120}publish|publish[^\n]{0,120}permission/i);
  });

  it("keeps existing-site Prescription bytes and excludes sample copy from the existing ZIP", async () => {
    const content: Content = {
      brand: "Quill & Finch",
      headline: "This sample headline must stay out",
      sub: "This sample subhead must stay out",
      cta: "Try this sample action",
      features: [{ title: "Sample feature", body: "Sample feature description" }],
      quote: "This sample quote must stay out",
    };
    const markdown = prescription(content, "Cursor", "existing");
    // Pin the corrected output and verify that the v15 prescription differed only in placement guidance.
    const digest = (text: string) => createHash("sha256").update(text).digest("hex");
    const preceding = markdown.replace(
      "Keep existing files and their contents. Place generated files beside them. In the isolated copy, add only the documented trial imports, wrapper attributes and optional reminder. Never replace a customer file with a generated file.",
      "Never delete or overwrite existing files such as styles, config or rule files. Add the Focus files next to them.",
    );
    expect(preceding).not.toBe(markdown);
    expect(digest(preceding)).toBe(
      "066d6e29e8f77b52d074d2abc59a81942496338977a7507c9820af43b7f9bbc4",
    );
    const previous = preceding.replace(
      EXISTING_PACK_PLACEMENT,
      "Extract to a fresh focus-restyle folder; if it already exists, stop rather than overwrite it.",
    );
    expect(digest(previous)).toBe(
      "3392952762a31e75249cdf4876c8edf96aa5bbeebdbe2309db6b41d8c6e0d12d",
    );
    const downloaded = await readPackDesign(markdown, content.brand, "existing");
    expect(downloaded).not.toMatch(/focus-content-v1|^```json/m);
    for (const sample of [
      content.headline,
      content.sub,
      content.cta,
      content.quote,
      content.features[0]!.title,
      content.features[0]!.body,
    ]) {
      expect(downloaded).not.toContain(sample);
    }
  });
});

describe("Target Content transfer", () => {
  const entry: LibraryEntry = {
    id: "quill-booking",
    title: "A quiet booking page",
    collection: "Workshops",
    favorite: false,
    created: "2026-11-18T00:00:00Z",
    updated: "2026-11-18T00:00:00Z",
    state: { libraryId: "quill-booking", tokens, content: copyThatNeedsEscaping },
  };
  const draft: TargetDraft = {
    ...EMPTY_TARGET_DRAFT,
    designId: entry.id,
    integration: "new",
    page: "Workshop booking page at /book",
    improvement: "Show which workshop sessions are eligible for members",
    tasks: "Find a workshop and check membership eligibility",
    backup: "Separate project folder with a saved baseline commit",
    preview: "Isolated local preview with test bookings",
    rollback: "Revert only the trial changes and repeat the booking task",
  };

  it("exports exact known content fields through Target without spreading extra saved data", async () => {
    const privateStateMarker = "STUDIO PRIVATE STATE MARKER";
    const privateContentMarker = "CONTENT UNKNOWN FIELD MARKER";
    const privateFeatureMarker = "FEATURE UNKNOWN FIELD MARKER";
    const known = copyThatNeedsEscaping;
    const contentFromStorage = {
      ...known,
      privateContent: privateContentMarker,
      features: known.features.map((feature) => ({
        ...feature,
        privateNote: privateFeatureMarker,
      })),
    };
    const saved = {
      ...entry,
      state: { ...entry.state, content: contentFromStorage, privateNote: privateStateMarker },
    };
    const before = structuredClone(saved);

    const direct = readContent(prescription(contentFromStorage));
    expect(direct.data).toEqual({ format: "focus-content-v1", content: known });
    const zip = await JSZip.loadAsync(await prepareTargetPack(draft, saved));
    const markdown = await zip.file("DESIGN.md")!.async("string");
    const target = readContent(markdown);
    expect(target.data).toEqual({ format: "focus-content-v1", content: known });
    expect(target.source).toBe(direct.source);
    expect(target.guidance).toContain(draft.page);
    expect(target.guidance).toContain(draft.tasks);
    for (const marker of [privateStateMarker, privateContentMarker, privateFeatureMarker]) {
      expect(markdown).not.toContain(marker);
    }
    expect(saved).toEqual(before);
  });

  it("carries the selected design's exact public destination through the downloaded guides", async () => {
    const href =
      "https://Calendar.example.org:8443/rooms/O'Brien?service=wheel&slot=am&slot=pm#classes";
    const saved = { ...entry, state: { ...entry.state, page: { actionUrl: href } } };
    const direct = prescription(entry.state.content, "Cursor", "new", saved.state.page, "website");
    const zip = await JSZip.loadAsync(await prepareTargetPack(draft, saved));
    for (const markdown of [direct, await zip.file("DESIGN.md")!.async("string")]) {
      const blocks = [...markdown.matchAll(/^```json\n([\s\S]*?)^```$/gm)].map((m) =>
        JSON.parse(m[1]!),
      );
      expect(blocks.filter((block) => block.format === "focus-primary-action-v1")).toEqual([
        { format: "focus-primary-action-v1", href },
      ]);
    }
    for (const guide of [
      prescription(entry.state.content, "Cursor", "existing", saved.state.page, "website"),
      prescription(entry.state.content, "Cursor", "new", saved.state.page, "app"),
    ]) {
      expect(guide).not.toContain("focus-primary-action-v1");
      expect(guide).not.toContain("calendar.example.org");
    }
  });

  it.each([
    undefined,
    null,
    { actionUrl: "" },
    { actionUrl: "mailto:studio@example.org" },
    { actionUrl: "https://private.localhost/path" },
    { actionUrl: "http://127.0.0.1/test" },
    { actionUrl: "https://calendar.example.org/?token=synthetic" },
    { actionUrl: "https://calendar.example.org/#confirm?access_token=synthetic" },
    { actionUrl: "https://calendar.example.org/?X-Amz-Signature=synthetic" },
    { actionUrl: "https://name:pass@example.org/path" },
  ])("keeps an absent or non-shareable action unresolved in the guide: %j", async (page) => {
    const markdown = await readPackDesign(
      prescription(editorLimitCopy, "Cursor", "new", page),
      "Studio",
    );
    expect(markdown).toContain("Keep an unconfirmed action unlinked");
    expect(markdown).not.toContain("focus-primary-action-v1");
    expect(markdown).not.toMatch(
      /private\.localhost|calendar\.example|studio@example|127\.0\.0\.1|synthetic/,
    );
  });

  it("keeps public-code confirmation bound to the exact link and excludes sign-in and signed links", async () => {
    const href = "https://Bookings.example.org?code=SPRINGSALE&slot=morning";
    const guide = (actionUrl: string, publicCodeUrl?: string) =>
      prescription(editorLimitCopy, "Cursor", "new", { actionUrl, publicCodeUrl }, "website");
    const markdown = await readPackDesign(guide(href, href), "Studio");
    const blocks = [...markdown.matchAll(/^```json\n([\s\S]*?)^```$/gm)].map((m) =>
      JSON.parse(m[1]!),
    );
    expect(blocks).toContainEqual({ format: "focus-primary-action-v1", href });
    for (const [address, confirmation] of [
      [href, undefined],
      [href + "&day=2", href],
      ...[
        "https://service.example.org/oauth/callback?code=synthetic",
        href + "&state=synthetic",
        href + "&access_token=synthetic",
      ].map((value) => [value, value]),
    ]) {
      expect(guide(address!, confirmation)).not.toContain("focus-primary-action-v1");
    }
  });

  it("preserves the existing-project oversized-plan error", async () => {
    const expanded: TargetDraft = {
      ...draft,
      integration: "existing",
      page: "&".repeat(TARGET_LIMITS.page),
      improvement: "&".repeat(TARGET_LIMITS.improvement),
      tasks: "&".repeat(TARGET_LIMITS.tasks),
      backup: "&".repeat(TARGET_LIMITS.backup),
      preview: "&".repeat(TARGET_LIMITS.preview),
      rollback: "&".repeat(TARGET_LIMITS.rollback),
    };
    const prepared = prepareTargetPack(expanded, entry);
    await expect(prepared).rejects.toBeInstanceOf(TargetPreparationError);
    await expect(prepared).rejects.toThrow(/prepared plan is too long/i);
  });
});

describe("Prescription Markdown size limit", () => {
  const atLimit = `# Safe markdown\n\n${withEndMarker(59_983, "\n\nKeep this ending.\n")}`;

  it("keeps the entire Markdown at the 60,000-character limit", async () => {
    expect(atLimit).toHaveLength(60_000);
    expect(packFiles(atLimit, tokens)["DESIGN.md"]).toBe(atLimit);
    expect(await readPackDesign(atLimit, "Boundary fixture")).toBe(atLimit);
  });

  it("still produces a complete copyable Prescription when encoded restored content exceeds the ZIP budget", async () => {
    const content = {
      ...editorLimitCopy,
      features: editorLimitCopy.features.map(({ title }, index) => ({
        title,
        body: "<>&".repeat(420) + ` End of restored description ${index + 1}.`,
      })),
    };
    const markdown = prescription(content);
    expect(markdown.length).toBeGreaterThan(60_000);
    expect(readContent(markdown).data).toEqual({ format: "focus-content-v1", content });
    await expect(buildPack(markdown, tokens)).rejects.toBeInstanceOf(PackError);
  });

  it.each(["new", "existing"] as const)(
    "rejects oversized %s Markdown instead of silently cutting the end",
    async (mode) => {
      const oversized = `${atLimit}x`;
      expect(() => packFiles(oversized, tokens, "Quill & Finch", undefined, mode)).toThrow(
        PackError,
      );
      await expect(
        buildPack(oversized, tokens, "Quill & Finch", undefined, mode),
      ).rejects.toBeInstanceOf(PackError);
    },
  );
});
