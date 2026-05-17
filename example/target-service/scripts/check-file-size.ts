import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const maxLines = 300;
const oversized: string[] = [];

walk(join(process.cwd(), "src"));

if (oversized.length > 0) {
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
    if (!path.endsWith(".ts")) {
      continue;
    }
    const lines = readFileSync(path, "utf8").split("\n").length;
    if (lines > maxLines) {
      oversized.push(`${path}: ${lines}`);
    }
  }
}
