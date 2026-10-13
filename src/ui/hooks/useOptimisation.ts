// src/ui/hooks/useOptimisation.ts

import { useCallback } from "react"
import type { ComparaisonOptions, SessionState, StatutSociete } from "@/types"
import { useCalculDiffere } from "./useCalculDiffere"

/**
 * Arbitrage rémunération / dividendes d'une activité en SASU ou en EURL, recalculé peu après chaque changement ;
 * la rémunération et la répartition choisies dans le comparateur n'y changent rien. Partagé entre la section
 * « Rémunération ou dividendes ? » et la barre de partage du bénéfice. Inactif, il ne calcule rien.
 */
export function useOptimisation(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number, actif = true) {
  const { activityId, partBncPrestations, fraisFonctionnement } = options
  const optimiser = useCallback(
    () => window.api.optimiserRemuneration(session, { activityId, partBncPrestations, fraisFonctionnement, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 } }, statut, annee),
    [session, activityId, partBncPrestations, fraisFonctionnement, statut, annee]
  )
  return useCalculDiffere(optimiser, { echec: "L'optimisation a échoué.", actif })
}
