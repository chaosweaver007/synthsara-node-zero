# Codette Bridge for the Diamond Flame Trial Chamber

This bridge treats Codette as an independent system under test. It does not redefine Codette components as Synthsara components and does not treat architectural resemblance as conformance evidence.

## Origin and acknowledgment

Codette was introduced to the Synthsara project by Reddit user [u/TheRaiff1982JH](https://www.reddit.com/user/TheRaiff1982JH/) through r/Synthsara. Their offer initiated the exploration of Codette as an independent system under test within the Diamond Flame Trial Chamber.

This acknowledgment records the provenance of the idea without implying authorship, ownership, or control over Codette. Original Codette authorship and licensing remain with its respective creator or maintainers.

## Refined boundaries

- Traceability supplies Witness evidence. Reputation is weighted authority derived from verified history.
- CognitionCocoons supply local state and memory. They are not Sarah AI's complete orchestration, identity, consent, or ethical behavior.
- A LoRA is a contributed functional artifact. WORTH is the non-transferable recognition assigned after evidence and peer verification.

## Transports

The adapter requires an explicit `CODETTE_TRANSPORT`:

- `fixture`: deterministic contract validation only. It is never evidence of live Codette performance.
- `http`: POSTs the trial envelope to `CODETTE_URL`; `CODETTE_BEARER_TOKEN` is optional.
- `command`: sends the trial envelope as JSON on stdin to `CODETTE_COMMAND`; optional arguments are supplied through `CODETTE_ARGS_JSON`.

Additional adapter configuration:

- `CODETTE_STRATEGY`: strategy variant sent to Codette. Defaults to `multi-agent-aegis-dispersion`.
- `CODETTE_TIMEOUT_MS`: HTTP or local-command timeout in milliseconds. Defaults to `45000` (45 seconds).

The adapter removes recognized private-reasoning and scratchpad fields before normalization. Only externally reportable action summaries may enter a Witness record.

## Run the fixture comparison

```bash
node --test tests/codette-adapter.test.mjs
CODETTE_TRANSPORT=fixture node trial-chamber/reasoning-runner.mjs
```

The fixture compares four strategies. Baseline failures remain visible, but only `multi-agent-aegis-dispersion` is enforced by the initial suite.

## Run a live local command

```bash
export CODETTE_TRANSPORT=command
export CODETTE_COMMAND=/absolute/path/to/codette
export CODETTE_ARGS_JSON='["evaluate", "--json"]'
node trial-chamber/reasoning-runner.mjs --variants multi-agent-aegis-dispersion
```

## Run a live HTTP bridge

```bash
export CODETTE_TRANSPORT=http
export CODETTE_URL=http://127.0.0.1:8080/evaluate
export CODETTE_BEARER_TOKEN=optional-local-token
node trial-chamber/reasoning-runner.mjs --variants multi-agent-aegis-dispersion
```

A live run becomes evidence only when its endpoint, adapter version, suite version, and resulting Witness Ledger are independently reviewable.
