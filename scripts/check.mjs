import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = ["index.html", "src/styles.css", "src/app.js"];

for (const file of requiredFiles) {
  await access(file, constants.R_OK);
}

const [html, css, javascript] = await Promise.all(
  requiredFiles.map((file) => readFile(file, "utf8")),
);

const checks = [
  {
    name: "strict Content Security Policy is present",
    pass: html.includes("Content-Security-Policy") && html.includes("default-src 'self'"),
  },
  {
    name: "styles are external",
    pass: !/<style(?:\s|>)/i.test(html) && html.includes("/src/styles.css"),
  },
  {
    name: "JavaScript is external and modular",
    pass: !/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && html.includes('type="module"'),
  },
  {
    name: "no inline style attributes",
    pass: !/\sstyle\s*=/i.test(html),
  },
  {
    name: "no third-party font or asset requests",
    pass: !/https?:\/\//i.test(html) && !/@import\s+url\(/i.test(css),
  },
  {
    name: "no unsafe HTML injection APIs",
    pass:
      !/\.innerHTML\s*=/i.test(javascript) &&
      !/insertAdjacentHTML\s*\(/i.test(javascript) &&
      !/document\.write\s*\(/i.test(javascript),
  },
  {
    name: "private content is not persisted in RTME or Mirror events",
    pass:
      javascript.includes("A private reflection was generated locally.") &&
      javascript.includes("A private intention was structured locally."),
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
    pass: javascript.includes("[key, false]"),
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
  console.log("\nAll Node Zero structural, privacy, and accessibility checks passed.");
}
