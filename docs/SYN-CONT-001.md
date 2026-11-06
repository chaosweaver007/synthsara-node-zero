# SYN-CONT-001 — Consent-Gated Local Memory Reconstruction

**Status:** review prototype; not deployed to the Genesis shadow gateway  
**Canonical predecessors:** [SYN-NODE-001](./SYN-NODE-001.md), [SCR-001 Continuity Ledger](https://github.com/chaosweaver007/continuity-ledger/blob/main/docs/SCR-001_Continuity_Ledger_Spec.md)  
**Reference implementation:** `src/continuity-resolver.js`, `src/sovereign-node.js`  
**Executable regression cases:** `tests/continuity-resolver.test.mjs`

## Evidence Basis

SYN-NODE-001 already provides `remember()`, `correctMemory()`, `supersedes` links, exportable state, revocable optional consent, and a reference acceptance test. The separate SCR-001 initiative already specifies source-status distinctions, memory-honesty scoring, audit fixtures, and restoration evidence.

Before this change, the reference node could record and correct memory without checking the dedicated `memory` consent scope. There was no operation that reconstructed a single active memory entry from the correction chain. The current Node Zero-to-Genesis proxy also sends a fresh session UUID for each request and does not supply durable memory to Genesis.

This patch **extends** the existing reference node, rather than creating a competing ledger or altering the production shadow route.

## Contract

1. `remember()`, `correctMemory()`, and `recall()` require an active node plus explicit `grantConsent("memory", purpose)`. Profile or creative consent is insufficient.
2. `recall(subject, { asOf })` calls the deterministic `reconstructMemory` function and returns one of `active`, `missing`, `conflict`, or `invalid`.
3. Subjects use exact identifiers. Neither the resolver nor the AI guesses that two similar names represent the same entity. Alias resolution belongs to a future explicit identity register.
4. `asOf` is a record-ingestion timestamp, **not** proof that the memory was true in the external world. A later bi-temporal model would need a separate world-validity interval.
5. A `supersedes` edge preserves the older record. Only a unique, well-formed terminal correction chain can produce `current`. Orphans, cycles, duplicates, and competing heads must not silently become truth.
6. The current response carries source provenance and evidence IDs, but provenance is not independent verification. The historical output contains correction metadata and pointers, not a second copy of each old value.
7. `eraseMemory(subject)` is an explicit, user-directed removal of *all local versions* for that exact subject. It stays available after memory-consent revocation, before node exit.
8. Witness events describe the type of operation without embedding memory values or subject text. The user's own `snapshot()` and `exportState()` continue to expose local state to that user.

## Claim Ceiling

This is a deterministic, in-process reference component. It **does not** establish durable storage, cross-session persistence, full bi-temporal validity, semantic entity matching, external verification, authenticated multi-user access, encrypted vaults, or ChatGPT memory changes. The public Genesis shadow endpoint remains stateless, private, and `NULL_WRITE`.

There is no automatic link between Node Zero's `recall()` output and the O-Series model `ContextBuilder` yet; therefore the FoxLion.OS failure is currently a *reconstruction regression fixture*, not proof that Sarah AI's live model will use the recalled context.

## Implementation Safeguard

- Never broaden authorization from an unrelated scope to `memory`.
- Revocation blocks new read, write, and correction operations; erasure remains user-available.
- If multiple historical paths compete, return `conflict` without a current value.
- A local memory claim remains user-provided data; it cannot override Gate Zero, UDS, or model capability restrictions.
- Do not send private memory to the existing `/api/genesis` route or silently modify its stateless boundary.
- Explicit copies/export files produced before erasure remain outside this reference node's control; production deletion requires a documented storage lifecycle.

## Verification Method

Run:

```bash
npm test
npm run build
```

The `npm test` runner includes all `tests/*.test.mjs` files. SYN-CONT-001 cases cover default-deny memory, revocation, user-directed erasure, exact-entity separation, old/new correction state, competing active facts, malformed correction chains, and Node Zero's exited state.

A future phase must separately validate cross-session restore, signed provenance, opt-in vault encryption, source-specific evidence status, actual Sarah AI response use, and regression behavior after model switches. A documentation check or passing reference-node test is **not** production certification.

## Planned Integration, Not Implemented Here

Once the local contract passes review, create an authenticated, consent-scoped, separately versioned continuity context envelope. Validate it in a trusted server-side adapter before any model generation, without accepting the envelope as a constitutional instruction. Reuse the existing SCR-001 scoring protocol to measure whether the generated response actually applies corrections. Treat any rollout as a separately reviewed change to Genesis' production privacy boundary.
