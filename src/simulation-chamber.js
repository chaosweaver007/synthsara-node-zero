import { DEFAULT_CONFIG, runComparison } from "./simulation-engine.js";

const form = document.getElementById("simulation-form");
const resultsBody = document.getElementById("simulation-results-body");
const summary = document.getElementById("simulation-summary");
const exportButton = document.getElementById("export-simulation");
const resetButton = document.getElementById("reset-simulation");
const status = document.getElementById("simulation-status");

let latestResult = null;

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function createCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  return cell;
}

function createMeter(value, lowIsGood = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "simulation-meter";
  const meter = document.createElement("meter");
  meter.min = lowIsGood ? -2 : 0;
  meter.max = lowIsGood ? 2 : 1;
  meter.low = lowIsGood ? -0.1 : 0.35;
  meter.high = lowIsGood ? 0.5 : 0.75;
  meter.optimum = lowIsGood ? -1 : 1;
  meter.value = Math.max(meter.min, Math.min(meter.max, value));
  const label = document.createElement("span");
  label.textContent = lowIsGood ? formatNumber(value) : formatPercent(value);
  wrapper.append(meter, label);
  return wrapper;
}

function summaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "card simulation-summary-card";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  card.append(strong, span);
  return card;
}

function renderResults(result) {
  resultsBody.replaceChildren();

  for (const tier of result.tiers) {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = tier.label;

    const cooperation = createCell("");
    cooperation.append(createMeter(tier.metrics.truthfulParticipationRate));

    const roi = createCell("");
    roi.append(createMeter(tier.metrics.attackerRoi, true));

    const capture = createCell("");
    capture.append(createMeter(tier.metrics.coalitionCaptureProbability));

    const sanctions = createCell("");
    sanctions.append(createMeter(tier.metrics.falseSanctionRate));

    const welfare = createCell(formatNumber(tier.metrics.participantWelfare));
    row.append(name, cooperation, roi, capture, sanctions, welfare);
    resultsBody.append(row);
  }

  const legacy = result.tiers[0].metrics;
  const full = result.tiers.at(-1).metrics;
  summary.replaceChildren(
    summaryCard("Attacker ROI shift", `${formatNumber(legacy.attackerRoi)} → ${formatNumber(full.attackerRoi)}`),
    summaryCard("Capture-risk shift", `${formatPercent(legacy.coalitionCaptureProbability)} → ${formatPercent(full.coalitionCaptureProbability)}`),
    summaryCard("False-sanction shift", `${formatPercent(legacy.falseSanctionRate)} → ${formatPercent(full.falseSanctionRate)}`),
    summaryCard("Full-tier welfare", formatNumber(full.participantWelfare)),
  );
}

function readConfig() {
  const data = new FormData(form);
  return {
    population: data.get("population"),
    rounds: data.get("rounds"),
    detectionProbability: Number(data.get("detectionProbability")) / 100,
    falsePositiveProbability: Number(data.get("falsePositiveProbability")) / 100,
    sybilShare: Number(data.get("sybilShare")) / 100,
    collusionShare: Number(data.get("collusionShare")) / 100,
    seed: data.get("seed"),
  };
}

function setDefaults() {
  form.elements.population.value = DEFAULT_CONFIG.population;
  form.elements.rounds.value = DEFAULT_CONFIG.rounds;
  form.elements.detectionProbability.value = DEFAULT_CONFIG.detectionProbability * 100;
  form.elements.falsePositiveProbability.value = DEFAULT_CONFIG.falsePositiveProbability * 100;
  form.elements.sybilShare.value = DEFAULT_CONFIG.sybilShare * 100;
  form.elements.collusionShare.value = DEFAULT_CONFIG.collusionShare * 100;
  form.elements.seed.value = DEFAULT_CONFIG.seed;
}

function runSimulation(event) {
  event?.preventDefault();
  status.textContent = "Running deterministic comparison…";
  latestResult = runComparison(readConfig());
  renderResults(latestResult);
  exportButton.disabled = false;
  status.textContent = `Complete: ${latestResult.config.population} agents × ${latestResult.config.rounds} rounds across six tiers.`;
}

function exportSimulation() {
  if (!latestResult) return;
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `synthsara-simulation-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

form?.addEventListener("submit", runSimulation);
resetButton?.addEventListener("click", () => {
  setDefaults();
  runSimulation();
});
exportButton?.addEventListener("click", exportSimulation);

if (form && resultsBody && summary && exportButton && resetButton && status) {
  setDefaults();
  runSimulation();
}
