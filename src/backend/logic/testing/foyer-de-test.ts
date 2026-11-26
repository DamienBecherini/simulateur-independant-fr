// src/backend/logic/testing/foyer-de-test.ts

import type { EpargneRetraiteDuFoyer } from "../../../types.js"

/** L'épargne retraite d'un foyer écrit à la main pour un test, qui n'en dit rien : aucune personne, aucun versement. */
export const SANS_EPARGNE_RETRAITE: EpargneRetraiteDuFoyer = { trancheMarginale: 0, partDesRevenus: 0.1, personnes: [] }
