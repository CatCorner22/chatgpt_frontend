// The colleague kit copies this file to start.mjs. Everything it needs ships in the ZIP.
import { createHash, randomInt, randomUUID } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const mediaTypes = new Map(
  Object.entries({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  }),
);

async function checkedFiles(directory) {
  const root = await realpath(directory);
  const manifest = await readFile(join(root, "SHA256SUMS"), "utf8");
  const files = new Map();
  for (const row of manifest.trimEnd().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(row);
    if (!match) throw new Error("The kit checksum list is incomplete.");
    const [, expected, name] = match;
    if (
      files.has(name) ||
      name.includes("\\") ||
      name.includes(":") ||
      name.split("/").some((part) => !part || part.startsWith("."))
    )
      throw new Error("The kit contains a duplicate or invalid file name.");
    const path = join(root, name);
    if ((await realpath(path)) !== path || !(await stat(path)).isFile())
      throw new Error("Extract the kit into a fresh folder with regular files.");
    const bytes = await readFile(path);
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error(`The file ${name} differs from the supplied kit. Extract a fresh copy.`);
    files.set(name, bytes);
  }
  return files;
}

function required(files, name) {
  const bytes = files.get(name);
  if (!bytes) throw new Error(`The extracted kit is missing ${name}.`);
  return bytes;
}

function pageFiles(files, directory) {
  const index = required(files, directory + "/index.html");
  const pages = new Map([
    ["/", index],
    ["/index.html", index],
  ]);
  for (const [name, bytes] of files) {
    if (name.startsWith(directory + "/assets/") && mediaTypes.has(extname(name)))
      pages.set(name.slice(directory.length), bytes);
  }
  return pages;
}

async function listen(pages, bookingService) {
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (request.headers.host !== "127.0.0.1:" + server.address()?.port) {
      response.writeHead(403).end();
      return;
    }
    const serveFile = () => {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
      }
      // The allowlist contains in-memory public build files only. No request reads the filesystem.
      const path = request.url.split("?")[0];
      const bytes = pages.get(path);
      if (!bytes) {
        response.writeHead(404).end();
        return;
      }
      response
        .writeHead(200, {
          "Content-Type": mediaTypes.get(path === "/" ? ".html" : extname(path)),
          "Content-Length": bytes.length,
        })
        .end(request.method === "HEAD" ? undefined : bytes);
    };
    try {
      if (bookingService) await bookingService(request, response, serveFile);
      else serveFile();
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}

const address = (server) => `http://127.0.0.1:${server.address().port}/`;

export async function startPilot(directory) {
  const files = await checkedFiles(directory);
  required(files, "booking-service.mjs");
  const { createBookingService } = await import(
    pathToFileURL(resolve(directory, "booking-service.mjs")).href
  );
  const organizer = JSON.parse(required(files, "private/organizer-template.json"));
  const packet = JSON.parse(required(files, "private/packet-template.json"));
  const groups = ["original", "guided"];
  if (
    organizer.protocol !== "booking-pair-v1" ||
    organizer.id !== packet.benchmarkId ||
    organizer.samples?.length !== 2 ||
    packet.samples?.length !== 2 ||
    new Set(packet.samples.map((s) => s.id)).size !== 2 ||
    !groups.every((group) => organizer.samples.some((s) => s.group === group)) ||
    !packet.samples.every((s) =>
      organizer.samples.some(
        (o) => o.id === s.id && o.taskId === s.taskId && o.kind === "interactive",
      ),
    )
  )
    throw new Error("The private organizer file and reviewer packet describe different samples.");

  const servers = [];
  const close = async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          }),
      ),
    );
  };
  try {
    for (const sample of organizer.samples) {
      const server = await listen(
        pageFiles(files, "samples/" + sample.group),
        createBookingService(),
      );
      servers.push(server);
      sample.assetRef = address(server);
    }
    // Sample IDs and study ID stay stable for scoring. Only presentation order and local URLs vary.
    if (randomInt(2)) packet.samples.reverse();
    packet.samples = packet.samples.map(({ id, taskId, kind }, index) => ({
      id,
      taskId,
      kind,
      label: index === 0 ? "Sample A" : "Sample B",
      assetRef: organizer.samples.find((s) => s.id === id).assetRef,
    }));
    const reviewer = pageFiles(files, "reviewer");
    reviewer.set("/packet.json", Buffer.from(JSON.stringify(packet)));
    const server = await listen(reviewer);
    servers.push(server);
    const organizerPath = resolve(directory, "private", `organizer-${randomUUID()}.json`);
    await writeFile(organizerPath, JSON.stringify(organizer, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return { reviewerUrl: address(server), organizerPath, close };
  } catch (error) {
    await close();
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const pilot = await startPilot(dirname(fileURLToPath(import.meta.url)));
    console.log("Reviewer URL: " + pilot.reviewerUrl);
    console.log("Private organizer file: " + pilot.organizerPath);
    console.log(
      "Keep this terminal open. Export answers before pressing Ctrl+C to end the session.",
    );
    process.once("SIGINT", pilot.close);
    process.once("SIGTERM", pilot.close);
  } catch (error) {
    console.error("The pilot could not start. " + error.message);
    process.exitCode = 1;
  }
}
