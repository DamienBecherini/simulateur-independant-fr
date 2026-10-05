// eslint.config.js

import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", "dist-react", "dist-web", "dist-electron", "coverage", "reports", ".stryker-tmp", "**/*.d.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    },
    settings: {
      "import/resolver": {
        typescript: {}
      }
    }
  },
  {
    // Garde-fou de complexité cyclomatique sur tout le code applicatif, tests compris.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["error", { max: 15 }]
    }
  },
  {
    // Scripts Node des workflows GitHub (JavaScript sans compilation), tests compris.
    extends: [js.configs.recommended],
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      complexity: ["error", { max: 15 }]
    }
  }
)
