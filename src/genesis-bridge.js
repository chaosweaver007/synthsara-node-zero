const gatewayStyles = document.createElement("link");
gatewayStyles.rel = "stylesheet";
gatewayStyles.href = "./src/genesis-bridge.css";
document.head.append(gatewayStyles);

const GATEWAY_PATH = "/api/genesis";
const STORAGE_KEY = "synthsara-node-zero-v2";
const MAX_LEDGER_EVENTS = 100;
const DEFAULT_CORRECTION_LIMIT = 1000;

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

function createPrivateState() {
  return {
    version: 2,
    consent: {
      profile: false,
      emotional: false,
      creative: false,
      collective: false,
    },
    worth: 0,
    contributions: 0,
    votes: {},
    ledger: [
      {
        id: createId(),
        at: new Date().toISOString(),
        type: "NODE_INITIALIZED",
        detail: "Node Zero opened in private, local-first mode.",
      },
    ],
  };
}

function recordPrivateEvent(type, detail) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : createPrivateState();
    const state = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : createPrivateState();

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

function ensureTraceField(id, label) {
  const trace = getElement("mirror-trace");
  if (!trace) {
    return null;
  }

  let value = getElement(id);
  if (value) {
    return value;
  }

  const wrapper = document.createElement("span");
  const heading = document.createElement("b");
  heading.textContent = label;
  value = document.createElement("span");
  value.id = id;
  wrapper.append(heading, document.createTextNode(" "), value);
  trace.append(wrapper);
  return value;
}

function updateTrace(payload) {
  const trace = getElement("mirror-trace");
  if (!trace) {
    return;
  }

  const receipt = payload?.witness_receipt || {};
  const gate = payload?.gate_zero || {};
  const reflection = payload?.reflection || {};
  const selection = payload?.codex_selection || {};
  const selector = payload?.selector || {};

  getElement("trace-id").textContent = receipt.trace_id || "Not issued";
  getElement("trace-gate").textContent = gate.decision || receipt.gate_zero || "unknown";
  getElement("trace-memory").textContent = receipt.memory_write || "none";
  getElement("trace-reflection").textContent = receipt.reflection || (reflection.required_revision ? "review" : "pass");

  const codexValue = ensureTraceField("trace-codex", "Codex");
  const selectorValue = ensureTraceField("trace-selector", "Selector");
  const registryValue = ensureTraceField("trace-registry", "Registry");
  if (codexValue) {
    codexValue.textContent = selection.selected_node || receipt.selected_node || "none";
  }
  if (selectorValue) {
    selectorValue.textContent = selection.challenge_status || receipt.challenge_status || "not used";
  }
  if (registryValue) {
    registryValue.textContent = selector.registry_version || selection.registry_version || receipt.registry_version || "unknown";
  }

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

async function postGateway(body) {
  const response = await fetch(GATEWAY_PATH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  return { response, payload: await readJson(response) };
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
      payload?.sonic_codex?.selector_mode === "opt-in-explicit"
        ? "Private shadow mode · sovereign Selector online · no memory writes"
        : "Private shadow mode · no memory writes · no tools",
    );
  } catch {
    setGatewayState(
      "fallback",
      "Local mirror active",
      "Genesis proxy is unavailable; private local reflection remains available",
    );
  }
}

function makeText(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function formatConfidence(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}% match score` : "unscored match";
}

function presentSelector(selector) {
  return new Promise((resolve) => {
    const thread = getElement("mirror-thread");
    const panel = document.createElement("section");
    panel.className = "selector-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Sonic Codex Selector");

    panel.append(
      makeText("h3", "selector-title", "Choose the lens, reject it, or correct it"),
      makeText(
        "p",
        "selector-copy",
        "Genesis is proposing interpretive lenses only. Nothing is selected automatically, and the match score is not a truth score.",
      ),
    );

    const candidates = Array.isArray(selector?.candidates) ? selector.candidates : [];
    const candidateList = document.createElement("div");
    candidateList.className = "selector-candidates";

    for (const candidate of candidates) {
      const card = document.createElement("article");
      card.className = "selector-candidate";
      const heading = makeText("h4", "", `${candidate.node_id} · ${candidate.title}`);
      const meta = makeText(
        "p",
        "selector-meta",
        `${candidate.archetype || "Interpretive node"} · phase ${candidate.harmonic_phase || "?"} · ${formatConfidence(candidate.confidence)}`,
      );
      const themes = Array.isArray(candidate.matched_themes) ? candidate.matched_themes : [];
      const reasons = Array.isArray(candidate.reason_codes) ? candidate.reason_codes : [];
      const themeText = makeText(
        "p",
        "selector-detail",
        themes.length ? `Matched: ${themes.join(" · ")}` : "Matched through the pinned node vocabulary.",
      );
      const reasonText = makeText(
        "p",
        "selector-reasons",
        reasons.length ? reasons.join(" · ") : "No diagnostic reason code supplied.",
      );
      const useButton = makeText("button", "button button-secondary selector-use", "Use this lens");
      useButton.type = "button";
      useButton.addEventListener("click", () => {
        resolve({
          challenge_status: "CONFIRMED",
          selected_node_id: candidate.node_id,
          correction_text: null,
          panel,
        });
      }, { once: true });
      card.append(heading, meta, themeText, reasonText, useButton);
      candidateList.append(card);
    }

    if (candidates.length === 0) {
      candidateList.append(
        makeText(
          "p",
          "selector-empty",
          "No close Codex lens was proposed. You can continue without one or supply your own framing.",
        ),
      );
    }
    panel.append(candidateList);

    const actionRow = document.createElement("div");
    actionRow.className = "selector-actions";

    const rejectButton = makeText("button", "button button-secondary", "None of these fit");
    rejectButton.type = "button";
    rejectButton.addEventListener("click", () => {
      resolve({
        challenge_status: "REJECTED",
        selected_node_id: null,
        correction_text: null,
        panel,
      });
    }, { once: true });

    const correctButton = makeText("button", "button button-secondary", "Correct the interpretation");
    correctButton.type = "button";
    actionRow.append(rejectButton, correctButton);
    panel.append(actionRow);

    const correctionForm = document.createElement("form");
    correctionForm.className = "selector-correction";
    correctionForm.hidden = true;

    const correctionLabel = makeText("label", "selector-label", "Optional alternate Codex node");
    const nodeSelect = document.createElement("select");
    nodeSelect.className = "selector-select";
    nodeSelect.setAttribute("aria-label", "Alternate Sonic Codex node");
    const blankOption = document.createElement("option");
    blankOption.value = "";
    blankOption.textContent = "No node · use my words only";
    nodeSelect.append(blankOption);

    const availableNodes = Array.isArray(selector?.selection_contract?.available_nodes)
      ? selector.selection_contract.available_nodes
      : [];
    for (const node of availableNodes) {
      const option = document.createElement("option");
      option.value = node.node_id;
      option.textContent = `${node.node_id} · ${node.title}`;
      nodeSelect.append(option);
    }

    const textLabel = makeText("label", "selector-label", "My correction (optional if you choose another node)");
    const correctionInput = document.createElement("textarea");
    correctionInput.className = "selector-correction-input";
    correctionInput.maxLength = Number(selector?.selection_contract?.correction_max_length) || DEFAULT_CORRECTION_LIMIT;
    correctionInput.placeholder = "My meaning is…";

    const correctionError = makeText("p", "selector-error", "");
    correctionError.setAttribute("role", "alert");

    const correctionSubmit = makeText("button", "button button-primary", "Use my correction");
    correctionSubmit.type = "submit";
    correctionForm.append(
      correctionLabel,
      nodeSelect,
      textLabel,
      correctionInput,
      correctionError,
      correctionSubmit,
    );

    correctButton.addEventListener("click", () => {
      correctionForm.hidden = false;
      correctionInput.focus();
      scrollMirrorToLatest();
    });

    correctionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const selectedNode = nodeSelect.value || null;
      const correctionText = correctionInput.value.trim() || null;
      if (!selectedNode && !correctionText) {
        correctionError.textContent = "Choose another node, write your correction, or use ‘None of these fit’.";
        return;
      }
      resolve({
        challenge_status: "CORRECTED",
        selected_node_id: selectedNode,
        correction_text: correctionText,
        panel,
      });
    });

    panel.append(correctionForm);
    thread?.append(panel);
    scrollMirrorToLatest();
  });
}

async function runSelectorFlow(text, pending) {
  const proposal = await postGateway({
    operation: "selector.propose",
    message: text,
    persona: "sarah",
  });

  if (proposal.response.status === 403 || proposal.payload?.gate_zero?.decision === "reject") {
    pending.textContent = proposal.payload?.response || "This request could not pass Gate 0.";
    pending.classList.remove("bubble-pending");
    updateTrace(proposal.payload);
    recordPrivateEvent(
      "GENESIS_PRIME_REFUSAL",
      "Genesis Gate 0 refused a private request before Codex recognition; message content was not stored locally.",
    );
    return;
  }

  if (!proposal.response.ok || !proposal.payload?.selector) {
    throw new Error(proposal.payload?.error || "Genesis returned no Selector proposal.");
  }

  pending.textContent = "Genesis found possible interpretive lenses. You decide whether any of them belong in the response.";
  pending.classList.remove("bubble-pending");
  updateTrace(proposal.payload);
  recordPrivateEvent(
    "SONIC_SELECTOR_PROPOSED",
    "Interpretive candidates were offered without persona generation; private message content was not stored locally.",
  );

  const choice = await presentSelector(proposal.payload.selector);
  choice.panel.remove();
  pending.textContent = "Genesis is rechecking Gate 0 and your explicit Selector choice…";
  pending.classList.add("bubble-pending");
  scrollMirrorToLatest();

  const confirmation = await postGateway({
    operation: "selector.confirm",
    message: text,
    persona: "sarah",
    challenge_status: choice.challenge_status,
    selected_node_id: choice.selected_node_id,
    correction_text: choice.correction_text,
  });

  if (confirmation.response.status === 400) {
    pending.textContent = `${confirmation.payload?.error || "The Selector choice could not be confirmed."} Please submit the message again to receive a fresh proposal.`;
    pending.classList.remove("bubble-pending");
    updateTrace(confirmation.payload);
    recordPrivateEvent(
      "SONIC_SELECTOR_RESELECT_REQUIRED",
      "A Selector confirmation was invalid or stale; private correction content was not stored locally.",
    );
    return;
  }

  if (confirmation.response.status === 403 || confirmation.payload?.gate_zero?.decision === "reject") {
    pending.textContent = confirmation.payload?.response || "The request no longer passes Gate 0.";
    pending.classList.remove("bubble-pending");
    updateTrace(confirmation.payload);
    recordPrivateEvent(
      "GENESIS_PRIME_REFUSAL",
      "Genesis Gate 0 refused the recomputed request during Selector confirmation; private content was not stored locally.",
    );
    return;
  }

  if (typeof confirmation.payload?.response !== "string" || !confirmation.payload.response.trim()) {
    throw new Error(confirmation.payload?.error || "Genesis returned no reflection after selection.");
  }

  pending.textContent = confirmation.payload.response;
  pending.classList.remove("bubble-pending");
  updateTrace(confirmation.payload);
  setGatewayState(
    "connected",
    "Genesis connected",
    confirmation.response.ok
      ? "Private Selector reflection completed through Gate 0"
      : "UDS reflection returned a protected boundary",
  );

  const eventByStatus = {
    CONFIRMED: "SONIC_SELECTOR_CONFIRMED",
    REJECTED: "SONIC_SELECTOR_REJECTED",
    CORRECTED: "SONIC_SELECTOR_CORRECTED",
  };
  recordPrivateEvent(
    eventByStatus[choice.challenge_status] || "GENESIS_MIRROR_REFLECTION",
    choice.challenge_status === "CORRECTED"
      ? "The user supplied a different interpretive selection; private correction content was not stored locally."
      : choice.challenge_status === "REJECTED"
        ? "All proposed interpretive lenses were declined; private message content was not stored locally."
        : "A proposed interpretive lens was explicitly selected; private message content was not stored locally.",
  );
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
  const pending = createBubble("Genesis is applying Gate 0 before proposing any interpretive lens…", "mirror", "bubble-pending");
  input.value = "";
  input.disabled = true;
  submitButton.disabled = true;
  form.setAttribute("aria-busy", "true");
  scrollMirrorToLatest();

  try {
    await runSelectorFlow(text, pending);
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
