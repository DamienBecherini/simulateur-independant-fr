// eslint.config.js

import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

/**
 * Motif de `no-restricted-imports` qui refuse des dossiers de src, par l'alias (« @/web/… ») ou par un chemin relatif
 * (« ../web/… », « ../../../lib/… »). « @/components/ui » n'est pas src/ui.
 */
const interdire = (dossiers, message) => ({ regex: `^(@/|(\\.\\./)+)(${dossiers.join("|")})(/|$)`, message })

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
      complexity: ["error", { max: 12 }]
    }
  },
  // Sens des dépendances entre les dossiers de src (voir documentation/GUIDE_DEVELOPPEUR.md, § 2.1), tests compris sauf
  // mention contraire. La règle lit les import et export statiques ; elle ne voit ni import() ni les chaînes de vi.mock.
  {
    // Le moteur pur ne connaît ni la logique côté interface, ni l'interface, ni la démo.
    files: ["src/backend/logic/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [interdire(["lib", "ui", "web"], "Le moteur (src/backend/logic) n'importe que src/types.ts, src/backend/regles et Zod.")] }]
    }
  },
  {
    // L'interface reçoit ce qui est propre à la démo de sa racine de composition (src/ui/plateforme.ts).
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [interdire(["web"], "L'interface n'importe pas la démo web : ce qui lui est propre passe par la plateforme (src/ui/plateforme.ts), fournie par src/web/main.tsx.")] }]
    }
  },
  {
    // La logique côté interface ne dépend ni des composants ni de la démo ; ses tests, eux, empruntent des données de
    // test (src/ui/testing, simulation d'exemple de la démo).
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [interdire(["ui", "web"], "src/lib n'importe ni l'interface (src/ui) ni la démo web (src/web).")] }]
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
      complexity: ["error", { max: 12 }]
    }
  }
)
