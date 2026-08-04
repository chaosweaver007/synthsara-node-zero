# Synthsara Node Zero

A public, local-first proof node for Synthsara's consent, governance, WORTH, RTME, reflective interface, Universal Diamond Standard, Witness Layer, and private Genesis O-Series connection.

Node Zero is intentionally small enough to audit. The browser interface remains local-first while the Sarah Mirror can pass a private request through a same-origin serverless proxy to the deployed Genesis Gate 0 shadow gateway.

## Core guarantees in this prototype

- Consent starts **private by default**.
- Every optional data scope is granular and revocable.
- A global kill switch revokes all optional access.
- Mirror messages and RTME intentions are not written to the local Witness Layer.
- Genesis requests are forced into `private` consent, `shadow` mode, and `collective_learning: false`.
- The browser calls only the same-origin `/api/genesis` route.
- The proxy sends no cookies, durable user identifier, tools, or memory authorization to Genesis.
- User-originated text is rendered with DOM text nodes, not HTML injection.
- Local prototype state remains in the browser's `localStorage` unless the user exports it.
- The interface makes no third-party font, analytics, or browser asset requests.
- A strict Content Security Policy limits the browser to same-origin resources.
- The Witness Layer records only generic gateway events, never the Mirror message or response.
- If Genesis is unavailable, the Mirror fails softly into the existing local deterministic reflection.

## Functional chambers

- **Sarah Mirror:** Genesis-backed private reflection with Gate 0 refusal, UDS output review, visible Witness Receipt metadata, and a local fallback.
- **Consent Vault:** granular permissions and one-click global revocation.
- **Witness Layer:** application-controlled local event history with JSON export.
- **RTME:** transforms an intention into a vow, consent test, and concrete next action without storing the intention.
- **Synthocracy:** visible proposals and voluntary support/question votes.
- **WORTH:** a non-transferable demonstration contribution signal.
- **UDS:** an inspectable eight-pillar ethics gate.
- **Trial Chamber:** repeatable reference and live-gateway conformance infrastructure.

## Research reference

The Codette-specific conformance and reasoning-matrix work in `trial-chamber/` cites the following primary publication:

> Harrison, J. (2026). Codette: a multi-perspective cognitive architecture with memory and meta-cognitive strategy evolution. *Scientific Reports*. https://doi.org/10.1038/s41598-026-64449-0

The paper is cited as the external source for Codette's described architecture. This citation does not imply that the author, journal, or publisher endorses Node Zero or its conformance claims.

## Genesis connection

```text
Mobile or desktop browser
        ↓
Synthsara Node Zero
        ↓  same origin
/api/genesis
        ↓  private server-to-server request
Genesis O-Series Gate 0
        ↓
Response + non-persistent Witness Receipt
```

The proxy defaults to:

```text
https://genesis-seven-bice.vercel.app
```

A deployment may override that target with the trusted server-side environment variable `GENESIS_BASE_URL`. The value is never accepted from a browser request.

## Project structure

```text
synthsara-node-zero/
├── .github/workflows/
│   ├── diamond-flame-conformance.yml
│   ├── diamond-flame-live-gateway.yml
│   └── quality.yml
├── api/
│   └── genesis.js
├── scripts/
│   ├── build.mjs
│   ├── check.mjs
│   └── serve.mjs
├── src/
│   ├── app.js
│   ├── genesis-bridge.css
│   ├── genesis-bridge.js
│   └── styles.css
├── tests/
│   └── genesis-proxy.test.mjs
├── trial-chamber/
├── index.html
├── package.json
├── vercel.json
└── README.md
```

## Requirements

- Node.js 20.11 or newer
- npm 10 or newer

There are no third-party runtime or development dependencies in Node Zero.

## Run locally

```bash
npm run dev
```

The local static server listens on `http://127.0.0.1:4173` by default. It does not emulate the Vercel serverless route, so the Sarah Mirror intentionally reports **Local mirror active** and exercises its private fallback.

## Validate and build

```bash
npm test
npm run build
npm run preview
```

- `npm test` enforces structural, privacy, security, accessibility, and Genesis proxy contracts.
- `npm run build` creates a deterministic static bundle in `dist/`.
- `npm run preview` serves the static production bundle with security headers and local Mirror fallback.

GitHub Actions runs the same tests and production build for pull requests and branch pushes.

## Deploy to Vercel

Import the repository as a new Vercel project. The committed `vercel.json` runs `npm run build`, serves `dist/`, deploys `api/genesis.js` as the same-origin function, and adds HTTP security headers.

No secret is required for the current public Genesis shadow gateway. A later authenticated gateway should store its credential only as a Vercel server-side environment variable and must never expose it to browser JavaScript.

## Security and privacy model

The browser's `localStorage` is convenient and inspectable, but it is not encrypted and is accessible to JavaScript running on the same origin. Do not treat Node Zero as a secure vault for sensitive production data.

The local Witness Layer is append-only through the application interface, but browser developer access can alter local storage. Its JSON export is an audit artifact, not a signed or immutable ledger.

The Genesis proxy is transport glue, not an identity system. It creates fresh request and session UUIDs for each message, forwards only the current message and selected persona, applies a bounded timeout, and returns the upstream status without persisting content.

## Production boundary

The next phase still requires:

1. authenticated sovereign identity;
2. client-side encrypted user vaults;
3. signed, hash-chained Witness events;
4. persistent proposal and governance services;
5. peer evidence and anti-capture checks for WORTH;
6. authenticated model-provider and gateway credentials;
7. threat modeling and independent UDS testing.

Until those controls exist, Node Zero remains a functional proof node rather than a production identity, vault, ledger, or decentralized governance network.