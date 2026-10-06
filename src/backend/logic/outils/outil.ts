// src/backend/logic/outils/outil.ts
// Forme commune des outils : un nom, une description écrite pour un modèle, le schéma Zod de ses paramètres et de son
// résultat, et une fonction pure qui l'exécute sur une session. Les paramètres sont validés avant chaque exécution.

import { z } from "zod"
import type { SessionState } from "../../../types.js"

/** Ce que rend un outil : le résultat, destiné au modèle, et pour `appliquer_proposition` seulement, la session modifiée, destinée à l'hôte. */
export interface Execution<R> {
  resultat: R
  nouvelleSession?: SessionState
}

export interface DefinitionOutil<P extends z.ZodType, R extends z.ZodType> {
  /** Nom de l'outil, en minuscules et tirets bas (serveur MCP, appels d'outils des fournisseurs). */
  nom: string
  /** Titre court, affiché par les clients qui le montrent. */
  titre: string
  /** Ce que fait l'outil, quand s'en servir, les unités et les limites : c'est tout ce que le modèle en sait. */
  description: string
  parametres: P
  resultat: R
  /** Vrai si l'outil ne fait que lire la session ; une proposition non plus ne la modifie pas, seule son application le fait. */
  lecture: boolean
  executer(session: SessionState, parametres: z.output<P>): Execution<z.input<R>>
}

/** Un outil du catalogue, ses types effacés : il valide lui-même ses paramètres. */
export interface Outil {
  nom: string
  titre: string
  description: string
  parametres: z.ZodType
  resultat: z.ZodType
  lecture: boolean
  /** Valide les paramètres puis exécute l'outil ; lève une `ErreurOutil` ou une `ParametresInvalides`. */
  executer(session: SessionState, parametres: unknown): Execution<unknown>
}

/** Paramètres refusés par leur schéma : le message liste chaque problème, avec son chemin. */
export class ParametresInvalides extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ParametresInvalides"
  }
}

const messagesEnFrancais = z.locales.fr().localeError

/**
 * Le message d'un problème, complété de ce qu'un modèle doit savoir pour corriger son appel : les valeurs permises
 * d'un discriminant (« cible », « type »), et l'écriture d'un nombre quand il a envoyé un texte (« 1 200,50 € »).
 */
function messageDuProbleme(issue: z.core.$ZodIssue): string {
  if (issue.code === "invalid_union" && "options" in issue && Array.isArray(issue.options) && issue.options.length > 0) {
    return `${issue.message} : valeurs permises ${issue.options.map(o => `« ${String(o)} »`).join(", ")}.`
  }
  if (issue.code === "invalid_type" && issue.expected === "number" && issue.message.includes("chaîne")) {
    return `${issue.message}. Écrivez un nombre JSON, sans guillemets, espace ni symbole : 1200.5, pas « 1 200,50 € ».`
  }
  return issue.message
}

/** Les problèmes d'une validation, un par ligne : « operations.0.montant : … ». */
export function problemes(erreur: z.ZodError): string {
  return erreur.issues.map(issue => `- ${issue.path.length > 0 ? issue.path.join(".") : "(racine)"} : ${messageDuProbleme(issue)}`).join("\n")
}

/** Valide une valeur avec un schéma, messages en français ; lève `ParametresInvalides` si elle est refusée. */
export function valider<S extends z.ZodType>(schema: S, valeur: unknown, quoi: string): z.output<S> {
  const verdict = schema.safeParse(valeur, { error: messagesEnFrancais })
  if (verdict.success) return verdict.data
  throw new ParametresInvalides(`${quoi} invalides :\n${problemes(verdict.error)}`)
}

export function definirOutil<P extends z.ZodType, R extends z.ZodType>(definition: DefinitionOutil<P, R>): Outil {
  return {
    ...definition,
    executer: (session, parametres) => definition.executer(session, valider(definition.parametres, parametres ?? {}, `Paramètres de ${definition.nom}`))
  }
}

/** Le résultat seul, pour les outils qui ne modifient pas la session. */
export const resultatSeul = <R>(resultat: R): Execution<R> => ({ resultat })
