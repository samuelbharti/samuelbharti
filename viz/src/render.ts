// Reads the cached portfolio data and writes all SVG variants to assets/viz.
// Pure and deterministic: same input JSON always produces identical bytes,
// which is what lets the nightly Action skip commits when nothing changed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { themes } from "./lib/theme.js";
import { renderCircos } from "./renderers/circos.js";
import { renderGenome } from "./renderers/genome.js";
import { renderVolcano } from "./renderers/volcano.js";
import type { Portfolio } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataFile = join(here, "..", "data", "portfolio.json");
const outDir = join(here, "..", "..", "assets", "viz");

const renderers = {
  genome: renderGenome,
  circos: renderCircos,
  volcano: renderVolcano,
} as const;

const data = JSON.parse(readFileSync(dataFile, "utf8")) as Portfolio;
mkdirSync(outDir, { recursive: true });

for (const [name, render] of Object.entries(renderers)) {
  for (const theme of themes) {
    const file = join(outDir, `${name}-${theme.name}.svg`);
    writeFileSync(file, render(data, theme));
    console.log(`Wrote ${file}`);
  }
}
