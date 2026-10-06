// src/backend/logic/outils/catalogue.ts
// Le catalogue des outils pour les clients d'IA (voir l'ADR 010) : une seule source pour le serveur MCP local et
// l'assistant intégré. Aucun transport ici : des fonctions pures, qui reçoivent la session et rendent du JSON.
//
//   catalogueDesOutils()                → { nom, titre, description, inputSchema, lecture }[] (MCP tools/list)
//   executerOutil(nom, session, args)   → { ok: true, resultat, nouvelleSession? } | { ok: false, erreur }
//
// Seul appliquer_proposition rend une `nouvelleSession` : l'hôte la montre à l'utilisateur et ne l'enregistre (comme
// une étape d'annulation) qu'avec son accord.

import { z } from "zod"
import type { SessionState } from "../../../types.js"
import { ErreurOutil } from "./commun.js"
import { comparerStatuts, optimiserRemuneration } from "./comparaison.js"
import { decrireSimulation, listerFlux, reglesDeLAnneeOutil } from "./lecture.js"
import { ParametresInvalides, type Outil } from "./outil.js"
import { appliquerProposition, proposerActeur, proposerFlux, proposerModification, proposerReglagesComparateur, proposerRelation, proposerSuppression, rafraichirProposition } from "./outils-de-proposition.js"
import { expliquerResultat, simuler, syntheseDesAnnees } from "./resultats.js"

/** Les outils, dans l'ordre où un modèle s'en sert le plus souvent : lire, calculer, proposer, appliquer. */
export const OUTILS: readonly Outil[] = [
  decrireSimulation,
  listerFlux,
  simuler,
  syntheseDesAnnees,
  expliquerResultat,
  comparerStatuts,
  optimiserRemuneration,
  reglesDeLAnneeOutil,
  proposerFlux,
  proposerActeur,
  proposerRelation,
  proposerModification,
  proposerSuppression,
  proposerReglagesComparateur,
  rafraichirProposition,
  appliquerProposition
]

export type JsonSchema = Record<string, unknown>

/**
 * Schéma JSON des paramètres d'un outil, tel qu'un client d'IA l'attend. Le schéma du résultat n'est pas publié : il
 * pesait autant que celui des paramètres, et le modèle lit les champs dans le JSON rendu (les descriptions expliquent
 * ceux qui le demandent) ; son schéma Zod sert aux tests.
 */
export function schemaJson(schema: z.ZodType): JsonSchema {
  // La version du format (« $schema ») est retirée : MCP et les fournisseurs attendent l'objet seul.
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema
  delete json.$schema
  return json
}

export interface DescriptionOutil {
  nom: string
  titre: string
  description: string
  inputSchema: JsonSchema
  /** Vrai si l'outil ne modifie jamais la session (MCP : `annotations.readOnlyHint`). */
  lecture: boolean
}

/** Le catalogue, prêt pour `tools/list` d'un serveur MCP ou les définitions d'outils d'un fournisseur. */
export function catalogueDesOutils(): DescriptionOutil[] {
  return OUTILS.map(outil => ({ nom: outil.nom, titre: outil.titre, description: outil.description, inputSchema: schemaJson(outil.parametres), lecture: outil.lecture }))
}

export type ReponseOutil = { ok: true; resultat: unknown; nouvelleSession?: SessionState } | { ok: false; erreur: string }

/**
 * Exécute un outil sur la session, avec des arguments venus du modèle (inconnus, donc validés). Ne lève jamais :
 * une erreur devient un message en français, à rendre au modèle pour qu'il corrige son appel.
 */
export function executerOutil(nom: string, session: SessionState, argumentsInconnus: unknown): ReponseOutil {
  const outil = OUTILS.find(o => o.nom === nom)
  if (!outil) return { ok: false, erreur: `Outil inconnu : « ${String(nom).slice(0, 80)} ». Outils disponibles : ${OUTILS.map(o => o.nom).join(", ")}.` }
  try {
    const { resultat, nouvelleSession } = outil.executer(session, argumentsInconnus)
    return nouvelleSession ? { ok: true, resultat, nouvelleSession } : { ok: true, resultat }
  } catch (erreur) {
    if (erreur instanceof ErreurOutil || erreur instanceof ParametresInvalides) return { ok: false, erreur: erreur.message }
    // Une erreur imprévue du moteur : le message seul, sans pile d'appels, que le modèle n'a pas à voir.
    return { ok: false, erreur: `Erreur du simulateur pendant ${nom} : ${erreur instanceof Error ? erreur.message : String(erreur)}` }
  }
}
