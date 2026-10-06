// src/ui/hooks/usePropositionsEnAttente.ts
// Les propositions d'un client d'IA en attente dans la boîte aux propositions (voir l'ADR 011) : lues au démarrage,
// puis tenues à jour par le process principal. Dans la démo web, la liste reste vide.

import { useCallback, useEffect, useState } from "react"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"

const AUCUNE: PropositionRecue[] = []

/**
 * @param sessionChargee Faux tant que la session enregistrée n'est pas chargée : aucune proposition n'est rendue, car
 * sur la session vierge provisoire elle paraîtrait périmée.
 */
export function usePropositionsEnAttente(sessionChargee: boolean) {
  const [propositions, setPropositions] = useState<PropositionRecue[]>([])

  useEffect(() => {
    let actif = true
    // On s'abonne avant de lire la liste : une proposition déposée entre les deux n'est pas perdue.
    const desabonner = window.api.onPropositionsEnAttente(liste => setPropositions(liste))
    window.api
      .propositionsEnAttente()
      .then(liste => {
        if (actif) setPropositions(liste)
      })
      .catch(erreur => console.error("Propositions en attente illisibles :", erreur))
    return () => {
      actif = false
      desabonner()
    }
  }, [])

  /** Retire une proposition traitée (appliquée ou refusée) : de l'écran tout de suite, puis de la boîte. */
  const retirer = useCallback((id: string) => {
    setPropositions(liste => liste.filter(p => p.id !== id))
    window.api.retirerProposition(id).catch(erreur => console.error("Proposition impossible à retirer :", erreur))
  }, [])

  return { propositions: sessionChargee ? propositions : AUCUNE, retirer }
}
