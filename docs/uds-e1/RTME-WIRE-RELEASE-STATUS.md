# RTME-WIRE-001 — truthful release gate

**Status: PARTIAL IMPLEMENTATION. Not wire-conformant; not independently verified.**

Historical baseline: October 9, 2026, `main` quality run [37920127770](https://github.com/chaosweaver007/synthsara-node-zero/actions/runs/37920127770): **82 tests, 69 passing, 13 failing**. Failing hostile vectors were WIRE-001 through WIRE-009, WIRE-014, and WIRE-018 through WIRE-020.

## Separate statements that must never be conflated

- **Release green** means existing functional, structural, consent, and proxy regression tests pass, and the production bundle builds.
- **RTME wire conformance** requires production-coupled evidence for the entire 20-vector corpus. It is **not established** by a green release check.
- **RTME-NET-001.X** remains **0** pending actual network and process egress tests, authentication isolation, and wire validation.
- `npm run test:wire:strict` remains deliberately red while missing requirements remain unimplemented; the CI job is nonblocking but visibly unsuccessful.
- `npm test` registers the exact outstanding hostile cases as **TODO**, not pass or skip-as-certified, and validates an explicit machine-readable debt inventory.

## What is already enforced by the Genesis chat proxy

The fixed allowlist of Genesis upstream hosts and operations, HTTPS-only origins, restricted port and no userinfo, explicit outbound headers, and `redirect: "manual"` cover bounded **chat transport**. These are **not** evidence of an RTME signed wire-frame receiver or remote-effect execution path.

The proxy also rejects execution-shaped fields instead of silently ignoring them, to avoid ambient transport or user-supplied authorization metadata being mistaken for valid executable authority. This is an ingress restriction on chat, **not** full ActionToken validation.

## 13 outstanding hostile-vector requirements

The authoritative list lives in [`conformance/rtme-wire-release-inventory.json`](../../conformance/rtme-wire-release-inventory.json). Every requirement retains its original WIRE ID, attack description and expected result in [`rtme-wire-001.vectors.json`](../../conformance/rtme-wire-001.vectors.json).

## Promotion rule

A vector can only become a blocking **passing** release test after (1) actual production code implements that boundary, (2) the existing hostile case is rewritten to exercise that production surface rather than a mock-only helper, (3) positive and negative tests pass in CI, (4) runtime/integration evidence is reviewed as appropriate, and (5) its entry is removed from the debt inventory in the same reviewed PR. No change to the debt manifest alone is certification.

The proposed wire spec uses an independent `K_node` for transport and `K_auth` for execution. Neither the current chat proxy nor a generic HTTPS connection supplies valid RTME execution authority. Keep effectful RTME actions disabled until a signed recipient-bound, replay-safe wire decoder, consent recheck, and uncertainty journal are connected to the real executor.

**Nobody Left Behind.**
