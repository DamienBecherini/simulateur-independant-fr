// src/backend/canaux-de-calcul.ts

/*
 * Canaux IPC des calculs : simulation de toutes les années, comparateur de statuts, optimiseur de rémunération et
 * stratégies de distribution. Chaque canal passe par `ipcMainHandle` (émetteur vérifié) ; la session est revalidée
 * (`sessionACalculer`), les réglages, l'année et l'activité vérifiés (logic/entrees-ipc.ts) : un paramètre invalide
 * fait échouer l'appel.
 */

import { estSocieteIS, type ComparaisonOptions, type SessionState, type StatutSociete } from "../types.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./logic/simulation-pluriannuelle.js"
import { comparerStrategiesDeDistribution } from "./logic/strategies-de-distribution.js"
import { AnneeSchema, ComparaisonOptionsSchema, IdentifiantSchema, entreeValide, sessionACalculer } from "./logic/entrees-ipc.js"
import { ipcMainHandle } from "./util.js"

export function declarerLesCanauxDeCalcul() {
  ipcMainHandle("simulerLesAnnees", async (session: SessionState) => simulerLesAnnees(sessionACalculer(session, "simulerLesAnnees")))

  ipcMainHandle("compareStatuts", async (session: SessionState, options: ComparaisonOptions, annee: number) =>
    comparerStatutsDeLAnnee(sessionACalculer(session, "compareStatuts"), entreeValide(ComparaisonOptionsSchema, options, "compareStatuts"), entreeValide(AnneeSchema, annee, "compareStatuts"))
  )
  // Un statut qui n'est pas une société à l'IS est optimisé comme une SASU.
  ipcMainHandle("optimiserRemuneration", async (session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number) =>
    optimiserRemunerationDeLAnnee(sessionACalculer(session, "optimiserRemuneration"), entreeValide(ComparaisonOptionsSchema, options, "optimiserRemuneration"), estSocieteIS(statut) ? statut : "SASU", entreeValide(AnneeSchema, annee, "optimiserRemuneration"))
  )
  ipcMainHandle("comparerStrategies", async (session: SessionState, activityId: string) => {
    const validee = sessionACalculer(session, "comparerStrategies")
    const activite = entreeValide(IdentifiantSchema, activityId, "comparerStrategies")
    return comparerStrategiesDeDistribution(validee, activite, validee.comparateur?.reglagesParActivite[activite])
  })
}
