// vitest.mutation.config.ts

import { defineConfig } from "vitest/config"

// Configuration de Vitest réservée aux tests de mutation (stryker.config.json).
// Seuls les tests du moteur fiscal tournent, sous Node et sans projets : le score dit ce que ces tests-là attrapent,
// et un mutant ne paie ni les tests de l'interface (jsdom), ni ceux de src/lib, de la démo web et des scripts.
// C'est ce qui rend la durée tenable : les tests de référence calculent leurs simulations dans le corps des describe,
// si bien que deux mutants sur trois s'exécutent hors d'un test (« statiques » pour Stryker) et rejouent, chacun, tous
// les fichiers de tests liés à leur module.
// Le moteur n'importe que src/types.ts, src/backend/regles et Zod (eslint.config.js) : ni alias « @ », ni
// __APP_VERSION__ à définir ici.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/backend/logic/**/*.test.ts"]
  }
})
