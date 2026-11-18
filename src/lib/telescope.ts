import JSZip from "jszip";
import { z } from "zod";

export const TELESCOPE_LIMITS = {
  fileBytes: 10 * 1024 * 1024,
  entries: 200,
  entryBytes: 8 * 1024 * 1024,
  expandedBytes: 32 * 1024 * 1024,
  textBytes: 2 * 1024 * 1024,
  inspectedTextBytes: 8 * 1024 * 1024,
  receiptBytes: 256 * 1024,
  references: 500,
  findings: 400,
  inspectionMs: 8000,
} as const;

const findingSchema = z
  .object({
    id: z.string().min(1).max(80),
    level: z.enum(["fail", "warn", "unknown"]),
    message: z.string().min(1).max(1200),
    path: z.string().max(240).optional(),
  })
  .strict();
const count = z.number().int().min(0).max(TELESCOPE_LIMITS.entries);
const receiptSchema = z
  .object({
    schema: z.literal("focus.telescope.build-receipt"),
    version: z.literal(1),
    scope: z.literal("static-inventory-only"),
    createdAt: z.string().datetime(),
    artifact: z
      .object({
        name: z.string().min(1).max(180),
        kind: z.enum(["html", "zip"]),
        bytes: z.number().int().positive().max(TELESCOPE_LIMITS.fileBytes),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    inventory: z
      .object({
        files: count,
        html: count,
        css: count,
        javascript: count,
        images: count,
        other: count,
        entryHtml: z.string().max(240).nullable(),
      })
      .strict(),
    execution: z
      .object({
        rendered: z.literal(false),
        scriptsExecuted: z.literal(false),
        networkRequests: z.literal(false),
        browserTests: z.literal("not-run"),
      })
      .strict(),
    findings: z.array(findingSchema).max(TELESCOPE_LIMITS.references + 20),
  })
  .strict()
  .refine(
    (r) =>
      r.inventory.files ===
      r.inventory.html +
        r.inventory.css +
        r.inventory.javascript +
        r.inventory.images +
        r.inventory.other,
    "Inventory counts disagree.",
  );
export type TelescopeReceipt = z.infer<typeof receiptSchema>;
type Finding = z.infer<typeof findingSchema>;
type ZipEntry = {
  name: string;
  directory: boolean;
  expanded: number;
  compressed: number;
  crc: number;
  start: number;
  end: number;
};

function failure(message: string): never {
  throw new Error(message);
}
function unsafeNameCharacter(character: string): boolean {
  const point = character.codePointAt(0)!;
  return (
    point < 32 ||
    (point >= 127 && point <= 159) ||
    (point >= 0x202a && point <= 0x202e) ||
    (point >= 0x2066 && point <= 0x2069)
  );
}
function zipName(raw: Uint8Array, utf8: boolean): string {
  if (!utf8 && raw.some((byte) => byte > 127))
    failure("This ZIP uses an unsupported filename encoding. Export it with UTF-8 names.");
  let name: string;
  try {
    name = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return failure("This ZIP contains an unreadable filename.");
  }
  if (
    !name ||
    name.length > 240 ||
    /^[/.]/.test(name) ||
    /[\\:]/.test(name) ||
    [...name].some(unsafeNameCharacter)
  )
    failure("This ZIP contains an unsafe or ambiguous path name.");
  const parts = name.replace(/\/$/, "").split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        /[. ]$/.test(part) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  )
    failure("This ZIP contains an unsafe or ambiguous path name.");
  return name;
}
function extraFields(view: DataView, start: number, size: number) {
  const end = start + size;
  for (let at = start; at < end;) {
    if (at + 4 > end) failure("Malformed ZIP extra fields.");
    const id = view.getUint16(at, true),
      length = view.getUint16(at + 2, true);
    if ([0x0001, 0x7075, 0x6375, 0x9901].includes(id))
      failure("ZIP64, alternate filename and encrypted ZIP extensions are not supported.");
    at += 4 + length;
    if (at > end) failure("Malformed ZIP extra fields.");
  }
}

/** Inspect raw records before JSZip can sanitize names or collapse duplicates. */
function inspectZipHeaders(data: Uint8Array): ZipEntry[] {
  if (data.length < 22) return failure("This file is not a complete ZIP.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let end = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 65557); at--) {
    if (
      view.getUint32(at, true) === 0x06054b50 &&
      at + 22 + view.getUint16(at + 20, true) === data.length
    ) {
      end = at;
      break;
    }
  }
  if (end < 0) return failure("This ZIP has a missing or malformed directory.");
  const entryCount = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== entryCount
  )
    failure("Multi-disk ZIP files are not supported.");
  if (entryCount === 65535 || size === 0xffffffff || offset === 0xffffffff)
    failure("ZIP64 files are not supported.");
  if (!entryCount || entryCount > TELESCOPE_LIMITS.entries)
    failure("The ZIP entry count exceeds the 200-entry limit or the ZIP is empty.");
  if (offset + size !== end || offset < 30)
    failure("This ZIP has inconsistent directory boundaries.");
  const entries: ZipEntry[] = [],
    names = new Map<string, boolean>();
  let at = offset,
    total = 0;
  for (let index = 0; index < entryCount; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50)
      failure("This ZIP has a malformed directory entry.");
    const flags = view.getUint16(at + 8, true),
      method = view.getUint16(at + 10, true);
    if (flags & 0x2041) failure("Encrypted ZIP entries are not supported.");
    if (flags & ~0x080e || ![0, 8].includes(method))
      failure("This ZIP uses unsupported compression or flags.");
    const compressed = view.getUint32(at + 20, true),
      expanded = view.getUint32(at + 24, true);
    const nameSize = view.getUint16(at + 28, true),
      extraSize = view.getUint16(at + 30, true),
      commentSize = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true),
      crc = view.getUint32(at + 16, true);
    if (at + 46 + nameSize + extraSize + commentSize > end)
      failure("This ZIP has a truncated filename or metadata.");
    if (
      expanded > TELESCOPE_LIMITS.entryBytes ||
      (total += expanded) > TELESCOPE_LIMITS.expandedBytes ||
      compressed > data.length
    )
      failure("This ZIP exceeds its expanded size limits (8 MiB per entry, 32 MiB total).");
    if (expanded > 1024 * 1024 && expanded > Math.max(1, compressed) * 100)
      failure("This ZIP exceeds the supported compression ratio limit.");
    const rawName = data.subarray(at + 46, at + 46 + nameSize);
    const name = zipName(rawName, !!(flags & 0x800));
    const directory = name.endsWith("/");
    const unixKind = (view.getUint32(at + 38, true) >>> 16) & 0xf000;
    if (unixKind && unixKind !== 0x8000 && unixKind !== 0x4000)
      failure("Symbolic links and non-regular ZIP entries are not supported.");
    if ((unixKind === 0x4000 && !directory) || (directory && expanded))
      failure("This ZIP has inconsistent directory metadata.");
    if (view.getUint16(at + 34, true)) failure("Multi-disk ZIP entries are not supported.");
    extraFields(view, at + 46 + nameSize, extraSize);
    const key = name.replace(/\/$/, "").normalize("NFC").toLowerCase();
    if (names.has(key)) failure("This ZIP has duplicate names or a filename collision.");
    names.set(key, directory);
    if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50)
      failure("This ZIP has a malformed local header.");
    const localNameSize = view.getUint16(local + 26, true),
      localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localNameSize + localExtra;
    if (
      start + compressed > offset ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method ||
      localNameSize !== nameSize ||
      data.subarray(local + 30, local + 30 + localNameSize).some((byte, i) => byte !== rawName[i])
    )
      failure("This ZIP has inconsistent local headers or names.");
    extraFields(view, local + 30 + localNameSize, localExtra);
    let finish = start + compressed;
    if (flags & 8) {
      if (finish + 12 > offset) failure("This ZIP has a truncated size descriptor.");
      if (view.getUint32(finish, true) === 0x08074b50) finish += 4;
      if (
        finish + 12 > offset ||
        view.getUint32(finish, true) !== crc ||
        view.getUint32(finish + 4, true) !== compressed ||
        view.getUint32(finish + 8, true) !== expanded
      )
        failure("This ZIP has an inconsistent size descriptor.");
      finish += 12;
    } else if (
      view.getUint32(local + 14, true) !== crc ||
      view.getUint32(local + 18, true) !== compressed ||
      view.getUint32(local + 22, true) !== expanded
    ) {
      failure("This ZIP has inconsistent local size or checksum metadata.");
    }
    entries.push({ name, directory, expanded, compressed, crc, start: local, end: finish });
    at += 46 + nameSize + extraSize + commentSize;
  }
  if (at !== end) failure("This ZIP has unexpected directory records.");
  for (const [name] of names) {
    const parts = name.split("/");
    for (let length = 1; length < parts.length; length++)
      if (names.get(parts.slice(0, length).join("/")) === false)
        failure("This ZIP has a file/directory path collision.");
  }
  const ordered = [...entries].sort((a, b) => a.start - b.start);
  if (
    ordered[0]?.start !== 0 ||
    ordered.some((entry, i) => i > 0 && entry.start < ordered[i - 1]!.end)
  )
    failure("This ZIP has overlapping or unsupported prefixed entries.");
  return entries;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Pause the inflater as soon as actual output exceeds its declared or inspection budget. */
interface ZipTextStream {
  pause(): void;
  resume(): void;
  on(event: "data", callback: (chunk: Uint8Array) => void): void;
  on(event: "error", callback: () => void): void;
  on(event: "end", callback: () => void): void;
}

function readZipText(
  file: JSZip.JSZipObject,
  entry: ZipEntry,
  maximum: number,
  deadline: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = (
        file as JSZip.JSZipObject & { internalStream(type: "uint8array"): ZipTextStream }
      ).internalStream("uint8array"),
      chunks: Uint8Array[] = [];
    let size = 0,
      settled = false;
    const stop = (message: string) => {
      if (settled) return;
      settled = true;
      stream.pause();
      reject(new Error(message));
    };
    stream.on("data", (chunk: Uint8Array) => {
      if (settled) return;
      if (Date.now() > deadline) {
        stop("Inspection exceeded its eight-second processing budget.");
        return;
      }
      size += chunk.byteLength;
      if (size > maximum || size > entry.expanded) {
        stop("An expanded ZIP entry exceeded its actual-byte inspection limit.");
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", () => stop("A ZIP text entry could not be decompressed safely."));
    stream.on("end", () => {
      if (settled) return;
      if (size !== entry.expanded) {
        stop("A ZIP entry's actual size differs from its metadata.");
        return;
      }
      const output = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      if (crc32(output) !== entry.crc) {
        stop("A ZIP text entry failed its checksum check.");
        return;
      }
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(output);
        settled = true;
        resolve(text);
      } catch {
        stop("A ZIP text entry is not supported UTF-8 text.");
      }
    });
    stream.resume();
  });
}

function category(name: string): "html" | "css" | "javascript" | "images" | "other" {
  if (/\.html?$/i.test(name)) return "html";
  if (/\.css$/i.test(name)) return "css";
  if (/\.(?:m?js|cjs)$/i.test(name)) return "javascript";
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(name)) return "images";
  return "other";
}
function readAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  let at = 0;
  while (at < source.length) {
    while (at < source.length && /[\s/]/.test(source[at]!)) at++;
    const start = at;
    while (at < source.length && /[\w:-]/.test(source[at]!)) at++;
    if (at === start) {
      at++;
      continue;
    }
    const name = source.slice(start, at).toLowerCase();
    while (at < source.length && /\s/.test(source[at]!)) at++;
    if (source[at] !== "=") continue;
    at++;
    while (at < source.length && /\s/.test(source[at]!)) at++;
    let value: string;
    if (source[at] === '"' || source[at] === "'") {
      const quote = source[at++]!;
      const end = source.indexOf(quote, at);
      if (end < 0) break;
      value = source.slice(at, end);
      at = end + 1;
    } else {
      const begin = at;
      while (at < source.length && !/[\s>]/.test(source[at]!)) at++;
      value = source.slice(begin, at);
    }
    if (!attrs.has(name)) attrs.set(name, value);
  }
  return attrs;
}

function tagEnd(text: string, start: number): number {
  let quote = "";
  // An unusually large/malformed tag is uninspected instead of scanning it repeatedly.
  for (let at = start; at < Math.min(text.length, start + 8192); at++) {
    const character = text[at]!;
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ">") return at;
  }
  return -1;
}

/** Linear, capped text scans. No DOM construction, URLs loaded or supplied code evaluated. */
function references(
  text: string,
  kind: "html" | "css",
): { refs: string[]; base: boolean; incomplete: boolean; executable: boolean } {
  const refs: string[] = [];
  let incomplete = false;
  if (kind === "css") {
    const chunks: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf("/*", cursor);
      if (start < 0) {
        chunks.push(text.slice(cursor));
        break;
      }
      chunks.push(text.slice(cursor, start));
      const end = text.indexOf("*/", start + 2);
      if (end < 0) {
        incomplete = true;
        break;
      }
      cursor = end + 2;
    }
    const css = chunks.join(""),
      lower = css.toLowerCase();
    cursor = 0;
    while (cursor < css.length && refs.length < TELESCOPE_LIMITS.references) {
      const start = lower.indexOf("url(", cursor);
      if (start < 0) break;
      const end = css.indexOf(")", start + 4);
      if (end < 0) {
        incomplete = true;
        break;
      }
      let value = css.slice(start + 4, end).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      if (!value || value.length > 2000 || value.includes("(") || value.includes("\\"))
        incomplete = true;
      else refs.push(value);
      cursor = end + 1;
    }
    return {
      refs,
      base: false,
      incomplete:
        incomplete ||
        lower.includes("@import") ||
        lower.includes("var(") ||
        refs.length >= TELESCOPE_LIMITS.references,
      executable: false,
    };
  }
  const lower = text.toLowerCase();
  let cursor = 0,
    tags = 0,
    base = false,
    executable = false;
  const resourceTags = new Set([
    "script",
    "link",
    "img",
    "source",
    "video",
    "audio",
    "track",
    "iframe",
  ]);
  while (cursor < text.length && tags++ < 5000 && refs.length < TELESCOPE_LIMITS.references) {
    const start = lower.indexOf("<", cursor);
    if (start < 0) break;
    if (lower.startsWith("<!--", start)) {
      const end = lower.indexOf("-->", start + 4);
      if (end < 0) {
        incomplete = true;
        break;
      }
      cursor = end + 3;
      continue;
    }
    const end = tagEnd(text, start + 1);
    if (end < 0) {
      incomplete = true;
      break;
    }
    cursor = end + 1;
    let nameEnd = start + 1;
    while (nameEnd < end && /[a-z0-9:-]/.test(lower[nameEnd]!)) nameEnd++;
    const name = lower.slice(start + 1, nameEnd);
    if (!name) continue;
    const attrs = readAttributes(text.slice(nameEnd, end));
    if (name === "base") base = true;
    if (
      name === "script" ||
      name === "iframe" ||
      [...attrs.keys()].some((key) => key.startsWith("on"))
    )
      executable = true;
    if (
      attrs.has("srcset") ||
      attrs.has("style") ||
      [...attrs.values()].some((value) => value.includes("&"))
    )
      incomplete = true;
    if (resourceTags.has(name)) {
      if (
        name === "link" &&
        (attrs.get("rel") ?? "")
          .toLowerCase()
          .split(/\s+/)
          .some((rel) => ["stylesheet", "icon", "preload"].includes(rel))
      )
        refs.push(attrs.get("href") ?? "");
      if (name !== "link") refs.push(attrs.get("src") ?? "");
      if (name === "video") refs.push(attrs.get("poster") ?? "");
    }
    if (["script", "style", "textarea"].includes(name)) {
      if (name === "style") incomplete = true;
      let closing = lower.indexOf(`</${name}`, cursor);
      while (closing >= 0 && !/[\s>]/.test(lower[closing + name.length + 2] ?? ""))
        closing = lower.indexOf(`</${name}`, closing + name.length + 2);
      if (closing < 0) {
        incomplete = true;
        break;
      }
      const closingEnd = tagEnd(text, closing + name.length + 2);
      if (closingEnd < 0) {
        incomplete = true;
        break;
      }
      cursor = closingEnd + 1;
    }
  }
  return {
    refs: refs.filter(Boolean),
    base,
    incomplete: incomplete || tags >= 5000 || refs.length >= TELESCOPE_LIMITS.references,
    executable,
  };
}

export async function inspectTelescopeArtifact(
  name: string,
  bytes: Uint8Array,
): Promise<TelescopeReceipt> {
  const deadline = Date.now() + TELESCOPE_LIMITS.inspectionMs;
  const checkTime = () => {
    if (Date.now() > deadline)
      failure(
        "Inspection exceeded its eight-second processing budget. Choose a smaller built export.",
      );
  };
  if (!bytes.length || bytes.length > TELESCOPE_LIMITS.fileBytes)
    failure("Choose a nonempty HTML or ZIP file within the 10 MiB file limit.");
  const kind = /\.zip$/i.test(name) ? "zip" : /\.html?$/i.test(name) ? "html" : null;
  if (!kind) failure("Choose a built .html, .htm or .zip file.");
  if (!globalThis.crypto?.subtle)
    failure("This browser cannot compute the required SHA-256. Use a secure, current browser.");
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  const sha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const artifactName =
    [...name.split(/[\\/]/).pop()!]
      .filter((character) => !unsafeNameCharacter(character))
      .join("")
      .slice(0, 180) || "selected-file";
  const textFiles = new Map<string, string>();
  const findings: Finding[] = [];
  let files: string[];
  if (kind === "html") {
    if (bytes.length > TELESCOPE_LIMITS.textBytes)
      failure("A single HTML file must be no larger than 2 MiB.");
    try {
      textFiles.set(artifactName, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return failure("Choose a UTF-8 HTML export.");
    }
    files = [artifactName];
    findings.push({
      id: "standalone-assets-unknown",
      level: "unknown",
      message:
        "A standalone HTML file does not include its neighboring files. Local asset availability cannot be confirmed; choose its built ZIP for a package inventory.",
    });
  } else {
    const entries = inspectZipHeaders(bytes);
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: false, createFolders: false });
    if (
      Object.keys(zip.files).length !== entries.length ||
      entries.some((entry) => !zip.files[entry.name])
    )
      failure("ZIP filenames changed while loading. Inspection stopped.");
    files = entries.filter((entry) => !entry.directory).map((entry) => entry.name);
    let inspected = 0;
    for (const entry of entries) {
      checkTime();
      if (entry.directory || !["html", "css"].includes(category(entry.name))) continue;
      if (
        entry.expanded > TELESCOPE_LIMITS.textBytes ||
        inspected + entry.expanded > TELESCOPE_LIMITS.inspectedTextBytes
      ) {
        findings.push({
          id: "text-budget-unverified",
          level: "unknown",
          path: entry.name,
          message:
            "This text file was inventoried but not inspected because it exceeds the 2 MiB file or 8 MiB total text budget.",
        });
        continue;
      }
      textFiles.set(
        entry.name,
        await readZipText(
          zip.files[entry.name]!,
          entry,
          Math.min(TELESCOPE_LIMITS.textBytes, TELESCOPE_LIMITS.inspectedTextBytes - inspected),
          deadline,
        ),
      );
      inspected += entry.expanded;
    }
    findings.push({
      id: "binary-content-unverified",
      level: "unknown",
      message:
        "Non-HTML/CSS files were inventoried from ZIP metadata only. Their contents, checksums, fonts and image decoding were not verified.",
    });
  }
  const inventory: TelescopeReceipt["inventory"] = {
    files: files.length,
    html: 0,
    css: 0,
    javascript: 0,
    images: 0,
    other: 0,
    entryHtml: null,
  };
  for (const file of files) inventory[kind === "html" ? "html" : category(file)]++;
  const htmlFiles = files
    .filter((file) => kind === "html" || category(file) === "html")
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  inventory.entryHtml =
    htmlFiles.find((file) => /(?:^|\/)index\.html?$/i.test(file)) ?? htmlFiles[0] ?? null;
  if (!inventory.html)
    findings.push({
      id: "no-html-entry",
      level: "fail",
      message:
        "No HTML page was found. This may be a source/server build; choose the deployable frontend output for this static inspection.",
    });
  const paths = new Set(files),
    missing = new Set<string>();
  let totalReferences = 0,
    external = false,
    incomplete = false;
  for (const [file, text] of textFiles) {
    checkTime();
    const result = references(text, category(file) === "css" ? "css" : "html");
    if (result.base)
      findings.push({
        id: "base-url-unverified",
        level: "unknown",
        path: file,
        message:
          "This page sets a base URL. Relative asset resolution depends on hosting and was not inferred.",
      });
    if (result.executable)
      findings.push({
        id: "executable-content-unreviewed",
        level: "warn",
        path: file,
        message:
          "Scripts, event handlers or embedded frames are present. Telescope did not execute them or establish that their behavior is safe.",
      });
    incomplete ||= result.incomplete;
    for (const raw of result.refs) {
      if (++totalReferences > TELESCOPE_LIMITS.references) {
        incomplete = true;
        break;
      }
      if (!raw || raw.startsWith("#")) continue;
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) {
        external = true;
        continue;
      }
      if (kind !== "zip" || result.base || /[{}<>]|&(?:#\w+|\w+);|\\/.test(raw)) {
        incomplete = true;
        continue;
      }
      if (raw.startsWith("/")) {
        incomplete = true;
        continue;
      } // Hosting root may differ from ZIP root.
      try {
        const path = decodeURIComponent(
          new URL(raw, `https://telescope.invalid/${file}`).pathname,
        ).slice(1);
        if (paths.has(path)) continue;
        if (!missing.has(path)) {
          missing.add(path);
          findings.push({
            id: "missing-local-asset",
            level: "warn",
            path: path.slice(0, 240),
            message:
              "A statically referenced local asset was not found at this package-relative path. Check the hosting base and build output before treating it as a broken link.",
          });
        }
      } catch {
        incomplete = true;
      }
    }
  }
  if (external)
    findings.push({
      id: "external-resources-unverified",
      level: "unknown",
      message:
        "External or embedded resource references were found. They were not fetched, decoded, inspected or checked for availability.",
    });
  if (incomplete)
    findings.push({
      id: "reference-resolution-unverified",
      level: "unknown",
      message:
        "Some references need a browser or hosting context: root paths, inline CSS, srcset, entities, dynamic values, imports or the reference limit. Static inventory is incomplete.",
    });
  findings.push({
    id: "runtime-unverified",
    level: "unknown",
    message:
      "Browser behavior, visual quality, responsive layout, accessibility, authenticated tasks, security and rollback have not been tested. Missing findings do not establish readiness.",
  });
  if (findings.length > TELESCOPE_LIMITS.findings) {
    findings.splice(TELESCOPE_LIMITS.findings - 2);
    findings.push({
      id: "findings-truncated",
      level: "unknown",
      message:
        "Additional findings were omitted to keep this receipt bounded. Inspect a smaller package and complete browser checks; this report is incomplete.",
    });
    findings.push({
      id: "runtime-unverified",
      level: "unknown",
      message: "No browser, task, security or release-readiness verification was performed.",
    });
  }
  checkTime();
  const report = receiptSchema.parse({
    schema: "focus.telescope.build-receipt",
    version: 1,
    scope: "static-inventory-only",
    createdAt: new Date().toISOString(),
    artifact: { name: artifactName, kind, bytes: bytes.length, sha256 },
    inventory,
    execution: {
      rendered: false,
      scriptsExecuted: false,
      networkRequests: false,
      browserTests: "not-run",
    },
    findings,
  });
  // The exported, pretty-printed receipt must be accepted by the same byte-bounded importer.
  const receiptSize = (items: Finding[]) =>
    new TextEncoder().encode(JSON.stringify({ ...report, findings: items }, null, 2) + "\n").length;
  if (receiptSize(report.findings) > TELESCOPE_LIMITS.receiptBytes) {
    const ending: Finding[] = [
      {
        id: "findings-truncated",
        level: "unknown",
        message:
          "Additional findings were omitted to keep the receipt within its 256 KiB size limit. This inventory is incomplete.",
      },
      {
        id: "runtime-unverified",
        level: "unknown",
        message: "No browser, task, security or release-readiness verification was performed.",
      },
    ];
    let lower = 0,
      upper = report.findings.length;
    while (lower < upper) {
      const middle = Math.ceil((lower + upper) / 2);
      if (
        receiptSize([...report.findings.slice(0, middle), ...ending]) <=
        TELESCOPE_LIMITS.receiptBytes
      )
        lower = middle;
      else upper = middle - 1;
    }
    report.findings = [...report.findings.slice(0, lower), ...ending];
  }
  checkTime();
  return report;
}

export function parseTelescopeReceipt(text: string): TelescopeReceipt {
  if (
    text.length > TELESCOPE_LIMITS.receiptBytes ||
    new TextEncoder().encode(text).length > TELESCOPE_LIMITS.receiptBytes
  )
    failure("Choose a Telescope receipt smaller than 256 KiB.");
  try {
    return receiptSchema.parse(JSON.parse(text));
  } catch {
    return failure(
      "This is not a supported Telescope static build receipt. Browser reports belong in Quality lab.",
    );
  }
}
export function compareTelescopeReceipts(
  previous: TelescopeReceipt,
  selected: TelescopeReceipt,
): "same-bytes" | "different-bytes" | "metadata-conflict" {
  if (previous.artifact.sha256 !== selected.artifact.sha256) return "different-bytes";
  if (
    previous.artifact.bytes !== selected.artifact.bytes ||
    previous.artifact.kind !== selected.artifact.kind
  )
    return "metadata-conflict";
  return "same-bytes";
}

export const TELESCOPE_STATES = [
  "loading",
  "empty",
  "error",
  "success",
  "validation",
  "keyboard",
  "recovery",
] as const;
export type TelescopeState = (typeof TELESCOPE_STATES)[number];
export const TELESCOPE_STATE_HINTS: Record<TelescopeState, string> = {
  loading: "The task shows progress without losing input or creating duplicate actions.",
  empty: "No results or first use explains a useful next action.",
  error: "A failed request explains recovery and preserves valid work.",
  success: "Completion corresponds to the intended record and confirms the result.",
  validation: "Invalid input is explained beside the field; valid input is retained.",
  keyboard: "The whole task works with keyboard, visible focus and meaningful reading order.",
  recovery: "Selective rollback restores the original task without losing unrelated changes.",
};
const markdownLine = (text: string) =>
  text
    .slice(0, 1000)
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_{}[\]<>|#]/g, "\\$&");
export function telescopeTestPlan(
  receipt: TelescopeReceipt,
  task: string,
  expectations: Partial<Record<TelescopeState, string>> = {},
): string {
  return `# Telescope interaction test plan\n\nStatus: manual — not run. This is a blank plan, not browser evidence or release approval.\n\nArtifact: ${markdownLine(receipt.artifact.name)}\nSHA-256 of exact selected file: ${receipt.artifact.sha256}\nStatic receipt scope: ${receipt.scope}\n\nPrimary visitor task: ${markdownLine(task.trim() || "Define the primary task before testing.")}\n\nUse an isolated staging/local copy, test accounts and sandbox integrations. Disconnect production writes. Record a backup and the exact tested revision.\n\n| State | Expected outcome | Status | Actual evidence / issue |\n| --- | --- | --- | --- |\n${TELESCOPE_STATES.map((state) => `| ${state} | ${markdownLine(expectations[state]?.trim() || TELESCOPE_STATE_HINTS[state])} | manual — not run | |`).join("\n")}\n\nRepeat on desktop, phone and keyboard; inspect focus, errors, dialogs, overflow and readable text. Capture before/after evidence at the same viewport. Record browser and assistive technology used.\n\nDemonstrate selective rollback and rerun the original task. Preserve customer files and unrelated later work. Record unresolved findings and obtain owner review before deploying through the customer's own hosting tool. A changed artifact hash needs a new inspection and task review.\n`;
}
