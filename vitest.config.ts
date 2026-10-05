// vitest.config.ts

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Version de l'application, comme dans vite.config.ts (voir src/lib/version.ts).
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
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
      // La couverture ne porte que sur la logique pure : moteur fiscal, utilitaires de l'interface et pont de la démo web.
      // Les composants sont vérifiés par leurs tests, sans seuil chiffré.
      include: ["src/backend/logic/**/*.ts", "src/lib/**/*.ts", "src/web/**/*.ts"],
      exclude: ["**/*.test.ts", "src/backend/logic/testing/**", "src/web/*.tsx"],
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
