const STORAGE_KEY = "synthsara-node-zero-v2";
const STATE_VERSION = 2;
const MAX_LEDGER_EVENTS = 100;

const consentDefinitions = Object.freeze({
  profile: {
    title: "Profile data",
    description: "Name, preferences, and public identity",
  },
  emotional: {
    title: "Emotional reflections",
    description: "Sensitive journal and mood patterns",
  },
  creative: {
    title: "Creative works",
    description: "Songs, stories, prompts, and designs",
  },
  collective: {
    title: "Collective learning",
    description: "Anonymous patterns for public-good research",
  },
});

const proposals = Object.freeze([
  {
    id: "garden-fund",
    title: "Fund the Community Garden Node",
    description: "Direct 120 WORTH toward a local food-sovereignty pilot.",
  },
  {
    id: "audit-council",
    title: "Create an Independent Audit Circle",
    description: "Form a rotating citizen review group for UDS compliance.",
  },
  {
    id: "library-release",
    title: "Open the First Akasha Collection",
    description: "Publish the founding scrolls under a public-interest license.",
  },
]);

const udsPillars = Object.freeze([
  "Human sovereignty first",
  "Radical transparency",
  "Proactive fairness",
  "Unwavering accountability",
  "Robust security",
  "Service to life",
  "Privacy is sacred",
  "Ecological responsibility",
]);

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function createId() {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialState() {
  return {
    version: STATE_VERSION,
    consent: Object.fromEntries(
      Object.keys(consentDefinitions).map((key) => [key, false]),
    ),
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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeState(candidate) {
  const fallback = createInitialState();

  if (!isObject(candidate)) {
    return fallback;
  }

  const consent = Object.fromEntries(
    Object.keys(consentDefinitions).map((key) => [
      key,
      Boolean(isObject(candidate.consent) && candidate.consent[key]),
    ]),
  );

  const votes = {};
  if (isObject(candidate.votes)) {
    for (const proposal of proposals) {
      const vote = candidate.votes[proposal.id];
      if (vote === "support" || vote === "question") {
        votes[proposal.id] = vote;
      }
    }
  }

  const ledger = Array.isArray(candidate.ledger)
    ? candidate.ledger
        .filter((event) => {
          return (
            isObject(event) &&
            typeof event.id === "string" &&
            typeof event.at === "string" &&
            typeof event.type === "string" &&
            typeof event.detail === "string"
          );
        })
        .slice(0, MAX_LEDGER_EVENTS)
    : fallback.ledger;

  return {
    version: STATE_VERSION,
    consent,
    worth: Number.isFinite(candidate.worth) ? Math.max(0, candidate.worth) : 0,
    contributions: Number.isFinite(candidate.contributions)
      ? Math.max(0, candidate.contributions)
      : 0,
    votes,
    ledger: ledger.length > 0 ? ledger : fallback.ledger,
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored)) : createInitialState();
  } catch (error) {
    console.warn("Unable to read local Node Zero state.", error);
    return createInitialState();
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to save local Node Zero state.", error);
  }
}

function recordEvent(type, detail) {
  state.ledger.unshift({
    id: createId(),
    at: new Date().toISOString(),
    type,
    detail,
  });
  state.ledger = state.ledger.slice(0, MAX_LEDGER_EVENTS);
  saveState();
  render();
}

function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Required element #${id} was not found.`);
  }
  return element;
}

function removeChildren(element) {
  element.replaceChildren();
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function calculateReadiness() {
  // This is an explicit implementation checklist, not a scientific measurement.
  const implementedChecks = [
    true, // Local-first state
    true, // Granular consent controls
    true, // Global revocation
    true, // Private Mirror content excluded from ledger
    true, // User-controlled ledger export
    true, // Safe text rendering
    false, // Signed ledger events
    false, // Encrypted user vault
  ];

  const passed = implementedChecks.filter(Boolean).length;
  return Math.round((passed / implementedChecks.length) * 100);
}

function renderMetrics() {
  const enabledScopes = Object.values(state.consent).filter(Boolean).length;
  getElement("coherence").textContent = `${calculateReadiness()}%`;
  getElement("scope-count").textContent = `${enabledScopes}/${Object.keys(consentDefinitions).length}`;
  getElement("worth-metric").textContent = String(state.worth);
  getElement("event-metric").textContent = String(state.ledger.length);
  getElement("worth-balance").textContent = String(state.worth);
  getElement("contribution-count").textContent = `${state.contributions} witnessed contribution${state.contributions === 1 ? "" : "s"}`;
  getElement("ledger-count").textContent = `${state.ledger.length} event${state.ledger.length === 1 ? "" : "s"} retained`;
}

function renderConsent() {
  const container = getElement("consent-list");
  removeChildren(container);

  for (const [key, definition] of Object.entries(consentDefinitions)) {
    const row = document.createElement("div");
    row.className = "consent-row";

    const copy = document.createElement("div");
    copy.append(
      createTextElement("h3", "", definition.title),
      createTextElement("p", "", definition.description),
    );

    const toggle = document.createElement("button");
    toggle.className = "toggle";
    toggle.type = "button";
    toggle.dataset.consent = key;
    toggle.setAttribute("aria-pressed", String(state.consent[key]));
    toggle.setAttribute(
      "aria-label",
      `${state.consent[key] ? "Revoke" : "Grant"} ${definition.title}`,
    );

    const indicator = document.createElement("span");
    indicator.className = "toggle-indicator";
    indicator.setAttribute("aria-hidden", "true");
    toggle.append(indicator);

    row.append(copy, toggle);
    container.append(row);
  }
}

function renderProposals() {
  const container = getElement("proposal-list");
  removeChildren(container);

  for (const proposal of proposals) {
    const article = document.createElement("article");
    article.className = "card";

    const icon = createTextElement("div", "proposal-icon", "⚖");
    icon.setAttribute("aria-hidden", "true");

    const actions = document.createElement("div");
    actions.className = "vote-actions";

    for (const vote of ["support", "question"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `vote-button${state.votes[proposal.id] === vote ? " selected" : ""}`;
      button.dataset.proposal = proposal.id;
      button.dataset.vote = vote;
      button.setAttribute("aria-pressed", String(state.votes[proposal.id] === vote));
      button.textContent = vote === "support" ? "Support" : "Question";
      actions.append(button);
    }

    article.append(
      icon,
      createTextElement("h3", "", proposal.title),
      createTextElement("p", "", proposal.description),
      actions,
    );
    container.append(article);
  }
}

function renderPillars() {
  const container = getElement("pillar-list");
  removeChildren(container);

  udsPillars.forEach((pillar, index) => {
    const article = document.createElement("article");
    article.className = "card uds-pillar";

    const number = createTextElement("span", "pillar-number", String(index + 1));
    number.setAttribute("aria-hidden", "true");

    const check = createTextElement("span", "pillar-check", "✓");
    check.setAttribute("aria-hidden", "true");

    article.append(number, check, createTextElement("h3", "", pillar));
    container.append(article);
  });
}

function renderLedger() {
  const container = getElement("ledger-list");
  removeChildren(container);

  for (const event of state.ledger) {
    const article = document.createElement("article");
    article.className = "ledger-event";

    const marker = document.createElement("span");
    marker.className = "event-marker";
    marker.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    const title = createTextElement(
      "strong",
      "",
      event.type.replace(/_/g, " "),
    );
    const detail = createTextElement("p", "", event.detail);
    content.append(title, detail);

    const timestamp = document.createElement("time");
    timestamp.dateTime = event.at;
    const date = new Date(event.at);
    timestamp.textContent = Number.isNaN(date.getTime())
      ? "Unknown time"
      : dateFormatter.format(date);

    article.append(marker, content, timestamp);
    container.append(article);
  }
}

function render() {
  renderMetrics();
  renderConsent();
  renderProposals();
  renderPillars();
  renderLedger();
}

function mirrorReply(text) {
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

function appendMirrorBubble(text, role) {
  const bubble = createTextElement(
    "p",
    `bubble ${role === "user" ? "bubble-user" : "bubble-mirror"}`,
    text,
  );
  getElement("mirror-thread").append(bubble);
}

function handleMirrorSubmit(event) {
  event.preventDefault();
  const input = getElement("mirror-input");
  const text = input.value.trim();

  if (!text) {
    return;
  }

  appendMirrorBubble(text, "user");
  appendMirrorBubble(mirrorReply(text), "mirror");
  input.value = "";

  const thread = getElement("mirror-thread");
  thread.scrollTop = thread.scrollHeight;

  // The event confirms use without storing the user's private text.
  recordEvent("MIRROR_REFLECTION", "A private reflection was generated locally.");
}

function handleConsentClick(event) {
  const button = event.target.closest("button[data-consent]");
  if (!button) {
    return;
  }

  const key = button.dataset.consent;
  const definition = consentDefinitions[key];
  if (!definition) {
    return;
  }

  state.consent[key] = !state.consent[key];
  recordEvent(
    "CONSENT_UPDATED",
    `${definition.title} ${state.consent[key] ? "granted" : "revoked"}.`,
  );
}

function handleGlobalRevocation() {
  for (const key of Object.keys(state.consent)) {
    state.consent[key] = false;
  }
  recordEvent("GLOBAL_KILL_SWITCH", "All optional data access was revoked.");
}

function createManifestItem(label, text) {
  const item = document.createElement("div");
  item.className = "manifest-item";
  item.append(
    createTextElement("b", "", label),
    createTextElement("p", "", text),
  );
  return item;
}

function handleRtmeSubmit(event) {
  event.preventDefault();
  const input = getElement("intention-input");
  const text = input.value.trim();

  if (!text) {
    return;
  }

  const words = text.split(/\s+/);
  const focus = words.slice(0, 7).join(" ");
  const shortFocus = `${focus}${words.length > 7 ? "…" : ""}`;
  const output = getElement("manifest-output");

  output.replaceChildren(
    createManifestItem(
      "Vow",
      `I will move “${shortFocus}” from possibility into a consent-aware experiment.`,
    ),
    createManifestItem(
      "Consent test",
      "A person affected by this action can understand what will happen and can decline participation.",
    ),
    createManifestItem(
      "Next action",
      "Within 24 hours, create one visible artifact or conversation that tests the smallest part of this intention.",
    ),
  );

  // Intention text is deliberately not persisted in localStorage or the ledger.
  recordEvent("RTME_VOW_CREATED", "A private intention was structured locally.");
}

function handleProposalClick(event) {
  const button = event.target.closest("button[data-proposal][data-vote]");
  if (!button) {
    return;
  }

  const proposal = proposals.find((item) => item.id === button.dataset.proposal);
  const vote = button.dataset.vote;

  if (!proposal || (vote !== "support" && vote !== "question")) {
    return;
  }

  state.votes[proposal.id] = vote;
  recordEvent(
    "GOVERNANCE_VOTE",
    `${vote === "support" ? "Support" : "Question"} recorded for “${proposal.title}.”`,
  );
}

function handleContribution() {
  state.worth += 1;
  state.contributions += 1;
  recordEvent(
    "WORTH_RECOGNIZED",
    "One self-attested demonstration contribution was recorded.",
  );
}

function exportLedger() {
  const exportPayload = {
    schema: "synthsara.node-zero.witness.v2",
    exportedAt: new Date().toISOString(),
    notice: "This export contains local prototype state and is not a cryptographically signed ledger.",
    state,
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `synthsara-witness-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function closeMobileNavigation() {
  const navigation = getElement("primary-navigation");
  const menuButton = getElement("menu-button");
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Open navigation");
}

function handleNavigation(event) {
  const button = event.target.closest("[data-go]");
  if (!button) {
    return;
  }

  const section = document.getElementById(button.dataset.go);
  if (!section) {
    return;
  }

  section.scrollIntoView({ behavior: "smooth" });
  closeMobileNavigation();
}

function toggleMobileNavigation() {
  const navigation = getElement("primary-navigation");
  const menuButton = getElement("menu-button");
  const isOpen = navigation.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function observeSections() {
  const navigationButtons = [...document.querySelectorAll(".side-navigation [data-go]")];
  const sections = navigationButtons
    .map((button) => document.getElementById(button.dataset.go))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      for (const button of navigationButtons) {
        const active = button.dataset.go === visible.target.id;
        button.classList.toggle("active", active);
        if (active) {
          button.setAttribute("aria-current", "location");
        } else {
          button.removeAttribute("aria-current");
        }
      }
    },
    { rootMargin: "-30% 0px -55%", threshold: [0.01, 0.25, 0.5] },
  );

  sections.forEach((section) => observer.observe(section));
}

function bindEvents() {
  document.addEventListener("click", handleNavigation);
  getElement("menu-button").addEventListener("click", toggleMobileNavigation);
  getElement("mirror-form").addEventListener("submit", handleMirrorSubmit);
  getElement("consent-list").addEventListener("click", handleConsentClick);
  getElement("kill-switch").addEventListener("click", handleGlobalRevocation);
  getElement("rtme-form").addEventListener("submit", handleRtmeSubmit);
  getElement("proposal-list").addEventListener("click", handleProposalClick);
  getElement("add-contribution").addEventListener("click", handleContribution);
  getElement("export-ledger").addEventListener("click", exportLedger);

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        state = normalizeState(JSON.parse(event.newValue));
        render();
      } catch (error) {
        console.warn("Ignored invalid state from another tab.", error);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNavigation();
    }
  });
}

render();
bindEvents();
observeSections();
