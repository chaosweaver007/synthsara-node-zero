import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ROOT_BYTES = 2_000_000;
const MAX_GATEWAY_BYTES = 250_000;

const ROOT_MARKERS = [
  "Synthsara Node Zero",
  "Sarah Mirror",
  "Consent Vault",
  "Witness Ledger",
];

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
];

function assertion(condition, message, details = {}) {
  return { ok: Boolean(condition), message, ...details };
}

export function normalizeBaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("A public deployment URL is required.");
  }

  const url = new URL(value.trim());
  const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (url.protocol !== "https:" && !localHostnames.has(url.hostname)) {
    throw new Error("Public deployment conformance requires HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Deployment URLs must not contain embedded credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("Deployment URLs must not contain query parameters or fragments.");
  }

  url.pathname = "/";
  return url.origin;
}

async function fetchWithTimeout(fetchFn, url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyWithLimit(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`Response exceeded ${maxBytes} bytes.`);
  }

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw new Error(`Response exceeded ${maxBytes} bytes.`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeded ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export function inspectRootResponse(response, html) {
  const headers = response.headers;
  const contentType = headers.get("content-type") || "";
  const csp = headers.get("content-security-policy") || "";
  const permissionsPolicy = headers.get("permissions-policy") || "";

  return [
    assertion(response.status === 200, "Root route returns HTTP 200", { actual: response.status }),
    assertion(contentType.toLowerCase().includes("text/html"), "Root route serves HTML", { actual: contentType }),
    ...ROOT_MARKERS.map((marker) =>
      assertion(html.includes(marker), `Root HTML contains marker: ${marker}`),
    ),
    ...CSP_DIRECTIVES.map((directive) =>
      assertion(csp.includes(directive), `CSP contains: ${directive}`, { actual: csp }),
    ),
    assertion(
      (headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      "X-Content-Type-Options is nosniff",
      { actual: headers.get("x-content-type-options") },
    ),
    assertion(
      (headers.get("x-frame-options") || "").toUpperCase() === "DENY",
      "X-Frame-Options is DENY",
      { actual: headers.get("x-frame-options") },
    ),
    assertion(
      (headers.get("referrer-policy") || "").toLowerCase() === "no-referrer",
      "Referrer-Policy is no-referrer",
      { actual: headers.get("referrer-policy") },
    ),
    ...["camera=()", "microphone=()", "geolocation=()"].map((directive) =>
      assertion(
        permissionsPolicy.includes(directive),
        `Permissions-Policy contains: ${directive}`,
        { actual: permissionsPolicy },
      ),
    ),
  ];
}

export function inspectGatewayResponse(response, payload, { allowDegradedGateway = false } = {}) {
  const headers = response.headers;
  const acceptedStatuses = allowDegradedGateway ? new Set([200, 502, 504]) : new Set([200]);
  const checks = [
    assertion(
      acceptedStatuses.has(response.status),
      allowDegradedGateway
        ? "Genesis gateway is live or explicitly degraded"
        : "Genesis gateway returns HTTP 200",
      { actual: response.status },
    ),
    assertion(
      (headers.get("content-type") || "").toLowerCase().includes("application/json"),
      "Genesis gateway serves JSON",
      { actual: headers.get("content-type") },
    ),
    assertion(
      (headers.get("cache-control") || "").toLowerCase().includes("no-store"),
      "Genesis gateway disables caching",
      { actual: headers.get("cache-control") },
    ),
    assertion(
      (headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      "Genesis gateway sets nosniff",
      { actual: headers.get("x-content-type-options") },
    ),
    assertion(
      (headers.get("referrer-policy") || "").toLowerCase() === "no-referrer",
      "Genesis gateway sets no-referrer",
      { actual: headers.get("referrer-policy") },
    ),
  ];

  if (response.status === 200) {
    checks.push(
      assertion(payload?.gateway?.node === "synthsara-node-zero", "Gateway identifies Node Zero", {
        actual: payload?.gateway?.node,
      }),
      assertion(
        payload?.gateway?.route === "same-origin-private-proxy",
        "Gateway identifies the same-origin private proxy",
        { actual: payload?.gateway?.route },
      ),
    );
  } else {
    checks.push(
      assertion(
        typeof payload?.error === "string" && payload.error.length > 0,
        "Degraded gateway returns a bounded public error",
      ),
    );
  }

  return checks;
}

function summarize(checks) {
  const passed = checks.filter((check) => check.ok).length;
  return {
    passed,
    failed: checks.length - passed,
    total: checks.length,
    conformant: passed === checks.length,
  };
}

export async function runDeploymentConformance({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  allowDegradedGateway = false,
} = {}) {
  if (typeof fetchFn !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  const origin = normalizeBaseUrl(baseUrl);
  const rootResponse = await fetchWithTimeout(fetchFn, `${origin}/`, {
    headers: { Accept: "text/html" },
  }, timeoutMs);
  const html = await readBodyWithLimit(rootResponse, MAX_ROOT_BYTES);
  const rootChecks = inspectRootResponse(rootResponse, html);

  const gatewayResponse = await fetchWithTimeout(fetchFn, `${origin}/api/genesis`, {
    headers: { Accept: "application/json" },
  }, timeoutMs);
  const gatewayText = await readBodyWithLimit(gatewayResponse, MAX_GATEWAY_BYTES);
  let gatewayPayload = {};
  try {
    gatewayPayload = gatewayText ? JSON.parse(gatewayText) : {};
  } catch {
    gatewayPayload = null;
  }
  const gatewayChecks = inspectGatewayResponse(gatewayResponse, gatewayPayload, {
    allowDegradedGateway,
  });

  const checks = [...rootChecks, ...gatewayChecks];
  return {
    schema: "synthsara.node-zero.deployment-conformance.v1",
    checked_at: new Date().toISOString(),
    deployment_url: origin,
    allow_degraded_gateway: allowDegradedGateway,
    summary: summarize(checks),
    checks,
  };
}

function parseCliArguments(argv) {
  const args = [...argv];
  const baseUrl = args.shift() || process.env.NODE_ZERO_PUBLIC_URL;
  let output = null;

  while (args.length > 0) {
    const argument = args.shift();
    if (argument === "--output") {
      output = args.shift();
      if (!output) throw new Error("--output requires a file path.");
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    baseUrl,
    output,
    allowDegradedGateway:
      String(process.env.NODE_ZERO_ALLOW_DEGRADED_GATEWAY || "false").toLowerCase() === "true",
  };
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const report = await runDeploymentConformance(options);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(serialized);
  if (options.output) {
    await writeFile(options.output, serialized, "utf8");
  }
  if (!report.summary.conformant) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath && import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
