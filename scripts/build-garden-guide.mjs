import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Research prose only: no imported rule becomes an executable control.
const root = new URL("../", import.meta.url);
const read = (name) => readFileSync(new URL(`docs/research/north-star-atlas/${name}`, root));
const bytes = read("decisions.json");
const catalogue = JSON.parse(bytes);
const sources = JSON.parse(read("sources.json"));
const contracts = JSON.parse(read("journey-contracts.json"));
const readable = (text) =>
  text.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([A-Za-z])/g, "$1 $2");
const data = {
  version: 1,
  catalogueSha256: createHash("sha256").update(bytes).digest("hex"),
  status: "Planning guidance; selections do not implement or verify a customer project.",
  decisions: catalogue.decisions.map((record) => ({
    id: record.id,
    region: record.region,
    question: record.question,
    mode: record.selectionMode,
    actor: record.responsibleActor,
    applies: record.applicability.flag
      ? contracts.contextFlags[record.applicability.flag]
      : "Review this question for each project.",
    approaches: record.options.map((option) => ({
      id: option.id,
      consequence: readable(option.consequence),
      checks: option.checks.map(readable),
    })),
    sources: record.sources.map((id) => {
      const source = sources[id];
      return {
        title: source.title,
        url: source.locator.startsWith("https://") ? source.locator : null,
        limit: source.limit,
      };
    }),
  })),
};
const output = JSON.stringify(data, null, 2) + "\n";
const target = new URL("src/lib/garden-decisions.data.json", root);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output)
    throw new Error("Garden guide differs from the research source; regenerate and review.");
} else {
  writeFileSync(target, output);
}
console.log(
  `Garden guide: ${data.decisions.length} questions; source ${data.catalogueSha256}; planning only.`,
);
