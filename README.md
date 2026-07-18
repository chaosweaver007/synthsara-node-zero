# Synthsara Node Zero

A public, local-first proof node for Synthsara's consent, governance, WORTH, RTME, reflective interface, Universal Diamond Standard, and Witness Layer.

Node Zero is intentionally small enough to audit. It demonstrates the interaction pattern before production identity, cryptography, networking, or AI inference are introduced.

## Core guarantees in this prototype

- Consent starts **private by default**.
- Every optional data scope is granular and revocable.
- A global kill switch revokes all optional access.
- Mirror messages and RTME intentions are not persisted.
- User-originated text is rendered with DOM text nodes, not HTML injection.
- State remains in the browser's `localStorage` unless the user exports it.
- The interface makes no third-party font, analytics, or asset requests.
- A strict Content Security Policy limits the browser to same-origin resources.
- The Witness Layer clearly states that it is local and not cryptographically signed.

## Functional chambers

- **Sarah Mirror:** local ethical reflection with explicit refusal of harm, coercion, impersonation, and consent bypass.
- **Consent Vault:** granular permissions and one-click global revocation.
- **Witness Layer:** application-controlled local event history with JSON export.
- **RTME:** transforms an intention into a vow, consent test, and concrete next action without storing the intention.
- **Synthocracy:** visible proposals and voluntary support/question votes.
- **WORTH:** a non-transferable demonstration contribution signal.
- **UDS:** an inspectable eight-pillar ethics gate.

## Project structure

```text
synthsara-node-zero/
├── .github/workflows/quality.yml
├── scripts/check.mjs
├── src/
│   ├── app.js
│   └── styles.css
├── .gitignore
├── index.html
├── package.json
└── README.md
```

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

## Validate and build

```bash
npm run check
npm run build
npm run preview
```

`npm run check` fails when the project reintroduces inline scripts/styles, third-party asset requests, unsafe HTML injection APIs, non-private consent defaults, or missing accessibility protections.

GitHub Actions runs the same checks and production build for pull requests and branch pushes.

## Security and privacy model

This version is a browser-only prototype. `localStorage` is convenient and inspectable, but it is not encrypted and is accessible to JavaScript running on the same origin. Do not treat Node Zero as a secure vault for sensitive production data.

The local Witness Layer is append-only through the application interface, but a person with browser developer access can alter local storage. The JSON export is an audit artifact, not a signed or immutable ledger.

## Production boundary

The next phase requires:

1. authenticated sovereign identity;
2. client-side encrypted user vaults;
3. signed, hash-chained Witness events;
4. persistent proposal and governance services;
5. peer evidence and anti-capture checks for WORTH;
6. an auditable AI model gateway behind the consent interface;
7. threat modeling, dependency review, and independent UDS testing.

Until those controls exist, Node Zero must remain labeled as a functional proof node rather than a production network.
