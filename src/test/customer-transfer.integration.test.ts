/**
 * Filesystem acceptance test of the real existing-site ZIP and its documented
 * manual transfer procedure. This is not an automatic customer-app installer:
 * callers must still follow the collision, backup, review and rollback steps.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import JSZip from "jszip";
import { buildPack, packFiles } from "@/lib/exportPack";
import { buildPrescription, normalizeTokens, type Content } from "@/lib/design";

const tokens = normalizeTokens({});
const content: Content = {
  brand: "Customer booking",
  headline: "Keep every customer task",
  sub: "An existing application, with its original words and features.",
  cta: "Book",
  features: [],
  quote: "",
};
const prescription = buildPrescription({
  brief: "Restyle the booking page only",
  content,
  direction: "Customer trial",
  tokens,
  picks: [],
  tool: "Lovable",
  integration: "existing",
});
const originalFiles: Record<string, string> = {
  "AGENTS.md": "# Customer rules\nNever change authorization or billing.\n",
  ".cursorrules": "Keep original component contracts.\n",
  "package.json": '{"name":"customer-booking","private":true}\n',
  "tokens.css": ":root{--background:#ffffff;--foreground:#111111}\n",
  "tailwind-theme.css": "/* Existing customer theme */\n",
  "src/entry.ts": 'import "./customer.css";\nimport { start } from "./app";\nstart();\n',
  "src/customer.css": "body{margin:0}.fixed{background:#123;color:#fff}\n",
  "src/app.ts": 'export const routes = ["/booking", "/account"];\nexport function start() {}\n',
  "src/authorization.ts": "export const requiresSession = true;\n",
  "customer-data.json": '{"draft":"Uncommitted customer work","bookings":[1,2]}\n',
  "index.html":
    '<!doctype html><html><head><meta name="generator" content="Customer CMS"><link rel="stylesheet" href="/existing-fonts.css"></head><body><main id="booking"><form action="/api/book"><input name="email" type="email" required><button>Book</button></form></main><aside id="portal">Account menu</aside></body></html>\n',
};

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function customerFixture() {
  const directory = await mkdtemp(join(tmpdir(), "focus-customer-transfer-"));
  temporary.push(directory);
  for (const [name, body] of Object.entries(originalFiles)) {
    await mkdir(dirname(join(directory, name)), { recursive: true });
    await writeFile(join(directory, name), body);
  }
  return directory;
}

async function fileHashes(directory: string, prefix = ""): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(result, await fileHashes(directory, name));
    else
      result[name] = createHash("sha256")
        .update(await readFile(join(directory, name)))
        .digest("hex");
  }
  return result;
}

async function realArchive() {
  return JSZip.loadAsync(
    await buildPack(prescription, tokens, content.brand, undefined, "existing"),
    {
      checkCRC32: true,
    },
  );
}

/** Model the guide's explicit STOP-on-collision procedure, with exclusive writes. */
async function extractIntoFreshFolder(zip: JSZip, customerDirectory: string) {
  const files = Object.entries(zip.files).filter(([, entry]) => !entry.dir);
  for (const [name] of files) expect(name).toMatch(/^focus-restyle\/[A-Za-z0-9_.-]+$/);
  // No writes happen before this exclusive creation. Generic unzip applications
  // can overwrite files; the ZIP itself does not implement this safety check.
  await mkdir(join(customerDirectory, "focus-restyle"));
  for (const [name, entry] of files) {
    await writeFile(join(customerDirectory, name), await entry.async("nodebuffer"), { flag: "wx" });
  }
}

describe("customer transfer acceptance: real archive and documented manual procedure", () => {
  it("extracts the complete existing-site archive without changing any original customer file", async () => {
    const directory = await customerFixture();
    const original = await fileHashes(directory);
    const archive = await realArchive();
    await extractIntoFreshFolder(archive, directory);
    const after = await fileHashes(directory);
    for (const [name, hash] of Object.entries(original)) expect(after[name], name).toBe(hash);

    const expected = packFiles(prescription, tokens, content.brand, undefined, "existing");
    for (const [name, body] of Object.entries(expected)) {
      expect(await readFile(join(directory, "focus-restyle", name), "utf8"), name).toBe(body);
    }
    expect(Object.keys(after)).toHaveLength(
      Object.keys(original).length + Object.keys(expected).length,
    );
    expect(
      Object.keys(after)
        .filter((name) => !(name in original))
        .every((name) => name.startsWith("focus-restyle/")),
    ).toBe(true);
    const guide = await readFile(join(directory, "focus-restyle/START-HERE.md"), "utf8");
    expect(guide).toMatch(/save a copy/i);
    expect(guide).toMatch(/never unzip over customer files/i);
    expect(guide).toMatch(/one.*wrapper/i);
    expect(guide).toMatch(/wait for approval/i);
  });

  it("the prescribed fresh-folder check refuses a repeat transfer before any write", async () => {
    const directory = await customerFixture();
    const archive = await realArchive();
    await extractIntoFreshFolder(archive, directory);
    await writeFile(
      join(directory, "focus-restyle/customer-notes.txt"),
      "Later customer work must survive.\n",
    );
    const before = await fileHashes(directory);
    await expect(extractIntoFreshFolder(archive, directory)).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await fileHashes(directory)).toEqual(before);
    expect(await archive.file("focus-restyle/READ-FIRST.txt")!.async("string")).toMatch(
      /STOP if a folder named focus-restyle/,
    );
  });

  it("selective rollback restores every original file while retaining later unrelated changes", async () => {
    const directory = await customerFixture();
    const original = await fileHashes(directory);
    const archive = await realArchive();
    await extractIntoFreshFolder(archive, directory);
    // Apply only the additions specified in the handoff. The source remains a
    // customer app: original routes, form, authorization and data stay in place.
    const imports =
      'import "../focus-restyle/focus-tokens.css";\nimport "../focus-restyle/focus-bridge.css";\n';
    const ruleBlock =
      "\n<!-- FOCUS-RESTYLE:BEGIN -->\nRead focus-restyle/FOCUS-RULES.md.\n<!-- FOCUS-RESTYLE:END -->\n";
    const newHeadTag = '<meta name="generator" content="Focus trial">';
    await writeFile(join(directory, "src/entry.ts"), originalFiles["src/entry.ts"] + imports);
    await writeFile(join(directory, "AGENTS.md"), originalFiles["AGENTS.md"] + ruleBlock);
    await writeFile(
      join(directory, "index.html"),
      originalFiles["index.html"]!.replace(
        '<main id="booking">',
        '<main id="booking" data-focus-restyle data-focus-theme="semantic">',
      ).replace("</head>", newHeadTag + "</head>"),
    );

    // A different developer works after the trial. Reverting a commit or
    // restoring whole-file backups would lose these legitimate changes.
    const unrelatedRule = "\nKeep the new customer support link.\n";
    const unrelatedRoute = 'export const supportRoute = "/support";\n';
    await writeFile(
      join(directory, "AGENTS.md"),
      (await readFile(join(directory, "AGENTS.md"), "utf8")) + unrelatedRule,
    );
    await writeFile(join(directory, "src/app.ts"), originalFiles["src/app.ts"] + unrelatedRoute);
    await writeFile(
      join(directory, "customer-later-note.txt"),
      "Unrelated work after the trial.\n",
    );

    // Follow UNDO.md: remove only additions recorded for this transfer.
    await writeFile(
      join(directory, "src/entry.ts"),
      (await readFile(join(directory, "src/entry.ts"), "utf8")).replace(imports, ""),
    );
    await writeFile(
      join(directory, "AGENTS.md"),
      (await readFile(join(directory, "AGENTS.md"), "utf8")).replace(ruleBlock, ""),
    );
    await writeFile(
      join(directory, "index.html"),
      (await readFile(join(directory, "index.html"), "utf8"))
        .replace(' data-focus-restyle data-focus-theme="semantic"', "")
        .replace(newHeadTag, ""),
    );
    const after = await fileHashes(directory);
    for (const [name, hash] of Object.entries(original)) {
      if (!["AGENTS.md", "src/app.ts"].includes(name)) expect(after[name], name).toBe(hash);
    }
    expect(await readFile(join(directory, "AGENTS.md"), "utf8")).toBe(
      originalFiles["AGENTS.md"] + unrelatedRule,
    );
    expect(await readFile(join(directory, "src/app.ts"), "utf8")).toBe(
      originalFiles["src/app.ts"] + unrelatedRoute,
    );
    expect(await readFile(join(directory, "customer-later-note.txt"), "utf8")).toBe(
      "Unrelated work after the trial.\n",
    );
    const undo = await archive.file("focus-restyle/UNDO.md")!.async("string");
    expect(undo).toMatch(/preserve any later unrelated work/i);
    expect(undo).toMatch(/never hard-reset/i);
    expect(undo).toMatch(/repeat the original visitor tasks/i);
    expect(undo).toMatch(/only the new font links/i);
  });
});
