import assert from "node:assert/strict";
import test from "node:test";

import {
  GOVERNANCE_POSITION,
  NODE_STATUS,
  createSovereignNode,
  evaluateSynNode001,
} from "../src/sovereign-node.js";

function deterministicHarness() {
  let id = 0;
  let tick = 0;
  const start = Date.parse("2026-09-09T00:00:00.000Z");
  return {
    idFactory(prefix) {
      id += 1;
      return `${prefix}-${id}`;
    },
    clock() {
      const value = new Date(start + tick * 1000).toISOString();
      tick += 1;
      return value;
    },
  };
}

test("SYN-NODE-001 acceptance path keeps sovereignty constant while contribution changes", () => {
  const harness = deterministicHarness();
  const node = createSovereignNode({
    ...harness,
    identity: { displayName: "Reference User" },
  });

  const initial = node.snapshot();
  node.grantConsent("profile", "render-profile");
  node.contribute("documentation", { artifact: "first-contribution" });

  const originalMemory = node.remember("display-name", "River", {
    source: "user-statement",
  });
  node.correctMemory(originalMemory.id, "Riven", "User corrected the stored value.");

  node.recordGovernancePosition("proposal-001", GOVERNANCE_POSITION.OPPOSE);
  const recommendation = node.guardianRecommend("Enable optional shared-memory synchronization.");
  node.respondToGuardian(recommendation.id, false);

  const beforeExit = node.exportState();
  assert.equal(beforeExit.worth.score, 1);
  assert.equal(beforeExit.sovereignty.current, initial.sovereignty.current);
  assert.equal(beforeExit.governance.positions[0].position, "oppose");
  assert.equal(beforeExit.guardian.recommendations[0].accepted, false);
  assert.equal(beforeExit.memory.entries.length, 2);
  assert.equal(beforeExit.memory.entries[1].supersedes, beforeExit.memory.entries[0].id);

  const finalExport = node.exit();
  assert.equal(finalExport.status, NODE_STATUS.EXITED);
  assert.equal(finalExport.consent.profile.status, "revoked");
  assert.equal(finalExport.sovereignty.current, initial.sovereignty.current);

  const report = evaluateSynNode001(finalExport);
  assert.equal(report.pass, true);
  assert.deepEqual(report.checks.filter((check) => !check.pass), []);
});

test("exit disables continuing node authority but preserves exportability", () => {
  const node = createSovereignNode(deterministicHarness());
  node.grantConsent("creative", "local-edit");
  const exited = node.exit();

  assert.equal(exited.status, NODE_STATUS.EXITED);
  assert.equal(node.exportState().status, NODE_STATUS.EXITED);
  assert.throws(() => node.contribute("post-exit"), (error) => error.code === "NODE_EXITED");
});

test("conformance fails closed when sovereignty is made dependent on WORTH", () => {
  const node = createSovereignNode(deterministicHarness());
  const tampered = node.exportState();
  tampered.policy.worthCanGrantSovereignty = true;
  tampered.sovereignty.current = 0.5;

  const report = evaluateSynNode001(tampered);
  assert.equal(report.pass, false);
  assert.equal(report.checks.find((check) => check.id === "worth-non-jurisdictional").pass, false);
  assert.equal(report.checks.find((check) => check.id === "sovereignty-constant").pass, false);
});

test("conformance rejects a Guardian that claims sovereign authority", () => {
  const node = createSovereignNode(deterministicHarness());
  const recommendation = node.guardianRecommend("Take a break.");
  const tampered = node.exportState();
  tampered.guardian.recommendations.find((item) => item.id === recommendation.id).authority = "sovereign";

  const report = evaluateSynNode001(tampered);
  assert.equal(report.pass, false);
  assert.equal(report.checks.find((check) => check.id === "guardian-advisory").pass, false);
});
