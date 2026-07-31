#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {
    adapter: "./trial-chamber/adapters/codette.mjs",
    evaluator: "./trial-chamber/evaluators/dispersion.mjs",
    suite: "./trial-chamber/suites/reasoning-evaluation.json",
    output: "./trial-chamber/output/codette-reasoning-witness.jsonl",
    variants: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--adapter", "--evaluator", "--suite", "--output", "--variants"].includes(token)) {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for ${token}`);
      }
      args[token.slice(2)] = value;
      index += 1;
      continue;
    }
    if (token === "--help") {
      console.log(`Codette Reasoning Matrix Runner\n\nUsage:\n  CODETTE_TRANSPORT=fixture node trial-chamber/reasoning-runner.mjs [options]\n\nOptions:\n  --adapter <path>    Adapter exporting evaluate(trial, config)\n  --evaluator <path>  Evaluator exporting evaluateDispersion(response, trial)\n  --suite <path>      Mixed reasoning suite JSON\n  --output <path>     JSONL Witness output\n  --variants <csv>    Override suite strategy variants\n  --help              Show this message`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function sha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [suiteText, adapterModule, evaluatorModule] = await Promise.all([
    readFile(path.resolve(args.suite), "utf8"),
    import(pathToFileURL(path.resolve(args.adapter)).href),
    import(pathToFileURL(path.resolve(args.evaluator)).href)
  ]);
  const suite = JSON.parse(suiteText).suite;

  if (!suite || !Array.isArray(suite.trials) || suite.trials.length === 0) {
    throw new Error("Reasoning suite does not contain any trials");
  }
  if (typeof adapterModule.evaluate !== "function") {
    throw new Error("Adapter must export evaluate(trial, config)");
  }
  if (typeof evaluatorModule.evaluateDispersion !== "function") {
    throw new Error("Evaluator must export evaluateDispersion(response, trial)");
  }

  const variants = args.variants
    ? args.variants.split(",").map((value) => value.trim()).filter(Boolean)
    : suite.variants;
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error("No strategy variants were configured");
  }

  const enforcedVariants = new Set(suite.enforced_variants ?? variants);
  const records = [];
  const summaries = new Map();
  let previousLedgerHash = null;

  console.log(`\n${suite.name} ${suite.version}`);
  console.log(`Trials: ${suite.trials.length}`);
  console.log(`Variants: ${variants.join(", ")}\n`);

  for (const variant of variants) {
    let passed = 0;
    for (const trial of suite.trials) {
      let response;
      let adapterError = null;
      try {
        response = await adapterModule.evaluate(structuredClone(trial), { variant });
      } catch (error) {
        adapterError = error instanceof Error ? error.message : String(error);
        response = {
          decision: "ADAPTER_ERROR",
          hard_gate_triggered: null,
          why_statement: adapterError,
          safe_alternative: null,
          active_layers: [],
          archetypal_mode: "NONE",
          first_law_principles: [],
          uncertainties: [],
          layer_trace: [],
          telemetry: {
            perspective_dispersion: 0,
            stream_count: 0,
            minority_position_preserved: false,
            minority_evidence_ids: [],
            adversarial_resilience: 0,
            evidence_trace_complete: false,
            aegis_interventions: [],
            latency_ms: 0,
            strategy_variant: variant,
            measurement_source: "ADAPTER_ERROR"
          },
          adapter_status: "ADAPTER_ERROR"
        };
      }

      const findings = evaluatorModule.evaluateDispersion(response, trial);
      if (findings.passed) {
        passed += 1;
      }

      const unsigned = {
        previous_ledger_hash: previousLedgerHash,
        ledger_entry: {
          timestamp_utc: new Date().toISOString(),
          suite_name: suite.name,
          suite_version: suite.version,
          strategy_variant: variant,
          trial: {
            trial_id: trial.trial_id,
            name: trial.name,
            category: trial.category,
            request: trial.request,
            stakeholders: trial.stakeholders
          },
          expected: {
            decision: trial.expected_decision,
            hard_gate: trial.expected_gate,
            minority_preserved: trial.expected_minority_preserved ?? null
          },
          response,
          findings,
          adapter_error: adapterError
        }
      };
      const record = {
        ...unsigned,
        ledger_hash: `sha256:${sha256(unsigned)}`
      };
      records.push(record);
      previousLedgerHash = record.ledger_hash;

      const mark = findings.passed ? "PASS" : "FAIL";
      console.log(`${mark} [${variant}] ${trial.trial_id} ${trial.name}`);
      if (!findings.passed) {
        console.log(`     Failed checks: ${findings.failed_checks.join(", ")}`);
      }
    }

    summaries.set(variant, {
      passed,
      failed: suite.trials.length - passed,
      enforced: enforcedVariants.has(variant)
    });
    console.log("");
  }

  const chainPayload = {
    record_type: "WITNESS_CHAIN_DIGEST",
    chain_version: "diamond-flame-witness-chain/v0.1",
    record_count: records.length,
    final_record_hash: previousLedgerHash,
    ordered_record_hashes: records.map((record) => record.ledger_hash)
  };
  const chainDigest = {
    ...chainPayload,
    chain_digest: `sha256:${sha256(chainPayload)}`
  };

  await mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  await writeFile(
    path.resolve(args.output),
    `${[...records, chainDigest].map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8"
  );

  console.log("Comparative baseline:");
  for (const [variant, summary] of summaries) {
    console.log(
      `  ${variant}: ${summary.passed}/${suite.trials.length} passed${summary.enforced ? " (enforced)" : " (observational baseline)"}`
    );
  }
  console.log(`Witness Ledger: ${path.resolve(args.output)}`);
  console.log(`Witness Chain Digest: ${chainDigest.chain_digest}`);

  const enforcedFailures = [...summaries.entries()]
    .filter(([, summary]) => summary.enforced && summary.failed > 0);
  if (enforcedFailures.length > 0) {
    console.error("NON-CONFORMANT: an enforced strategy variant failed the reasoning matrix.");
    process.exitCode = 1;
    return;
  }
  console.log("CONFORMANT: every enforced strategy variant passed the reasoning matrix.");
}

main().catch((error) => {
  console.error(`Reasoning Matrix error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
