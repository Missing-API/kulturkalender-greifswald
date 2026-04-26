import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(currentDir, "./src"),
      "@schafevormfenster/data-text-mapper": path.resolve(
        currentDir,
        "node_modules/@schafevormfenster/data-text-mapper/src/index.ts"
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.live.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "cobertura"],
      reportsDirectory: "./reports/coverage",
    },
    reporters: ["default", "junit", "json", "html"],
    outputFile: {
      junit: "./reports/tests/junit.xml",
      json: "./reports/tests/results.json",
      html: "./reports/tests/index.html",
    },
  },
});
