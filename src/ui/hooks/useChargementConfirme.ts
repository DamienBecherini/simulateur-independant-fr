// src/ui/hooks/useChargementConfirme.ts
// Charger une situation type depuis « Par où commencer ? » (fenêtre, bloc de la page) : confirmé quand la simulation en
// cours serait perdue, puis, depuis une question, la zone de la page qui y répond (allerALaReponse.ts).

import { useRef, useState } from "react"
import type { Ancre } from "@/lib/ancres"
import type { MontageType } from "@/lib/montages/montages"
import { allerALaReponse } from "../allerALaReponse"

/**
 * @param avantDeCharger appelé juste avant le chargement (la fenêtre se ferme).
 * @returns la situation qui attend sa confirmation, le bouton qui l'a demandée (le focus y revient sur « Annuler »),
 * et les actions : demander le chargement, le faire (après confirmation), l'annuler.
 */
export function useChargementConfirme(confirmationNecessaire: boolean, onCharger: (montage: MontageType) => void, avantDeCharger?: () => void) {
  const [aConfirmer, setAConfirmer] = useState<{ montage: MontageType; reponse?: Ancre } | null>(null)
  const declencheur = useRef<HTMLElement | null>(null)
  const charger = (montage: MontageType, reponse?: Ancre) => {
    setAConfirmer(null)
    avantDeCharger?.()
    onCharger(montage)
    if (reponse) allerALaReponse(reponse)
  }
  const demander = (montage: MontageType, reponse?: Ancre) => {
    if (!confirmationNecessaire) return charger(montage, reponse)
    declencheur.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAConfirmer({ montage, reponse })
  }
  return { aConfirmer, declencheur, charger, demander, annuler: () => setAConfirmer(null) }
}
