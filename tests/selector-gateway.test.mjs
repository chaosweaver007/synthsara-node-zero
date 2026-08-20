import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import handler from "../api/genesis.js";

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

async function invoke(body) {
  const response = createResponse();
  await handler({ method: "POST", body }, response);
  return {
    status: response.statusCode,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

test("selector.propose forwards a fresh private envelope to the proposal endpoint", async () => {
  process.env.GENESIS_BASE_URL = "https://genesis.example";
  let captured;

  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        gate_zero: { decision: "allow" },
        selector: {
          candidates: [],
          selection_contract: { default_action: "OPT_IN_EXPLICIT" },
        },
        witness_receipt: { memory_write: "none", challenge_status: "PROPOSED" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await invoke({
    operation: "selector.propose",
    message: "Help me interpret this without assuming authority.",
    persona: "sarah",
  });

  assert.equal(result.status, 200);
  assert.equal(captured.url, "https://genesis.example/api/o-series/selector/propose");
  assert.equal(captured.body.message, "Help me interpret this without assuming authority.");
  assert.equal(captured.body.consent_level, "private");
  assert.equal(captured.body.collective_learning, false);
  assert.equal(captured.body.pipeline_mode, "shadow");
  assert.equal(result.json.gateway.operation, "selector.propose");
});

test("selector.confirm rebuilds the private envelope and forwards explicit confirmation", async () => {
  process.env.GENESIS_BASE_URL = "https://genesis.example";
  let captured;

  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        response: "Selected response.",
        codex_selection: { selected_node: "SC-006", challenge_status: "CONFIRMED" },
        witness_receipt: { memory_write: "none", selected_node: "SC-006" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await invoke({
    operation: "selector.confirm",
    message: "somatic integration and coherence after crisis",
    persona: "sarah",
    challenge_status: "CONFIRMED",
    selected_node_id: "SC-006",
  });

  assert.equal(result.status, 200);
  assert.equal(captured.url, "https://genesis.example/api/o-series/selector/confirm");
  assert.equal(captured.body.challenge_status, "CONFIRMED");
  assert.equal(captured.body.selected_node_id, "SC-006");
  assert.equal(captured.body.correction_text, null);
  assert.equal(captured.body.request.message, "somatic integration and coherence after crisis");
  assert.equal(captured.body.request.consent_level, "private");
  assert.match(captured.body.request.request_id, /^[0-9a-f-]{36}$/i);
  assert.match(captured.body.request.session_id, /^[0-9a-f-]{36}$/i);
});

test("free-text CORRECTED remains transit-only and is forwarded without local persistence fields", async () => {
  process.env.GENESIS_BASE_URL = "https://genesis.example";
  let captured;
  const correction = "My meaning is epistemic repair after mistrust, not somatic recovery.";

  globalThis.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        response: "Correction-aware response.",
        codex_selection: {
          selected_node: null,
          challenge_status: "CORRECTED",
          human_correction_supplied: true,
        },
        witness_receipt: {
          memory_write: "none",
          challenge_status: "CORRECTED",
          human_correction_supplied: true,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await invoke({
    operation: "selector.confirm",
    message: "somatic integration and coherence after crisis",
    persona: "sarah",
    challenge_status: "CORRECTED",
    selected_node_id: null,
    correction_text: correction,
  });

  assert.equal(result.status, 200);
  assert.equal(captured.body.correction_text, correction);
  assert.equal(captured.body.request.consent_level, "private");
  assert.equal(result.json.witness_receipt.memory_write, "none");
  assert.equal(result.json.witness_receipt.human_correction_supplied, true);
});

test("selector.confirm rejects an empty correction before calling Genesis", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };

  const result = await invoke({
    operation: "selector.confirm",
    message: "A private message.",
    challenge_status: "CORRECTED",
    selected_node_id: null,
    correction_text: "   ",
  });

  assert.equal(result.status, 400);
  assert.equal(fetchCalls, 0);
});

test("REJECTED cannot smuggle a selected node or correction", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };

  const result = await invoke({
    operation: "selector.confirm",
    message: "A private message.",
    challenge_status: "REJECTED",
    selected_node_id: "SC-006",
  });

  assert.equal(result.status, 400);
  assert.equal(fetchCalls, 0);
});
