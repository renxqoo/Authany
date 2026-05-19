import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts"
  },
  clean: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  shims: false,
  sourcemap: false,
  splitting: false,
  target: "node18"
});
