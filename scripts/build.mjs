import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("../dist/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(new URL("../index.html", import.meta.url), new URL("index.html", outputDirectory));
await cp(new URL("../simulation.html", import.meta.url), new URL("simulation.html", outputDirectory));
await cp(new URL("../src/", import.meta.url), new URL("src/", outputDirectory), {
  recursive: true,
});

console.log("Built static Node Zero bundle in dist/.");
