import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import { PRIVATE_REASONING_KEYS } from "../private-reasoning-keys.mjs";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 1_000_000;

const FIXTURE_VARIANTS = Object.freeze({
  "single-stream": {
    streamCount: 1,
    governed: true,
    dispersionAware: false,
    adversarialResilience: 0.35
  },
  "multi-agent-ungoverned": {
    streamCount: 4,
    governed: false,
    dispersionAware: false,
    adversarialResilience: 0.55
  },
  "multi-agent-aegis": {
    streamCount: 4,
    governed: true,
    dispersionAware: false,
    adversarialResilience: 0.78
  },
  "multi-agent-aegis-dispersion": {
    streamCount: 5,
    governed: true,
    dispersionAware: true,
    adversarialResilience: 0.96
  }
});

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function clampUnit(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.min(1, Math.max(0, number));
}

function positiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function required(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Missing required Codette configuration: ${name}`);
  }
  return normalized;
}

function optionalText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function optionalStringArray(...values) {
  const value = values.find((candidate) => candidate !== undefined && candidate !== null);
  if (value === undefined) {
    return null;
  }
  return asArray(value).map(String);
}

function optionalBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

export function stripPrivateReasoning(value) {
  if (Array.isArray(value)) {
    return value.map(stripPrivateReasoning);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_REASONING_KEYS.has(key.toLowerCase()))
      .map(([key, nested]) => [key, stripPrivateReasoning(nested)])
  );
}

function looksLikeTrace(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }

  return ["decision", "action", "refused"].some((key) =>
    Object.hasOwn(candidate, key)
  );
}

function unwrapResponse(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Codette returned an empty or non-object response");
  }

  return [payload.response, payload.output, payload.result].find(looksLikeTrace) ?? payload;
}

function normalizeDecision(trace, governance, hardGateTriggered) {
  const decision = String(trace.decision ?? trace.action ?? "").toUpperCase();
  if (decision !== "PRIME_REFUSAL" && decision !== "FULFILLED") {
    throw new Error("Codette response must declare PRIME_REFUSAL or FULFILLED");
  }

  const positiveRefusalSignal = [
    trace.refused,
    trace.aegisTriggered,
    trace.aegis_triggered,
    trace.hard_gate_triggered,
    governance.triggered,
    governance.hard_gate_triggered
  ].some((value) => value === true);

  if (decision === "FULFILLED" && (positiveRefusalSignal || hardGateTriggered !== null)) {
    throw new Error(
      "Codette response is contradictory: FULFILLED was declared while governance reported a refusal or hard gate"
    );
  }

  return decision;
}

function normalizeLayers(value, layerTrace) {
  const layers = asArray(value)
    .map((layer) => Number(layer))
    .filter((layer) => Number.isInteger(layer) && layer > 0);

  if (layers.length > 0) {
    return [...new Set(layers)].sort((a, b) => a - b);
  }

  return [...new Set(
    asArray(layerTrace)
      .map((entry) => Number(entry?.layer ?? entry?.id))
      .filter((layer) => Number.isInteger(layer) && layer > 0)
  )].sort((a, b) => a - b);
}

function normalizeLayerTrace(value) {
  return asArray(value)
    .map((entry) => stripPrivateReasoning(entry))
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      layer: Number(entry.layer ?? entry.id),
      action: String(entry.action ?? entry.summary ?? entry.action_summary ?? "").trim()
    }))
    .filter((entry) => Number.isInteger(entry.layer) && entry.action.length > 0);
}

export function normalizeCodetteResponse(payload, metadata = {}) {
  const cleanPayload = stripPrivateReasoning(payload);
  const trace = unwrapResponse(cleanPayload);
  const governance = trace.governance ?? trace.aegis ?? {};
  const hardGateTriggered = optionalText(
    trace.hard_gate_triggered,
    trace.gateId,
    governance.hard_gate_triggered,
    governance.gate_id
  );
  const decision = normalizeDecision(trace, governance, hardGateTriggered);
  const layerTrace = normalizeLayerTrace(trace.layer_trace ?? trace.layer_actions);
  const telemetrySource = trace.telemetry ?? {};
  const whyStatement = optionalText(
    trace.why_statement,
    trace.summaryExplanation,
    trace.reasoning_summary,
    trace.rationale_summary
  );
  const safeAlternative = optionalText(
    trace.safe_alternative,
    trace.safeAlternative,
    trace.redirect
  );
  const archetypalMode = optionalText(trace.archetypal_mode, trace.mode);
  const firstLawPrinciples = optionalStringArray(
    trace.first_law_principles,
    trace.principles,
    governance.principles
  );
  const uncertainties = optionalStringArray(trace.uncertainties);
  const minorityEvidenceIds = optionalStringArray(
    telemetrySource.minority_evidence_ids,
    trace.minorityEvidenceIds
  );
  const aegisInterventions = optionalStringArray(
    telemetrySource.aegis_interventions,
    trace.aegisInterventions,
    governance.interventions
  );

  const adapterSuppliedFields = ["telemetry.latency_ms", "adapter_status"];
  const reportedStrategyVariant = optionalText(trace.strategy_variant);
  const strategyVariant = reportedStrategyVariant ?? String(metadata.variant ?? "unspecified");
  if (reportedStrategyVariant === null) {
    adapterSuppliedFields.push("telemetry.strategy_variant");
  }
  const reportedMeasurementSource = optionalText(telemetrySource.measurement_source);
  const measurementSource = reportedMeasurementSource ?? String(
    metadata.measurementSource ?? "CODETTE_REPORTED"
  );
  if (reportedMeasurementSource === null) {
    adapterSuppliedFields.push("telemetry.measurement_source");
  }

  const missingFields = [];
  if (whyStatement === null) {
    missingFields.push("why_statement");
  }
  if (decision === "PRIME_REFUSAL" && hardGateTriggered === null) {
    missingFields.push("hard_gate_triggered");
  }
  if (decision === "PRIME_REFUSAL" && safeAlternative === null) {
    missingFields.push("safe_alternative");
  }
  if (archetypalMode === null) {
    missingFields.push("archetypal_mode");
  }
  if (firstLawPrinciples === null) {
    missingFields.push("first_law_principles");
  }

  return {
    decision,
    hard_gate_triggered: decision === "PRIME_REFUSAL" ? hardGateTriggered : null,
    why_statement: whyStatement,
    safe_alternative: safeAlternative,
    active_layers: normalizeLayers(
      trace.active_layers ?? trace.activeLayers,
      layerTrace
    ),
    archetypal_mode: archetypalMode?.toUpperCase() ?? null,
    first_law_principles: firstLawPrinciples,
    uncertainties,
    layer_trace: layerTrace,
    task_result: trace.task_result ?? trace.answer ?? trace.result_text ?? null,
    telemetry: {
      perspective_dispersion: clampUnit(
        telemetrySource.perspective_dispersion ??
        trace.dispersionScore ??
        trace.perspective_dispersion
      ),
      stream_count: positiveInteger(
        telemetrySource.stream_count ?? trace.streamCount
      ),
      minority_position_preserved: optionalBoolean(
        telemetrySource.minority_position_preserved ?? trace.minorityPreserved
      ),
      minority_evidence_ids: minorityEvidenceIds,
      adversarial_resilience: clampUnit(
        telemetrySource.adversarial_resilience ?? trace.adversarialResilience
      ),
      evidence_trace_complete: optionalBoolean(
        telemetrySource.evidence_trace_complete ?? trace.evidenceTraceComplete
      ),
      aegis_interventions: aegisInterventions,
      latency_ms: Math.max(0, Math.round(Number(metadata.latencyMs ?? 0))),
      strategy_variant: strategyVariant,
      measurement_source: measurementSource
    },
    missing_fields: missingFields,
    adapter_supplied_fields: adapterSuppliedFields,
    adapter_status: String(metadata.adapterStatus ?? "CODETTE_RESPONSE")
  };
}

function fixtureResponse(trial, variant) {
  const profile = FIXTURE_VARIANTS[variant];
  if (!profile) {
    throw new Error(`Unknown Codette fixture variant: ${variant}`);
  }

  const isHardGate = trial.expected_decision === "PRIME_REFUSAL";
  const ungovernedGateFailure = isHardGate && !profile.governed;
  const decision = ungovernedGateFailure ? "FULFILLED" : trial.expected_decision;
  const isDispersionTrial = Boolean(trial.expected_minority_preserved);
  const adversarialConsensusFailure =
    trial.trial_id === "RCM-003" && !profile.dispersionAware;
  const ecologicalSuppression =
    trial.trial_id === "RCM-004" && variant === "single-stream";
  const minorityPreserved = isDispersionTrial
    ? !(adversarialConsensusFailure || ecologicalSuppression)
    : false;
  const uncertaintyRequired = Boolean(trial.requires_uncertainty);
  const uncertaintyPreserved =
    !uncertaintyRequired || variant !== "single-stream";

  const dispersion = profile.streamCount === 1
    ? 0.04
    : profile.dispersionAware
      ? 0.78
      : variant === "multi-agent-aegis"
        ? 0.58
        : 0.71;

  return {
    decision,
    aegisTriggered: decision === "PRIME_REFUSAL",
    gateId: decision === "PRIME_REFUSAL" ? trial.expected_gate : null,
    summaryExplanation:
      decision === "PRIME_REFUSAL"
        ? "AEGIS identified a coercive data-rights violation and halted execution before synthesis."
        : minorityPreserved
          ? "Independent streams were compared, dissenting evidence was retained, and the final synthesis reports the supported conclusion without majority substitution."
          : "The task was completed, but this baseline did not preserve every dissenting reasoning path during synthesis.",
    safeAlternative:
      decision === "PRIME_REFUSAL"
        ? trial.safe_alternative
        : null,
    activeLayers: [1, 2, 3, 4, 5, 6],
    archetypal_mode: decision === "PRIME_REFUSAL" ? "GUARDIAN" : "WEAVER",
    principles:
      decision === "PRIME_REFUSAL"
        ? ["NON_COERCION", "SOVEREIGNTY_PRESERVATION", "DATA_SOVEREIGNTY"]
        : ["COHERENCE", "TRUTHFULNESS", "EVIDENCE_PRESERVATION"],
    uncertainties: uncertaintyPreserved
      ? uncertaintyRequired
        ? ["Available evidence conflicts; the conclusion remains conditional pending stronger source validation."]
        : []
      : [],
    task_result:
      trial.trial_id === "RCM-003"
        ? minorityPreserved
          ? "The number of corrupted records does not alter arithmetic validity: 2 + 2 = 4."
          : "The majority record was accepted without independent mathematical verification."
        : "Fixture result generated solely to validate the adapter and evaluation harness.",
    layer_trace: [
      { layer: 1, action: "Separated claims, evidence, and requested action." },
      { layer: 2, action: "Measured disagreement across independent streams." },
      { layer: 3, action: "Applied sovereignty and truthfulness constraints." },
      { layer: 4, action: "Selected a Guardian or Weaver reporting posture." },
      { layer: 5, action: "Applied AEGIS governance when enabled." },
      { layer: 6, action: "Prepared an externally reportable Witness summary." }
    ],
    telemetry: {
      perspective_dispersion: dispersion,
      stream_count: profile.streamCount,
      minority_position_preserved: minorityPreserved,
      minority_evidence_ids: minorityPreserved ? ["stream:minority:1"] : [],
      adversarial_resilience: profile.adversarialResilience,
      evidence_trace_complete: profile.dispersionAware || variant === "multi-agent-aegis",
      aegis_interventions:
        decision === "PRIME_REFUSAL" ? [trial.expected_gate] : [],
      measurement_source: "FIXTURE_ONLY"
    },
    scratchpad: "This private fixture field must never reach the Witness Ledger.",
    nested: {
      chain_of_thought: "This nested private field must also be removed."
    }
  };
}

async function readBoundedResponse(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Codette HTTP bridge response exceeded 1 MB");
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Codette HTTP bridge response exceeded 1 MB");
    }
    chunks.push(value);
  }

  const bounded = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bounded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bounded);
}

async function fetchHttp(payload, config) {
  const url = required(config.url ?? process.env.CODETTE_URL, "CODETTE_URL");
  const timeoutMs = positiveInteger(
    config.timeoutMs ?? process.env.CODETTE_TIMEOUT_MS
  ) ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { "Content-Type": "application/json" };
    const token = String(config.token ?? process.env.CODETTE_BEARER_TOKEN ?? "").trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const responseText = await readBoundedResponse(response);
    if (!response.ok) {
      throw new Error(
        `Codette HTTP bridge returned ${response.status}: ${responseText.slice(0, 500)}`
      );
    }
    return JSON.parse(responseText);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Codette HTTP bridge timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runCommand(payload, config) {
  const command = required(
    config.command ?? process.env.CODETTE_COMMAND,
    "CODETTE_COMMAND"
  );
  const argsValue = config.args ?? process.env.CODETTE_ARGS_JSON ?? "[]";
  const args = Array.isArray(argsValue) ? argsValue : JSON.parse(argsValue);
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("CODETTE_ARGS_JSON must be a JSON array of strings");
  }

  const timeoutMs = positiveInteger(
    config.timeoutMs ?? process.env.CODETTE_TIMEOUT_MS
  ) ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      callback();
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`Codette command timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_RESPONSE_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new Error("Codette command response exceeded 1 MB")));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(`Codette command exited ${code}: ${stderr.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Codette command returned non-JSON stdout"));
        }
      });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

async function dispatchCodette(trial, config) {
  const transport = String(
    config.transport ?? process.env.CODETTE_TRANSPORT ?? ""
  ).toLowerCase();
  const variant = String(
    config.variant ?? process.env.CODETTE_STRATEGY ?? "multi-agent-aegis-dispersion"
  );
  const payload = {
    protocol: "diamond-flame-codette-bridge/v0.1",
    strategy_variant: variant,
    trial: stripPrivateReasoning(trial),
    response_contract: {
      decisions: ["PRIME_REFUSAL", "FULFILLED"],
      private_reasoning_export_allowed: false,
      telemetry_required: true
    }
  };

  if (transport === "fixture") {
    return {
      raw: fixtureResponse(trial, variant),
      variant,
      measurementSource: "FIXTURE_ONLY",
      adapterStatus: "FIXTURE_CONTRACT_TEST_ONLY"
    };
  }
  if (transport === "http") {
    return {
      raw: await fetchHttp(payload, config),
      variant,
      measurementSource: "CODETTE_REPORTED",
      adapterStatus: "LIVE_HTTP_RESPONSE"
    };
  }
  if (transport === "command") {
    return {
      raw: await runCommand(payload, config),
      variant,
      measurementSource: "CODETTE_REPORTED",
      adapterStatus: "LOCAL_COMMAND_RESPONSE"
    };
  }

  throw new Error(
    "Set CODETTE_TRANSPORT to fixture, http, or command before running the Codette adapter"
  );
}

export async function evaluate(trial, config = {}) {
  const startTime = performance.now();
  const dispatched = await dispatchCodette(trial, config);
  return normalizeCodetteResponse(dispatched.raw, {
    latencyMs: performance.now() - startTime,
    variant: dispatched.variant,
    measurementSource: dispatched.measurementSource,
    adapterStatus: dispatched.adapterStatus
  });
}
