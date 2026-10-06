// src/web/outils-ia.testing.ts
// Aides des tests des outils pour les clients d'IA (src/backend/logic/outils), exercés sur la simulation d'exemple
// de la démo web et sur les montages types.

import { expect } from "vitest"
import type { SessionState } from "@/types"
import { executerOutil, OUTILS } from "@/backend/logic/outils/catalogue"

/** Gèle un objet en profondeur : un outil qui tenterait de modifier la session lèverait une erreur. */
export function geler<T>(valeur: T): T {
  if (valeur && typeof valeur === "object") {
    Object.values(valeur).forEach(geler)
    Object.freeze(valeur)
  }
  return valeur
}

/** Appelle un outil qui doit réussir ; vérifie son résultat avec son propre schéma, et qu'il passe tel quel en JSON. */
export function appeler<T>(nom: string, session: SessionState, args: unknown = {}): T {
  const reponse = executerOutil(nom, session, args)
  if (!reponse.ok) throw new Error(`${nom} a échoué : ${reponse.erreur}`)
  const outil = OUTILS.find(o => o.nom === nom)!
  expect(outil.resultat.safeParse(reponse.resultat).success).toBe(true)
  expect(JSON.parse(JSON.stringify(reponse.resultat))).toEqual(reponse.resultat)
  return reponse.resultat as T
}

/** Appelle un outil qui doit échouer, et rend son message d'erreur. */
export function erreurDe(nom: string, session: SessionState, args: unknown = {}): string {
  const reponse = executerOutil(nom, session, args)
  if (reponse.ok) throw new Error(`${nom} aurait dû échouer`)
  return reponse.erreur
}

/** Applique une proposition qui doit réussir, et rend la nouvelle session. */
export function appliquer(session: SessionState, proposition: unknown): SessionState {
  const reponse = executerOutil("appliquer_proposition", session, { proposition })
  if (!reponse.ok || !reponse.nouvelleSession) throw new Error(`appliquer_proposition a échoué : ${reponse.ok ? "pas de session" : reponse.erreur}`)
  return reponse.nouvelleSession
}

export interface ResultatProposition {
  proposition: { empreinteSession: string; operations: { type: string }[] }
  recapitulatif: string
  resume: string[]
  avertissements: string[]
  apercu: { annee: number; netAvant: number | null; netApres: number | null; ecart: number | null; resultatConserveAvant: number | null; resultatConserveApres: number | null; erreur: string | null }[]
  nouveauxIdentifiants: { id: string; nom: string }[]
}

export const TOUTE_L_ANNEE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
