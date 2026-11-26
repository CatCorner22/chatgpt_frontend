import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const checkout = fileURLToPath(new URL("../", import.meta.url));
const entry = join(checkout, "examples", "pilot-reviewer");

async function resolveParent(path) {
  try {
    return await realpath(path);
  } catch (error) {
    if (error.code !== "ENOENT" || path === dirname(path)) throw error;
    return join(await resolveParent(dirname(path)), basename(path));
  }
}

async function requireEmpty(directory) {
  let stat;
  try {
    stat = await lstat(directory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!stat.isDirectory() || (await readdir(directory)).length)
    throw new Error("Choose a new or empty output directory. Existing files were left in place.");
}

export async function buildPilotReviewer(destination) {
  if (!destination) throw new Error("Supply a new or empty output directory.");
  const target = resolve(destination);
  const directory = join(await resolveParent(dirname(target)), basename(target));
  const fromRoot = relative(await realpath(checkout), directory);
  if (
    !isAbsolute(fromRoot) &&
    !fromRoot.startsWith(".." + sep) &&
    fromRoot !== ".." &&
    !fromRoot.startsWith("artifacts" + sep) &&
    fromRoot !== "artifacts"
  )
    throw new Error("Place the review build under artifacts/ or outside the checkout.");
  await requireEmpty(directory);
  // Build in memory. Only the standalone entry and its imported assets go into the kit.
  const result = await build({
    root: entry,
    configFile: false,
    envDir: false,
    envPrefix: [],
    publicDir: false,
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": join(checkout, "src") }, dedupe: ["react", "react-dom", "zod"] },
    define: { "import.meta.env.VITE_FOCUS_HOSTED": JSON.stringify("false") },
    build: {
      write: false,
      copyPublicDir: false,
      sourcemap: false,
      license: { fileName: "licenses.txt" },
    },
  });

  // Tailwind resolves CSS-only imports before Vite enumerates bundled modules.
  const notices = result.output.find((file) => file.fileName === "licenses.txt");
  if (notices?.type !== "asset" || typeof notices.source !== "string")
    throw new Error("The dependency notices were missing from the reviewer build.");
  let licenses = notices.source;
  for (const name of ["tailwindcss", "tw-animate-css"]) {
    const pkg = join(checkout, "node_modules", name);
    const { version, license } = JSON.parse(await readFile(join(pkg, "package.json"), "utf8"));
    const text = await readFile(join(pkg, "LICENSE"), "utf8");
    licenses += `\n## ${name} - ${version} (${license})\n\n${text}\n`;
  }
  for (const { fileName } of result.output) {
    if (
      fileName !== "index.html" &&
      fileName !== "licenses.txt" &&
      !/^assets\/[\w.-]+\.(?:js|css|woff2|txt)$/.test(fileName)
    )
      throw new Error("Unexpected file type in the participant build: " + fileName);
  }
  await requireEmpty(directory);
  await mkdir(directory, { recursive: true });
  await mkdir(join(directory, "assets"));
  for (const file of result.output) {
    const contents = file.type === "chunk" ? file.code : file.source;
    await writeFile(
      join(directory, file.fileName),
      file.fileName === "licenses.txt" ? licenses : contents,
      { flag: "wx" },
    );
  }
  return directory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: node scripts/build-pilot-reviewer.mjs <output-directory>");
    console.log("Reviewer ready in", await buildPilotReviewer(process.argv[2]));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
