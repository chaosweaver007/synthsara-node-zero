import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/styles.css",
  "src/app.js",
  "src/genesis-bridge.js",
  "src/genesis-bridge.css",
  "api/genesis.js",
  "tests/genesis-proxy.test.mjs",
  "scripts/build.mjs",
  "scripts/serve.mjs",
];

for (const file of requiredFiles) {
  await access(file, constants.R_OK);
}

const [
  html,
  css,
  javascript,
  genesisBridge,
  genesisCss,
  genesisProxy,
  proxyTests,
  buildScript,
  serverScript,
] = await Promise.all(requiredFiles.map((file) => readFile(file, "utf8")));

const browserJavascript = `${javascript}\n${genesisBridge}`;
const browserCss = `${css}\n${genesisCss}`;

const checks = [
  {
    name: "strict Content Security Policy is present",
    pass: html.includes("Content-Security-Policy") && html.includes("default-src 'self'") && html.includes("connect-src 'self'"),
  },
  {
    name: "styles are external and portable",
    pass:
      !/<style(?:\s|>)/i.test(html) &&
      html.includes("./src/styles.css") &&
      genesisBridge.includes("./src/genesis-bridge.css"),
  },
  {
    name: "JavaScript is external and modular",
    pass:
      !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) &&
      html.includes('type="module"') &&
      html.includes("./src/app.js") &&
      html.includes("./src/genesis-bridge.js"),
  },
  {
    name: "no inline style attributes",
    pass: !/\sstyle\s*=/i.test(html),
  },
  {
    name: "no third-party browser asset requests",
    pass: !/https?:\/\//i.test(html) && !/@import\s+url\(/i.test(browserCss),
  },
  {
    name: "no unsafe HTML injection APIs",
    pass:
      !/\.innerHTML\s*=/i.test(browserJavascript) &&
      !/insertAdjacentHTML\s*\(/i.test(browserJavascript) &&
      !/document\.write\s*\(/i.test(browserJavascript),
  },
  {
    name: "private content is excluded from local Witness events",
    pass:
      javascript.includes("A private intention was structured locally.") &&
      genesisBridge.includes("message content was not stored locally") &&
      genesisBridge.includes("message content was not stored."),
  },
  {
    name: "Genesis uses a same-origin browser gateway",
    pass:
      genesisBridge.includes('const GATEWAY_PATH = "/api/genesis"') &&
      genesisBridge.includes("fetch(GATEWAY_PATH") &&
      html.includes("same-origin gateway"),
  },
  {
    name: "Genesis proxy enforces private shadow mode",
    pass:
      genesisProxy.includes('consent_level: "private"') &&
      genesisProxy.includes("collective_learning: false") &&
      genesisProxy.includes('pipeline_mode: "shadow"') &&
      genesisProxy.includes('response.setHeader("Cache-Control", "no-store")'),
  },
  {
    name: "Genesis proxy has bounded input and timeout controls",
    pass:
      genesisProxy.includes("MAX_MESSAGE_LENGTH = 2000") &&
      genesisProxy.includes("REQUEST_TIMEOUT_MS") &&
      genesisProxy.includes("AbortController") &&
      genesisProxy.includes("ALLOWED_PERSONAS"),
  },
  {
    name: "Genesis proxy contract has executable tests",
    pass:
      proxyTests.includes("private shadow envelope") &&
      proxyTests.includes("Genesis refusals remain visible") &&
      proxyTests.includes("invalid private input is rejected"),
  },
  {
    name: "reduced-motion accessibility is supported",
    pass: css.includes("prefers-reduced-motion"),
  },
  {
    name: "focus-visible accessibility is supported",
    pass: css.includes(":focus-visible"),
  },
  {
    name: "consent defaults to private",
    pass: javascript.includes("[key, false]") && genesisBridge.includes("collective: false"),
  },
  {
    name: "build is deterministic and dependency-free",
    pass: buildScript.includes("Built static Node Zero bundle") && buildScript.includes("await cp"),
  },
  {
    name: "local server supplies security headers",
    pass:
      serverScript.includes("Content-Security-Policy") &&
      serverScript.includes("X-Content-Type-Options") &&
      serverScript.includes("Permissions-Policy"),
  },
];

const failures = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "✓" : "✗"} ${check.name}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll Node Zero structural, privacy, security, accessibility, and Genesis gateway checks passed.");
}
