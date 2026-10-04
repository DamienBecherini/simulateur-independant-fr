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
    // Deux projets : la logique pure tourne sous Node, les composants React dans un DOM simulé (jsdom).
    projects: [
      {
        extends: true,
        test: {
          name: "logique",
          environment: "node",
          include: ["src/**/*.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "interface",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["src/ui/testing/setup.ts"]
        }
      }
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // La couverture ne porte que sur la logique pure : moteur fiscal et utilitaires de l'interface.
      // Les composants sont vérifiés par leurs tests, sans seuil chiffré.
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
