#!/usr/bin/env node
// Owned offline substitute for GitHub CLI. The corresponding Git pushes use a real bare repository.
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const [command, action, ...options] = process.argv.slice(2);
const settings = JSON.parse(process.env.FOCUS_TEST_GITHUB);
const pullFile = settings.pullFile;
const output = (value) => process.stdout.write(JSON.stringify(value));

if (command === "repo" && action === "view" && options.includes(settings.repo)) {
  output({ nameWithOwner: settings.repo, isPrivate: process.env.FOCUS_TEST_PUBLIC !== "yes" });
} else if (command === "api") {
  if (!options.includes("repos/" + settings.repo + "/pulls/1")) process.exit(1);
  output({
    state: "open",
    draft: true,
    base: {
      repo: { full_name: settings.repo },
      ref: "main",
      sha: process.env.FOCUS_TEST_PR_DRIFT || settings.base,
    },
    head: { repo: { full_name: settings.repo }, ref: settings.branch, sha: settings.head },
  });
} else if (command === "pr" && action === "list") {
  output(existsSync(pullFile) ? JSON.parse(readFileSync(pullFile, "utf8")) : []);
} else if (command === "pr" && action === "create") {
  if (
    process.env.FOCUS_TEST_INTERRUPT === "yes" ||
    !["--draft", settings.branch, "main"].every((value) => options.includes(value))
  )
    process.exit(1);
  writeFileSync(pullFile, JSON.stringify([{ number: 1, isCrossRepository: false }]), {
    flag: "wx",
  });
  process.stdout.write("https://github.com/" + settings.repo + "/pull/1\n");
} else {
  process.exit(1);
}
