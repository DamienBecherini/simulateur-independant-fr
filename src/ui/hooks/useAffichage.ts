// src/ui/hooks/useAffichage.ts
// Affichage choisi (bêta), transmis aux composants qui se présentent autrement selon l'affichage.

import { createContext, useContext } from "react"
import { AFFICHAGE_PAR_DEFAUT } from "@/lib/affichage"
import type { Affichage } from "@/types"

export const AffichageContext = createContext<Affichage>(AFFICHAGE_PAR_DEFAUT)

/** L'affichage en cours ; « classique » hors de tout fournisseur (tests de composants isolés). */
export function useAffichage(): Affichage {
  return useContext(AffichageContext)
}

/** Vrai dans l'affichage A : résumé collant et divulgation progressive. */
export function useAffichageResume(): boolean {
  return useAffichage() === "resume"
}
