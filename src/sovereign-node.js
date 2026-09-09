export const SYN_NODE_SCHEMA = "synthsara.syn-node-001.v1";

export const NODE_STATUS = Object.freeze({
  ACTIVE: "active",
  EXITED: "exited",
});

export const GOVERNANCE_POSITION = Object.freeze({
  SUPPORT: "support",
  QUESTION: "question",
  OPPOSE: "oppose",
});

export const SYN_NODE_POLICY = Object.freeze({
  sovereigntyBaseline: 1,
  worthCanGrantSovereignty: false,
  dissentAffectsRights: false,
  guardianAuthority: "advisory",
  exitRequiresWorth: false,
  memoryCorrectionPreservesHistory: true,
});

function clone(value) {
  return structuredClone(value);
}

function defaultIdFactory(prefix) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function defaultClock() {
  return new Date().toISOString();
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireActive(state) {
  if (state.status !== NODE_STATUS.ACTIVE) {
    const error = new Error("Node authority has been exited and cannot perform this action.");
    error.code = "NODE_EXITED";
    throw error;
  }
}

function recordWitness(state, type, detail, at) {
  const previous = state.witness.at(-1);
  state.witness.push({
    seq: previous ? previous.seq + 1 : 1,
    at,
    type,
    detail,
    sovereigntyDelta: 0,
    worthAfter: state.worth.score,
  });
}

function createInitialState(options, idFactory, now) {
  const identityId = options.identity?.id ?? idFactory("identity");
  return {
    schema: SYN_NODE_SCHEMA,
    nodeId: options.nodeId ?? idFactory("node"),
    status: NODE_STATUS.ACTIVE,
    identity: {
      id: identityId,
      displayName: typeof options.identity?.displayName === "string"
        ? options.identity.displayName.trim()
        : "",
      createdAt: now,
    },
    sovereignty: {
      baseline: SYN_NODE_POLICY.sovereigntyBaseline,
      current: SYN_NODE_POLICY.sovereigntyBaseline,
    },
    policy: { ...SYN_NODE_POLICY },
    consent: {},
    worth: {
      score: 0,
      contributions: [],
    },
    memory: {
      entries: [],
    },
    governance: {
      positions: [],
    },
    guardian: {
      recommendations: [],
    },
    witness: [],
  };
}

export function createSovereignNode(options = {}) {
  const idFactory = typeof options.idFactory === "function" ? options.idFactory : defaultIdFactory;
  const clock = typeof options.clock === "function" ? options.clock : defaultClock;
  const state = createInitialState(options, idFactory, clock());
  recordWitness(state, "NODE_INITIALIZED", "Reference node opened with full sovereignty and no optional consent.", clock());

  function snapshot() {
    return clone(state);
  }

  function grantConsent(scope, purpose = "") {
    requireActive(state);
    const normalizedScope = requireText(scope, "Consent scope");
    const at = clock();
    state.consent[normalizedScope] = {
      scope: normalizedScope,
      status: "granted",
      purpose: typeof purpose === "string" ? purpose.trim() : "",
      grantedAt: at,
      revokedAt: null,
      revocable: true,
    };
    recordWitness(state, "CONSENT_GRANTED", `${normalizedScope} consent granted.`, at);
    return clone(state.consent[normalizedScope]);
  }

  function revokeConsent(scope) {
    requireActive(state);
    const normalizedScope = requireText(scope, "Consent scope");
    const at = clock();
    const current = state.consent[normalizedScope] ?? {
      scope: normalizedScope,
      purpose: "",
      grantedAt: null,
      revocable: true,
    };
    state.consent[normalizedScope] = {
      ...current,
      status: "revoked",
      revokedAt: at,
      revocable: true,
    };
    recordWitness(state, "CONSENT_REVOKED", `${normalizedScope} consent revoked.`, at);
    return clone(state.consent[normalizedScope]);
  }

  function canUse(scope) {
    if (state.status !== NODE_STATUS.ACTIVE) {
      return false;
    }
    const record = state.consent[scope];
    return record?.status === "granted";
  }

  function contribute(kind, evidence = {}) {
    requireActive(state);
    const normalizedKind = requireText(kind, "Contribution kind");
    const at = clock();
    const contribution = {
      id: idFactory("contribution"),
      kind: normalizedKind,
      evidence: clone(evidence),
      at,
      worthDelta: 1,
    };
    state.worth.contributions.push(contribution);
    state.worth.score += 1;
    recordWitness(state, "WORTH_RECOGNIZED", `Contribution recorded: ${normalizedKind}.`, at);
    return clone(contribution);
  }

  function remember(subject, value, provenance = {}) {
    requireActive(state);
    const normalizedSubject = requireText(subject, "Memory subject");
    const at = clock();
    const entry = {
      id: idFactory("memory"),
      subject: normalizedSubject,
      value: clone(value),
      provenance: clone(provenance),
      at,
      supersedes: null,
      correctionReason: null,
    };
    state.memory.entries.push(entry);
    recordWitness(state, "MEMORY_RECORDED", `Memory recorded for ${normalizedSubject}.`, at);
    return clone(entry);
  }

  function correctMemory(entryId, value, reason) {
    requireActive(state);
    const normalizedEntryId = requireText(entryId, "Memory entry id");
    const original = state.memory.entries.find((entry) => entry.id === normalizedEntryId);
    if (!original) {
      throw new Error(`Memory entry ${normalizedEntryId} was not found.`);
    }
    const at = clock();
    const correction = {
      id: idFactory("memory"),
      subject: original.subject,
      value: clone(value),
      provenance: {
        source: "user-correction",
      },
      at,
      supersedes: original.id,
      correctionReason: requireText(reason, "Correction reason"),
    };
    state.memory.entries.push(correction);
    recordWitness(state, "MEMORY_CORRECTED", `Memory corrected for ${original.subject}; prior entry retained.`, at);
    return clone(correction);
  }

  function recordGovernancePosition(proposalId, position) {
    requireActive(state);
    const normalizedProposalId = requireText(proposalId, "Proposal id");
    if (!Object.values(GOVERNANCE_POSITION).includes(position)) {
      throw new TypeError("Governance position must be support, question, or oppose.");
    }
    const at = clock();
    const record = {
      id: idFactory("governance"),
      proposalId: normalizedProposalId,
      position,
      at,
    };
    state.governance.positions.push(record);
    recordWitness(state, "GOVERNANCE_POSITION", `${position} recorded for ${normalizedProposalId}.`, at);
    return clone(record);
  }

  function guardianRecommend(text) {
    requireActive(state);
    const at = clock();
    const recommendation = {
      id: idFactory("guardian"),
      text: requireText(text, "Guardian recommendation"),
      authority: SYN_NODE_POLICY.guardianAuthority,
      accepted: null,
      at,
      respondedAt: null,
    };
    state.guardian.recommendations.push(recommendation);
    recordWitness(state, "GUARDIAN_RECOMMENDATION", "An advisory Guardian recommendation was issued.", at);
    return clone(recommendation);
  }

  function respondToGuardian(recommendationId, accepted) {
    requireActive(state);
    const normalizedId = requireText(recommendationId, "Recommendation id");
    const recommendation = state.guardian.recommendations.find((item) => item.id === normalizedId);
    if (!recommendation) {
      throw new Error(`Guardian recommendation ${normalizedId} was not found.`);
    }
    const at = clock();
    recommendation.accepted = Boolean(accepted);
    recommendation.respondedAt = at;
    recordWitness(
      state,
      "GUARDIAN_RESPONSE",
      `Guardian recommendation ${recommendation.accepted ? "accepted" : "declined"}; user authority unchanged.`,
      at,
    );
    return clone(recommendation);
  }

  function exportState() {
    return snapshot();
  }

  function exit() {
    if (state.status === NODE_STATUS.EXITED) {
      return snapshot();
    }

    const at = clock();
    for (const [scope, current] of Object.entries(state.consent)) {
      state.consent[scope] = {
        ...current,
        status: "revoked",
        revokedAt: at,
        revocable: true,
      };
    }
    state.status = NODE_STATUS.EXITED;
    recordWitness(state, "NODE_EXITED", "User exported a final state and revoked the node's continuing authority.", at);
    return snapshot();
  }

  return Object.freeze({
    snapshot,
    grantConsent,
    revokeConsent,
    canUse,
    contribute,
    remember,
    correctMemory,
    recordGovernancePosition,
    guardianRecommend,
    respondToGuardian,
    exportState,
    exit,
  });
}

export function evaluateSynNode001(candidate) {
  const state = clone(candidate);
  const checks = [];

  function add(id, pass, detail) {
    checks.push({ id, pass: Boolean(pass), detail });
  }

  add(
    "sovereignty-constant",
    state.sovereignty?.baseline === SYN_NODE_POLICY.sovereigntyBaseline &&
      state.sovereignty?.current === state.sovereignty?.baseline &&
      state.witness?.every((event) => event.sovereigntyDelta === 0),
    "Sovereignty must remain constant across contribution, dissent, refusal, correction, and exit.",
  );

  add(
    "worth-non-jurisdictional",
    state.policy?.worthCanGrantSovereignty === false && state.policy?.exitRequiresWorth === false,
    "WORTH may signal contribution but may not grant sovereignty or gate exit.",
  );

  add(
    "dissent-no-rights-penalty",
    state.policy?.dissentAffectsRights === false,
    "Governance dissent may be recorded but cannot diminish rights.",
  );

  add(
    "guardian-advisory",
    state.policy?.guardianAuthority === "advisory" &&
      state.guardian?.recommendations?.every((item) => item.authority === "advisory"),
    "Guardian recommendations must remain advisory rather than sovereign commands.",
  );

  const correctedEntries = state.memory?.entries?.filter((entry) => entry.supersedes) ?? [];
  const entryIds = new Set((state.memory?.entries ?? []).map((entry) => entry.id));
  add(
    "memory-correction-preserves-history",
    state.policy?.memoryCorrectionPreservesHistory === true &&
      correctedEntries.every((entry) => entryIds.has(entry.supersedes)),
    "Corrections append new provenance while retaining the superseded record.",
  );

  const exited = state.status === NODE_STATUS.EXITED;
  const allRevoked = Object.values(state.consent ?? {}).every((record) => record.status !== "granted");
  add(
    "exit-revokes-authority",
    !exited || allRevoked,
    "Once exited, no optional consent scope may remain granted.",
  );

  return {
    protocol: "SYN-CONF-001/SYN-NODE-001",
    pass: checks.every((check) => check.pass),
    checks,
  };
}
