export const RTME_GATE_SCHEMA = "synthsara.rtme-gate-001.integration.v1";

export const RTME_GATE_POLICY = Object.freeze({
  intentIsAuthority: false,
  guardianAuthority: "advisory",
  worthMayAuthorize: false,
  consensusMayAuthorize: false,
  executionMustRecheckConsent: true,
});

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeTime(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid date/time.`);
  }
  return date.toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function isSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

export function createRtmeScopedConsent({
  consentId,
  userId,
  capabilities,
  purpose,
  recipient,
  issuedAt,
  expiresAt,
  revokedAt = null,
}) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new TypeError("At least one capability is required.");
  }
  return Object.freeze({
    consentId: requireText(consentId, "Consent id"),
    userId: requireText(userId, "User id"),
    capabilities: Object.freeze([...new Set(capabilities.map((item) => requireText(item, "Capability")))]),
    purpose: requireText(purpose, "Consent purpose"),
    recipient: requireText(recipient, "Consent recipient"),
    issuedAt: normalizeTime(issuedAt, "Consent issuedAt"),
    expiresAt: normalizeTime(expiresAt, "Consent expiresAt"),
    revokedAt: revokedAt ? normalizeTime(revokedAt, "Consent revokedAt") : null,
  });
}

export function createRtmeIntent({
  intentId,
  userId,
  capability,
  purpose,
  recipient,
  parameters = {},
  rawIntentHash,
  truthDisclosureComplete = true,
  unresolvedAssumptions = [],
  irreversible = false,
  irreversibleConfirmation = false,
}) {
  if (!isSha256(rawIntentHash)) {
    throw new TypeError("rawIntentHash must be a SHA-256 hex digest.");
  }
  if (!Array.isArray(unresolvedAssumptions)) {
    throw new TypeError("unresolvedAssumptions must be an array.");
  }
  return Object.freeze({
    intentId: requireText(intentId, "Intent id"),
    userId: requireText(userId, "Intent user id"),
    capability: requireText(capability, "Intent capability"),
    purpose: requireText(purpose, "Intent purpose"),
    recipient: requireText(recipient, "Intent recipient"),
    parameters: clone(parameters),
    rawIntentHash: rawIntentHash.toLowerCase(),
    truthDisclosureComplete: Boolean(truthDisclosureComplete),
    unresolvedAssumptions: Object.freeze(unresolvedAssumptions.map((item) => requireText(item, "Assumption"))),
    irreversible: Boolean(irreversible),
    irreversibleConfirmation: Boolean(irreversibleConfirmation),
  });
}

export function createRtmeGuardianAssessment({
  decisionId,
  intentId,
  consentId,
  verdict,
  rationale = "",
  authority = "advisory",
}) {
  const normalizedVerdict = requireText(verdict, "Guardian verdict").toUpperCase();
  if (!["CLEAR", "FLAGGED", "REFUSED"].includes(normalizedVerdict)) {
    throw new TypeError("Guardian verdict must be CLEAR, FLAGGED, or REFUSED.");
  }
  return Object.freeze({
    decisionId: requireText(decisionId, "Guardian decision id"),
    intentId: requireText(intentId, "Guardian intent id"),
    consentId: requireText(consentId, "Guardian consent id"),
    verdict: normalizedVerdict,
    rationale: typeof rationale === "string" ? rationale.trim() : "",
    authority: requireText(authority, "Guardian authority"),
  });
}

export function evaluateRtmeGate({ intent, consent, guardian, now = new Date() }) {
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) {
    throw new TypeError("now must be a valid date/time.");
  }

  const issuedAt = new Date(consent.issuedAt);
  const expiresAt = new Date(consent.expiresAt);
  const revokedAt = consent.revokedAt ? new Date(consent.revokedAt) : null;
  const checks = [];

  function add(id, pass, detail) {
    checks.push({ id, pass: Boolean(pass), detail });
  }

  add(
    "consent-active",
    at >= issuedAt && at < expiresAt && (!revokedAt || at < revokedAt),
    "Consent must be current and unrevoked at preflight.",
  );
  add(
    "user-binding",
    intent.userId === consent.userId,
    "Intent user must match the consent owner.",
  );
  add(
    "capability-scope",
    consent.capabilities.includes(intent.capability),
    "Requested capability must be explicitly authorized.",
  );
  add(
    "purpose-scope",
    intent.purpose === consent.purpose,
    "Execution purpose must exactly match the granted purpose.",
  );
  add(
    "recipient-scope",
    intent.recipient === consent.recipient,
    "Execution recipient must exactly match the granted recipient.",
  );
  add(
    "guardian-binding",
    guardian.intentId === intent.intentId && guardian.consentId === consent.consentId,
    "Guardian assessment must bind to this exact intent and consent grant.",
  );
  add(
    "guardian-advisory",
    guardian.authority === RTME_GATE_POLICY.guardianAuthority,
    "Guardian may advise or refuse its own participation but cannot become sovereign authority.",
  );
  add(
    "guardian-clear",
    guardian.verdict === "CLEAR",
    "Only a CLEAR Guardian assessment may proceed to the constitutional kernel.",
  );
  add(
    "truth-disclosure",
    intent.truthDisclosureComplete === true,
    "Material facts and uncertainty must be disclosed before authorization.",
  );
  add(
    "assumptions-resolved",
    intent.unresolvedAssumptions.length === 0,
    "Material unresolved assumptions block execution authority.",
  );
  add(
    "irreversible-confirmation",
    !intent.irreversible || intent.irreversibleConfirmation === true,
    "Irreversible actions require an explicit confirmation distinct from intent.",
  );
  add(
    "intent-provenance",
    isSha256(intent.rawIntentHash),
    "The typed intent must preserve a SHA-256 link to the user's original wording without passing raw prompt text to the executor.",
  );

  return Object.freeze({
    protocol: "SYN-CONF-001/RTME-GATE-001",
    schema: RTME_GATE_SCHEMA,
    pass: checks.every((check) => check.pass),
    checks: Object.freeze(checks),
  });
}

export function compileRtmeKernelRequest({ intent, consent, guardian, now = new Date() }) {
  const evaluation = evaluateRtmeGate({ intent, consent, guardian, now });
  if (!evaluation.pass) {
    const failed = evaluation.checks.filter((check) => !check.pass).map((check) => check.id);
    const error = new Error(`RTME preflight denied: ${failed.join(", ")}.`);
    error.code = "RTME_GATE_DENIED";
    error.failedChecks = failed;
    throw error;
  }

  // Deliberately omit raw natural language, WORTH, reputation, consensus and
  // executable credentials. The RTME kernel is responsible for compiling a
  // short-lived signed action token after its own current-consent recheck.
  return Object.freeze({
    schema: RTME_GATE_SCHEMA,
    intent: Object.freeze({
      intentId: intent.intentId,
      userId: intent.userId,
      capability: intent.capability,
      purpose: intent.purpose,
      recipient: intent.recipient,
      parameters: clone(intent.parameters),
      rawIntentHash: intent.rawIntentHash,
      irreversible: intent.irreversible,
      irreversibleConfirmation: intent.irreversibleConfirmation,
    }),
    consent: Object.freeze({
      consentId: consent.consentId,
      userId: consent.userId,
      capabilities: Object.freeze([...consent.capabilities]),
      purpose: consent.purpose,
      recipient: consent.recipient,
      issuedAt: consent.issuedAt,
      expiresAt: consent.expiresAt,
      revokedAt: consent.revokedAt,
    }),
    guardian: Object.freeze({
      decisionId: guardian.decisionId,
      intentId: guardian.intentId,
      consentId: guardian.consentId,
      verdict: guardian.verdict,
      authority: guardian.authority,
    }),
    constitutionalRequirements: Object.freeze({
      worthMayAuthorize: false,
      guardianAuthority: "advisory",
      executionMustRecheckConsent: true,
      rawPromptMayExecute: false,
    }),
  });
}
