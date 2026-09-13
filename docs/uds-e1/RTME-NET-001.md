# UDS-E1 / RTME-NET-001 — Network Egress Boundary

Status: INSPECTED — ADVERSARIAL CAMPAIGN PENDING
Protocol: UDS-E1 v0.1.1
Node Zero version: 0.3.0
Inspection base: `fd7291ac94a0df0b89ec6f5140d58bee55241a5c`
Companion wire specification: `docs/uds-e1/RTME-WIRE-001.md`
Adversarial corpus: `conformance/rtme-wire-001.vectors.json`
Transport invariant: `Transport != Execution Power`

## Claim Boundary

The network claim is split into three testable boundaries rather than one global zero-network assertion:

- `M_local-action`: the isolated local RTME action path performs no network dispatch.
- `M_strict-local-runtime`: a full browser runtime declared strict-local performs zero application network egress after required static assets are loaded.
- `M_remote-authorized`: client egress is confined to the same-origin `/api/genesis` gateway, and server-side egress is confined to the configured Genesis upstream and fixed operation paths, carrying only the explicitly authorized request envelope.

Current evidence state: `RTME-NET-001.X = 0`.

Static inspection identifies test targets only. It does not advance the adversarial-testing dimension. The companion RTME-WIRE-001 document is a candidate specification and likewise does not advance the evidence state until its vectors exercise production-coupled transport surfaces.

## Inspected Runtime Surfaces

- `index.html`
- `src/app.js`
- `src/genesis-bridge.js`
- `src/rtme-gate.js`
- `api/genesis.js`
- `tests/genesis-proxy.test.mjs`
- `tests/deployment-conformance.test.mjs`

## Static Inspection Findings

### 1. Strict-local full-page mode is not presently established

`index.html` loads `src/genesis-bridge.js` unconditionally. The bridge invokes `checkGateway()` on boot, which performs `GET /api/genesis`. Therefore the full browser boot cannot presently be described as zero-egress strict-local mode without an explicit mode/consent mechanism that suppresses that gateway handshake.

The narrower RTME action handler in `src/app.js` performs its vow-generation and local ledger update without a network dispatch in that action path. This narrower property must not be promoted into a full-runtime claim.

### 2. Client network destination is same-origin by construction and CSP

The browser bridge defines `GATEWAY_PATH = "/api/genesis"` and uses that path for gateway GET/POST operations. `index.html` also declares `connect-src 'self'` in Content Security Policy. These are implementation constraints, not packet-level proof.

### 3. Remote Genesis mode intentionally sends message text

`api/genesis.js` constructs the upstream private-shadow envelope with `message`, `persona`, generated request/session IDs, `consent_level: "private"`, `collective_learning: false`, and `pipeline_mode: "shadow"`.

Therefore the earlier wording "zero raw intent text in remote mode" is not compatible with the implemented Genesis chat path. The defensible remote invariant is that no ambient or unconsented state travels beyond the explicitly authorized message/persona/selector envelope. Raw-prompt exclusion from the RTME kernel compiler is a separate boundary and must not be conflated with Genesis chat transport.

### 4. Ambient inbound authorization headers are not visibly forwarded

The inspected proxy constructs its upstream headers from `Accept` plus explicitly supplied request headers such as `Content-Type`; it does not copy the incoming request header collection wholesale. This supports a test hypothesis that inbound Cookie/Authorization headers should not reach Genesis, but wire-level or fetch-intercept evidence is still required.

### 5. Upstream redirect confinement is not implemented explicitly

`fetchGenesis()` does not set `redirect: "manual"`. The network campaign must test whether an upstream redirect can cause the server-side fetch to follow an alternate origin. Existing deployment-conformance tests use manual redirect handling while probing Node Zero itself; that is a different boundary and does not establish the behavior of `api/genesis.js` toward Genesis.

### 6. Upstream destination is configuration-controlled

`GENESIS_BASE_URL` may override the default Genesis origin. This makes deployment configuration part of the network trust boundary. A later hardening step may require scheme/host validation or an explicit upstream allowlist, depending on the intended deployment model.

### 7. Client failure is locally degraded, not silently re-routed

When the gateway status check or remote Mirror path fails, the inspected client bridge falls back to local reflection. No secondary public fallback endpoint is visible in the inspected browser bridge. This observation remains subject to runtime testing.

## Transport Authority Separation

RTME-WIRE-001 adds a candidate wire-level boundary for future remote RTME effects:

```text
Authenticated transport != authenticated authority
K_node != K_auth
```

A node certificate, mTLS session, reverse-proxy identity, internal-network location, or ambient session credential must never stand in for an independently valid ActionToken. Transport may authenticate who sent an envelope; only the constitutional execution path may determine whether its contained authority is valid.

Payload hashing alone is not authenticity. Any envelope digest that matters to security must itself be authenticated, and the contained ActionToken must still be independently verified under its authority key.

## Proposed Harness Correction

The initially proposed `tests/rtme-network.test.mjs` must not be committed unchanged as evidence. It contains tests that can pass without exercising production networking behavior:

- The local-mode case inspects mock request arrays after invoking only RTME gate/compiler logic.
- The remote-envelope case defines `sanitizeForGateway()` inside the test and then tests that helper instead of production `api/genesis.js`.
- The crash-telemetry case invokes only the RTME gate and therefore cannot prove absence of telemetry from the actual browser/proxy runtime.
- The live compiled recipient is under `compiled.intent.recipient`, not `compiled.recipient`.

## Production-Coupled Test Plan

The next baseline campaign should be separated by layer:

1. **Proxy policy tests** — import the real `api/genesis.js` handler and intercept `globalThis.fetch`; verify exact upstream URL, path, headers, body, operation, redirect policy, and failure behavior.
2. **Browser dispatch tests** — exercise actual bridge boot/dispatch behavior; confirm the automatic status GET and later prove a strict-local mode once such a mode exists.
3. **Wire-frame tests** — when RTME-WIRE-001 is implemented, exercise the production framing/parser path against `conformance/rtme-wire-001.vectors.json`; do not substitute helper-only tests for the live implementation.
4. **Process egress tests** — use a separate process/network harness for DNS/socket-level assertions. Fetch mocks alone cannot establish `E_network = 0` at the process boundary.
5. **No-effect remote adapter** — only after the wire/parser baseline exists, exercise a bounded echo/hash capability across a real network before placing consequential remote effects behind the transport.

## Candidate Falsifiers

A bounded network claim is defeated by any observation such as:

- network dispatch from a declared strict-local runtime;
- client request outside the same-origin route when same-origin confinement is asserted;
- proxy egress to an origin outside the allowed configured destination set;
- ambient Cookie, Authorization, durable account/device identifier, local-storage token, or undeclared telemetry in an upstream envelope;
- upstream redirect causing unapproved origin expansion;
- silent remote fallback to an undeclared destination;
- crash/error handling initiating undeclared telemetry;
- valid node/transport credentials being accepted as RTME execution authority without a valid ActionToken;
- payload or recipient mutation surviving authenticated frame verification;
- replay of an expired or previously consumed transport envelope;
- remote-effect uncertainty being converted into a blind retry instead of `RECOVERY_REQUIRED` reconciliation.

## Provenance Note

Git commit IDs and Git blob IDs are version-control identifiers, not SHA-256 artifact hashes. Under the current UDS-E1 schema, a field declared specifically as `artifact_hash: SHA-256` must either contain a computed SHA-256 of the evidence bytes or remain unset/TBD. Commit references should be stored separately as VCS provenance rather than relabeled as SHA-256.

## Next Gate

Keep `RTME-NET-001.X = 0` while RTME-WIRE-001 remains specification-only.

Create the production-coupled proxy policy baseline before remediation, then implement the bounded wire/frame path and run the hostile-vector corpus against production code. Preserve every RED finding, patch the production surface, and rerun the identical vector before updating the adversarial evidence dimension.
