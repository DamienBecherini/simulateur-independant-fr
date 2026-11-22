// src/lib/questions-de-depart.ts
// « Par où commencer ? » dans la page (src/ui/components/ParOuCommencer.tsx) : quand il s'affiche. Les questions elles-
// mêmes sont celles des situations types (src/lib/montages/montages.ts), chacune avec la zone de la page qui y répond.

import type { SessionState, UserPreferences } from "@/types"

/** Identifiant du bouton « + Ajouter une personne » : « Partir de zéro » y porte le focus. */
export const ID_DE_L_AJOUT_D_UNE_PERSONNE = "ajouter-une-personne"

/** Identifiants des deux entrées de la barre d'outils vers « Par où commencer ? » : « Situations types » sur un écran
 *  large, « Plus d'actions » sur un téléphone. « Partir de zéro » signale celle qui est affichée. */
export const ID_DU_BOUTON_DES_SITUATIONS = "bouton-des-situations-types"
export const ID_DU_MENU_PLUS_D_ACTIONS = "menu-plus-d-actions"

/**
 * « Par où commencer ? » s'affiche dans la page sur une simulation vide ou sur l'exemple du premier lancement (démo
 * web), tant que l'utilisateur ne l'a pas fermé ; jamais avant le chargement de la session et des préférences.
 */
export function avecLesQuestions(session: SessionState, fermees: UserPreferences["questionsFermees"], sessionChargee: boolean, estLaSessionDExemple?: (session: SessionState) => boolean): boolean {
  if (!sessionChargee || fermees) return false
  return session.entities.length === 0 || (estLaSessionDExemple?.(session) ?? false)
}
