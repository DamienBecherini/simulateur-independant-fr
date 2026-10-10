// src/backend/logic/calculs-du-pont.ts
// Les calculs demandés par l'interface, communs aux deux ponts : le process principal d'Electron (main.ts) et la démo
// web (src/web/api-navigateur.ts). Ce qui arrive de l'interface est vérifié de la même façon des deux côtés : la
// session est revalidée par le schéma (invalide, elle est remplacée par la session par défaut), les réglages, l'année et
// l'activité par les schémas des entrées IPC (invalides, l'appel échoue : `EntreeIpcInvalide`), et un statut à
// optimiser qui n'est pas une société à l'IS est ramené à la SASU. Seuls le stockage et les fichiers diffèrent d'un
// pont à l'autre.

import { estSocieteIS, SessionStateSchema, type ComparaisonOptions, type ComparaisonResult, type OptimisationRemuneration, type SessionState, type SimulationPluriannuelle, type StatutSociete, type StrategiesDeDistribution } from "../../types.js"
import { AnneeSchema, ComparaisonOptionsSchema, entreeValide, IdentifiantSchema } from "./entrees-ipc.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./simulation-pluriannuelle.js"
import { comparerStrategiesDeDistribution } from "./strategies-de-distribution.js"

/** Session reçue de l'interface, revalidée avant calcul ; une session invalide est remplacée par la session par défaut. */
export function sessionRevalidee(session: unknown, appelant: string): SessionState {
  const resultat = SessionStateSchema.safeParse(session)
  if (resultat.success) return resultat.data
  console.warn(`${appelant} : session invalide, utilisation des valeurs par défaut du schéma`, resultat.error.flatten())
  return SessionStateSchema.parse({})
}

/**
 * Les quatre calculs, nommés comme les canaux de `window.api`.
 * @throws {EntreeIpcInvalide} Si les réglages, l'année ou l'activité ne sont pas conformes à leur schéma.
 */
export const calculsDuPont = {
  simulerLesAnnees: (session: unknown): SimulationPluriannuelle => simulerLesAnnees(sessionRevalidee(session, "simulerLesAnnees")),

  compareStatuts: (session: unknown, options: ComparaisonOptions, annee: number): ComparaisonResult =>
    comparerStatutsDeLAnnee(sessionRevalidee(session, "compareStatuts"), entreeValide(ComparaisonOptionsSchema, options, "compareStatuts"), entreeValide(AnneeSchema, annee, "compareStatuts")),

  optimiserRemuneration: (session: unknown, options: ComparaisonOptions, statut: StatutSociete, annee: number): OptimisationRemuneration =>
    optimiserRemunerationDeLAnnee(sessionRevalidee(session, "optimiserRemuneration"), entreeValide(ComparaisonOptionsSchema, options, "optimiserRemuneration"), estSocieteIS(statut) ? statut : "SASU", entreeValide(AnneeSchema, annee, "optimiserRemuneration")),

  comparerStrategies: (session: unknown, activityId: string): StrategiesDeDistribution => {
    const validee = sessionRevalidee(session, "comparerStrategies")
    const activite = entreeValide(IdentifiantSchema, activityId, "comparerStrategies")
    return comparerStrategiesDeDistribution(validee, activite, validee.comparateur?.reglagesParActivite[activite])
  }
}
