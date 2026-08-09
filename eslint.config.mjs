import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "coverage/**"] },
  { ...eslint.configs.recommended, languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  ...tseslint.configs.recommendedTypeChecked,
  { files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "vitest.config.ts"], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { files: ["**/*.mjs"], ...tseslint.configs.disableTypeChecked },
);
