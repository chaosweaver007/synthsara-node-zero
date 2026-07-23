export const DEFAULT_CONFIG = Object.freeze({
  population: 240,
  rounds: 120,
  detectionProbability: 0.62,
  falsePositiveProbability: 0.08,
  sybilShare: 0.12,
  collusionShare: 0.10,
  seed: 369,
});

export const MECHANISM_TIERS = Object.freeze([
  { id: "legacy", label: "Legacy baseline", witness: .05, identity: .02, due: .02, privacy: .18, guardian: 0, attackCost: .02, governance: .05, worth: 0, restore: .02, availability: .90 },
  { id: "ledger", label: "Witness Ledger only", witness: .38, identity: .08, due: .08, privacy: .34, guardian: .10, attackCost: .12, governance: .12, worth: .12, restore: .12, availability: .92 },
  { id: "ledger-sybil", label: "Ledger + Sybil resistance", witness: .48, identity: .58, due: .14, privacy: .46, guardian: .18, attackCost: .32, governance: .28, worth: .30, restore: .20, availability: .93 },
  { id: "identity-due-process", label: "Identity + due process", witness: .56, identity: .66, due: .80, privacy: .62, guardian: .28, attackCost: .40, governance: .42, worth: .50, restore: .86, availability: .94 },
  { id: "trifold", label: "Trifold governance", witness: .62, identity: .72, due: .84, privacy: .70, guardian: .68, attackCost: .50, governance: .65, worth: .62, restore: .90, availability: .95 },
  { id: "full-synthsara", label: "Full Synthsara mechanism", witness: .72, identity: .84, due: .92, privacy: .84, guardian: .86, attackCost: .70, governance: .82, worth: .82, restore: .95, availability: .97 },
]);

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const rounded = (value, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

export function normalizeConfig(candidate = {}) {
  return {
    population: Math.round(clamp(finite(candidate.population, DEFAULT_CONFIG.population), 24, 5000)),
    rounds: Math.round(clamp(finite(candidate.rounds, DEFAULT_CONFIG.rounds), 10, 2000)),
    detectionProbability: clamp(finite(candidate.detectionProbability, DEFAULT_CONFIG.detectionProbability), .01, .99),
    falsePositiveProbability: clamp(finite(candidate.falsePositiveProbability, DEFAULT_CONFIG.falsePositiveProbability), 0, .5),
    sybilShare: clamp(finite(candidate.sybilShare, DEFAULT_CONFIG.sybilShare), 0, .45),
    collusionShare: clamp(finite(candidate.collusionShare, DEFAULT_CONFIG.collusionShare), 0, .45),
    seed: Math.trunc(clamp(finite(candidate.seed, DEFAULT_CONFIG.seed), 1, 2147483646)),
  };
}

function randomFactory(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function calculateWorthDelta({ evidence = 0, validation = 0, impact = 0, reliability = 0, fraud = 0 } = {}) {
  const positive = clamp(evidence) * .28 + clamp(validation) * .24 + clamp(impact) * .28 + clamp(reliability) * .20;
  return clamp(positive - clamp(fraud) * .75);
}

function simulateTier(tier, config, tierIndex) {
  const random = randomFactory(config.seed + tierIndex * 100003);
  const detection = clamp(config.detectionProbability + tier.witness * .22 + tier.guardian * .08, .01, .995);
  const falseSanctionProbability = config.falsePositiveProbability * (1 - tier.due * .82);

  let honest = 0, truthful = 0, selective = 0, exits = 0;
  let attacks = 0, successes = 0, detected = 0, sybilAttempts = 0, sybilSuccesses = 0;
  let falseSignals = 0, falseSanctions = 0, reviews = 0, restorations = 0;
  let attackBenefit = 0, attackCost = 0, sanctionCost = 0, privacyLoss = 0, welfare = 0;
  const detectionDelays = [], appealTimes = [], worth = Array(config.population).fill(0);

  for (let round = 0; round < config.rounds; round += 1) {
    for (let agent = 0; agent < config.population; agent += 1) {
      const roleRoll = random();
      const sybil = roleRoll < config.sybilShare;
      const collusive = !sybil && roleRoll < config.sybilShare + config.collusionShare;
      const adversarial = sybil || collusive || roleRoll < config.sybilShare + config.collusionShare + .17;
      const privacyPreference = random();
      const exitPressure = (1 - tier.privacy) * privacyPreference - .22 - tier.due * .18;

      if (round > 4 && random() < clamp(exitPressure * .012, 0, .06)) {
        exits += 1;
        continue;
      }

      if (adversarial && random() < .48 + (sybil ? .22 : 0)) {
        attacks += 1;
        if (sybil) sybilAttempts += 1;
        const successProbability = clamp(.76 - tier.identity * (sybil ? .72 : .24) - tier.guardian * .16 + random() * .10, .02, .95);
        const success = random() < successProbability;
        const caught = random() < detection;
        const cost = 1.5 + tier.attackCost * 7 + random() * 1.5;
        attackCost += cost;
        if (success) {
          successes += 1;
          if (sybil) sybilSuccesses += 1;
          attackBenefit += 6 + random() * 8;
          privacyLoss += (1 - tier.privacy) * (.8 + random());
        }
        if (caught) {
          detected += 1;
          sanctionCost += 3 + tier.witness * 7 + tier.identity * 4;
          detectionDelays.push(Math.max(1, Math.round((1 - detection) * 8 + random() * 3)));
        }
      } else {
        honest += 1;
        const choseSelective = privacyPreference > .62 - tier.privacy * .18;
        if (choseSelective) {
          selective += 1;
          welfare += .55 + tier.privacy * .45;
        } else {
          truthful += 1;
          welfare += .80 + tier.privacy * .55;
        }
        if (random() < config.falsePositiveProbability) {
          falseSignals += 1;
          if (random() < 1 - tier.due * .82) {
            falseSanctions += 1;
            welfare -= 1.2;
          } else {
            reviews += 1;
            if (random() < tier.restore) {
              restorations += 1;
              appealTimes.push(Math.max(1, Math.round(8 - tier.due * 5 + random() * 3)));
              welfare += .45;
            }
          }
        }
        const delta = calculateWorthDelta({
          evidence: .45 + random() * .5,
          validation: .35 + tier.witness * .5,
          impact: .25 + random() * .6,
          reliability: .35 + random() * .6,
          fraud: 0,
        });
        worth[agent] += Math.min(delta, .2 + tier.worth * .8);
      }
    }
  }

  const attackerRoi = (attackBenefit - attackCost - sanctionCost) / Math.max(1, attackCost);
  const sybilPenetration = sybilSuccesses / Math.max(1, sybilAttempts);
  const worthTotal = worth.reduce((a, b) => a + b, 0);
  const worthConcentration = clamp(Math.max(...worth) / Math.max(1, worthTotal) + sybilPenetration * .18 + config.collusionShare * (1 - tier.worth) * .45);
  const governanceConcentration = clamp(.58 - tier.governance * .50 + sybilPenetration * .26 + config.collusionShare * .34);
  const captureProbability = clamp(governanceConcentration * (.48 + config.collusionShare) * (1 - tier.guardian * .42));

  return {
    tierId: tier.id,
    label: tier.label,
    metrics: {
      truthfulParticipationRate: rounded(truthful / Math.max(1, honest)),
      selectiveDisclosureRate: rounded(selective / Math.max(1, honest)),
      voluntaryExitRate: rounded(exits / Math.max(1, config.population * config.rounds)),
      participantWelfare: rounded(welfare / Math.max(1, config.population * config.rounds)),
      attackerRoi: rounded(attackerRoi),
      sybilPenetrationRate: rounded(sybilPenetration),
      falsePositiveSignalRate: rounded(falseSignals / Math.max(1, honest)),
      falseSanctionRate: rounded(falseSanctions / Math.max(1, honest)),
      falseNegativeRate: rounded((attacks - detected) / Math.max(1, attacks)),
      averageFraudDetectionDelay: rounded(mean(detectionDelays), 2),
      averageAppealResolutionTime: rounded(mean(appealTimes), 2),
      restorationRate: rounded(restorations / Math.max(1, reviews)),
      worthConcentration: rounded(worthConcentration),
      governanceConcentration: rounded(governanceConcentration),
      coalitionCaptureProbability: rounded(captureProbability),
      privacyLoss: rounded(privacyLoss / Math.max(1, config.population * config.rounds)),
      systemAvailability: rounded(tier.availability - successes / Math.max(1, config.population * config.rounds) * .08),
      detectionProbability: rounded(detection),
      residualSanctionError: rounded(falseSanctionProbability),
    },
  };
}

export function runComparison(candidate = DEFAULT_CONFIG) {
  const config = normalizeConfig(candidate);
  return {
    schema: "synthsara.simulation.v0.1",
    hypothesis: "The full mechanism should improve cooperation and reduce extractive returns under declared assumptions.",
    config,
    tiers: MECHANISM_TIERS.map((tier, index) => simulateTier(tier, config, index)),
  };
}
