// Distributed in the Focus source proposal. Requires Node 22.12+, Git, and (for sharing) gh.
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pinnedBase = /* FOCUS_BASE_COMMIT */ null;
const bundle = dirname(fileURLToPath(import.meta.url));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};
const commitId = /^[0-9a-f]{40}$/;
const repoName = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/;
const baseName = /^[a-zA-Z0-9_][a-zA-Z0-9._/-]{0,199}$/;
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith("GIT_") && !["NODE_OPTIONS", "NODE_PATH", "GH_REPO"].includes(key),
  ),
);
const env = {
  ...cleanEnv,
  GH_HOST: "github.com",
  GH_PROMPT_DISABLED: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  GIT_LFS_SKIP_SMUDGE: "1",
  GIT_NO_LAZY_FETCH: "1",
  GIT_ATTR_NOSYSTEM: "1",
};

function run(tool, args, cwd, message) {
  const result = spawnSync(tool, args, {
    cwd,
    env,
    timeout: 90_000,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  ensure(!result.error && result.status === 0, message);
  return result.stdout;
}
function git(cwd, args, message, shareWithGitHub = false) {
  // A regular file used as hooksPath cannot contain any executable hooks.
  return run(
    "git",
    [
      "--no-replace-objects",
      "-c",
      "protocol.allow=never",
      "-c",
      "protocol.file.allow=always",
      ...(shareWithGitHub ? ["-c", "protocol.https.allow=always"] : []),
      "-c",
      "core.hooksPath=" + join(bundle, "verify.mjs"),
      "-c",
      "core.fsmonitor=false",
      ...args,
    ],
    cwd,
    message,
  );
}
const txt = (bytes) => bytes.toString("utf8").trimEnd();
function repoFromOrigin(url) {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^\s]+?)(?:\.git)?\/?$/i.exec(
      url,
    );
  ensure(
    match && repoName.test(match[1]),
    "Use a local clone with a GitHub.com origin that contains no embedded credentials.",
  );
  return match[1];
}
function validateBase(name, sha) {
  ensure(
    baseName.test(name) && !name.startsWith("focus/trial-") && commitId.test(sha),
    "Supply the base branch and its full 40-character lowercase commit ID.",
  );
  git(bundle, ["check-ref-format", "--branch", name], "Choose a valid base branch.");
  ensure(
    !pinnedBase || pinnedBase === sha,
    "The supplied commit differs from the baseline recorded by the owner in Focus.",
  );
}
function verify(project, direction) {
  run(
    process.execPath,
    [join(bundle, "verify.mjs"), direction, project],
    bundle,
    "The proposal or the two files differ from the expected " +
      direction +
      " snapshots. Stop and inspect.",
  );
}
const contractBytes = () => readFileSync(join(bundle, "trial-contract.json"));
function verifyCommit(project, state) {
  verify(project, "after");
  const bytes = contractBytes();
  const files = JSON.parse(bytes).files;
  ensure(state.contract === hash(bytes), "This package belongs to a different trial.");
  ensure(
    txt(
      git(project, ["symbolic-ref", "--short", "HEAD"], "Check out the prepared trial branch."),
    ) === state.branch,
    "Check out the prepared trial branch.",
  );
  const head = txt(
    git(
      project,
      ["rev-list", "--parents", "-n", "1", "HEAD"],
      "Cannot identify the local trial commit.",
    ),
  );
  ensure(
    head === state.head + " " + state.base,
    "The local trial commit or its parent changed. Prepare a fresh trial.",
  );
  const changed = git(
    project,
    ["diff", "--no-ext-diff", "--name-only", "--no-renames", "-z", state.base, state.head],
    "Cannot inspect the committed change.",
  );
  const names = changed.toString("utf8").split("\0").filter(Boolean).sort();
  ensure(
    JSON.stringify(names) === JSON.stringify(files.map((f) => f.path).sort()),
    "The commit contains unexpected paths.",
  );
  for (const file of files) {
    for (const [revision, expected] of [
      [state.base, file.beforeSha256],
      [state.head, file.afterSha256],
    ]) {
      const blob = git(
        project,
        ["cat-file", "blob", revision + ":" + file.path],
        "Cannot inspect both committed source files.",
      );
      ensure(
        hash(blob) === expected,
        "Committed bytes differ from the proposal. Check line ending and repository filter settings.",
      );
    }
  }
  ensure(
    !git(
      project,
      ["status", "--porcelain=v1", "--untracked-files=all"],
      "Cannot inspect trial status.",
    ).length,
    "The trial copy has additional edits. Keep those edits and prepare a fresh trial before sharing.",
  );
}
function contains(parent, child) {
  const path = relative(parent, child);
  return !isAbsolute(path) && path !== ".." && !path.startsWith(".." + sep);
}
function prepare(args) {
  ensure(
    args.length === 4,
    "Usage: node github-trial.mjs prepare <existing-local-clone> <base-branch> <full-base-commit> <new-directory>",
  );
  const [sourcePath, baseBranch, base, newPath] = args;
  validateBase(baseBranch, base);
  const source = realpathSync(sourcePath);
  ensure(
    realpathSync(
      txt(git(source, ["rev-parse", "--show-toplevel"], "Choose a local Git checkout.")),
    ) === source,
    "Choose the root of the local Git checkout.",
  );
  const repo = repoFromOrigin(
    txt(
      git(
        source,
        ["config", "--local", "--get", "remote.origin.url"],
        "The source checkout has no GitHub origin.",
      ),
    ),
  );
  const destination = resolve(newPath);
  const trial = join(realpathSync(dirname(destination)), basename(destination));
  ensure(
    !contains(source, trial) && !contains(bundle, trial),
    "Choose an unused directory outside the source checkout and the proposal.",
  );
  ensure(
    txt(
      git(
        source,
        ["rev-parse", "--verify", "refs/heads/" + baseBranch],
        "The chosen base branch is unavailable locally.",
      ),
    ) === base,
    "The local base branch has moved. Confirm the current revision and prepare a new proposal when its inputs change.",
  );
  try {
    mkdirSync(trial, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("Choose a new directory. The existing path was left untouched.");
    throw error;
  }
  git(
    dirname(trial),
    [
      "clone",
      "--local",
      "--no-hardlinks",
      "--no-checkout",
      "--no-tags",
      "--single-branch",
      "--branch",
      baseBranch,
      "--template=",
      "--",
      source,
      trial,
    ],
    "The new trial copy could not be created. Inspect the new directory before retrying.",
  );
  git(
    trial,
    ["remote", "remove", "origin"],
    "Cannot detach the trial copy from the source checkout.",
  );
  const branch = "focus/trial-" + randomUUID();
  git(
    trial,
    ["switch", "--no-track", "-c", branch, base],
    "Cannot check out the specified baseline.",
  );
  verify(trial, "before");
  const patch = join(bundle, "forward.patch");
  git(
    trial,
    ["apply", "--index", "--check", patch],
    "The exact patch does not apply to this revision.",
  );
  verify(trial, "before");
  git(
    trial,
    ["apply", "--index", patch],
    "The exact patch could not be applied to the isolated copy.",
  );
  verify(trial, "after");
  git(
    trial,
    [
      "-c",
      "user.name=Focus trial",
      "-c",
      "user.email=focus@localhost",
      "-c",
      "commit.gpgSign=false",
      "commit",
      "-m",
      "Apply the reviewed Focus styling trial",
    ],
    "Cannot create the local trial commit.",
  );
  const head = txt(git(trial, ["rev-parse", "HEAD"], "Cannot identify the trial commit."));
  const state = { repo, baseBranch, base, branch, head, contract: hash(contractBytes()) };
  verifyCommit(trial, state);
  writeFileSync(join(trial, ".git", "focus-source-trial.json"), JSON.stringify(state), {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Local trial ready. GitHub has not been contacted.\nRepository: " +
      repo +
      "\nBase: " +
      base +
      "\nTrial: " +
      head +
      "\nWorking copy: " +
      trial +
      "\nInspect and test this copy with isolated services. Review START-HERE.md for selective undo. The publish command is a separate, optional action.",
  );
}
function publish(args) {
  const publicApproved = args.length === 3 && args[2] === "--allow-public";
  ensure(
    args.length === 2 || publicApproved,
    "Usage: node github-trial.mjs publish <prepared-trial-directory> <GitHub-owner/repository> [--allow-public]",
  );
  const [directory, confirmedRepo] = args;
  ensure(repoName.test(confirmedRepo), "Enter the intended GitHub owner/repository.");
  const trial = realpathSync(directory);
  // The helper-created checkout has only normal core settings. A later tool might add
  // URL rewrites, executable filters, extra refs or includes. Re-prepare rather than
  // run any local or remote Git operation in a checkout with unexpected configuration.
  const localConfig = git(
    trial,
    ["config", "--local", "--no-includes", "--name-only", "--list", "-z"],
    "Cannot inspect the trial Git configuration.",
  );
  const allowedSettings = new Set([
    "user.name",
    "user.email",
    "color.ui",
    "core.repositoryformatversion",
    "core.filemode",
    "core.bare",
    "core.logallrefupdates",
    "core.ignorecase",
    "core.symlinks",
    "core.precomposeunicode",
  ]);
  ensure(
    localConfig
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .every((key) => allowedSettings.has(key)),
    "Trial repository configuration changed. Prepare a fresh local copy before sharing.",
  );
  const state = JSON.parse(readFileSync(join(trial, ".git", "focus-source-trial.json"), "utf8"));
  validateBase(state.baseBranch, state.base);
  ensure(
    typeof state.repo === "string" &&
      state.repo.toLowerCase() === confirmedRepo.toLowerCase() &&
      commitId.test(state.head) &&
      /^focus\/trial-[a-f0-9-]{36}$/.test(state.branch),
    "The repository or branch does not match this prepared trial.",
  );
  verifyCommit(trial, state);
  const gh = (args, message) => txt(run("gh", args, bundle, message));
  const repo = confirmedRepo;
  const actual = JSON.parse(
    gh(
      ["repo", "view", repo, "--json", "nameWithOwner,isPrivate"],
      "Sign into GitHub CLI and check access to the intended private repository.",
    ),
  );
  ensure(
    actual.nameWithOwner.toLowerCase() === confirmedRepo.toLowerCase(),
    "GitHub returned a different repository.",
  );
  ensure(
    actual.isPrivate === true || (publicApproved && actual.isPrivate === false),
    "This repository is publicly visible. Keep the trial local or explicitly authorize public sharing with --allow-public.",
  );
  const remote = "https://github.com/" + confirmedRepo + ".git";
  const ref = "refs/heads/" + state.branch,
    baseRef = "refs/heads/" + state.baseBranch;
  const auth = [
    "-c",
    "credential.helper=",
    "-c",
    "credential.https://github.com.helper=!gh auth git-credential",
  ];
  function readRefs() {
    const listing = txt(
      git(
        trial,
        [...auth, "ls-remote", "--refs", remote, baseRef, ref],
        "Cannot read both remote branch identities with GitHub CLI credentials.",
        true,
      ),
    );
    return Object.fromEntries(
      listing
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [sha, name] = line.split("\t");
          return [name, sha];
        }),
    );
  }
  function checkRemote(refs) {
    ensure(
      refs[baseRef] === state.base,
      "The GitHub base has moved. Keep this trial local and prepare a fresh one against the new base.",
    );
    ensure(
      !refs[ref] || refs[ref] === state.head,
      "This remote trial branch contains different work. It was left untouched.",
    );
  }
  const refs = readRefs();
  checkRemote(refs);
  function verifiedPull(number, mustBeDraft) {
    ensure(
      Number.isSafeInteger(number) && number > 0,
      "Cannot identify the pull request. Check the branch on GitHub.",
    );
    const result = JSON.parse(
      gh(
        ["api", "--hostname", "github.com", "repos/" + confirmedRepo + "/pulls/" + number],
        "The pull request could not be checked. Retry this command before relying on the handoff.",
      ),
    );
    const matches = (side, branch, sha) =>
      side?.repo?.full_name?.toLowerCase() === confirmedRepo.toLowerCase() &&
      side.ref === branch &&
      side.sha === sha;
    ensure(
      result.state === "open" &&
        (!mustBeDraft || result.draft === true) &&
        matches(result.base, state.baseBranch, state.base) &&
        matches(result.head, state.branch, state.head),
      "The pull request changed, closed, or references different commits. Review it on GitHub before using the trial.",
    );
    return "https://github.com/" + confirmedRepo + "/pull/" + number;
  }
  const pulls = JSON.parse(
    gh(
      [
        "pr",
        "list",
        "--repo",
        repo,
        "--head",
        state.branch,
        "--state",
        "all",
        "--json",
        "number,isCrossRepository",
      ],
      "Could not check for an existing pull request. The trial branch can be retried.",
    ),
  );
  const existing = pulls.find((p) => p.isCrossRepository === false);
  if (existing) {
    ensure(
      refs[ref] === state.head,
      "The existing pull request branch changed. Review it on GitHub.",
    );
    console.log("Existing pull request: " + verifiedPull(existing.number, false));
    return;
  }
  if (!refs[ref]) {
    // An empty expected old value is a creation-only lease; an existing ref can never be replaced.
    git(
      trial,
      [
        ...auth,
        "-c",
        "push.followTags=false",
        "push",
        "--no-verify",
        "--force-with-lease=" + ref + ":",
        remote,
        state.head + ":" + ref,
      ],
      "Could not create the new GitHub branch. Check repository access and retry.",
      true,
    );
  }
  const latest = readRefs();
  checkRemote(latest);
  ensure(
    latest[ref] === state.head,
    "The remote trial branch changed. Inspect it before continuing.",
  );
  const url = gh(
    [
      "pr",
      "create",
      "--repo",
      repo,
      "--draft",
      "--base",
      state.baseBranch,
      "--head",
      state.branch,
      "--title",
      "Review the Focus styling trial",
      "--body",
      "Two scoped React/Vite style changes. Reviewed baseline: " +
        state.base +
        ". Trial commit: " +
        state.head +
        ". Record actual preview, visitor tasks, and selective rollback results before a release decision.",
    ],
    "The branch was shared, but a draft could not be confirmed. Retry this command to find or create its pull request.",
  );
  const urlPrefix = "https://github.com/" + confirmedRepo + "/pull/";
  const numberText = url.slice(urlPrefix.length);
  ensure(
    url.toLowerCase().startsWith(urlPrefix.toLowerCase()) && /^[1-9][0-9]*$/.test(numberText),
    "A draft may have been created. Retry to identify the pull request on the intended repository.",
  );
  console.log(
    "Draft pull request: " +
      verifiedPull(Number(numberText), true) +
      "\nConfirm its base and trial commits before review. GitHub can change after this check.",
  );
}
try {
  const [action, ...args] = process.argv.slice(2);
  if (action === "prepare") prepare(args);
  else if (action === "publish") publish(args);
  else
    throw new Error(
      "Choose prepare for a local trial or publish to share a reviewed trial as a draft pull request.",
    );
} catch (error) {
  console.error(
    "Trial stopped. " +
      (error instanceof Error && !error.code && error.name === "Error"
        ? error.message
        : "Check the directory, tools, and intact proposal before retrying."),
  );
  process.exitCode = 1;
}
