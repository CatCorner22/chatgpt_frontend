import { format, resolveConfig } from "prettier";

// Use the repository's existing formatter for generated research JSON as well.
// Input is local catalogue data on stdin; this performs no network or file writes.
const target = process.argv[2];
if (!target) throw new Error("A JSON target path is required.");
let input = "";
for await (const chunk of process.stdin) input += chunk;
process.stdout.write(await format(input, { ...(await resolveConfig(target)), filepath: target }));
