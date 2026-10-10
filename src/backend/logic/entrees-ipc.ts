// src/backend/logic/entrees-ipc.ts

/*
 * Paramètres reçus de l'interface par les canaux IPC (voir l'ADR 003), vérifiés par le process principal avant usage.
 * L'interface est typée, mais le process principal ne lui fait pas confiance : une page détournée pourrait appeler
 * `window.api` avec n'importe quoi. Sans Electron, pour être testé seul.
 */

import { z } from "zod"
import { FraisFonctionnementSchema, RepartitionBeneficeSchema, SessionStateSchema, type ComparaisonOptions, type FormatFichierTexte, type SessionState } from "../../types.js"

/** Paramètre refusé : l'appel IPC échoue avec ce message, sans rien faire. */
export class EntreeIpcInvalide extends Error {
  constructor(canal: string) {
    super(`${canal} : paramètres invalides.`)
    this.name = "EntreeIpcInvalide"
  }
}

/** Réglages du comparateur et de l'optimiseur : ceux de l'interface, bornés comme à l'enregistrement (ADR 009). */
export const ComparaisonOptionsSchema = z.object({
  activityId: z.string(),
  remunerationNette: z.number(),
  repartition: RepartitionBeneficeSchema,
  partBncPrestations: z.number().min(0).max(1),
  fraisFonctionnement: FraisFonctionnementSchema.optional()
}) satisfies z.ZodType<ComparaisonOptions>

/** Année d'une session à comparer ou à optimiser. */
export const AnneeSchema = z.number().int()

/** Identifiant d'une activité. */
export const IdentifiantSchema = z.string()

const FormatFichierTexteSchema = z.enum(["csv", "markdown", "json"]) satisfies z.ZodType<FormatFichierTexte>

/** Fichier texte à faire enregistrer (exports CSV et Markdown, sauvegardes groupées) ; un format inconnu est refusé. */
export const FichierTexteAEnregistrerSchema = z.object({ defaultName: z.string(), content: z.string(), format: FormatFichierTexteSchema })

/** Fichier texte à faire choisir pour l'ouvrir. */
export const FichierTexteAOuvrirSchema = z.object({ title: z.string(), format: FormatFichierTexteSchema })

/** Nom de fichier proposé par une fenêtre d'enregistrement (PDF). */
export const NomDeFichierSchema = z.string()

/**
 * Une simulation reçue de l'interface (session à enregistrer, export) : un objet avec ses acteurs, ses relations et au
 * moins une année. Le contenu de chaque élément est vérifié à part : le nettoyage de la session l'examine élément par
 * élément, et un export est relu et nettoyé à son import.
 */
export const SimulationRecueSchema = z.object({ entities: z.array(z.unknown()), relationships: z.array(z.unknown()), annees: z.array(z.unknown()).min(1) })

/** Sauvegardes à enregistrer : une liste, chacune validée ensuite comme à la lecture ; et l'option de discrétion. */
export const SauvegardesRecuesSchema = z.array(z.unknown())
export const OptionsDesSauvegardesSchema = z.object({ silencieux: z.boolean().optional() }).optional()

/**
 * Le paramètre s'il est conforme à son schéma (inconnus retirés) ; sinon l'appel est refusé.
 * @throws {EntreeIpcInvalide} Si le paramètre n'est pas conforme.
 */
export function entreeValide<T>(schema: z.ZodType<T>, valeur: unknown, canal: string): T {
  const resultat = schema.safeParse(valeur)
  if (resultat.success) return resultat.data
  console.warn(`${canal} : paramètres refusés.`, z.flattenError(resultat.error))
  throw new EntreeIpcInvalide(canal)
}

/**
 * Session reçue pour un calcul (simulation, comparateur, optimiseur, stratégies), revalidée : une session invalide est
 * remplacée par la session par défaut du schéma, et le calcul porte sur elle.
 */
export function sessionACalculer(session: unknown, canal: string): SessionState {
  const resultat = SessionStateSchema.safeParse(session)
  if (resultat.success) return resultat.data
  console.warn(`${canal} : session invalide, utilisation des valeurs par défaut du schéma`, z.flattenError(resultat.error))
  return SessionStateSchema.parse({})
}
