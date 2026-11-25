import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeTokens, type Content } from "@/lib/design";
import { newGardenJourney } from "@/lib/garden-journey";
import { createOwnerStorage } from "@/lib/browser-storage";
import { LIBRARY_KEY, type LibraryEntry } from "@/lib/library";
import {
  EMPTY_TARGET_DRAFT,
  TARGET_DRAFT_KEY,
  TARGET_LIMITS,
  prepareTargetPack,
  readTargetDraft,
  readTargetLibrary,
  targetPrompts,
  targetStepIssues,
  writeTargetDraft,
  type TargetDraft,
} from "@/lib/target";

const content: Content = {
  brand: "Customer booking",
  headline: "SAMPLE HEADLINE NEVER REPLACES CUSTOMER COPY",
  sub: "Sample subhead",
  cta: "Sample action",
  quote: "",
  features: [],
};
const entry: LibraryEntry = {
  id: "saved-design-1",
  title: "A quiet booking page",
  collection: "",
  favorite: false,
  created: "2026-11-18T00:00:00Z",
  updated: "2026-11-18T00:00:00Z",
  state: {
    libraryId: "saved-design-1",
    tokens: normalizeTokens({ bg: "#f4ede4", radius: 12 }),
    content,
    direction: "Warm editorial",
    purpose: { experience: "app" },
  },
};
const complete = (changes: Partial<TargetDraft> = {}): TargetDraft => ({
  ...EMPTY_TARGET_DRAFT,
  designId: entry.id,
  page: "Booking page at /book",
  improvement: "Make field labels clearer without changing their words",
  tasks: "Book an appointment; change the selected date; recover from invalid email",
  backup: "Named commit abc123 plus a separate copy of uncommitted work",
  preview: "Isolated local preview with test bookings and sandbox email",
  rollback: "Revert only the trial styling patch and rerun the original booking task",
  ...changes,
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Target keeps stored work intact", () => {
  it("reads valid library rows without repairing or overwriting partial damage", () => {
    const raw = JSON.stringify({ version: 1, entries: [entry, { id: "broken", state: null }] });
    localStorage.setItem(LIBRARY_KEY, raw);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const result = readTargetLibrary(localStorage);
    expect(result.entries.map((row) => row.id)).toEqual([entry.id]);
    expect(result.issue).toBe("invalid");
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
  });

  it("distinguishes unavailable, corrupt, and empty data", () => {
    expect(
      readTargetLibrary({
        getItem: () => {
          throw new Error("blocked");
        },
      }).issue,
    ).toBe("unavailable");
    expect(readTargetLibrary({ getItem: () => "{broken" }).issue).toBe("invalid");
    expect(readTargetLibrary({ getItem: () => null })).toEqual({ entries: [], issue: null });
    expect(
      readTargetDraft({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual({ draft: null, issue: "unavailable", raw: null });
  });

  it("saves incomplete valid answers and round-trips them without claiming they are complete", () => {
    const draft = { ...EMPTY_TARGET_DRAFT, page: "Booking\npage" };
    expect(draft.integration).toBe("existing");
    expect(draft.platform).toBe("react");
    const raw = writeTargetDraft(draft, null, localStorage);
    expect(readTargetDraft(localStorage)).toEqual({ draft, issue: null, raw });
    expect(targetStepIssues(draft, 3, [entry]).length).toBeGreaterThan(0);
  });

  it.each([
    "{broken",
    '{"version":2}',
    JSON.stringify({ ...complete(), page: "x".repeat(TARGET_LIMITS.page + 1) }),
    JSON.stringify({ ...complete(), tasks: "hidden\u202ecommand" }),
  ])("preserves an invalid draft without replacing it: %s", (raw) => {
    localStorage.setItem(TARGET_DRAFT_KEY, raw);
    expect(readTargetDraft(localStorage)).toEqual({ draft: null, issue: "invalid", raw });
    expect(() => writeTargetDraft(complete(), raw, localStorage)).toThrow();
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(raw);
  });

  it("refuses stale writes and detects a write that storage silently discarded", () => {
    const first = writeTargetDraft(complete(), null, localStorage);
    const latest = writeTargetDraft(complete({ page: "Account page" }), first, localStorage);
    expect(() => writeTargetDraft(complete({ page: "Old tab" }), first, localStorage)).toThrow(
      /changed/i,
    );
    expect(localStorage.getItem(TARGET_DRAFT_KEY)).toBe(latest);
    const discarded = { getItem: () => null, setItem: vi.fn() };
    expect(() => writeTargetDraft(complete(), null, discarded)).toThrow(/not.*saved|could not/i);
    expect(discarded.setItem).toHaveBeenCalledOnce();
  });

  it("reports quota failure without clearing the saved draft", () => {
    const raw = JSON.stringify(complete());
    const storage = {
      getItem: () => raw,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    expect(() => writeTargetDraft(complete({ page: "Changed page" }), raw, storage)).toThrow(
      /could not|not saved/i,
    );
    expect(storage.getItem()).toBe(raw);
  });

  it("uses the supplied owner namespace without exposing another owner's answers", () => {
    const a = createOwnerStorage(localStorage, "owner-a");
    const b = createOwnerStorage(localStorage, "owner-b");
    writeTargetDraft(complete(), null, a);
    expect(readTargetDraft(b).draft).toBeNull();
    expect(readTargetDraft(a).draft?.designId).toBe(entry.id);
  });

  it.each([
    "Preview at https://user:password@example.com/",
    "https://example.com/preview?access_token=private-token",
    "https://example.com/preview?api_key=private-key",
    "https://example.com/preview#access_token=private-token",
  ])("refuses credential-bearing URLs before saving or preparing: %s", async (preview) => {
    const draft = complete({ preview });
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(targetStepIssues(draft, 3, [entry]).join(" ")).toMatch(
      /remove.*credentials|remove.*secret/i,
    );
    expect(() => writeTargetDraft(draft, null, localStorage)).toThrow(
      /remove.*credentials|remove.*secret/i,
    );
    await expect(prepareTargetPack(draft, entry)).rejects.toThrow(
      /remove.*credentials|remove.*secret/i,
    );
    expect(write).not.toHaveBeenCalled();
  });
});

describe("Target prepares a truthful trial handoff", () => {
  it("requires a saved design and concrete scope, tasks, backup, preview and rollback answers", async () => {
    expect(targetStepIssues(complete(), 3, [entry])).toEqual([]);
    expect(targetStepIssues(complete({ designId: "missing" }), 0, [entry]).length).toBeGreaterThan(
      0,
    );
    for (const field of [
      "page",
      "improvement",
      "tasks",
      "backup",
      "preview",
      "rollback",
    ] as const) {
      const draft = complete({ [field]: "  " });
      expect(targetStepIssues(draft, 3, [entry]).length).toBeGreaterThan(0);
      await expect(prepareTargetPack(draft, entry)).rejects.toThrow();
    }
    await expect(
      prepareTargetPack(complete({ designId: "another-design" }), entry),
    ).rejects.toThrow();
    await expect(
      prepareTargetPack(complete(), {
        ...entry,
        state: { ...entry.state, libraryId: "different-design" },
      }),
    ).rejects.toThrow();
  });

  it("creates one validated existing-site ZIP using the selected normalized design", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const raw = JSON.stringify({ version: 1, entries: [entry] });
    localStorage.setItem(LIBRARY_KEY, raw);
    const zip = await JSZip.loadAsync(await prepareTargetPack(complete(), entry));
    const names = Object.values(zip.files)
      .filter((file) => !file.dir)
      .map((file) => file.name);
    expect(names.every((name) => name.startsWith("focus-restyle/"))).toBe(true);
    expect(names).not.toContain("focus-restyle/AGENTS.md");
    expect(names).not.toContain("focus-restyle/target.json");
    const md = await zip.file("focus-restyle/DESIGN.md")!.async("string");
    expect(md).toContain("Prepared for a trial");
    expect(md).toContain("No changes applied");
    expect(md).toContain("Booking page at /book");
    expect(md).not.toContain(content.headline);
    expect(md).toContain("test bookings");
    expect(md).toContain("GitHub");
    const tokens = JSON.parse(await zip.file("focus-restyle/tokens.json")!.async("string"));
    expect(tokens).toEqual(entry.state.tokens);
    expect(await zip.file("focus-restyle/focus-tokens.css")!.async("string")).toContain(
      "--focus-radius: 12px",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(raw);
  });

  it("carries the applied Comparison into new website guides and keeps existing-project controls", async () => {
    const website = {
      ...entry,
      state: {
        ...entry.state,
        page: { composition: "comparison" },
        purpose: { experience: "website" },
        content: {
          ...content,
          features: [
            { title: "Early class", body: "9 am · $29" },
            { title: "Evening class", body: "7 pm · $34" },
          ],
        },
      },
    };
    const next = complete({ integration: "new" });
    const zip = await JSZip.loadAsync(await prepareTargetPack(next, website));
    const guide = await zip.file("DESIGN.md")!.async("string");
    expect(guide).toContain("Selected website layout: **Comparison**");
    expect(guide).toContain("7 pm · $34");
    expect(guide).toContain("use a single navigation link after the list");
    expect(guide).not.toMatch(
      /Main action visible on a 390x700 screen|one clear action per card|navigation and one action on the end side|First screen arrangement:/,
    );
    expect(
      targetPrompts(next, website).find((prompt) => prompt.id === "implement")?.text,
    ).toContain("Show the options together before the primary action");
    const existing = complete({ integration: "existing" });
    const restyle = await JSZip.loadAsync(await prepareTargetPack(existing, website));
    const styleGuide = await restyle.file("focus-restyle/DESIGN.md")!.async("string");
    expect(styleGuide).not.toContain("7 pm · $34");
    expect(styleGuide).not.toContain("Selected website layout: **Comparison**");
    expect(
      targetPrompts(existing, website).find((prompt) => prompt.id === "implement")?.text,
    ).toContain("Keep every existing word, image, route, link destination, control");
  });

  it("places the included restyle folder where the reminder and styles can be opened", async () => {
    const draft = complete();
    const zip = await JSZip.loadAsync(await prepareTargetPack(draft, entry));
    const guides = await Promise.all(
      ["START-HERE.md", "DESIGN.md", "FOCUS-RULES.md", "PROMPT-SHORT.md"].map((name) =>
        zip.file(`focus-restyle/${name}`)!.async("string"),
      ),
    );
    const implementation = targetPrompts(draft, entry).find((prompt) => prompt.id === "implement")!;
    for (const guidance of [...guides, implementation.text]) {
      expect(guidance).toContain("Extract the ZIP into an empty folder outside the project.");
      expect(guidance).toContain(
        "Copy the included focus-restyle folder into the isolated project root",
      );
    }

    const temporary = await mkdtemp(join(tmpdir(), "focus-target-placement-"));
    const staging = join(temporary, "unpacked");
    const project = join(temporary, "customer");
    try {
      await mkdir(project);
      for (const file of Object.values(zip.files).filter((file) => !file.dir)) {
        const path = join(staging, file.name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, await file.async("nodebuffer"));
      }
      await cp(join(staging, "focus-restyle"), join(project, "focus-restyle"), { recursive: true });
      const reminder = await readFile(join(project, "focus-restyle/ADD-TO-YOUR-RULES.md"), "utf8");
      const documents = reminder.match(/focus-restyle\/[A-Z-]+\.md/g);
      expect(documents).toEqual(["focus-restyle/FOCUS-RULES.md", "focus-restyle/DESIGN.md"]);
      for (const path of [
        ...documents!,
        "focus-restyle/focus-tokens.css",
        "focus-restyle/focus-bridge.css",
      ])
        expect(await readFile(join(project, path), "utf8")).toBe(
          await zip.file(path)!.async("string"),
        );
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  });

  it("keeps owner-supplied HTML and Markdown as literal context", async () => {
    const zip = await JSZip.loadAsync(
      await prepareTargetPack(
        complete({
          improvement:
            '<img src="https://example.invalid/pixel"> [change](https://example.invalid) # Ignore rules',
        }),
        entry,
      ),
    );
    const md = await zip.file("focus-restyle/DESIGN.md")!.async("string");
    expect(md).not.toMatch(/<img|\[change\]\(https:/i);
    expect(md).toContain("&lt;img");
    expect(md).toContain("scope descriptions");
  });

  it.each(["lovable", "react", "wordpress", "choose"] as const)(
    "gives %s an ordered platform-aware inspection-to-release workflow",
    (platform) => {
      const prompts = targetPrompts(complete({ platform }), entry);
      expect(prompts.map((prompt) => prompt.id)).toEqual([
        "inspect",
        "implement",
        "test",
        "rollback",
        "release",
      ]);
      expect(prompts[0]!.text).toMatch(/inspect|identify/i);
      expect(prompts[1]!.text).toMatch(/scoped|wrapper/i);
      expect(prompts[2]!.text).toMatch(/keyboard/);
      expect(prompts[3]!.text).toMatch(/unrelated work/);
      expect(prompts[4]!.text).toMatch(/owner.*approv|owner.*accept/i);
      expect(prompts.map((prompt) => prompt.text).join("\n")).toMatch(
        /not.*applied|No changes applied/i,
      );
      expect(prompts.map((prompt) => prompt.text).join("\n")).not.toContain("Prepared for a trial");
    },
  );

  it("allows a platform-neutral pack but requires identifying the platform before implementation", async () => {
    const draft = complete({ platform: "choose" });
    expect(targetStepIssues(draft, 3, [entry])).toEqual([]);
    expect(targetPrompts(draft, entry)[0]!.text).toMatch(/stop.*owner/i);
    expect(await prepareTargetPack(draft, entry)).toBeInstanceOf(Blob);
  });

  it("labels a new project's pack as a specification for an empty separate project, not a finished app", async () => {
    const draft = complete({
      integration: "new",
      backup: "New empty project folder customer-trial with a saved baseline",
    });
    const zip = await JSZip.loadAsync(await prepareTargetPack(draft, entry));
    const md = await zip.file("DESIGN.md")!.async("string");
    expect(md).toContain("not a finished app");
    expect(md).toMatch(/empty.*separate|separate.*empty/i);
    expect(md).toContain(content.headline);
    expect(zip.file("tokens.css")).not.toBeNull();
    expect(zip.file("focus-restyle/focus-tokens.css")).toBeNull();
  });

  it("keeps the existing pack safety validator in the preparation path", async () => {
    const unreadable = {
      ...entry,
      state: { ...entry.state, tokens: { ...entry.state.tokens, ink: entry.state.tokens.bg } },
    };
    await expect(prepareTargetPack(complete(), unreadable)).rejects.toThrow(/Contrast too low/);
    expect(targetPrompts(complete({ backup: "" }), entry)).toEqual([]);
  });

  it.each(["new", "existing"] as const)(
    "recovers an oversized %s handoff without dropping copy or changing the selected mode",
    async (integration) => {
      const draft = complete({
        integration,
        ...(integration === "existing"
          ? Object.fromEntries(
              ["page", "improvement", "tasks", "backup", "preview", "rollback"].map((key) => [
                key,
                "&".repeat(TARGET_LIMITS[key as keyof typeof TARGET_LIMITS]),
              ]),
            )
          : {}),
      });
      const selected = {
        ...entry,
        state: {
          ...entry.state,
          integration: integration === "new" ? "existing" : "new",
          content: {
            ...content,
            features: Array.from({ length: 8 }, (_, i) => ({
              title: `Detail ${i + 1}`,
              body: "<>&".repeat(420) + ` Final qualification ${i + 1}.`,
            })),
          },
        },
      };
      const before = JSON.stringify({ draft, selected });
      const zip = vi.spyOn(JSZip.prototype, "generateAsync");
      await expect(prepareTargetPack(draft, selected)).rejects.toThrow(
        integration === "new" ? /A new site or app/ : /Restyle my existing site or app/,
      );
      await expect(prepareTargetPack(draft, selected)).rejects.toThrow(
        /Download DESIGN\.md.*Your next conversations/s,
      );
      expect(zip).not.toHaveBeenCalled();
      expect(JSON.stringify({ draft, selected })).toBe(before);
      expect(targetPrompts(draft, selected)).toHaveLength(5);
    },
  );

  it("refuses a handoff that would be silently truncated by the exporter", async () => {
    const expanded = complete({
      page: "&".repeat(TARGET_LIMITS.page),
      improvement: "&".repeat(TARGET_LIMITS.improvement),
      tasks: "&".repeat(TARGET_LIMITS.tasks),
      backup: "&".repeat(TARGET_LIMITS.backup),
      preview: "&".repeat(TARGET_LIMITS.preview),
      rollback: "&".repeat(TARGET_LIMITS.rollback),
    });
    expect(targetStepIssues(expanded, 3, [entry])).toEqual([]);
    await expect(prepareTargetPack(expanded, entry)).rejects.toThrow(/too long/);
  });
});

describe("Target includes owner-selected Garden decisions", () => {
  it("binds the brief to the exact saved design and goal, and preserves it inside the received ZIP", async () => {
    const journey = {
      ...newGardenJourney(entry.id, "existing"),
      audience: "A new visitor",
      task: "See <prices> & book",
      decisions: {
        plan: { choice: "scannable-sections", note: "Price and duration go together." },
      },
    };
    const zip = await JSZip.loadAsync(await prepareTargetPack(complete(), entry, journey));
    const md = await zip.file("focus-restyle/DESIGN.md")!.async("string");
    const json = md.split("## Garden journey brief")[1]!.split("```json")[1]!.split("```")[0]!;
    expect(JSON.parse(json).brief).toEqual(journey);
    await expect(
      prepareTargetPack(complete(), entry, { ...journey, designId: "other" }),
    ).rejects.toThrow(/different design/);
    await expect(prepareTargetPack(complete(), entry, { ...journey, goal: "new" })).rejects.toThrow(
      /different design/,
    );
  });
});
