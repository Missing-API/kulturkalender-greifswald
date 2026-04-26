import architectureConfig from "@schafevormfenster/eslint-config/architecture";
import cachingConfig from "@schafevormfenster/eslint-config/caching";
import loggingConfig from "@schafevormfenster/eslint-config/logging";
import nextConfig from "@schafevormfenster/eslint-config/next";
import restConfig from "@schafevormfenster/eslint-config/rest";
import vitestConfig from "@schafevormfenster/eslint-config/vitest";

export default [
  ...nextConfig,
  ...restConfig,
  ...loggingConfig,
  ...cachingConfig,
  ...architectureConfig,
  ...vitestConfig,
  {
    ignores: [".next/", "node_modules/", "reports/"],
  },  {
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      "@schafevormfenster/enforce-token-in-path": "off",
      "@schafevormfenster/enforce-api-route-structure": "warn",
      "@schafevormfenster/prefer-custom-logger": "warn",
      "@schafevormfenster/enforce-log-before-throw": "warn",
    },
  },
  {
    files: ["vitest.config.ts", "vitest.live.config.ts"],
    rules: {
      "unicorn/prefer-module": "off",
    },
  },
];
