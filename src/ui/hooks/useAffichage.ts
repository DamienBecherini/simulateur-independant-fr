// src/ui/hooks/useAffichage.ts
// Affichage choisi (bêta), transmis aux composants qui se présentent autrement selon l'affichage.

import { createContext, useContext } from "react"
import { avecResume } from "@/lib/affichage"
import type { Affichage } from "@/types"

// Hors de tout fournisseur (tests de composants isolés), l'affichage d'origine : tout y est affiché, rien n'est replié.
export const AffichageContext = createContext<Affichage>("classique")

/** L'affichage en cours ; « classique » hors de tout fournisseur. */
export function useAffichage(): Affichage {
  return useContext(AffichageContext)
}

/** Vrai dans l'affichage A (résumé collant et divulgation progressive) et dans l'affichage B, qui s'y ajoute. */
export function useAffichageResume(): boolean {
  return avecResume(useAffichage())
}
