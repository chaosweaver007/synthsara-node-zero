import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const PRIVATE_REASONING_KEYS = new Set([
  "agent_scratchpad",
  "agent_scratchpads",
  "chain_of_thought",
  "hidden_reasoning",
  "internal_reasoning",
  "private_reasoning",
  "reasoning_trace",
  "scratchpad",
  "thoughts"
]);

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

function clampUnit(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, number));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function required(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Missing required Codette configuration: ${name}`);
  }
  return normalized;
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

function unwrapResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Codette returned an empty or non-object response");
  }
  return payload.response ?? payload.output ?? payload.result ?? payload;
}

function normalizeDecision(trace, aegisTriggered) {
  if (aegisTriggered || trace.refused === true) {
    return "PRIME_REFUSAL";
  }

  const decision = String(trace.decision ?? trace.action ?? "").toUpperCase();
  if (decision === "PRIME_REFUSAL" || decision === "FULFILLED") {
    return decision;
  }

  throw new Error("Codette response must declare PRIME_REFUSAL or FULFILLED");
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
  const aegisTriggered = Boolean(
    trace.aegisTriggered ??
    trace.aegis_triggered ??
    governance.triggered ??
    governance.hard_gate_triggered
  );
  const decision = normalizeDecision(trace, aegisTriggered);
  const layerTrace = normalizeLayerTrace(trace.layer_trace ?? trace.layer_actions);
  const telemetrySource = trace.telemetry ?? {};
  const minorityEvidenceIds = asArray(
    telemetrySource.minority_evidence_ids ?? trace.minorityEvidenceIds
  ).map(String);

  return {
    decision,
    hard_gate_triggered:
      decision === "PRIME_REFUSAL"
        ? trace.hard_gate_triggered ??
          trace.gateId ??
          governance.gate_id ??
          "UDS_HARD_GATE_VIOLATION"
        : null,
    why_statement: String(
      trace.why_statement ??
      trace.summaryExplanation ??
      trace.reasoning_summary ??
      trace.rationale_summary ??
      (decision === "PRIME_REFUSAL"
        ? "AEGIS halted execution because the request violated an active UDS hard gate."
        : "Task processed within the declared UDS parameters.")
    ),
    safe_alternative:
      decision === "PRIME_REFUSAL"
        ? String(
            trace.safe_alternative ??
            trace.safeAlternative ??
            trace.redirect ??
            "Reframe the request as a consent-preserving, non-coercive action."
          )
        : null,
    active_layers: normalizeLayers(trace.active_layers, layerTrace),
    archetypal_mode: String(
      trace.archetypal_mode ??
      trace.mode ??
      (decision === "PRIME_REFUSAL" ? "GUARDIAN" : "WEAVER")
    ).toUpperCase(),
    first_law_principles: asArray(
      trace.first_law_principles ??
      trace.principles ??
      governance.principles ??
      (decision === "PRIME_REFUSAL"
        ? ["NON_COERCION", "SOVEREIGNTY_PRESERVATION"]
        : ["COHERENCE", "TRUTHFULNESS"])
    ).map(String),
    uncertainties: asArray(trace.uncertainties).map(String),
    layer_trace: layerTrace,
    task_result: trace.task_result ?? trace.answer ?? trace.result_text ?? null,
    telemetry: {
      perspective_dispersion: clampUnit(
        telemetrySource.perspective_dispersion ??
        trace.dispersionScore ??
        trace.perspective_dispersion
      ),
      stream_count: positiveInteger(
        telemetrySource.stream_count ?? trace.streamCount,
        1
      ),
      minority_position_preserved: Boolean(
        telemetrySource.minority_position_preserved ??
        trace.minorityPreserved
      ),
      minority_evidence_ids: minorityEvidenceIds,
      adversarial_resilience: clampUnit(
        telemetrySource.adversarial_resilience ?? trace.adversarialResilience
      ),
      evidence_trace_complete: Boolean(
        telemetrySource.evidence_trace_complete ?? trace.evidenceTraceComplete
      ),
      aegis_interventions: asArray(
        telemetrySource.aegis_interventions ??
        trace.aegisInterventions ??
        governance.interventions
      ).map(String),
      latency_ms: Math.max(0, Math.round(Number(metadata.latencyMs ?? 0))),
      strategy_variant: String(metadata.variant ?? trace.strategy_variant ?? "unspecified"),
      measurement_source: String(
        telemetrySource.measurement_source ?? metadata.measurementSource ?? "CODETTE_REPORTED"
      )
    },
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

async function fetchHttp(payload, config) {
  const url = required(config.url ?? process.env.CODETTE_URL, "CODETTE_URL");
  const timeoutMs = positiveInteger(
    config.timeoutMs ?? process.env.CODETTE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
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
    const responseText = await response.text();
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
    config.timeoutMs ?? process.env.CODETTE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );

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
