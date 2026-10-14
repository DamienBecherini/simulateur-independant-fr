// src/ui/hooks/usePropositionsEnAttente.ts
// Les propositions d'un client d'IA en attente dans la boîte aux propositions (voir l'ADR 011) : lues au démarrage,
// puis tenues à jour par le process principal. Dans la démo web, la liste reste vide.
// Le hook retient aussi lesquelles sont arrivées pendant que l'utilisateur laissait l'IA modifier directement la
// simulation (addendum du 2026-10-14) : seules celles-là peuvent s'appliquer sans relecture. Celles qui attendaient
// déjà au démarrage, ou à l'activation, restent à relire : elles peuvent venir d'une autre conversation.

import { useCallback, useEffect, useRef, useState } from "react"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"

const AUCUNE: PropositionRecue[] = []

/**
 * @param sessionChargee Faux tant que la session enregistrée n'est pas chargée : aucune proposition n'est rendue, car
 * sur la session vierge provisoire elle paraîtrait périmée.
 * @param iaModifieDirectement Vrai si l'utilisateur laisse l'IA modifier directement la simulation.
 */
export function usePropositionsEnAttente(sessionChargee: boolean, iaModifieDirectement: boolean) {
  const [propositions, setPropositions] = useState<PropositionRecue[]>([])
  // Les identifiants des propositions arrivées en modification directe, pas encore relues.
  const [arriveesEnDirect, setArriveesEnDirect] = useState<ReadonlySet<string>>(new Set())
  const enDirect = useRef(iaModifieDirectement)
  useEffect(() => {
    enDirect.current = iaModifieDirectement
  }, [iaModifieDirectement])

  useEffect(() => {
    let actif = true
    // Le critère est l'arrivée vue par l'interface, pas la date du fichier (l'horloge du serveur peut différer) : une
    // proposition est « arrivée en direct » si elle apparaît dans la boîte après sa lecture au démarrage, le mode
    // direct étant actif à cet instant. Avant cette lecture, tout ce qui se présente est tenu pour déjà là.
    const connues = new Set<string>()
    let boiteLue = false
    const recevoir = (liste: PropositionRecue[]) => {
      const nouvelles = liste.map(p => p.id).filter(id => !connues.has(id))
      for (const id of nouvelles) connues.add(id)
      if (boiteLue && enDirect.current && nouvelles.length > 0) setArriveesEnDirect(ids => new Set([...ids, ...nouvelles]))
      setPropositions(liste)
    }
    // On s'abonne avant de lire la liste : une proposition déposée entre les deux n'est pas perdue.
    const desabonner = window.api.onPropositionsEnAttente(liste => {
      if (actif) recevoir(liste)
    })
    window.api
      .propositionsEnAttente()
      .then(liste => {
        if (!actif) return
        for (const p of liste) connues.add(p.id)
        boiteLue = true
        setPropositions(liste)
      })
      .catch(erreur => console.error("Propositions en attente illisibles :", erreur))
    return () => {
      actif = false
      desabonner()
    }
  }, [])

  const oublierEnDirect = useCallback((ids: readonly string[]) => {
    setArriveesEnDirect(actuels => (ids.some(id => actuels.has(id)) ? new Set([...actuels].filter(id => !ids.includes(id))) : actuels))
  }, [])

  /** Retire une proposition traitée (appliquée ou refusée) : de l'écran tout de suite, puis de la boîte. */
  const retirer = useCallback(
    (id: string) => {
      setPropositions(liste => liste.filter(p => p.id !== id))
      oublierEnDirect([id])
      window.api.retirerProposition(id).catch(erreur => console.error("Proposition impossible à retirer :", erreur))
    },
    [oublierEnDirect]
  )

  /** Des propositions arrivées en direct mais inapplicables (périmées, refusées) : elles passent en relecture, pour de bon. */
  const garderEnRelecture = oublierEnDirect

  return { propositions: sessionChargee ? propositions : AUCUNE, retirer, arriveesEnDirect, garderEnRelecture }
}
