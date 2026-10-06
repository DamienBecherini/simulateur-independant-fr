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
      },
      {
        extends: true,
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.mjs"]
        }
      }
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      // La couverture ne porte que sur la logique pure : moteur fiscal, utilitaires de l'interface, pont de la démo web
      // et scripts des retours des utilisateurs.
      // Les composants sont vérifiés par leurs tests, sans seuil chiffré.
      // Le serveur MCP et la boîte aux propositions aussi ; pas leurs points d'entrée (serveur.ts, empaquetage), vérifiés
      // par les tests de bout en bout, comme le service worker de la démo web (e2e-web/installable.web.ts).
      include: ["src/backend/logic/**/*.ts", "src/backend/mcp/**/*.ts", "src/backend/boite-aux-propositions.ts", "src/lib/**/*.ts", "src/web/**/*.ts", "scripts/**/*.mjs"],
      exclude: ["**/*.test.ts", "**/*.test.mjs", "src/backend/logic/testing/**", "src/web/*.tsx", "src/backend/mcp/serveur.ts", "src/web/pwa/service-worker.ts", "scripts/empaqueter-serveur-mcp.mjs"],
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
