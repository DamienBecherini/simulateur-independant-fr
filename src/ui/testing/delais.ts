// src/ui/testing/delais.ts
// Délai des tests qui montent l'application entière, ou une grande fenêtre de réglages, et la pilotent comme un
// utilisateur (clics, saisie, listes Radix) dans le DOM simulé.

import { vi } from "vitest"

/**
 * Ces tests ne dorment presque pas (le recalcul différé est avancé par une horloge simulée quand il est attendu) : leur
 * durée est du temps de calcul, celui des rendus de React dans jsdom. Elle croît avec la charge de la machine, chaque
 * suite lançant autant de processus que de cœurs : 0,4 à 0,8 s seuls, jusqu'à 8 s avec trois suites complètes en
 * parallèle. Le délai par défaut de Vitest (5 s) les faisait échouer sans que rien ne soit faux ; 15 s gardent une
 * marge, sans laisser attendre longtemps un test vraiment bloqué. À appeler en tête du fichier : le réglage vaut pour lui seul.
 */
export function delaiDesTestsDIntegration() {
  vi.setConfig({ testTimeout: 15_000 })
}
