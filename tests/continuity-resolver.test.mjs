import assert from "node:assert/strict";
import test from "node:test";

import { reconstructMemory } from "../src/continuity-resolver.js";
import { createSovereignNode } from "../src/sovereign-node.js";

function harness() {
  let id = 0;
  let tick = 0;
  const initial = Date.parse("2026-11-04T12:00:00Z");
  return {
    idFactory(prefix) { return `${prefix}-${++id}`; },
    clock() { return new Date(initial + tick++ * 1000).toISOString(); },
  };
}

test("SYN-CONT-001: memory requires its own explicit consent, not general profile consent", () => {
  const node = createSovereignNode(harness());
  assert.throws(() => node.remember("entity:FoxLion.OS", "history"), (e) => e.code === "MEMORY_CONSENT_REQUIRED");
  assert.throws(() => node.recall("entity:FoxLion.OS"), (e) => e.code === "MEMORY_CONSENT_REQUIRED");
  node.grantConsent("profile", "display only");
  assert.throws(() => node.remember("entity:FoxLion.OS", "history"), (e) => e.code === "MEMORY_CONSENT_REQUIRED");

  node.grantConsent("memory", "store approved context");
  const first = node.remember("entity:FoxLion.OS", { relationship: "established collaborator" }, { source: "user-attested-history" });
  assert.equal(node.recall("entity:FoxLion.OS").current.entryId, first.id);

  node.revokeConsent("memory");
  assert.throws(() => node.recall("entity:FoxLion.OS"), (e) => e.code === "MEMORY_CONSENT_REQUIRED");
  assert.throws(() => node.correctMemory(first.id, "updated", "later correction"), (e) => e.code === "MEMORY_CONSENT_REQUIRED");
});

test("SYN-CONT-001: FoxLion.OS correction changes the current state without erasing historical evidence", () => {
  const node = createSovereignNode(harness());
  node.grantConsent("memory", "context continuity");
  const first = node.remember("entity:FoxLion.OS", {
    relationship: "established friend and creative collaborator",
    project: "shared cosmic artworks",
  }, { source: "user-provided-conversation-history", status: "user-attested" });

  const corrected = node.correctMemory(first.id, {
    relationship: "established friend and creative collaborator",
    project: "ongoing FoxLion.OS and Synthsara architecture exchanges",
  }, "The newer project context belongs in the active record.");

  const before = node.recall("entity:FoxLion.OS", { asOf: first.at });
  const now = node.recall("entity:FoxLion.OS");
  assert.equal(before.status, "active");
  assert.equal(before.current.entryId, first.id);
  assert.equal(now.status, "active");
  assert.equal(now.current.entryId, corrected.id);
  assert.deepEqual(now.evidenceIds, [first.id, corrected.id]);
  assert.equal(now.history[1].supersedes, first.id);
  assert.equal(node.snapshot().memory.entries.length, 2);
  assert.equal(now.current.provenance.source, "user-correction");
  assert.equal(now.current.value.project, "ongoing FoxLion.OS and Synthsara architecture exchanges");
});

test("SYN-CONT-001: exact entity IDs prevent inappropriate identity merging", () => {
  const node = createSovereignNode(harness());
  node.grantConsent("memory", "preserve entity distinctions");
  node.remember("entity:FoxLion.OS", "FoxLion.OS history");
  node.remember("entity:FoxLion", "a distinct entity");

  assert.equal(node.recall("entity:FoxLion.OS").current.value, "FoxLion.OS history");
  assert.equal(node.recall("entity:FoxLion").current.value, "a distinct entity");
  assert.equal(node.recall("entity:FoxLionOS").status, "missing");
});

test("SYN-CONT-001: independent records and correction forks fail closed as conflicts", () => {
  const node = createSovereignNode(harness());
  node.grantConsent("memory", "test conflicts");
  const first = node.remember("project:status", "draft");
  node.remember("project:status", "production");
  const conflicting = node.recall("project:status");
  assert.equal(conflicting.status, "conflict");
  assert.equal(conflicting.current, null);
  assert.equal(conflicting.candidateIds.length, 2);

  const separate = node.remember("project:fork", "old");
  node.correctMemory(separate.id, "change A", "first branch");
  node.correctMemory(separate.id, "change B", "parallel branch");
  assert.equal(node.recall("project:fork").status, "conflict");
});

test("SYN-CONT-001: malformed chains cannot be promoted to current truth", () => {
  const broken = [
    { id: "record-2", subject: "entity:test", at: "2026-11-04T12:00:01Z", supersedes: "missing", value: "assertion" },
  ];
  const result = reconstructMemory(broken, "entity:test");
  assert.equal(result.status, "invalid");
  assert.equal(result.current, null);

  assert.equal(reconstructMemory([], "entity:test").status, "missing");
  assert.throws(() => reconstructMemory([], "entity:test", { asOf: "not-a-date" }), TypeError);
});

test("SYN-CONT-001: erasure remains available after revocation, without retaining the deleted value in Witness", () => {
  const node = createSovereignNode(harness());
  node.grantConsent("memory", "temporary");
  node.remember("entity:FoxLion.OS", "do not retain this content");
  node.revokeConsent("memory");

  assert.deepEqual(node.eraseMemory("entity:FoxLion.OS"), { erased: 1 });
  assert.equal(node.snapshot().memory.entries.length, 0);
  assert.equal(JSON.stringify(node.snapshot().witness).includes("do not retain this content"), false);
  node.grantConsent("memory", "check deletion");
  assert.equal(node.recall("entity:FoxLion.OS").status, "missing");
  node.exit();
  assert.throws(() => node.recall("entity:FoxLion.OS"), (e) => e.code === "NODE_EXITED");
});
