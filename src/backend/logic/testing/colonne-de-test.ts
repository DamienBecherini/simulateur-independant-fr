// src/backend/logic/testing/colonne-de-test.ts

import type { RaisonDeNonRetenue, ScenarioStatut } from "../../../types.js"
import { raisonDeNonRetenue } from "../colonne-du-comparateur.js"

/** Une colonne écrite à la main dans un test, sans sa raison de non-retenue, ou avec celle que le test impose. */
export type ColonneEcriteALaMain = Omit<ScenarioStatut, "nonRetenue"> & { nonRetenue?: RaisonDeNonRetenue | null }

/**
 * Pose sur une colonne écrite à la main la raison de non-retenue que le moteur lui donnerait d'après ses champs (micro
 * hors plafond, régime fermé, portage non retenu, rémunération non couverte), sans profession. Un test qui veut une
 * autre raison (société d'exercice libéral) la donne lui-même.
 */
export function avecSaRaison(colonne: ColonneEcriteALaMain): ScenarioStatut {
  return { ...colonne, nonRetenue: colonne.nonRetenue === undefined ? raisonDeNonRetenue(colonne, null) : colonne.nonRetenue }
}
