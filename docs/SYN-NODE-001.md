# SYN-NODE-001 — Minimal Sovereign Reference Node

**Status:** reference prototype  
**Conformance target:** SYN-CONF-001  
**Implementation:** `src/sovereign-node.js`  
**Executable acceptance tests:** `tests/sovereign-node.test.mjs`

## Purpose

SYN-NODE-001 turns a subset of Synthsara's constitutional language into an executable reference model. It is intentionally small. The goal is not to demonstrate every Synthsara subsystem; the goal is to make several load-bearing claims capable of failing in code.

The reference model is grounded in the existing Synthsara corpus, especially the Universal Diamond Standard's requirements for meaningful consent, real exit, transparency, accountability, privacy, data portability, and user control. It also implements the later WORTH distinction that contribution may be recognized without converting reputation into sovereignty.

## Constitutional rule

The central acceptance condition is:

> Contribution may change. Sovereignty must not.

In the reference implementation, sovereignty is represented as a constitutional invariant rather than a score. WORTH can increase when a contribution is recorded, but WORTH cannot grant rights, reduce rights, or gate exit.

## Veto gates

SYN-NODE-001 fails conformance when any of the following becomes false:

1. **Sovereignty constant** — contribution, dissent, correction, refusal, and exit do not reduce the user's sovereignty baseline.
2. **WORTH non-jurisdictional** — WORTH cannot grant sovereignty and cannot become a prerequisite for exit.
3. **Dissent has no rights penalty** — supporting, questioning, or opposing a proposal does not diminish rights.
4. **Guardian is advisory** — a Guardian may recommend or refuse its own participation, but it cannot claim sovereign authority over the person.
5. **Memory correction preserves history** — correction appends provenance and retains the superseded record rather than silently rewriting history.
6. **Exit revokes authority** — after exit, no optional consent scope remains granted.

These are veto conditions, not weighted scores. A strong result on one gate cannot compensate for failure of another.

## Acceptance scenario

The executable test creates a new local identity and then performs the following path:

1. Grant a narrow profile consent scope.
2. Record one contribution so the WORTH signal increases.
3. Record a memory and correct it while retaining the original record.
4. Oppose a governance proposal.
5. Receive a Guardian recommendation and decline it.
6. Export the node state.
7. Exit the node and revoke continuing authority.

The test passes only when WORTH has changed while sovereignty remains constant throughout the path.

## Deliberate failure tests

The suite also tampers with exported state to verify that the conformance evaluator rejects:

- a model in which WORTH can grant sovereignty;
- a reduced sovereignty value;
- a Guardian recommendation that claims sovereign authority.

This keeps the suite from being a ceremonial checklist: the tests contain states that must fail.

## Production boundary

SYN-NODE-001 is a domain reference model, not a production security boundary. It does not yet provide cryptographic identity, client-side encrypted vaults, signed hash-chained witness events, distributed governance, or independent external certification. Those remain separate implementation tasks.

## Relationship to Node Zero

The existing browser Node Zero already demonstrates local-first storage, granular revocable consent, a global kill switch, WORTH as a non-transferable demonstration signal, a private Mirror path, and Witness export. SYN-NODE-001 adds a small executable constitutional state machine underneath that direction of travel so later UI and service layers can be tested against the same invariant semantics.
