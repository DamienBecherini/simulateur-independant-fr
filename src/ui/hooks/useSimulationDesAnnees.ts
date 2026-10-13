// src/ui/hooks/useSimulationDesAnnees.ts
// La simulation de toutes les années de la session, recalculée peu après chaque modification, et ce qu'en lisent les
// résultats : le rapport et l'erreur de l'année affichée.

import { useCallback } from "react"
import type { SessionState, SimulationPluriannuelle } from "@/types"
import { useCalculDiffere } from "./useCalculDiffere"

/** Rapport et erreur de l'année affichée ; une simulation qui a échoué en entier donne son erreur à chaque année. */
function resultatsDeLAnnee(simulation: SimulationPluriannuelle | null, erreurDeLaSimulation: string | null, annee: number) {
  const resultat = simulation?.annees.find(a => a.annee === annee)
  return { report: resultat?.report ?? null, erreur: erreurDeLaSimulation ?? resultat?.erreur ?? null }
}

/**
 * La simulation de toutes les années (exports, synthèse des années) et les résultats de l'année affichée. En cas
 * d'échec, les résultats précédents, périmés, ne restent pas affichés.
 */
export function useSimulationDesAnnees(session: SessionState, annee: number) {
  const simuler = useCallback(() => window.api.simulerLesAnnees(session), [session])
  const { resultat: simulation, erreur: simulationError } = useCalculDiffere(simuler, { echec: "La simulation a échoué.", effacerEnCasDEchec: true })
  const { report, erreur: erreurDeLAnnee } = resultatsDeLAnnee(simulation, simulationError, annee)
  return { simulation, simulationError, report, erreurDeLAnnee }
}
