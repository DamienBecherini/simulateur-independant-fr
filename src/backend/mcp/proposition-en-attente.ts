// src/backend/mcp/proposition-en-attente.ts
// La boîte aux propositions (voir l'ADR 011) : le serveur MCP n'écrit jamais la session. Il dépose chaque proposition
// à appliquer dans le dossier `propositions` du dossier de données ; l'application la lit, la montre à l'utilisateur,
// et ne l'applique qu'avec son accord. Ce module, sans accès au disque, fixe les noms et le format du fichier, partagés
// par le serveur, le process principal et l'interface.

import { z } from "zod"
import { PropositionSchema, type Proposition } from "../logic/outils/propositions.js"

/** Le fichier de la session, écrit par l'application dans son dossier de données (main.ts). */
export const FICHIER_DE_LA_SESSION = "sessionState.json"

/** Le dossier des propositions en attente, dans le dossier de données. */
export const DOSSIER_DES_PROPOSITIONS = "propositions"

/** Taille maximale d'un fichier de proposition : 200 opérations tiennent en moins de 100 Ko. */
export const TAILLE_MAX_D_UNE_PROPOSITION = 512 * 1024

/** Nom d'un fichier de proposition : lettres, chiffres, tirets, sans chemin ni point caché, extension `.json`. */
export const NOM_DE_PROPOSITION = /^[A-Za-z0-9_-]{1,100}\.json$/

const FORMAT = "simulateur-independant-fr/proposition"

/** Le contenu d'un fichier de proposition. Toute autre clé le fait refuser. */
export const PropositionEnAttenteSchema = z.strictObject({
  format: z.literal(FORMAT),
  version: z.literal(1),
  creeeLe: z.iso.datetime(),
  proposition: PropositionSchema
})

export type PropositionEnAttente = z.infer<typeof PropositionEnAttenteSchema>

/** Une proposition lue dans la boîte, telle que l'interface la reçoit : son identifiant est le nom du fichier. */
export interface PropositionRecue {
  id: string
  creeeLe: string
  proposition: Proposition
}

/** Le texte du fichier d'une proposition, déposé par le serveur MCP. */
export function contenuDUnePropositionEnAttente(proposition: Proposition, creeeLe: Date): string {
  const fichier: PropositionEnAttente = { format: FORMAT, version: 1, creeeLe: creeeLe.toISOString(), proposition }
  return JSON.stringify(fichier, null, 2)
}

/** Nom du fichier d'une proposition : l'horodatage d'abord, pour qu'elles se lisent dans l'ordre, puis un suffixe unique. */
export function nomDUnePropositionEnAttente(creeeLe: Date, suffixe: string): string {
  return `${creeeLe.toISOString().replace(/[:.]/g, "-")}-${suffixe.replace(/[^A-Za-z0-9]/g, "").slice(0, 12)}.json`
}

/** Lit le texte d'un fichier de proposition ; `null` s'il n'est pas du JSON ou ne suit pas le format. */
export function lireUnePropositionEnAttente(contenu: string): PropositionEnAttente | null {
  try {
    const verdict = PropositionEnAttenteSchema.safeParse(JSON.parse(contenu))
    return verdict.success ? verdict.data : null
  } catch {
    return null
  }
}
