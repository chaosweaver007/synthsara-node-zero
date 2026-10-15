import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => "tests/" + name);
if (!files.includes("tests/rtme-wire.test.mjs")) {
  throw new Error("RTME hostile wire tests are missing; no implicit exclusion allowed.");
}
const result = spawnSync(process.execPath, ["--test", ...files], {
  env: { ...process.env, RTME_WIRE_PROFILE: "release" },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
