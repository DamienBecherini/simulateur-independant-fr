// src/lib/testing/activites-sans-charge.ts
// Les exemples (démo web, montages types) saisissent les charges courantes de chaque activité : quelle que soit
// l'activité choisie dans le comparateur, l'alerte « aucune charge » ne doit pas apparaître.

import { vueDeLAnnee } from "@/backend/logic/annees"
import { AUCUNE_CHARGE } from "@/backend/logic/options-du-comparateur"
import { comparerStatutsDeLAnnee } from "@/backend/logic/simulation-pluriannuelle"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import type { SessionState } from "@/types"

/** Les activités de l'année qui, choisies dans le comparateur avec leurs réglages, l'ouvrent sur l'alerte « aucune charge ». */
export function activitesSansCharge(session: SessionState, annee: number): string[] {
  const vue = vueDeLAnnee(session, annee)
  return session.entities.filter(acteur => acteur.type !== "person").map(acteur => acteur.id).filter(id => {
    const reglages = reglagesDeLActiviteComparee(vue, { reglagesParActivite: {}, ...session.comparateur, activiteComparee: id })
    if (reglages?.activite.id !== id) throw new Error(`${id} : activité introuvable dans le comparateur`)
    return comparerStatutsDeLAnnee(session, reglages.options, annee).warnings.includes(AUCUNE_CHARGE)
  })
}
