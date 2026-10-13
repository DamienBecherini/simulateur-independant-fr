// src/ui/hooks/useCalculDiffere.ts
// Un calcul du moteur relancé peu après chaque modification : la simulation des années, la comparaison des statuts,
// l'arbitrage rémunération / dividendes et les stratégies sur toutes les années. Une rafale de frappes ne lance qu'un
// calcul, et un résultat arrivé après une nouvelle modification est ignoré : seul le dernier calcul demandé s'affiche.

import { useEffect, useState } from "react"

/** Délai d'inactivité avant de relancer le calcul, en millisecondes. */
export const DELAI_DU_CALCUL = 300

interface OptionsDuCalcul {
  /** Message affiché quand le calcul échoue sans message (une valeur levée qui n'est pas une `Error`). */
  echec: string
  /** Faux : rien n'est calculé, le dernier résultat reste. Vrai par défaut. */
  actif?: boolean
  /**
   * En cas d'échec, efface aussi le dernier résultat (la simulation, dont les résultats périmés seraient trompeurs) ;
   * sinon, il reste affiché avec l'erreur (comparateur, arbitrage, stratégies). Faux par défaut.
   */
  effacerEnCasDEchec?: boolean
}

interface EtatDuCalcul<T> {
  resultat: T | null
  erreur: string | null
}

/**
 * Le résultat de `calcul`, relancé `DELAI_DU_CALCUL` ms après chaque changement de `calcul` : l'appelant le mémorise
 * (`useCallback`) avec ses entrées, que la règle des dépendances de React vérifie chez lui.
 */
export function useCalculDiffere<T>(calcul: () => Promise<T>, { echec, actif = true, effacerEnCasDEchec = false }: OptionsDuCalcul): EtatDuCalcul<T> {
  const [etat, setEtat] = useState<EtatDuCalcul<T>>({ resultat: null, erreur: null })

  useEffect(() => {
    if (!actif) return
    let annule = false
    const minuterie = setTimeout(async () => {
      try {
        const resultat = await calcul()
        if (!annule) setEtat({ resultat, erreur: null })
      } catch (e) {
        const erreur = e instanceof Error ? e.message : echec
        if (!annule) setEtat(precedent => ({ resultat: effacerEnCasDEchec ? null : precedent.resultat, erreur }))
      }
    }, DELAI_DU_CALCUL)
    return () => {
      annule = true
      clearTimeout(minuterie)
    }
  }, [calcul, actif, echec, effacerEnCasDEchec])

  return etat
}
