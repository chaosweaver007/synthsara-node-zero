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

const CSP_SOURCE_BOUNDARY = new Map([
  ["default-src", ["'self'"]],
  ["script-src", ["'self'"]],
  ["style-src", ["'self'"]],
  ["img-src", ["'self'", "data:"]],
  ["font-src", ["'self'"]],
  ["connect-src", ["'self'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'none'"]],
  ["form-action", ["'self'"]],
  ["frame-ancestors", ["'none'"]],
]);

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

async function fetchTextWithTimeout(
  fetchFn,
  url,
  options = {},
  maxBytes,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
      redirect: options.redirect || "follow",
    });
    const text = await readBodyWithLimit(response, maxBytes);
    return { response, text };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseContentSecurityPolicy(value) {
  const directives = new Map();
  if (typeof value !== "string" || value.trim().length === 0 || value.includes(",")) {
    return directives;
  }

  for (const segment of value.split(";")) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [name, ...sources] = tokens;
    const normalizedName = name.toLowerCase();
    if (directives.has(normalizedName)) {
      return new Map();
    }
    directives.set(normalizedName, sources);
  }
  return directives;
}

function exactSourceSet(actual = [], expected = []) {
  if (actual.length !== expected.length) return false;
  const actualSet = new Set(actual);
  return actualSet.size === expected.length && expected.every((source) => actualSet.has(source));
}

export function inspectRootResponse(response, html) {
  const headers = response.headers;
  const contentType = headers.get("content-type") || "";
  const csp = headers.get("content-security-policy") || "";
  const parsedCsp = parseContentSecurityPolicy(csp);
  const permissionsPolicy = headers.get("permissions-policy") || "";

  return [
    assertion(response.status === 200, "Root route returns HTTP 200", { actual: response.status }),
    assertion(contentType.toLowerCase().includes("text/html"), "Root route serves HTML", { actual: contentType }),
    ...ROOT_MARKERS.map((marker) =>
      assertion(html.includes(marker), `Root HTML contains marker: ${marker}`),
    ),
    ...[...CSP_SOURCE_BOUNDARY.entries()].map(([directive, expectedSources]) => {
      const actualSources = parsedCsp.get(directive);
      return assertion(
        exactSourceSet(actualSources, expectedSources),
        `CSP directive is exact: ${directive} ${expectedSources.join(" ")}`,
        { actual: actualSources || null, policy: csp },
      );
    }),
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

function responseOrigin(response) {
  if (!response?.url) return null;
  try {
    return new URL(response.url).origin;
  } catch {
    return null;
  }
}

export function inspectGatewayResponse(
  response,
  payload,
  { allowDegradedGateway = false, expectedOrigin = null } = {},
) {
  const headers = response.headers;
  const acceptedStatuses = allowDegradedGateway ? new Set([200, 502, 504]) : new Set([200]);
  const finalOrigin = responseOrigin(response);
  const checks = [
    assertion(response.redirected !== true, "Genesis gateway does not follow redirects", {
      actual: response.redirected,
      final_url: response.url || null,
    }),
    assertion(
      !expectedOrigin || !finalOrigin || finalOrigin === expectedOrigin,
      "Genesis gateway response remains on the Node Zero origin",
      { expected: expectedOrigin, actual: finalOrigin },
    ),
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
  const { response: rootResponse, text: html } = await fetchTextWithTimeout(
    fetchFn,
    `${origin}/`,
    { headers: { Accept: "text/html" } },
    MAX_ROOT_BYTES,
    timeoutMs,
  );
  const rootChecks = inspectRootResponse(rootResponse, html);

  const { response: gatewayResponse, text: gatewayText } = await fetchTextWithTimeout(
    fetchFn,
    `${origin}/api/genesis`,
    {
      headers: { Accept: "application/json" },
      redirect: "manual",
    },
    MAX_GATEWAY_BYTES,
    timeoutMs,
  );
  let gatewayPayload = {};
  try {
    gatewayPayload = gatewayText ? JSON.parse(gatewayText) : {};
  } catch {
    gatewayPayload = null;
  }
  const gatewayChecks = inspectGatewayResponse(gatewayResponse, gatewayPayload, {
    allowDegradedGateway,
    expectedOrigin: origin,
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
