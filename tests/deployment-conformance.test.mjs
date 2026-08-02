import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeBaseUrl,
  runDeploymentConformance,
} from "../scripts/deployment-conformance.mjs";

const securityHeaders = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function response(body, { status = 200, headers = {}, url = null, redirected = false } = {}) {
  const result = new Response(body, { status, headers });
  if (url) {
    Object.defineProperty(result, "url", { value: url });
  }
  Object.defineProperty(result, "redirected", { value: redirected });
  return result;
}

function createFetch({ rootHeaders = {}, gatewayStatus = 200 } = {}) {
  return async (url) => {
    if (url.endsWith("/api/genesis")) {
      const payload = gatewayStatus === 200
        ? {
            status: "ready",
            gateway: {
              node: "synthsara-node-zero",
              route: "same-origin-private-proxy",
              upstream_status: 200,
            },
          }
        : { error: "Genesis is temporarily unavailable through the private gateway." };
      return response(JSON.stringify(payload), {
        status: gatewayStatus,
        url,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        },
      });
    }

    return response(
      "<title>Synthsara Node Zero</title><h2>Sarah Mirror</h2><h2>Consent Vault</h2><h2>Witness Ledger</h2>",
      {
        url,
        headers: {
          "content-type": "text/html; charset=utf-8",
          ...securityHeaders,
          ...rootHeaders,
        },
      },
    );
  };
}

test("normalizes a deployment origin and removes a trailing path", () => {
  assert.equal(normalizeBaseUrl("https://node-zero.example/path/"), "https://node-zero.example");
});

test("rejects non-HTTPS public deployments", () => {
  assert.throws(() => normalizeBaseUrl("http://node-zero.example"), /requires HTTPS/);
});

test("passes a conformant deployment and live Genesis gateway", async () => {
  const report = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn: createFetch(),
  });

  assert.equal(report.summary.conformant, true);
  assert.equal(report.summary.failed, 0);
  assert.deepEqual(report.certification, { eligible: true, status: "CERTIFIED" });
});

test("fails closed when a required CSP directive is missing", async () => {
  const report = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn: createFetch({
      rootHeaders: {
        "content-security-policy": "default-src 'self'; connect-src 'self'; object-src 'none'",
      },
    }),
  });

  assert.equal(report.summary.conformant, false);
  assert.ok(report.checks.some((check) => !check.ok && check.message.includes("frame-ancestors")));
});

test("rejects CSP directives widened with third-party origins", async () => {
  const widened = securityHeaders["content-security-policy"].replace(
    "connect-src 'self'",
    "connect-src 'self' https://tracker.example",
  );
  const report = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn: createFetch({
      rootHeaders: { "content-security-policy": widened },
    }),
  });

  assert.equal(report.summary.conformant, false);
  assert.ok(report.checks.some((check) =>
    !check.ok && check.message.includes("connect-src 'self'"),
  ));
});

test("rejects gateway redirects and requests manual redirect handling", async () => {
  let gatewayRedirectMode = null;
  const fetchFn = async (url, options = {}) => {
    if (url.endsWith("/api/genesis")) {
      gatewayRedirectMode = options.redirect;
      return response("", {
        status: 302,
        url,
        headers: {
          location: "https://gateway.example/status",
          "content-type": "application/json",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
        },
      });
    }
    return createFetch()(url, options);
  };

  const report = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn,
  });

  assert.equal(gatewayRedirectMode, "manual");
  assert.equal(report.summary.conformant, false);
  assert.ok(report.checks.some((check) =>
    !check.ok && check.message === "Genesis gateway returns HTTP 200",
  ));
});

test("rejects a valid-looking gateway response from another origin", async () => {
  const fetchFn = async (url, options = {}) => {
    if (!url.endsWith("/api/genesis")) {
      return createFetch()(url, options);
    }
    return response(JSON.stringify({
      status: "ready",
      gateway: {
        node: "synthsara-node-zero",
        route: "same-origin-private-proxy",
        upstream_status: 200,
      },
    }), {
      url: "https://gateway.example/status",
      redirected: true,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      },
    });
  };

  const report = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn,
  });

  assert.equal(report.summary.conformant, false);
  assert.ok(report.checks.some((check) =>
    !check.ok && check.message.includes("remains on the Node Zero origin"),
  ));
  assert.ok(report.checks.some((check) =>
    !check.ok && check.message.includes("does not follow redirects"),
  ));
});

test("keeps the timeout active while consuming response bodies", async () => {
  const fetchFn = async (url, options = {}) => {
    if (url.endsWith("/api/genesis")) {
      return createFetch()(url, options);
    }

    const stream = new ReadableStream({
      start(controller) {
        const timer = setTimeout(() => {
          controller.enqueue(new TextEncoder().encode(
            "<title>Synthsara Node Zero</title><h2>Sarah Mirror</h2><h2>Consent Vault</h2><h2>Witness Ledger</h2>",
          ));
          controller.close();
        }, 100);
        options.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          controller.error(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      },
    });

    return response(stream, {
      url,
      headers: {
        "content-type": "text/html; charset=utf-8",
        ...securityHeaders,
      },
    });
  };

  await assert.rejects(
    runDeploymentConformance({
      baseUrl: "https://node-zero.example",
      fetchFn,
      timeoutMs: 10,
    }),
    (error) => error?.name === "AbortError",
  );
});

test("allows an explicitly degraded gateway only in diagnostic mode", async () => {
  const strictReport = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn: createFetch({ gatewayStatus: 502 }),
  });
  assert.equal(strictReport.summary.conformant, false);

  const diagnosticReport = await runDeploymentConformance({
    baseUrl: "https://node-zero.example",
    fetchFn: createFetch({ gatewayStatus: 502 }),
    allowDegradedGateway: true,
  });
  assert.equal(diagnosticReport.summary.conformant, true);
  assert.deepEqual(diagnosticReport.certification, {
    eligible: false,
    status: "DIAGNOSTIC_ONLY",
  });
});
