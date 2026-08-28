import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSENT_STATUS,
  canPerform,
  createConsentRecord,
  grantConsent,
  normalizeConsentRecord,
  requireConsent,
  revokeConsent,
} from "../src/consent-engine.js";

const NOW = "2026-08-27T20:00:00.000Z";

test("new consent defaults to denied", () => {
  const record = createConsentRecord("emotional", { now: NOW });
  assert.equal(record.status, CONSENT_STATUS.DENIED);
  assert.equal(record.grantedAt, null);
});

test("legacy boolean consent migrates without silently granting false scopes", () => {
  const granted = normalizeConsentRecord("profile", true, { now: NOW });
  const denied = normalizeConsentRecord("creative", false, { now: NOW });

  assert.equal(granted.status, CONSENT_STATUS.GRANTED);
  assert.equal(denied.status, CONSENT_STATUS.DENIED);
});

test("unknown scopes fail closed", () => {
  const decision = canPerform("read", "emotional", {}, { now: NOW });
  assert.deepEqual(decision, {
    allowed: false,
    action: "read",
    scope: "emotional",
    reason: "missing-consent",
  });
});

test("granted scope permits only matching purpose and recipient", () => {
  const base = createConsentRecord("profile", { now: NOW });
  const granted = grantConsent(base, {
    now: NOW,
    purpose: "render-profile",
    recipient: "local-node",
  });
  const consent = { profile: granted };

  assert.equal(
    canPerform("read", "profile", consent, {
      now: NOW,
      purpose: "render-profile",
      recipient: "local-node",
    }).allowed,
    true,
  );

  assert.equal(
    canPerform("read", "profile", consent, {
      now: NOW,
      purpose: "train-model",
      recipient: "local-node",
    }).reason,
    "purpose-mismatch",
  );
});

test("expired consent is refused", () => {
  const base = createConsentRecord("creative", { now: NOW });
  const granted = grantConsent(base, {
    now: NOW,
    expiresAt: "2026-08-27T20:05:00.000Z",
  });

  const decision = canPerform("read", "creative", { creative: granted }, {
    now: "2026-08-27T20:06:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "expired");
});

test("revocation immediately blocks execution", () => {
  const base = createConsentRecord("collective", { now: NOW });
  const granted = grantConsent(base, { now: NOW });
  const revoked = revokeConsent(granted, { now: "2026-08-27T20:01:00.000Z" });

  const decision = canPerform("share", "collective", { collective: revoked }, {
    now: "2026-08-27T20:02:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "revoked");
});

test("requireConsent stops the action path on refusal", () => {
  assert.throws(
    () => requireConsent("share", "emotional", {}, { now: NOW }),
    (error) => {
      assert.equal(error.name, "ConsentDeniedError");
      assert.equal(error.code, "CONSENT_DENIED");
      assert.equal(error.decision.reason, "missing-consent");
      return true;
    },
  );
});
