import { randomUUID } from "node:crypto";

const DEFAULT_GENESIS_BASE_URL = "https://genesis-seven-bice.vercel.app";
const MAX_MESSAGE_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 15000;
const ALLOWED_PERSONAS = new Set(["sarah", "steven"]);

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

export default async function handler(request, response) {
  const method = String(request.method || "GET").toUpperCase();

  if (method !== "GET" && method !== "POST") {
    sendJson(
      response,
      405,
      { error: "Method not allowed." },
      { Allow: "GET, POST" },
    );
    return;
  }

  try {
    if (method === "GET") {
      const upstream = await fetchGenesis("/api/o-series/status");
      const payload = await parseUpstreamResponse(upstream);
      sendJson(response, upstream.status, {
        ...payload,
        gateway: {
          node: "synthsara-node-zero",
          route: "same-origin-private-proxy",
          upstream_status: upstream.status,
        },
      });
      return;
    }

    const body = parseRequestBody(request);
    if (!body) {
      sendJson(response, 400, { error: "A JSON object is required." });
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

    const genesisEnvelope = {
      request_id: randomUUID(),
      session_id: randomUUID(),
      message,
      persona,
      consent_level: "private",
      collective_learning: false,
      pipeline_mode: "shadow",
    };

    const upstream = await fetchGenesis("/api/o-series/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(genesisEnvelope),
    });
    const payload = await parseUpstreamResponse(upstream);

    sendJson(response, upstream.status, {
      ...payload,
      gateway: {
        node: "synthsara-node-zero",
        route: "same-origin-private-proxy",
        upstream_status: upstream.status,
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    sendJson(response, timedOut ? 504 : 502, {
      error: timedOut
        ? "Genesis did not respond before the private gateway timeout."
        : "Genesis is temporarily unavailable through the private gateway.",
    });
  }
}
