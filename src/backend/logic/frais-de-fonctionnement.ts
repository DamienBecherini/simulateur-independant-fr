// src/backend/logic/frais-de-fonctionnement.ts

import type { ComparaisonOptions, ComparaisonResult, FraisFonctionnement, StatutCompare, StatutFrais } from "../../types.js"
import { lireMois, noteCFE, partDeCFEDue } from "./dispositifs.js"
import type { ReglesFiscales } from "./regles.js"
import type { Activite } from "./conversion-de-statut.js"

/*
 * Frais de fonctionnement du comparateur (expert-comptable, banque, CFE…) : ce que chaque colonne reprend des frais
 * saisis par statut, et la CFE de l'année, réduite ou nulle selon la date de création de l'activité.
 */

/**
 * Frais de fonctionnement saisis que reprend chaque colonne : ceux de son statut, et ceux de la micro-entreprise pour
 * ses deux variantes. Un nouveau statut doit y dire lesquels il reprend : les siens (ajoutés à `STATUTS_FRAIS`, avec des
 * frais par défaut) ou ceux d'un statut proche.
 */
const FRAIS_DES_COLONNES: Record<StatutCompare, StatutFrais> = {
  SASU: "SASU",
  EURL: "EURL",
  EI: "EI",
  micro: "micro",
  "micro-vfl": "micro"
}

/** Total annuel des frais de fonctionnement saisis pour un statut. */
export function fraisDuStatut(statut: StatutCompare, options: ComparaisonOptions): number {
  const postes = options.fraisFonctionnement?.[FRAIS_DES_COLONNES[statut]]
  return postes ? Object.values(postes).reduce((somme, montant) => somme + Math.max(0, montant), 0) : 0
}

/**
 * Frais de fonctionnement de l'année : le poste CFE de chaque statut multiplié par la part due d'après la date de
 * création de l'activité (rien l'année de création, la moitié l'année suivante), avec la note qui le dit.
 */
export function avecLaCFEDeLAnnee(options: ComparaisonOptions, source: Activite, annee: number, regles: ReglesFiscales): { options: ComparaisonOptions } & Pick<ComparaisonResult, "noteCFE" | "partCFE"> {
  const creation = lireMois(source.dateDeCreation)
  const part = partDeCFEDue(creation, annee, regles)
  const note = noteCFE(creation, annee, regles)
  if (!options.fraisFonctionnement || part >= 1 || !note) return { options }
  const frais = Object.fromEntries(Object.entries(options.fraisFonctionnement).map(([statut, postes]) => [statut, { ...postes, cfe: postes.cfe * part }])) as FraisFonctionnement
  return { options: { ...options, fraisFonctionnement: frais }, noteCFE: note, partCFE: part }
}
