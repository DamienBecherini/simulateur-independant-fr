// src/backend/logic/calculs-du-pont.ts
// Les calculs demandés par l'interface, communs aux deux ponts : le process principal d'Electron (main.ts) et la démo
// web (src/web/api-navigateur.ts). Ce qui arrive de l'interface est revalidé de la même façon des deux côtés : la
// session par le schéma, le statut à optimiser, l'identifiant de l'activité. Seuls le stockage et les fichiers
// diffèrent d'un pont à l'autre.

import { estSocieteIS, SessionStateSchema, type ComparaisonOptions, type ComparaisonResult, type OptimisationRemuneration, type SessionState, type SimulationPluriannuelle, type StatutSociete, type StrategiesDeDistribution } from "../../types.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./simulation-pluriannuelle.js"
import { comparerStrategiesDeDistribution } from "./strategies-de-distribution.js"

/** Session reçue de l'interface, revalidée avant calcul ; une session invalide est remplacée par la session par défaut. */
export function sessionRevalidee(session: unknown, appelant: string): SessionState {
  const resultat = SessionStateSchema.safeParse(session)
  if (resultat.success) return resultat.data
  console.warn(`${appelant} : session invalide, utilisation des valeurs par défaut du schéma`, resultat.error.flatten())
  return SessionStateSchema.parse({})
}

export const calculsDuPont = {
  simulerLesAnnees: (session: unknown): SimulationPluriannuelle => simulerLesAnnees(sessionRevalidee(session, "simulerLesAnnees")),

  compareStatuts: (session: unknown, options: ComparaisonOptions, annee: number): ComparaisonResult => comparerStatutsDeLAnnee(sessionRevalidee(session, "compareStatuts"), options, annee),

  /** Un statut qui n'est pas une société à l'IS est optimisé comme une SASU. */
  optimiserRemuneration: (session: unknown, options: ComparaisonOptions, statut: StatutSociete, annee: number): OptimisationRemuneration => optimiserRemunerationDeLAnnee(sessionRevalidee(session, "optimiserRemuneration"), options, estSocieteIS(statut) ? statut : "SASU", annee),

  comparerStrategies: (session: unknown, activityId: string): StrategiesDeDistribution => {
    const validee = sessionRevalidee(session, "comparerStrategies")
    const activite = String(activityId)
    return comparerStrategiesDeDistribution(validee, activite, validee.comparateur?.reglagesParActivite[activite])
  }
}
