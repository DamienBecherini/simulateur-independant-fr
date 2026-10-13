// e2e/support/installer-electron.ts
//
// Préparation globale des tests de bout en bout (`globalSetup` de playwright.config.ts), lancée une seule fois,
// avant les workers.
//
// Le paquet npm `electron` (version 44) n'a pas de script d'installation : il télécharge et décompresse son
// exécutable dans `node_modules/electron/dist` au premier `require("electron")`. Playwright fait ce `require` dans
// chaque worker, au premier `electron.launch` : juste après un `npm ci`, les trois workers décompressaient donc en même
// temps dans le même dossier, et le premier test de chacun échouait (« failed to create directory … (os error 183) »,
// « Le processus ne peut pas accéder au fichier car ce fichier est utilisé par un autre processus »). Le lancement
// suivant passait, l'exécutable étant alors en place.
//
// Ce `require` unique installe l'exécutable s'il manque, avant tout worker ; s'il est déjà là, il ne fait rien.

import { createRequire } from "node:module"

export default function installerElectron() {
  createRequire(import.meta.url)("electron")
}
