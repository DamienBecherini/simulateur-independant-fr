// src/lib/relecture-de-proposition.ts
// Ce que l'application montre d'une proposition reçue d'un client d'IA (boîte aux propositions, voir l'ADR 011), avant
// que l'utilisateur l'applique ou la refuse. Tout est recalculé ici sur la session affichée, sans rien croire du
// fichier reçu hormis ses opérations : récapitulatif, résumé, doublons probables et effet sur le net de chaque année.

import type { SessionState } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { empreinteDeLaSession } from "@/backend/logic/outils/commun"
import { apercu as apercuDeLaProposition, presenterProposition, sessionApresLaProposition } from "@/backend/logic/outils/propositions"

export type ApercuDUneAnnee = ReturnType<typeof apercuDeLaProposition>[number]

export type Relecture =
  /** La proposition s'applique à la session affichée : voici ce qu'elle change, et la session obtenue. */
  | { etat: "applicable"; recapitulatif: string; resume: string[]; avertissements: string[]; apercu: ApercuDUneAnnee[]; nouvelleSession: SessionState }
  /** La session a changé depuis que la proposition a été construite : elle ne peut plus être appliquée. */
  | { etat: "perimee"; nombreDOperations: number }
  /** La proposition ne passe pas les vérifications des outils sur la session affichée. */
  | { etat: "refusee"; erreur: string }

/** Relit une proposition reçue sur la session affichée. Ne modifie pas la session. */
export function relireLaProposition(session: SessionState, { proposition }: PropositionRecue): Relecture {
  if (proposition.empreinteSession !== empreinteDeLaSession(session)) return { etat: "perimee", nombreDOperations: proposition.operations.length }
  try {
    const nouvelleSession = sessionApresLaProposition(session, proposition)
    return { etat: "applicable", ...presenterProposition(session, nouvelleSession, proposition.operations), nouvelleSession }
  } catch (erreur) {
    return { etat: "refusee", erreur: erreur instanceof Error ? erreur.message : String(erreur) }
  }
}
