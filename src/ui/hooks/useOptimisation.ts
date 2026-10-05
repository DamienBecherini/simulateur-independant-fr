// src/ui/hooks/useOptimisation.ts

import { useEffect, useState } from "react"
import type { ComparaisonOptions, OptimisationRemuneration, SessionState, StatutSociete } from "@/types"

/**
 * Arbitrage rémunération / dividendes d'une activité en SASU ou en EURL, recalculé peu après chaque changement ;
 * la rémunération et la répartition choisies dans le comparateur n'y changent rien. Partagé entre la section
 * « Rémunération ou dividendes ? » et la barre de partage du bénéfice. Inactif, il ne calcule rien.
 */
export function useOptimisation(session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number, actif = true) {
  const [resultat, setResultat] = useState<OptimisationRemuneration | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const { activityId, partBncPrestations, fraisFonctionnement } = options

  useEffect(() => {
    if (!actif) return
    let annule = false
    const minuteur = setTimeout(async () => {
      try {
        const optimisation = await window.api.optimiserRemuneration(session, { activityId, partBncPrestations, fraisFonctionnement, remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 } }, statut, annee)
        if (annule) return
        setResultat(optimisation)
        setErreur(null)
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : "L'optimisation a échoué.")
      }
    }, 300)
    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [session, activityId, partBncPrestations, fraisFonctionnement, statut, annee, actif])

  return { resultat, erreur }
}
