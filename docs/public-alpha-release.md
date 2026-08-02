# Node Zero v0.3 Public Alpha Release Gate

This checklist turns a repository build into a publicly reviewable Synthsara Node Zero deployment without silently widening the prototype's claims.

## Release boundary

Node Zero v0.3 is a functional proof node. It is not yet a production identity provider, encrypted sovereign vault, immutable ledger, decentralized governance network, or validated WORTH economy.

A public deployment may be promoted as **Public Alpha** only after the strict deployment-conformance workflow passes against its final HTTPS URL.

## 1. Deploy the repository

Import `chaosweaver007/synthsara-node-zero` into Vercel from the `main` branch.

The committed `vercel.json` must remain authoritative:

- build command: `npm run build`
- output directory: `dist`
- same-origin function: `api/genesis.js`
- function duration: 15 seconds
- security headers: CSP, nosniff, frame denial, no-referrer, and restricted permissions

The public Genesis shadow gateway requires no secret. A future authenticated Genesis endpoint must be configured only through the server-side `GENESIS_BASE_URL` environment variable.

## 2. Run deployment conformance

In GitHub Actions, run **Node Zero deployment conformance** manually.

Inputs:

- `public_url`: the final HTTPS deployment origin
- `allow_degraded_gateway`: leave `false` for release certification

The strict gate verifies:

1. the root route returns HTML over HTTPS;
2. required Node Zero interface markers are present;
3. the deployed security headers preserve the committed privacy boundary;
4. `/api/genesis` returns JSON with `Cache-Control: no-store`;
5. the gateway identifies `synthsara-node-zero` and the `same-origin-private-proxy` route;
6. response sizes remain bounded;
7. the full repository test suite and deterministic build still pass.

The workflow uploads `deployment-conformance-report.json` as a 90-day audit artifact.

`allow_degraded_gateway=true` is diagnostic only. It permits a bounded 502 or 504 response from Genesis so the deployment shell can be inspected during an upstream outage. A degraded result must not certify the Public Alpha release.

## 3. Perform the mobile encounter test

Using a clean mobile browser session:

- open the final public URL;
- confirm the navigation opens and all chambers remain reachable;
- verify every optional consent scope begins disabled;
- use the global revocation control;
- confirm the Sarah Mirror reports the live gateway or an explicit local fallback;
- verify Mirror text and RTME intention text do not appear in the local Witness Layer;
- export the Witness Layer and inspect the JSON;
- confirm no third-party fonts, analytics, or browser assets are requested.

## 4. Promote the URL

Only after the strict workflow and mobile encounter test pass:

- add the public URL to the repository README;
- add an **Enter Node Zero** link to Synthsara.org;
- preserve the proof-node boundary beside the link;
- record the workflow run and conformance artifact in the release notes.

## 5. Public Alpha completion condition

A visitor can open one URL, understand the privacy boundary, enter the Mirror, inspect consent, explore RTME, Synthocracy, WORTH, UDS, and the Witness Layer, and distinguish implemented behavior from simulation and future architecture.
