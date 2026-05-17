import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const maxLines = 300;
const roots = ["app", "components", "lib"];
const extensions = new Set([".ts", ".tsx"]);
const oversized: string[] = [];

for (const root of roots) {
  walk(join(process.cwd(), root));
}

if (oversized.length) {
  console.error(`Files exceed ${maxLines} lines:\n${oversized.join("\n")}`);
  process.exit(1);
}

function walk(directory: string) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path);
      continue;
    }
    if (!extensions.has(path.slice(path.lastIndexOf(".")))) {
      continue;
    }
    const lines = readdirSafe(path);
    if (lines > maxLines) {
      oversized.push(`${path}: ${lines}`);
    }
  }
}

function readdirSafe(path: string) {
  return readFileSync(path, "utf8").split("\n").length;
}
