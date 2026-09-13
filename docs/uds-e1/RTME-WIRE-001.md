# RTME-WIRE-001 — Sealed Transport Envelope

Status: CANDIDATE SPECIFICATION — IMPLEMENTATION/ADVERSARIAL EVIDENCE PENDING
Protocol family: UDS-E1 / RTME-NET-001
Invariant: `Transport != Execution Power`
Companion corpus: `conformance/rtme-wire-001.vectors.json`

## Constitutional Boundary

RTME-WIRE-001 defines how already-authorized execution material may cross an untrusted network without allowing transport identity, proxy state, ambient credentials, or framing metadata to become execution authority.

The transport layer carries an envelope. It does not mint, broaden, reinterpret, or substitute for authority.

```text
K_node authenticates the sender/receiver transport relationship.
K_auth authenticates the ActionToken execution authority.
K_node != K_auth
Authenticated transport != authenticated authority
```

A receiver MUST reject any design in which successful mTLS, an internal network location, a reverse-proxy identity, a session cookie, or a node certificate is treated as sufficient authority to execute an RTME capability.

## WireFrame v1

A frame has a fixed transport header plus canonical payload bytes.

```text
magic              = "RTME"
wire_version       = 1
content_type       = "application/rtme+json"
payload_length     = uint64
payload_digest     = SHA-256(canonical_payload_bytes)
sender_node_id     = NodeID
receiver_node_id   = NodeID
transport_nonce    = 256-bit random value
created_at         = UTC instant
expires_at         = UTC instant
node_key_id        = active K_node public-key identifier
signature_alg      = registered asymmetric algorithm identifier
node_signature     = signature over TransportBinding
```

Canonical payload:

```json
{
  "action_token": {},
  "request_id": "...",
  "routing_constraints": {},
  "witness_intent": {}
}
```

The transport signature MUST bind, at minimum:

```text
TransportBinding =
  domain_separator ||
  wire_version ||
  sender_node_id ||
  receiver_node_id ||
  transport_nonce ||
  created_at ||
  expires_at ||
  payload_digest
```

`domain_separator` MUST be protocol-specific and versioned so a valid signature from another protocol or context cannot be replayed as an RTME wire signature.

## Digest Integrity Is Not Authenticity

`payload_digest` detects accidental or adversarial payload mutation only when the digest itself is authenticated. An attacker who can alter an unsigned envelope can alter both the payload and its SHA-256 value.

Therefore:

```text
Digest integrity != authenticity
```

The node signature authenticates the transport envelope. The ActionToken signature is independently verified under `K_auth` and remains the sole source of RTME execution authority.

## Canonical Serialization

The payload MUST use one exact canonical serialization. A generic `JSON.stringify`, `json.dumps(sort_keys=True)`, or implementation-defined serializer is insufficient as a cross-runtime security contract.

For `application/rtme+json`, RTME-WIRE-001 selects RFC 8785 JSON Canonicalization Scheme (JCS) semantics as the candidate canonical form.

Receivers MUST reject inputs that cannot be represented unambiguously under the selected canonical form, including duplicate object keys, unsupported numeric encodings, and malformed Unicode.

If a later protocol version adopts deterministic CBOR, it MUST use a distinct content type and wire version.

## Ingress Verification Order

A receiver MUST NOT semantically deserialize RTME application content before basic frame integrity and authenticity checks complete.

```text
1. Read bounded fixed framing fields.
2. Validate magic, version, content type, and payload_length limits.
3. Read exactly payload_length bytes.
4. Compute SHA-256 over those payload bytes.
5. Constant-time compare against payload_digest.
6. Verify node_signature and sender/receiver binding.
7. Validate transport_nonce freshness/replay state and envelope TTL.
8. Canonicalize/validate payload representation.
9. Deserialize RTME semantic objects.
10. Verify ActionToken independently under K_auth.
11. Apply capability, consent, adapter, Witness, and execution gates.
```

Failure at steps 1–8 MUST NOT be reinterpreted as an execution refusal from the constitutional kernel; it is a transport rejection.

## No Ambient Credentials

Transport metadata MUST NOT expand RTME authority.

The following are forbidden as implicit execution authority:

- mTLS client identity;
- `Authorization`, `Cookie`, or reverse-proxy identity headers not explicitly part of a declared capability contract;
- private-network location;
- service-mesh identity;
- account/device identifiers copied from ambient request context;
- previously authenticated browser session state.

A forwarding component MUST construct outbound headers from an explicit allowlist. It MUST NOT copy inbound headers wholesale.

## Redirect and Egress Confinement

Remote-effect adapters MUST declare their allowed network destinations in the signed AdapterManifest. Authorization is evaluated against the final connection target, not only the original URL string.

A compliant egress boundary MUST address:

- redirect expansion;
- IPv4 and IPv6 loopback;
- link-local and metadata endpoints;
- RFC1918/private ranges unless explicitly authorized;
- DNS rebinding / resolution changes between policy check and connect;
- alternate textual IP representations;
- userinfo confusion such as `allowed.example@evil.example`;
- undeclared ports and schemes;
- silent fallback destinations;
- proxy environment variables or resolver behavior that bypass manifest policy.

When policy is violated, the connection MUST terminate and a `NETWORK_POLICY_VIOLATION` event MUST be eligible for Witness recording.

## Zero Undeclared Telemetry

No analytics, crash report, behavioral tracking, diagnostic phone-home, or secondary request may be emitted unless all of the following are true:

1. the capability contract declares it;
2. the AdapterManifest permits its destination/effect;
3. current ScopedConsentGrant authorizes it.

Error handling MUST NOT silently widen network behavior.

## Replay and Recipient Binding

`transport_nonce` is transport replay protection and does not replace the ActionToken execution nonce.

The receiver MUST bind the transport frame to `receiver_node_id`. A valid frame captured for Node B MUST NOT be accepted by Node C merely because the node signature is valid.

Expired wire envelopes MUST be rejected independently of ActionToken validity.

## Effect-Uncertainty Rule

If a remote side effect may have occurred but the connection fails before a definitive response is witnessed, the caller MUST NOT blindly retry the same logical effect.

The operation transitions to a recovery state, e.g.:

```text
RECOVERY_REQUIRED
```

Reconciliation must determine whether the remote effect occurred before any compensation or new execution authority is issued.

## Candidate Security Properties

A conforming implementation is intended to establish these bounded properties:

- transport identity cannot mint RTME execution authority;
- payload mutation invalidates the authenticated frame;
- a valid node signature cannot substitute for a valid ActionToken;
- recipient and temporal bindings prevent trivial cross-node replay;
- undeclared ambient credentials are not forwarded as authority;
- egress is confined to manifest-authorized destinations;
- transport failure does not silently broaden execution or cause blind replay.

These are design targets until production-coupled adversarial evidence exists.

## Explicit Non-Claims

RTME-WIRE-001 does not by itself prove:

- zero process-level egress;
- secure DNS or resolver behavior;
- correct mTLS certificate issuance/revocation;
- absence of kernel, runtime, hypervisor, or supply-chain compromise;
- end-to-end confidentiality beyond the negotiated transport encryption;
- that a remote adapter performed the claimed side effect;
- that a hash alone makes a record authentic.

## Required Adversarial Gate

Before this specification may advance from candidate to verified, the production transport path MUST be exercised against the vectors in `conformance/rtme-wire-001.vectors.json` and any discovered equivalent bypasses.

The implementation MUST preserve RED findings as evidence, patch the production path, and rerun the same vector before claiming closure.

## Forge Order

```text
WIRE SPEC
  -> HOSTILE VECTOR CORPUS
  -> NO-EFFECT REMOTE ADAPTER
  -> REAL EFFECT
```

The first remote adapter SHOULD be a no-effect echo/hash capability so node identity, framing, replay resistance, token verification, Witness continuity, and egress policy can be exercised across a real network without placing consequential assets behind the experiment.
