/** Keep owned-fixture subprocesses from inheriting a caller's repository or Node hooks. */
export function isolatedChildEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !key.startsWith("GIT_") && key !== "NODE_OPTIONS" && key !== "NODE_PATH",
    ),
  );
}
