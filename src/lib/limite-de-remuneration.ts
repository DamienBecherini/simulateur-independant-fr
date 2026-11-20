// src/lib/limite-de-remuneration.ts
// Ce que la fenêtre de saisie dit de la rémunération du dirigeant d'une société : ce qui est saisi sur l'année, et la
// plus haute rémunération que la société peut verser sans déficit (calculée par le moteur, voir l'ADR 019).

import type { FinancialFlow } from "@/types"
import { euros } from "@/backend/logic/format"
import { PRECISION_REMUNERATION } from "@/backend/logic/remuneration-maximale"

/** Rémunération nette du dirigeant saisie sur l'année, tous mois confondus. */
export function remunerationSaisie(fluxDeLAnnee: FinancialFlow[]): number {
  return fluxDeLAnnee.reduce((somme, flux) => (flux.type === "director_remuneration" ? somme + flux.amount : somme), 0)
}

export interface RappelDeLaLimite {
  texte: string
  /** La saisie dépasse la limite : le rappel devient une mise en garde. */
  depassee: boolean
}

/**
 * La limite, et où en est la saisie. La limite est arrondie à la centaine inférieure : une saisie ne la dépasse qu'à
 * partir de la centaine suivante, pour ne pas annoncer un déficit que le moteur ne trouvera pas.
 */
export function rappelDeLaLimite(saisie: number, limite: number): RappelDeLaLimite {
  if (limite <= 0) {
    return { texte: "Sans rémunération, l'activité est déjà déficitaire cette année : la société ne peut en verser aucune sans creuser son déficit.", depassee: saisie > 0 }
  }
  if (saisie <= 0) return { texte: `Cette année, la société peut verser au plus ${euros(limite)} nets sans déficit.`, depassee: false }
  if (saisie >= limite + PRECISION_REMUNERATION) {
    return { texte: `${euros(saisie)} nets saisis sur l'année : c'est plus que les ${euros(limite)} que la société peut verser sans déficit.`, depassee: true }
  }
  return { texte: `${euros(saisie)} nets saisis sur l'année, pour ${euros(limite)} au plus sans déficit de la société.`, depassee: false }
}
