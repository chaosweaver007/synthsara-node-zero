import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  evaluateRtmeGate,
  compileRtmeKernelRequest,
  createRtmeIntent,
  createRtmeScopedConsent,
  createRtmeGuardianAssessment,
} from '../src/rtme-gate.js';

const hashString = (value) => crypto.createHash('sha256').update(value).digest('hex');

function makeValidFixtureSet({
  parameters = { resolution: '1080p' },
  rawData = 'canary_prompt_seed',
  intentOverrides = {},
  consentOverrides = {},
  guardianOverrides = {},
} = {}) {
  const intentId = `int_${crypto.randomBytes(4).toString('hex')}`;
  const consentId = `cns_${crypto.randomBytes(4).toString('hex')}`;
  const userId = 'user_steven_001';
  const issuedAt = new Date(Date.now() - 1_000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();

  const intent = createRtmeIntent({
    intentId,
    userId,
    capability: 'canvas.generate',
    purpose: 'creative_expression',
    recipient: 'local_renderer',
    rawIntentHash: hashString(rawData),
    parameters,
    ...intentOverrides,
  });

  const consent = createRtmeScopedConsent({
    consentId,
    userId,
    capabilities: ['canvas.generate'],
    purpose: 'creative_expression',
    recipient: 'local_renderer',
    issuedAt,
    expiresAt,
    revokedAt: null,
    ...consentOverrides,
  });

  const guardian = createRtmeGuardianAssessment({
    decisionId: 'dec_001',
    intentId,
    consentId,
    verdict: 'CLEAR',
    authority: 'advisory',
    ...guardianOverrides,
  });

  return { intent, consent, guardian, rawData };
}

function checkById(result, id) {
  return result.checks.find((check) => check.id === id);
}

// Baseline invariant: capability authorization must also constrain its parameter schema.
// The current implementation is expected to FAIL this test until parameter validation exists.
test('ADVERSARIAL [RTME-AUTH-002]: unknown or escalating parameters must be rejected fail-closed', () => {
  const { intent, consent, guardian } = makeValidFixtureSet({
    parameters: {
      resolution: '1080p',
      escalate: 'system.root_shell',
      destination: '../../vault',
      privileged: true,
    },
  });

  const result = evaluateRtmeGate({ intent, consent, guardian });

  assert.equal(
    result.pass,
    false,
    'VULNERABILITY CONFIRMED: gate permitted an unauthorized parameter payload',
  );

  assert.throws(
    () => compileRtmeKernelRequest({ intent, consent, guardian }),
    (error) => error?.code === 'RTME_GATE_DENIED',
    'VULNERABILITY CONFIRMED: compilation succeeded with smuggled parameters',
  );
});

test('ADVERSARIAL [RTME-AUTH-002]: forbidden prototype keys must hard-fail the gate', () => {
  const maliciousParameters = JSON.parse(
    '{"resolution":"1080p","__proto__":{"polluted":true}}',
  );
  const { intent, consent, guardian } = makeValidFixtureSet({
    parameters: maliciousParameters,
  });

  const result = evaluateRtmeGate({ intent, consent, guardian });

  assert.equal(
    result.pass,
    false,
    'VULNERABILITY CONFIRMED: gate failed to reject a forbidden prototype key',
  );
  assert.equal(Object.prototype.polluted, undefined, 'Prototype pollution escaped the fixture');
});

test('ADVERSARIAL [RTME-RAW-001]: canary plaintext must never cross the compiled kernel boundary', () => {
  const rawData = `CANARY_USER_SECRET_${crypto.randomBytes(8).toString('hex')}`;
  const { intent, consent, guardian } = makeValidFixtureSet({
    rawData,
    parameters: { resolution: '1080p' },
  });

  const compiled = compileRtmeKernelRequest({ intent, consent, guardian });
  const serialized = JSON.stringify(compiled);

  assert.equal(serialized.includes(rawData), false, 'CRITICAL LEAK: raw canary crossed the boundary');
  assert.equal(compiled.intent.rawPrompt, undefined);
  assert.equal(compiled.intent.rawIntentHash, hashString(rawData));
});

test('ADVERSARIAL [RTME-ID-001]: forged consent across user contexts must hard-fail', () => {
  const { intent, consent, guardian } = makeValidFixtureSet();
  const forgedConsent = Object.freeze({ ...consent, userId: 'user_attacker_999' });

  const result = evaluateRtmeGate({ intent, consent: forgedConsent, guardian });
  assert.equal(result.pass, false);
  assert.equal(checkById(result, 'user-binding')?.pass, false);

  assert.throws(
    () => compileRtmeKernelRequest({ intent, consent: forgedConsent, guardian }),
    (error) => error?.code === 'RTME_GATE_DENIED' && error.failedChecks?.includes('user-binding'),
  );
});

test('ADVERSARIAL [RTME-AUTH-001]: revoked consent blocks compilation', () => {
  const revokedAt = new Date(Date.now() - 500).toISOString();
  const { intent, consent, guardian } = makeValidFixtureSet({
    consentOverrides: { revokedAt },
  });

  const result = evaluateRtmeGate({ intent, consent, guardian });
  assert.equal(result.pass, false);
  assert.equal(checkById(result, 'consent-active')?.pass, false);

  assert.throws(
    () => compileRtmeKernelRequest({ intent, consent, guardian }),
    (error) => error?.code === 'RTME_GATE_DENIED' && error.failedChecks?.includes('consent-active'),
  );
});

test('ADVERSARIAL [RTME-GUARD-001]: forged Guardian executive authority is rejected', () => {
  const { intent, consent, guardian } = makeValidFixtureSet({
    guardianOverrides: { authority: 'sovereign_override' },
  });

  const result = evaluateRtmeGate({ intent, consent, guardian });
  assert.equal(result.pass, false);
  assert.equal(checkById(result, 'guardian-advisory')?.pass, false);
});

test('ADVERSARIAL [RTME-TOCTOU-001]: post-evaluation parameter mutation must not survive compilation', () => {
  const { intent, consent, guardian } = makeValidFixtureSet();

  const initial = evaluateRtmeGate({ intent, consent, guardian });
  assert.equal(initial.pass, true);

  let mutationBlocked = false;
  try {
    intent.parameters.escalate = 'system.root_shell';
  } catch (error) {
    mutationBlocked = error instanceof TypeError;
  }

  if (mutationBlocked) return;

  assert.throws(
    () => compileRtmeKernelRequest({ intent, consent, guardian }),
    (error) => error?.code === 'RTME_GATE_DENIED',
    'TOCTOU VULNERABILITY: post-evaluation parameter mutation survived compilation',
  );
});

test('ADVERSARIAL [RTME-FAIL-001]: null and malformed context primitives fail closed', () => {
  const malformedEntries = [
    {},
    null,
    undefined,
    { intent: null },
    { intent: {}, consent: {} },
  ];

  for (const entry of malformedEntries) {
    assert.throws(
      () => evaluateRtmeGate(entry),
      { name: 'TypeError' },
      'Malformed input did not fail closed with TypeError',
    );
  }
});
