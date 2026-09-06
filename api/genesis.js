import { randomUUID } from "node:crypto";

const DEFAULT_GENESIS_BASE_URL = "https://genesis-seven-bice.vercel.app";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CORRECTION_LENGTH = 1000;
const REQUEST_TIMEOUT_MS = 12000;
const ALLOWED_PERSONAS = new Set(["sarah", "steven"]);
const ALLOWED_OPERATIONS = new Set(["chat", "selector.propose", "selector.confirm"]);
const ALLOWED_CHALLENGE_STATUSES = new Set(["CONFIRMED", "REJECTED", "CORRECTED"]);

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(payload));
}

function parseRequestBody(request) {
  if (request.body && typeof request.body === "object" && !Array.isArray(request.body)) {
    return request.body;
  }

  if (typeof request.body === "string" && request.body.trim()) {
    try {
      const parsed = JSON.parse(request.body);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

async function fetchGenesis(path, options = {}) {
  const baseUrl = (process.env.GENESIS_BASE_URL || DEFAULT_GENESIS_BASE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseUpstreamResponse(upstream) {
  const text = await upstream.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Genesis returned a non-JSON response.");
  }
}

function createGenesisEnvelope(message, persona) {
  return {
    request_id: randomUUID(),
    session_id: randomUUID(),
    message,
    persona,
    consent_level: "private",
    collective_learning: false,
    pipeline_mode: "shadow",
  };
}

function gatewayPayload(payload, upstreamStatus, operation) {
  return {
    ...payload,
    gateway: {
      node: "synthsara-node-zero",
      route: "same-origin-private-proxy",
      operation,
      upstream_status: upstreamStatus,
    },
  };
}

export default async function handler(request, response) {
  const method = String(request.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, POST" });
    return;
  }

  try {
    if (method === "GET") {
      const upstream = await fetchGenesis("/api/o-series/status");
      const payload = await parseUpstreamResponse(upstream);
      sendJson(response, upstream.status, gatewayPayload(payload, upstream.status, "status"));
      return;
    }

    const body = parseRequestBody(request);
    if (!body) {
      sendJson(response, 400, { error: "A JSON object is required." });
      return;
    }

    const operation = body.operation === undefined ? "chat" : body.operation;
    if (typeof operation !== "string" || !ALLOWED_OPERATIONS.has(operation)) {
      sendJson(response, 400, { error: "operation is not supported by the private gateway." });
      return;
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      sendJson(response, 400, {
        error: `message must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
      });
      return;
    }

    const persona = body.persona === undefined ? "sarah" : body.persona;
    if (typeof persona !== "string" || !ALLOWED_PERSONAS.has(persona)) {
      sendJson(response, 400, { error: "persona must be either 'sarah' or 'steven'." });
      return;
    }

    const genesisEnvelope = createGenesisEnvelope(message, persona);
    let upstreamPath = "/api/o-series/chat";
    let upstreamBody = genesisEnvelope;

    if (operation === "selector.propose") {
      upstreamPath = "/api/o-series/selector/propose";
    }

    if (operation === "selector.confirm") {
      const challengeStatus = typeof body.challenge_status === "string"
        ? body.challenge_status.trim().toUpperCase()
        : "";
      if (!ALLOWED_CHALLENGE_STATUSES.has(challengeStatus)) {
        sendJson(response, 400, {
          error: "challenge_status must be CONFIRMED, REJECTED, or CORRECTED.",
        });
        return;
      }

      const selectedNodeId = body.selected_node_id === undefined ? null : body.selected_node_id;
      if (selectedNodeId !== null && (
        typeof selectedNodeId !== "string" || !/^SC-[0-9]{3}$/.test(selectedNodeId)
      )) {
        sendJson(response, 400, {
          error: "selected_node_id must be null or a canonical SC-000 style identifier.",
        });
        return;
      }

      let correctionText = null;
      if (body.correction_text !== undefined && body.correction_text !== null) {
        if (typeof body.correction_text !== "string") {
          sendJson(response, 400, { error: "correction_text must be a string or null." });
          return;
        }
        correctionText = body.correction_text.trim();
        if (!correctionText || correctionText.length > MAX_CORRECTION_LENGTH) {
          sendJson(response, 400, {
            error: `correction_text must contain between 1 and ${MAX_CORRECTION_LENGTH} characters when supplied.`,
          });
          return;
        }
      }

      if (challengeStatus === "CONFIRMED" && selectedNodeId === null) {
        sendJson(response, 400, { error: "CONFIRMED requires selected_node_id." });
        return;
      }
      if (challengeStatus === "REJECTED" && (selectedNodeId !== null || correctionText !== null)) {
        sendJson(response, 400, {
          error: "REJECTED requires no selected node and no correction text.",
        });
        return;
      }
      if (challengeStatus === "CORRECTED" && selectedNodeId === null && correctionText === null) {
        sendJson(response, 400, {
          error: "CORRECTED requires an alternate node, correction text, or both.",
        });
        return;
      }

      upstreamPath = "/api/o-series/selector/confirm";
      upstreamBody = {
        request: genesisEnvelope,
        selected_node_id: selectedNodeId,
        challenge_status: challengeStatus,
        correction_text: correctionText,
      };
    }

    const upstream = await fetchGenesis(upstreamPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upstreamBody),
    });
    const payload = await parseUpstreamResponse(upstream);

    sendJson(
      response,
      upstream.status,
      gatewayPayload(payload, upstream.status, operation),
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut
        ? "Genesis did not respond before the private gateway timeout."
        : "Genesis is temporarily unavailable through the private gateway.",
    });
  }
}
