import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { isolatedChildEnv } from "./isolated-child-env";

it("keeps Git initialization in the intended fixture despite inherited repository overrides", () => {
  const root = mkdtempSync(join(tmpdir(), "focus-env-isolation-"));
  const external = join(root, "external");
  const intended = join(root, "intended");
  const clean = isolatedChildEnv();
  try {
    execFileSync("git", ["init", "--quiet", external], { env: clean });
    const config = readFileSync(join(external, ".git/config"));
    const inherited = {
      ...process.env,
      GIT_DIR: join(external, ".git"),
      GIT_WORK_TREE: external,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.bare",
      GIT_CONFIG_VALUE_0: "true",
      NODE_OPTIONS: "--require=/nonexistent-focus-hook.cjs",
      NODE_PATH: "/nonexistent-focus-modules",
    };
    const safe = isolatedChildEnv(inherited);
    execFileSync("git", ["init", "--quiet", intended], { env: safe });
    expect(
      execFileSync("git", ["-C", intended, "rev-parse", "--absolute-git-dir"], {
        env: safe,
        encoding: "utf8",
      }).trim(),
    ).toBe(join(intended, ".git"));
    expect(readFileSync(join(external, ".git/config"))).toEqual(config);
    expect(Object.keys(safe).some((key) => key.startsWith("GIT_"))).toBe(false);
    expect(safe.NODE_OPTIONS).toBeUndefined();
    expect(safe.NODE_PATH).toBeUndefined();
    expect(safe.PATH).toBe(process.env.PATH);
    expect(inherited.GIT_DIR).toBe(join(external, ".git"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
