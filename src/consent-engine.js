export const CONSENT_STATUS = Object.freeze({
  GRANTED: "granted",
  DENIED: "denied",
  REVOKED: "revoked",
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function createConsentRecord(scope, options = {}) {
  if (typeof scope !== "string" || !scope.trim()) {
    throw new TypeError("Consent scope must be a non-empty string.");
  }

  const now = normalizeDate(options.now) ?? new Date().toISOString();
  const status = Object.values(CONSENT_STATUS).includes(options.status)
    ? options.status
    : CONSENT_STATUS.DENIED;

  return {
    scope,
    status,
    purpose: typeof options.purpose === "string" ? options.purpose.trim() : "",
    recipient: typeof options.recipient === "string" ? options.recipient.trim() : "local-node",
    grantedAt: status === CONSENT_STATUS.GRANTED ? normalizeDate(options.grantedAt) ?? now : null,
    revokedAt: status === CONSENT_STATUS.REVOKED ? normalizeDate(options.revokedAt) ?? now : null,
    expiresAt: normalizeDate(options.expiresAt),
    lastUsedAt: normalizeDate(options.lastUsedAt),
    revocable: options.revocable !== false,
  };
}

export function normalizeConsentRecord(scope, candidate, options = {}) {
  if (typeof candidate === "boolean") {
    return createConsentRecord(scope, {
      ...options,
      status: candidate ? CONSENT_STATUS.GRANTED : CONSENT_STATUS.DENIED,
    });
  }

  if (!isObject(candidate)) {
    return createConsentRecord(scope, options);
  }

  return createConsentRecord(scope, {
    ...candidate,
    ...options,
    status: Object.values(CONSENT_STATUS).includes(candidate.status)
      ? candidate.status
      : CONSENT_STATUS.DENIED,
    grantedAt: candidate.grantedAt,
    revokedAt: candidate.revokedAt,
    expiresAt: candidate.expiresAt,
    lastUsedAt: candidate.lastUsedAt,
    revocable: candidate.revocable,
  });
}

export function grantConsent(record, options = {}) {
  const current = normalizeConsentRecord(record.scope, record);
  const now = normalizeDate(options.now) ?? new Date().toISOString();

  return {
    ...current,
    status: CONSENT_STATUS.GRANTED,
    purpose: typeof options.purpose === "string" ? options.purpose.trim() : current.purpose,
    recipient: typeof options.recipient === "string" ? options.recipient.trim() : current.recipient,
    grantedAt: now,
    revokedAt: null,
    expiresAt: options.expiresAt === undefined ? current.expiresAt : normalizeDate(options.expiresAt),
    revocable: options.revocable === undefined ? current.revocable : options.revocable !== false,
  };
}

export function revokeConsent(record, options = {}) {
  const current = normalizeConsentRecord(record.scope, record);
  if (current.revocable === false && options.force !== true) {
    throw new Error(`Consent scope "${current.scope}" is not revocable.`);
  }

  return {
    ...current,
    status: CONSENT_STATUS.REVOKED,
    revokedAt: normalizeDate(options.now) ?? new Date().toISOString(),
  };
}

export function canPerform(action, scope, consentMap, options = {}) {
  const now = new Date(options.now ?? Date.now());
  const record = isObject(consentMap) ? consentMap[scope] : undefined;

  if (!record) {
    return {
      allowed: false,
      action,
      scope,
      reason: "missing-consent",
    };
  }

  const normalized = normalizeConsentRecord(scope, record);

  if (normalized.status !== CONSENT_STATUS.GRANTED) {
    return {
      allowed: false,
      action,
      scope,
      reason: normalized.status,
    };
  }

  if (normalized.expiresAt && now >= new Date(normalized.expiresAt)) {
    return {
      allowed: false,
      action,
      scope,
      reason: "expired",
    };
  }

  if (typeof options.purpose === "string" && normalized.purpose && normalized.purpose !== options.purpose) {
    return {
      allowed: false,
      action,
      scope,
      reason: "purpose-mismatch",
    };
  }

  if (typeof options.recipient === "string" && normalized.recipient && normalized.recipient !== options.recipient) {
    return {
      allowed: false,
      action,
      scope,
      reason: "recipient-mismatch",
    };
  }

  return {
    allowed: true,
    action,
    scope,
    reason: "granted",
    consent: normalized,
  };
}

export function requireConsent(action, scope, consentMap, options = {}) {
  const decision = canPerform(action, scope, consentMap, options);
  if (!decision.allowed) {
    const error = new Error(`Gate denied ${action} for ${scope}: ${decision.reason}.`);
    error.name = "ConsentDeniedError";
    error.code = "CONSENT_DENIED";
    error.decision = decision;
    throw error;
  }

  return decision;
}

export function markConsentUsed(record, options = {}) {
  const current = normalizeConsentRecord(record.scope, record);
  return {
    ...current,
    lastUsedAt: normalizeDate(options.now) ?? new Date().toISOString(),
  };
}
