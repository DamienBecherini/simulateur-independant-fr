// src/lib/montages/confirmation.ts
// La règle commune aux entrées qui chargent une situation type (fenêtre des situations types, encart « Que voulez-vous
// savoir ? », adresse `#situation=…`) : la simulation en cours ne demande confirmation que si elle serait perdue.

import type { SessionState } from "@/types"

/**
 * Faut-il confirmer avant de remplacer la simulation en cours par une situation type ? Non si elle n'a pas de
 * modification non enregistrée (simulation vide comprise), et non plus si c'est l'exemple du premier lancement de la
 * démo, resté tel quel : il n'est le travail de personne. Le chargement reste annulable en une étape.
 */
export function confirmationDuMontageNecessaire(
  session: SessionState,
  modificationsNonEnregistrees: boolean,
  estLaSessionDExemple?: (session: SessionState) => boolean
): boolean {
  return modificationsNonEnregistrees && !(estLaSessionDExemple?.(session) ?? false)
}
