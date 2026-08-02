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

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
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
});
