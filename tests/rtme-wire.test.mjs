import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import handler from "../api/genesis.js";

const corpus = JSON.parse(
  readFileSync(new URL("../conformance/rtme-wire-001.vectors.json", import.meta.url), "utf8"),
);

const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.GENESIS_BASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBaseUrl === undefined) {
    delete process.env.GENESIS_BASE_URL;
  } else {
    process.env.GENESIS_BASE_URL = originalBaseUrl;
  }
});

function createResponse() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: "",
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    end(body = "") {
      this.body = String(body);
    },
  };
}

async function invoke(request) {
  const response = createResponse();
  await handler(request, response);
  return {
    status: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

function wireNotImplemented(vector) {
  assert.fail(
    `${vector.id} ${vector.expected}: NOT_IMPLEMENTED — no production RTME-WIRE-001 frame parser/verifier is present on this branch`,
  );
}

function vectorById(id) {
  const vector = corpus.vectors.find((candidate) => candidate.id === id);
  assert.ok(vector, `missing corpus vector ${id}`);
  return vector;
}

for (const vector of corpus.vectors) {
  test(`${vector.id} ${vector.name} -> ${vector.expected}`, async () => {
    switch (vector.id) {
      case "WIRE-001":
      case "WIRE-002":
      case "WIRE-003":
      case "WIRE-004":
      case "WIRE-005":
      case "WIRE-006":
      case "WIRE-007":
      case "WIRE-008":
      case "WIRE-009":
        wireNotImplemented(vector);
        break;

      case "WIRE-010": { // ambient credentials must not be forwarded
        process.env.GENESIS_BASE_URL = "https://genesis.example";
        let captured;
        globalThis.fetch = async (url, options = {}) => {
          captured = { url: String(url), options };
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };

        const result = await invoke({
          method: "POST",
          headers: {
            cookie: "session=ambient-secret",
            authorization: "Bearer ambient-secret",
            "x-device-id": "ambient-device",
          },
          body: { message: "bounded message", persona: "sarah" },
        });

        assert.equal(result.status, 200);
        const forwarded = Object.fromEntries(
          Object.entries(captured.options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
        );
        assert.equal(forwarded.cookie, undefined);
        assert.equal(forwarded.authorization, undefined);
        assert.equal(forwarded["x-device-id"], undefined);
        break;
      }

      case "WIRE-011":
      case "WIRE-012":
      case "WIRE-013": { // redirect policy must be manual/validated by production proxy
        process.env.GENESIS_BASE_URL = "https://genesis.example";
        let capturedOptions;
        globalThis.fetch = async (_url, options = {}) => {
          capturedOptions = options;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
        await invoke({ method: "POST", body: { message: "bounded message", persona: "sarah" } });
        assert.equal(
          capturedOptions.redirect,
          "manual",
          `${vector.id} ${vector.expected}: production proxy does not explicitly disable automatic redirect following`,
        );
        break;
      }

      case "WIRE-014":
        assert.fail(
          `${vector.id} ${vector.expected}: NOT_IMPLEMENTED — no production DNS resolution/pinning or connect-time address revalidation boundary is present`,
        );
        break;

      case "WIRE-015": { // userinfo host confusion must not escape the approved origin
        process.env.GENESIS_BASE_URL = "https://allowed.example@evil.example";
        let requestedUrl;
        globalThis.fetch = async (url) => {
          requestedUrl = String(url);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
        await invoke({ method: "GET" });
        const parsed = new URL(requestedUrl);
        assert.equal(
          parsed.hostname,
          "allowed.example",
          `${vector.id} ${vector.expected}: configured base URL can select an unapproved hostname`,
        );
        assert.equal(parsed.username, "");
        break;
      }

      case "WIRE-016": { // undeclared ports must be rejected
        process.env.GENESIS_BASE_URL = "https://genesis.example:8443";
        let requestedUrl;
        globalThis.fetch = async (url) => {
          requestedUrl = String(url);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
        await invoke({ method: "GET" });
        const parsed = new URL(requestedUrl);
        assert.equal(
          parsed.port,
          "",
          `${vector.id} ${vector.expected}: production proxy accepts an undeclared configured port`,
        );
        break;
      }

      case "WIRE-017": { // failure must not trigger undeclared secondary telemetry
        process.env.GENESIS_BASE_URL = "https://genesis.example";
        let fetchCalls = 0;
        globalThis.fetch = async () => {
          fetchCalls += 1;
          throw new Error("fixture network failure");
        };
        const result = await invoke({
          method: "POST",
          body: { message: "bounded message", persona: "sarah" },
        });
        assert.equal(result.status, 502);
        assert.equal(
          fetchCalls,
          1,
          `${vector.id} ${vector.expected}: error path initiated undeclared secondary network traffic`,
        );
        break;
      }

      case "WIRE-018":
        assert.fail(
          `${vector.id} ${vector.expected}: NOT_IMPLEMENTED — no remote-effect receipt/recovery state machine is wired into transport`,
        );
        break;

      case "WIRE-019": { // trusted transport may not override revoked current consent
        process.env.GENESIS_BASE_URL = "https://genesis.example";
        let fetchCalls = 0;
        globalThis.fetch = async () => {
          fetchCalls += 1;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
        await invoke({
          method: "POST",
          node_authenticated: true,
          body: {
            message: "bounded message",
            persona: "sarah",
            action_token: "fixture-valid-token",
            consent_state: "REVOKED",
          },
        });
        assert.equal(
          fetchCalls,
          0,
          `${vector.id} ${vector.expected}: production transport path does not recheck current RTME consent`,
        );
        break;
      }

      case "WIRE-020": { // node identity alone must never grant execution authority
        process.env.GENESIS_BASE_URL = "https://genesis.example";
        let fetchCalls = 0;
        globalThis.fetch = async () => {
          fetchCalls += 1;
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
        await invoke({
          method: "POST",
          node_authenticated: true,
          body: { message: "bounded message", persona: "sarah" },
        });
        assert.equal(
          fetchCalls,
          0,
          `${vector.id} ${vector.expected}: authenticated transport reaches upstream without an ActionToken boundary`,
        );
        break;
      }

      default:
        assert.fail(`unhandled vector ${vector.id}`);
    }
  });
}

test("corpus contains exactly the 20 witnessed RTME-WIRE-001 vectors", () => {
  assert.equal(corpus.protocol, "RTME-WIRE-001");
  assert.equal(corpus.vectors.length, 20);
  for (let index = 1; index <= 20; index += 1) {
    assert.equal(vectorById(`WIRE-${String(index).padStart(3, "0")}`).id, `WIRE-${String(index).padStart(3, "0")}`);
  }
});
