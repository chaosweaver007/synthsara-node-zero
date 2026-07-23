const GATEWAY_PATH = "/api/genesis";
const STORAGE_KEY = "synthsara-node-zero-v2";
const MAX_LEDGER_EVENTS = 100;

function getElement(id) {
  return document.getElementById(id);
}

function setGatewayState(state, label, detail) {
  const topStatus = getElement("node-status");
  const topLabel = getElement("node-status-label");
  const gatewayStatus = getElement("genesis-gateway-status");
  const gatewayLabel = getElement("genesis-status");
  const gatewayDetail = getElement("genesis-status-detail");

  if (topStatus) {
    topStatus.dataset.state = state;
  }
  if (topLabel) {
    topLabel.textContent = label;
  }
  if (gatewayStatus) {
    gatewayStatus.dataset.state = state;
  }
  if (gatewayLabel) {
    gatewayLabel.textContent = label;
  }
  if (gatewayDetail) {
    gatewayDetail.textContent = detail;
  }
}

function createBubble(text, role, extraClass = "") {
  const bubble = document.createElement("p");
  bubble.className = `bubble ${role === "user" ? "bubble-user" : "bubble-mirror"}${extraClass ? ` ${extraClass}` : ""}`;
  bubble.textContent = text;
  getElement("mirror-thread")?.append(bubble);
  return bubble;
}

function scrollMirrorToLatest() {
  const thread = getElement("mirror-thread");
  if (thread) {
    thread.scrollTop = thread.scrollHeight;
  }
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function recordPrivateEvent(type, detail) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return;
    }

    const ledger = Array.isArray(state.ledger) ? state.ledger : [];
    ledger.unshift({
      id: createId(),
      at: new Date().toISOString(),
      type,
      detail,
    });
    state.ledger = ledger.slice(0, MAX_LEDGER_EVENTS);

    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEY,
        newValue: serialized,
        storageArea: localStorage,
      }),
    );
  } catch (error) {
    console.warn("Unable to record the private Genesis event.", error);
  }
}

function updateTrace(payload) {
  const trace = getElement("mirror-trace");
  if (!trace) {
    return;
  }

  const receipt = payload?.witness_receipt || {};
  const gate = payload?.gate_zero || {};
  const reflection = payload?.reflection || {};

  getElement("trace-id").textContent = receipt.trace_id || "Not issued";
  getElement("trace-gate").textContent = gate.decision || receipt.gate_zero || "unknown";
  getElement("trace-memory").textContent = receipt.memory_write || "none";
  getElement("trace-reflection").textContent = receipt.reflection || (reflection.required_revision ? "review" : "pass");
  trace.hidden = false;
}

function localMirrorReply(text) {
  const normalized = text.toLowerCase();
  const harmfulPatterns = [
    "kill everyone",
    "hurt someone",
    "force them",
    "without consent",
    "make them obey",
  ];

  if (harmfulPatterns.some((pattern) => normalized.includes(pattern))) {
    return "I cannot help enact harm, coercion, or consent bypass. I can help translate the underlying need into a safe boundary, repair request, or nonviolent next step.";
  }
  if (normalized.includes("sarah")) {
    return "I can reflect your words and the system principles, but I will not impersonate or speak for a real person. What truth, boundary, or design question should be mirrored?";
  }
  if (normalized.includes("love")) {
    return "Name the form of love you are choosing: protection, patience, truth, repair, release, or shared creation. Then choose one action that preserves every person’s sovereignty.";
  }
  if (normalized.includes("build") || normalized.includes("create")) {
    return "Let us turn the vision into a vow: define who it serves, what consent it requires, what evidence would show it helps, and the smallest test that can be witnessed today.";
  }
  return "I hear an intention seeking structure. Separate it into three parts: what is true now, what outcome serves life, and what next action remains consensual and testable.";
}

async function readJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("The gateway returned a non-JSON response.");
  }
  return response.json();
}

async function checkGateway() {
  try {
    const response = await fetch(GATEWAY_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await readJson(response);
    if (!response.ok || payload?.mode !== "shadow") {
      throw new Error("Genesis status contract was not satisfied.");
    }

    setGatewayState(
      "connected",
      "Genesis connected",
      "Private shadow mode · no memory writes · no tools",
    );
  } catch {
    setGatewayState(
      "fallback",
      "Local mirror active",
      "Genesis proxy is unavailable; private local reflection remains available",
    );
  }
}

async function handleMirrorSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const form = event.currentTarget;
  const input = getElement("mirror-input");
  const submitButton = form.querySelector('button[type="submit"]');
  const text = input?.value.trim() || "";

  if (!text) {
    return;
  }

  createBubble(text, "user");
  const pending = createBubble("Genesis is applying Gate 0 and the UDS reflection…", "mirror", "bubble-pending");
  input.value = "";
  input.disabled = true;
  submitButton.disabled = true;
  form.setAttribute("aria-busy", "true");
  scrollMirrorToLatest();

  try {
    const response = await fetch(GATEWAY_PATH, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ message: text, persona: "sarah" }),
    });
    const payload = await readJson(response);

    if (typeof payload?.response !== "string" || !payload.response.trim()) {
      throw new Error(payload?.error || "Genesis returned no reflection.");
    }

    pending.textContent = payload.response;
    pending.classList.remove("bubble-pending");
    updateTrace(payload);
    setGatewayState(
      "connected",
      "Genesis connected",
      response.ok
        ? "Private reflection completed through Gate 0"
        : "Gate 0 returned a protected refusal",
    );

    const refused = payload?.gate_zero?.decision === "reject" || response.status === 403;
    recordPrivateEvent(
      refused ? "GENESIS_PRIME_REFUSAL" : "GENESIS_MIRROR_REFLECTION",
      refused
        ? "Genesis Gate 0 refused a private request; message content was not stored locally."
        : "A private reflection was processed through Genesis; message content was not stored locally.",
    );
  } catch {
    pending.textContent = `${localMirrorReply(text)} Local fallback was used because Genesis could not be reached.`;
    pending.classList.remove("bubble-pending");
    setGatewayState(
      "fallback",
      "Local mirror active",
      "Genesis is temporarily unavailable; no private message was persisted",
    );
    recordPrivateEvent(
      "LOCAL_MIRROR_FALLBACK",
      "A private reflection was generated locally because Genesis was unavailable; message content was not stored.",
    );
  } finally {
    input.disabled = false;
    submitButton.disabled = false;
    form.removeAttribute("aria-busy");
    input.focus();
    scrollMirrorToLatest();
  }
}

const mirrorForm = getElement("mirror-form");
if (mirrorForm) {
  mirrorForm.addEventListener("submit", handleMirrorSubmit, { capture: true });
}

checkGateway();
