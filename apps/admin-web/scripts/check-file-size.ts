import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "features", "lib"];
const limit = 300;
const offenders: string[] = [];

for (const root of roots) {
  walk(root);
}

if (offenders.length > 0) {
  console.error(`Files exceed ${limit} lines:\n${offenders.join("\n")}`);
  process.exit(1);
}

function walk(path: string) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(full)) {
      continue;
    }
    const lines = readFileSync(full, "utf8").split("\n").length;
    if (lines > limit) {
      offenders.push(`${full}: ${lines}`);
    }
  }
}
