import assert from "node:assert/strict";
import test from "node:test";

import {
  compileRtmeKernelRequest,
  createRtmeGuardianAssessment,
  createRtmeIntent,
  createRtmeScopedConsent,
  evaluateRtmeGate,
} from "../src/rtme-gate.js";
import { createSovereignNode } from "../src/sovereign-node.js";

const NOW = "2026-09-10T00:20:00.000Z";
const HASH = "a".repeat(64);

function consent(overrides = {}) {
  return createRtmeScopedConsent({
    consentId: "consent:rtme:1",
    userId: "user:1",
    capabilities: ["doc:write", "vault:export"],
    purpose: "create-draft",
    recipient: "rtme-local",
    issuedAt: "2026-09-10T00:10:00.000Z",
    expiresAt: "2026-09-10T00:30:00.000Z",
    ...overrides,
  });
}

function intent(overrides = {}) {
  return createRtmeIntent({
    intentId: "intent:1",
    userId: "user:1",
    capability: "doc:write",
    purpose: "create-draft",
    recipient: "rtme-local",
    parameters: { title: "Smallest test" },
    rawIntentHash: HASH,
    ...overrides,
  });
}

function guardian(overrides = {}) {
  return createRtmeGuardianAssessment({
    decisionId: "guardian:1",
    intentId: "intent:1",
    consentId: "consent:rtme:1",
    verdict: "CLEAR",
    rationale: "Within current authority.",
    ...overrides,
  });
}

test("typed preflight compiles a minimal kernel request without raw prompt or WORTH", () => {
  const request = compileRtmeKernelRequest({
    intent: intent(),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });

  assert.equal(request.constitutionalRequirements.worthMayAuthorize, false);
  assert.equal(request.constitutionalRequirements.rawPromptMayExecute, false);
  assert.equal(request.constitutionalRequirements.executionMustRecheckConsent, true);
  assert.equal(request.guardian.authority, "advisory");

  const serialized = JSON.stringify(request).toLowerCase();
  assert.equal(serialized.includes("worth"), true); // only the explicit false policy statement
  assert.equal(serialized.includes('"score"'), false);
  assert.equal(serialized.includes("rawprompt"), true); // only the explicit false policy statement
  assert.equal(serialized.includes("please create this"), false);
});

test("capability, purpose, and recipient are independent veto gates", () => {
  const capability = evaluateRtmeGate({
    intent: intent({ capability: "workflow:dispatch" }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(capability.pass, false);
  assert.equal(capability.checks.find((check) => check.id === "capability-scope").pass, false);

  const purpose = evaluateRtmeGate({
    intent: intent({ purpose: "train-model" }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(purpose.checks.find((check) => check.id === "purpose-scope").pass, false);

  const recipient = evaluateRtmeGate({
    intent: intent({ recipient: "external-service" }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(recipient.checks.find((check) => check.id === "recipient-scope").pass, false);
});

test("revoked and expired consent fail before a kernel request is produced", () => {
  assert.throws(
    () => compileRtmeKernelRequest({
      intent: intent(),
      consent: consent({ revokedAt: "2026-09-10T00:19:00.000Z" }),
      guardian: guardian(),
      now: NOW,
    }),
    (error) => error.code === "RTME_GATE_DENIED" && error.failedChecks.includes("consent-active"),
  );

  assert.throws(
    () => compileRtmeKernelRequest({
      intent: intent(),
      consent: consent({ expiresAt: "2026-09-10T00:19:59.000Z" }),
      guardian: guardian(),
      now: NOW,
    }),
    (error) => error.code === "RTME_GATE_DENIED" && error.failedChecks.includes("consent-active"),
  );
});

test("Guardian can advise but cannot claim execution authority", () => {
  const sovereignGuardian = evaluateRtmeGate({
    intent: intent(),
    consent: consent(),
    guardian: guardian({ authority: "sovereign" }),
    now: NOW,
  });
  assert.equal(sovereignGuardian.pass, false);
  assert.equal(sovereignGuardian.checks.find((check) => check.id === "guardian-advisory").pass, false);

  const refused = evaluateRtmeGate({
    intent: intent(),
    consent: consent(),
    guardian: guardian({ verdict: "REFUSED" }),
    now: NOW,
  });
  assert.equal(refused.checks.find((check) => check.id === "guardian-clear").pass, false);
});

test("truth, assumptions, and irreversible confirmation are vetoes", () => {
  const incomplete = evaluateRtmeGate({
    intent: intent({ truthDisclosureComplete: false }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(incomplete.checks.find((check) => check.id === "truth-disclosure").pass, false);

  const assumptions = evaluateRtmeGate({
    intent: intent({ unresolvedAssumptions: ["destination owner unknown"] }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(assumptions.checks.find((check) => check.id === "assumptions-resolved").pass, false);

  const irreversible = evaluateRtmeGate({
    intent: intent({ irreversible: true, irreversibleConfirmation: false }),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });
  assert.equal(irreversible.checks.find((check) => check.id === "irreversible-confirmation").pass, false);
});

test("WORTH can change while RTME authority request remains structurally independent", () => {
  let id = 0;
  const node = createSovereignNode({
    identity: { id: "user:1", displayName: "Tester" },
    idFactory: (prefix) => `${prefix}:${++id}`,
    clock: () => NOW,
  });

  node.contribute("fixture", { visible: true });
  node.contribute("fixture", { visible: true });
  assert.equal(node.snapshot().worth.score, 2);

  const request = compileRtmeKernelRequest({
    intent: intent(),
    consent: consent(),
    guardian: guardian(),
    now: NOW,
  });

  assert.equal(Object.hasOwn(request, "worth"), false);
  assert.equal(Object.hasOwn(request.intent, "worth"), false);
  assert.equal(Object.hasOwn(request.consent, "worth"), false);
  assert.equal(request.constitutionalRequirements.worthMayAuthorize, false);
});
