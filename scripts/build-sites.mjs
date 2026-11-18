#!/usr/bin/env node
/** Preserve the existing Nitro Worker when adapting its output to Sites. */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function filesUnder(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Unexpected symbolic link in build output: ${path}`);
    if (entry.isDirectory()) files.push(...filesUnder(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected non-file in build output: ${path}`);
  }
  return files.sort();
}

function workerReferences(source, path) {
  const references = [];
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      references.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      references.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return references;
}

function verifyWorkerClosure(server) {
  for (const path of filesUnder(server).filter((path) => /\.(?:js|mjs)$/.test(path))) {
    for (const ref of workerReferences(readFileSync(path, "utf8"), path)) {
      if (!ref.startsWith(".")) {
        if (!ref.startsWith("node:") && !ref.startsWith("cloudflare:"))
          throw new Error(`Unbundled Worker import ${ref} in ${path}`);
        continue;
      }
      const target = resolve(dirname(path), ref);
      const local = relative(server, target);
      if (local === ".." || local.startsWith("../") || isAbsolute(local))
        throw new Error(`Worker import escapes server output: ${ref}`);
      if (!existsSync(target) || !statSync(target).isFile())
        throw new Error(`Missing Worker module ${ref} from ${path}`);
    }
  }
}

function declaredPublicAssets(server, publicDirectory) {
  const entry = join(server, "index.mjs");
  const tree = ts.createSourceFile(
    entry,
    readFileSync(entry, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let manifest;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "public_assets_data_default"
    )
      manifest = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!manifest || !ts.isObjectLiteralExpression(manifest))
    throw new Error("Nitro public asset manifest changed; review the packaging adapter");
  const paths = manifest.properties.map((property) => {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name))
      throw new Error("Unexpected Nitro public asset declaration");
    const path = property.name.text;
    const target = resolve(publicDirectory, "." + path);
    const local = relative(publicDirectory, target);
    if (
      !path.startsWith("/") ||
      local === ".." ||
      local.startsWith("../") ||
      isAbsolute(local) ||
      !existsSync(target) ||
      !statSync(target).isFile()
    )
      throw new Error(`Missing declared public asset: ${path}`);
    return path;
  });
  return paths;
}

function emittedWorkerConfig(config) {
  return { ...config, main: "index.js", assets: { ...config.assets, directory: "../client" } };
}

function sourceContract(root) {
  const hosting = readJson(join(root, ".openai/hosting.json"));
  if (typeof hosting.project_id !== "string" || !hosting.project_id.trim())
    throw new Error("hosting.json must contain the registered Site project_id");
  // Sites provisions storage from logical binding names, not Wrangler binding objects.
  for (const key of ["d1", "r2"]) {
    const binding = hosting[key];
    if (
      binding != null &&
      (typeof binding !== "string" || !binding.trim() || binding !== binding.trim())
    )
      throw new Error(
        `hosting.json ${key} must be null or a non-empty logical binding name string`,
      );
  }
  if (hosting.static != null)
    throw new Error(
      "Focus needs a Worker deployment; remove static from the source hosting manifest",
    );
  const config = readJson(join(root, ".output/server/wrangler.json"));
  if (config.assets?.binding !== "ASSETS" || config.assets?.directory !== "../public")
    throw new Error("Nitro must declare ASSETS at ../public");
  if (!config.compatibility_flags?.includes("nodejs_compat"))
    throw new Error("Nitro Worker requires nodejs_compat");
  if (config.main !== "index.mjs")
    throw new Error("Unexpected Nitro entry point; review the build adapter before publishing");
  return { hosting, config };
}

/** Validates byte preservation and every statically known Worker module import. */
export function validateSitesArtifact(root = scriptRoot) {
  const { hosting, config } = sourceContract(root);
  const dist = join(root, "dist");
  const output = join(root, ".output");
  let serverFiles = 0;
  let publicFiles = 0;
  for (const directory of ["server", "public"]) {
    for (const source of filesUnder(join(output, directory))) {
      const name = relative(output, source);
      if (name === "server/wrangler.json") continue;
      const target = join(dist, name);
      if (!existsSync(target) || digest(source) !== digest(target))
        throw new Error(`Asset bytes changed or missing: ${name}`);
      if (directory === "server") serverFiles++;
      else {
        const client = join(dist, "client", relative(join(output, "public"), source));
        if (!existsSync(client) || digest(source) !== digest(client))
          throw new Error(`Client asset bytes changed or missing: ${name}`);
        publicFiles++;
      }
    }
  }
  const emittedHosting = readJson(join(dist, ".openai/hosting.json"));
  if (JSON.stringify(hosting) !== JSON.stringify(emittedHosting))
    throw new Error("Site identity or bindings changed during packaging");
  const emittedConfig = readJson(join(dist, "server/wrangler.json"));
  if (JSON.stringify(emittedConfig) !== JSON.stringify(emittedWorkerConfig(config)))
    throw new Error("Worker deployment configuration changed unexpectedly");
  if (
    readFileSync(join(dist, "server/index.js"), "utf8") !==
    'export { default } from "./index.mjs";\n'
  )
    throw new Error("Sites entry must preserve the generated Nitro handler");
  verifyWorkerClosure(join(dist, "server"));
  const declaredAssets = declaredPublicAssets(join(dist, "server"), join(dist, "client"));
  declaredPublicAssets(join(dist, "server"), join(dist, "public"));
  return {
    project_id: hosting.project_id,
    serverFiles,
    publicFiles,
    worker: "dist/server/index.js",
    assets: "dist/client",
    declaredAssets: declaredAssets.length,
  };
}

/** Copies a complete, already-built Nitro output; never rewrites generated source. */
export function prepareSitesArtifact(root = scriptRoot) {
  const { config } = sourceContract(root);
  // Validate all source output before replacing the disposable deployment directory.
  filesUnder(join(root, ".output/server"));
  filesUnder(join(root, ".output/public"));
  verifyWorkerClosure(join(root, ".output/server"));
  declaredPublicAssets(join(root, ".output/server"), join(root, ".output/public"));
  const dist = join(root, "dist");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, ".openai"), { recursive: true });
  cpSync(join(root, ".output/server"), join(dist, "server"), { recursive: true });
  // Publish the ASSETS client layout while retaining Nitro's original public paths too.
  cpSync(join(root, ".output/public"), join(dist, "client"), { recursive: true });
  cpSync(join(root, ".output/public"), join(dist, "public"), { recursive: true });
  cpSync(join(root, ".openai/hosting.json"), join(dist, ".openai/hosting.json"));
  writeFileSync(
    join(dist, "package.json"),
    JSON.stringify({ private: true, type: "module" }) + "\n",
  );
  writeFileSync(join(dist, "server/index.js"), 'export { default } from "./index.mjs";\n');
  writeFileSync(
    join(dist, "server/wrangler.json"),
    JSON.stringify(emittedWorkerConfig(config), null, 2) + "\n",
  );
  return validateSitesArtifact(root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--package-only", "--verify"].includes(arg)) || args.length > 1)
    throw new Error("Usage: node scripts/build-sites.mjs [--package-only|--verify]");
  if (args[0] === "--verify") console.log(JSON.stringify(validateSitesArtifact(), null, 2));
  else {
    if (args[0] !== "--package-only") {
      const result = spawnSync(
        process.execPath,
        [join(scriptRoot, "node_modules/vite/bin/vite.js"), "build"],
        { cwd: scriptRoot, stdio: "inherit", env: process.env },
      );
      if (result.error) throw result.error;
      if (result.status !== 0) process.exit(result.status ?? 1);
    }
    console.log(JSON.stringify(prepareSitesArtifact(), null, 2));
  }
}
