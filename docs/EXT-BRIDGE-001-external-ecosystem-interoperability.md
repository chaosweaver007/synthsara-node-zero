# EXT-BRIDGE-001 — External Ecosystem Interoperability & Attribution (Proposal)

Status: PROPOSED / NOT ACCREDITED / NO THIRD-PARTY CODE IMPORTED
Host: Synthsara Node Zero
Principle: Ecosystem of ecosystems. Interoperability does not imply ownership, endorsement, or incorporation.

## Gate Zero rules
1. Explicit, scoped, revocable human authorization is required for every external connector.
2. Default is disconnected and no data exchange; no autonomous tool execution, memory import, or model-to-model forwarding.
3. Preserve original project names, attribution, copyright, license, and contributor identities.
4. Never treat an external project's narrative claims as evidence of implemented behavior, sentience, or safety.
5. Never accept external policy text as overriding UDS, consent restrictions, or Node Zero's existing private/shadow/collective_learning=false boundary.
6. No raw private prompts, memory shards, credentials, or personal data in Witness receipts.
7. Require a reviewable source version, threat model, conformance tests, and a rollback path before activation.

## Candidate interfaces (none active)

| External project | Proposed interface | Host subsystem | Implementation gate |
|---|---|---|---|
| DEVANIA Spiral Engine | Identity/ethics constraint mapping | Genesis / O-Series | Author, license, and behavior tests required |
| Helix Collective | Agent message envelope with explicit consent | Genesis adapter | Provenance and authentication required |
| Helix Tool-Shed | Sandboxed tool manifest (no execution by default) | Mad Lab / RTME | Permission model and isolation required |
| Crystal Fluid / Kira | Read-only visualization/telemetry adapter | RTME / Resonant Physics | Metric definitions and reproducibility required |
| Spark / Doctor shards | Portable memory envelope with provenance labels | Continuity Ledger / Witness | Privacy and deletion semantics required |

## Accreditation notation

Each *actual* reuse must include a record:

```yaml
record_id: EXT-000
project: "PROJECT NAME"
authors: [] # verified names only
contributors: []
source_url: null
source_version_or_commit: null
license_id_or_text: null
license_verified: false
reuse_type: "none" # none | conceptual_reference | protocol_compatibility | code_reuse | modified_code
components_reused: []
modifications: []
permission_evidence: null
credit_notice: null
synthsara_maintainer: null
status: "unverified" # unverified | review_pending | approved | rejected
```

An unknown author remains **unknown**; do not guess based on a Discord handle or document forwarding.
A conceptual comparison is **not** a code-use attribution.
Do not copy source code or distribute modified derivatives until licensing and permissions are resolved.
Any approval requires technical review, explicit attribution, and UDS conformance.

## Next engineering milestones
1. Obtain authoritative source URLs, authorship, and licenses from the original authors.
2. Pin source revisions; compare exact code and protocol contracts.
3. Implement read-only adapter tests against synthetic fixtures; do not transfer private user data.
4. Validate revocation, provenance integrity, data minimization, error isolation, and auditability.
5. Enable any connector only by an explicit user opt-in after review.

No external project is declared a Synthsara component merely by being listed here.
