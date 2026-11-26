import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Read only the static distribution. The organizer build never runs the returned project.
export async function readDesignerReturn(dist, receiptPath, inputsSha256) {
  const receiptFile = await lstat(receiptPath);
  assert(
    receiptFile.isFile() && receiptFile.size <= 32 * 1024,
    "Choose the small, completed submission.json.",
  );
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(
    receipt.inputsSha256?.toLowerCase(),
    inputsSha256,
    "This submission names a different frozen builder ZIP.",
  );
  assert(
    receipt.permissionForStudy === true && receipt.builtIndependently === true,
    "Record permission and independent authorship before making the pair.",
  );
  assert((await lstat(dist)).isDirectory(), "Choose the returned dist folder.");
  const entries = (await readdir(dist)).sort();
  assert.deepEqual(
    entries,
    ["assets", "index.html"],
    "Expected index.html and assets/ at the root of dist.",
  );
  assert((await lstat(join(dist, "assets"))).isDirectory(), "Expected a regular assets folder.");
  const assets = (await readdir(join(dist, "assets"))).sort();
  assert(
    assets.length > 0 && assets.length <= 128,
    "Choose a bounded static build with 1 to 128 assets.",
  );
  const files = new Map();
  let size = 0;
  for (const path of [...assets.map((name) => "assets/" + name), "index.html"]) {
    assert(
      path === "index.html" ||
        /^assets\/[a-z\d_-][\w.-]*\.(?:css|js|woff2|txt|png|webp|svg)$/i.test(path),
      "Unexpected static asset: " + path,
    );
    const info = await lstat(join(dist, path));
    size += info.size;
    assert(
      info.isFile() && size <= 32 * 1024 * 1024,
      "Choose regular static files totaling up to 32 MB.",
    );
    files.set(path, await readFile(join(dist, path)));
  }
  return { files, receipt };
}
