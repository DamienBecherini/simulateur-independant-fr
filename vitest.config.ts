// vitest.config.ts

import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // La couverture ne porte que sur la logique pure : moteur fiscal et utilitaires de l'interface.
      include: ["src/backend/logic/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "src/backend/logic/testing/**"],
      // Seuils bloquants, fixés à la dizaine inférieure de la couverture réellement atteinte.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  }
})
