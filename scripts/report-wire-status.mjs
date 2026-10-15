import { readFileSync, appendFileSync } from "node:fs";
import assert from "node:assert/strict";

const inventory = JSON.parse(readFileSync(new URL("../conformance/rtme-wire-release-inventory.json", import.meta.url), "utf8"));
const corpus = JSON.parse(readFileSync(new URL("../conformance/rtme-wire-001.vectors.json", import.meta.url), "utf8"));
const outstanding = new Set(inventory.requirements.map((entry) => entry.id));
assert.equal(inventory.requirements.length, 13, "The 13 baseline failures must be accounted for explicitly.");
assert.equal(outstanding.size, 13, "Duplicate wire requirement IDs.");
assert.equal(corpus.vectors.length, 20, "Missing hostile wire vectors.");
for (const entry of inventory.requirements) {
  assert.equal(entry.status, "NOT_IMPLEMENTED", `Never label ${entry.id} verified without production-coupled proof.`);
  assert.ok(corpus.vectors.some((v) => v.id === entry.id), `Unknown wire case ${entry.id}`);
  assert.ok(entry.requirement.length > 20, `Missing acceptance obligation ${entry.id}`);
}
const rows = [
  "## RTME-WIRE-001 security conformance — NOT CERTIFIED",
  "",
  "Green release tests cover implemented, bounded behavior. The 13 original hostile-wire failures remain tracked as requirements; they are **not passing security evidence**.",
  "",
  "| Vector | Release status | Acceptance requirement |",
  "|---|---|---|",
  ...inventory.requirements.map((item) => `| ${item.id} | NOT IMPLEMENTED | ${item.requirement} |`),
  "",
  "To reproduce the adversarial failures, run: \`npm run test:wire:strict\`.",
  "No live wire-frame parser, network address pinning, distributed action-token authority, or ambiguous remote-effect recovery is certified by this release."
];
const summary = rows.join("\n") + "\n";
process.stdout.write(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
