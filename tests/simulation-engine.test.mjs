import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONFIG,
  calculateWorthDelta,
  normalizeConfig,
  runComparison,
} from "../src/simulation-engine.js";

test("comparison is deterministic for a declared seed", () => {
  assert.deepEqual(runComparison(DEFAULT_CONFIG), runComparison(DEFAULT_CONFIG));
});

test("all six comparison tiers are present", () => {
  const result = runComparison(DEFAULT_CONFIG);
  assert.equal(result.tiers.length, 6);
  assert.equal(result.tiers.at(-1).tierId, "full-synthsara");
});

test("default full mechanism reduces attacker ROI and capture risk", () => {
  const result = runComparison(DEFAULT_CONFIG);
  const legacy = result.tiers[0].metrics;
  const full = result.tiers.at(-1).metrics;
  assert.ok(full.attackerRoi < legacy.attackerRoi);
  assert.ok(full.coalitionCaptureProbability < legacy.coalitionCaptureProbability);
  assert.ok(full.falseSanctionRate < legacy.falseSanctionRate);
});

test("configuration is bounded", () => {
  const config = normalizeConfig({
    population: -10,
    rounds: 999999,
    detectionProbability: 9,
    falsePositiveProbability: -1,
    sybilShare: 2,
    collusionShare: 2,
    seed: 0,
  });
  assert.equal(config.population, 24);
  assert.equal(config.rounds, 2000);
  assert.equal(config.detectionProbability, 0.99);
  assert.equal(config.falsePositiveProbability, 0);
  assert.equal(config.sybilShare, 0.45);
  assert.equal(config.collusionShare, 0.45);
  assert.equal(config.seed, 1);
});

test("private disclosure cannot increase WORTH", () => {
  const base = calculateWorthDelta({
    evidence: 0.7,
    validation: 0.6,
    impact: 0.8,
    reliability: 0.75,
    fraud: 0,
  });
  const withPrivateDisclosure = calculateWorthDelta({
    evidence: 0.7,
    validation: 0.6,
    impact: 0.8,
    reliability: 0.75,
    fraud: 0,
    privateDisclosure: 999,
  });
  assert.equal(base, withPrivateDisclosure);
});
