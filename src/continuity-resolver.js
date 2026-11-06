/**
 * SYN-CONT-001: Deterministic reconstruction of a consented reference-node
 * memory subject. This module does no I/O, persistence, or model inference.
 *
 * "asOf" means the time the node recorded an entry, not the real-world
 * validity time of its claim. Source provenance is not proof of truth.
 */

function requireSubject(subject) {
  if (typeof subject !== "string" || !subject.trim()) {
    throw new TypeError("Memory subject must be a non-empty string.");
  }
  return subject.trim();
}

function parseInstant(value) {
  if (typeof value !== "string" || !value.trim()) return NaN;
  return Date.parse(value);
}

function result(subject, asOf, status, extra = {}) {
  return {
    protocol: "SYN-CONT-001",
    subject,
    asOf,
    status,
    current: null,
    evidenceIds: [],
    history: [],
    ...extra,
  };
}

/**
 * Reconstruct one *exactly identified* subject; never infer aliases.
 *
 * An unlinked competing record or a correction fork is a conflict, not
 * permission to select whichever entry looks most recent.
 */
export function reconstructMemory(entries, subject, { asOf = null } = {}) {
  const canonical = requireSubject(subject);
  const instant = asOf === null ? null : parseInstant(asOf);
  if (asOf !== null && !Number.isFinite(instant)) {
    throw new TypeError("asOf must be an ISO 8601 timestamp when supplied.");
  }
  const cutoff = instant === null ? null : new Date(instant).toISOString();

  if (!Array.isArray(entries)) {
    return result(canonical, cutoff, "invalid", { reason: "entries_not_array" });
  }

  const selected = entries.filter((entry) => entry?.subject === canonical);
  if (selected.some((entry) =>
    typeof entry.id !== "string" || !entry.id ||
    !Number.isFinite(parseInstant(entry.at)) ||
    (entry.supersedes !== null && entry.supersedes !== undefined &&
      (typeof entry.supersedes !== "string" || !entry.supersedes))
  )) {
    return result(canonical, cutoff, "invalid", { reason: "malformed_entry" });
  }

  const visible = selected
    .filter((entry) => instant === null || parseInstant(entry.at) <= instant)
    .sort((a, b) => parseInstant(a.at) - parseInstant(b.at) || a.id.localeCompare(b.id));

  if (visible.length === 0) return result(canonical, cutoff, "missing");

  const byId = new Map();
  for (const entry of visible) {
    if (byId.has(entry.id)) {
      return result(canonical, cutoff, "invalid", { reason: "duplicate_entry_id" });
    }
    byId.set(entry.id, entry);
  }

  const superseded = new Set();
  for (const entry of visible) {
    if (entry.supersedes === null || entry.supersedes === undefined) continue;
    const parent = byId.get(entry.supersedes);
    if (!parent || parent.id === entry.id || parseInstant(parent.at) > parseInstant(entry.at)) {
      return result(canonical, cutoff, "invalid", { reason: "broken_correction_chain" });
    }
    superseded.add(parent.id);
  }

  const heads = visible.filter((entry) => !superseded.has(entry.id));
  if (heads.length > 1) {
    return result(canonical, cutoff, "conflict", {
      reason: "competing_active_entries",
      evidenceIds: visible.map((entry) => entry.id),
      candidateIds: heads.map((entry) => entry.id),
    });
  }
  if (heads.length !== 1) {
    return result(canonical, cutoff, "invalid", { reason: "cyclic_correction_chain" });
  }

  const chain = [];
  const visited = new Set();
  let cursor = heads[0];
  while (cursor) {
    if (visited.has(cursor.id)) {
      return result(canonical, cutoff, "invalid", { reason: "cyclic_correction_chain" });
    }
    visited.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.supersedes == null ? null : byId.get(cursor.supersedes);
  }
  if (visited.size !== visible.length) {
    return result(canonical, cutoff, "invalid", { reason: "disconnected_correction_chain" });
  }

  chain.reverse();
  const current = heads[0];
  return result(canonical, cutoff, "active", {
    current: {
      entryId: current.id,
      value: structuredClone(current.value),
      provenance: structuredClone(current.provenance ?? {}),
      recordedAt: current.at,
    },
    evidenceIds: chain.map((entry) => entry.id),
    history: chain.map((entry) => ({
      entryId: entry.id,
      recordedAt: entry.at,
      supersedes: entry.supersedes ?? null,
      correctionReason: entry.correctionReason ?? null,
    })),
  });
}
