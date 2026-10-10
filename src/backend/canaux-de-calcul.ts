// src/backend/canaux-de-calcul.ts

/*
 * Canaux IPC des calculs : simulation de toutes les années, comparateur de statuts, optimiseur de rémunération et
 * stratégies de distribution. Chaque canal passe par `ipcMainHandle` (émetteur vérifié) et confie le calcul à
 * `calculsDuPont` (logic/calculs-du-pont.ts), commun avec la démo web : la session y est revalidée, et les réglages,
 * l'année et l'activité vérifiés par les schémas de logic/entrees-ipc.ts (un paramètre invalide fait échouer l'appel).
 */

import type { ComparaisonOptions, SessionState, StatutSociete } from "../types.js"
import { calculsDuPont } from "./logic/calculs-du-pont.js"
import { ipcMainHandle } from "./util.js"

export function declarerLesCanauxDeCalcul() {
  ipcMainHandle("simulerLesAnnees", async (session: SessionState) => calculsDuPont.simulerLesAnnees(session))
  ipcMainHandle("compareStatuts", async (session: SessionState, options: ComparaisonOptions, annee: number) => calculsDuPont.compareStatuts(session, options, annee))
  ipcMainHandle("optimiserRemuneration", async (session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number) => calculsDuPont.optimiserRemuneration(session, options, statut, annee))
  ipcMainHandle("comparerStrategies", async (session: SessionState, activityId: string) => calculsDuPont.comparerStrategies(session, activityId))
}
