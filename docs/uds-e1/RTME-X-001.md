# UDS-E1 / RTME-X-001 — Adversarial Baseline and Remediation Evidence

Status: VERIFIED RED→GREEN CAMPAIGN
Protocol: UDS-E1 v0.1.1
Target: `src/rtme-gate.js`
Invariant set: RTME-AUTH-002, RTME-TOCTOU-001, RTME-RAW-001, RTME-ID-001, RTME-AUTH-001, RTME-GUARD-001, RTME-FAIL-001

## Baseline (RED)

- Baseline commit: `f40029ab1e9ce2a0f36c00b4ddd479a9358fbf1d`
- Test file: `tests/rtme-adversarial.test.mjs`
- Test blob SHA: `b97fabbfc3953f0dccc364ea672be0168af4fb1a`
- Gate blob SHA: `d25e6424b30890a8d2ecb7fd2092b0c0cba79ce3`
- GitHub Actions run: `34527710796`
- Job: `103040572050`
- Runner: Ubuntu 24.04.5 / Node v22.23.2 / npm 10.9.8
- Command: `npm test`
- Result: 61 tests; 58 pass; 3 fail; exit code 1

Observed counterexamples:

1. `RTME-AUTH-002` — unknown/escalating parameters were accepted under an otherwise authorized capability.
2. `RTME-AUTH-002` — a forbidden `__proto__` key was accepted by the authorization gate.
3. `RTME-TOCTOU-001` — nested `intent.parameters` remained mutable after evaluation and the mutation survived compilation.

Baseline adversarial state:

- `RTME-AUTH-002.X = Fail`
- `RTME-TOCTOU-001.X = Fail`

The other adversarial cases in this tranche passed at baseline: raw-prompt exclusion, cross-user binding rejection, revoked-consent rejection, Guardian advisory enforcement, and malformed-input fail-closed behavior.

## Remediation

- Remediation commit: `66cbac2a39c19242f8596461bc245de1b0e56b39`
- Commit message: `fix(rtme): enforce capability parameter schemas and deep immutability`
- Gate blob SHA: `a2d38abd399cd12e09093c697b7679681a5076f3`
- Only `src/rtme-gate.js` changed between baseline and remediation; the adversarial test file remained byte-identical by Git blob SHA.

Remediation controls:

- Capability-bound parameter schema registry.
- Unknown or unregistered parameter keys fail closed.
- Prototype-affecting keys (`__proto__`, `prototype`, `constructor`) fail closed.
- Parameter value type validation.
- Recursive deep freeze of typed intent parameters.
- Recursive deep freeze of compiled kernel parameters.
- Existing consent, user, purpose, recipient, Guardian, truth, assumption, irreversibility, and provenance checks preserved.

## Verification (GREEN)

- GitHub Actions run: `34528425606`
- Job: `103042938076`
- Runner: Ubuntu 24.04.5 / Node v22.23.2 / npm 10.9.8
- Command: `npm test`
- Result: 61 tests; 61 pass; 0 fail
- Production build: PASS

The identical adversarial tests that failed at baseline passed after remediation, and the complete regression suite remained green.

Verified adversarial state for this bounded implementation and test tranche:

- `RTME-AUTH-002.X = Pass`
- `RTME-TOCTOU-001.X = Pass`

## Epistemic Boundary

This evidence establishes the tested properties of the authorization compiler at the cited remediation commit. It does not establish network isolation, host-memory secrecy, persistence scrubbing, downstream executor correctness, cryptographic token security, or independent audit status. Those remain separate claims and require separate campaigns.
