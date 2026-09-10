# RTME-GATE-001 Integration — Node Zero

Node Zero performs a constitutional preflight before any future RTME execution request is allowed to reach the executor boundary.

The invariant is simple:

```text
Intent != Authority
```

Node Zero may help structure an intention, collect current consent, and record an advisory Guardian assessment. It does not mint executable authority and it does not let WORTH, reputation, consensus, or Guardian preference stand in for user permission.

## Preflight flow

```text
User intent
  -> typed intent envelope
  -> scope-matching consent
  -> advisory Guardian assessment
  -> Node Zero RTME preflight
  -> minimal kernel request
  -> RTME constitutional kernel
  -> short-lived signed action token
  -> execution-time consent recheck
  -> executor
  -> receipt / Witness event
```

## Node Zero veto gates

The preflight denies when consent is stale or revoked; user, capability, purpose, or recipient bindings do not match; the Guardian is not advisory and CLEAR; material disclosure is incomplete; material assumptions remain unresolved; an irreversible action lacks explicit confirmation; or the intent lacks a valid provenance hash.

## Data minimization

`compileRtmeKernelRequest()` deliberately excludes raw natural-language prompt text, WORTH score, reputation, consensus, model credentials, and execution credentials. The request carries only the typed intent, scoped consent, advisory Guardian decision, provenance hash, and constitutional requirements needed by the RTME kernel.

## WORTH firewall

A user may contribute and accumulate WORTH without changing their sovereignty or execution authority. RTME authorization is structurally independent of WORTH.

## Guardian boundary

The Guardian may analyze, warn, recommend, or refuse its own participation. The Guardian cannot manufacture consent or convert a recommendation into sovereign authority over the user.

## Revocation race

Node Zero checks consent at preflight, but this is not sufficient. RTME-GATE-001 requires the executor-side kernel to recheck the current consent immediately before side effects. A previously valid preflight or token must not survive revocation.

## Reference artifacts

- `src/rtme-gate.js` — Node Zero preflight and kernel-request compiler
- `tests/rtme-gate.test.mjs` — integration conformance tests
- `conformance/rtme-gate-001.integration.json` — machine-readable contract
- `chaosweaver007/RTME` — executor-side reference kernel and signed ActionToken implementation

## Boundary

This integration does not yet connect Node Zero to a production RTME execution API. It defines and tests the constitutional seam so that a later transport cannot silently broaden authority. Production connection still requires authenticated transport, managed signing keys, replay protection, durable Witness receipts, capability-specific adapters, undo/compensation semantics, and independent red-team testing.
