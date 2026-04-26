import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Live E2E test configuration.
 * Runs against the deployed or running instance.
 */
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
    include: ["src/**/*.live.test.ts"],
    testTimeout: 30_000,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./reports/tests/live-junit.xml",
    },
  },
});
