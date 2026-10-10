// src/backend/logic/frais-de-fonctionnement.ts

import { POSTES_FRAIS, type ComparaisonOptions, type ComparaisonResult, type EcartDeFrais, type FraisFonctionnement, type PosteFrais, type StatutCompare, type StatutFrais } from "../../types.js"
import { lireMois, noteCFE, partDeCFEDue } from "./dispositifs.js"
import type { ReglesFiscales } from "./regles.js"
import type { Activite } from "./conversion-de-statut.js"

/*
 * Frais de fonctionnement du comparateur (expert-comptable, banque, CFE…). La grille contient déjà les frais réels de
 * l'activité dans son statut actuel : une colonne ne reçoit que l'écart entre les frais supposés de son statut et ceux
 * du statut actuel, positif ou négatif, nul pour le statut actuel. La CFE de l'année, réduite ou nulle selon la date de
 * création de l'activité, entre dans les deux termes de l'écart.
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

/** Montant annuel d'un poste de frais saisi pour un statut ; 0 sans frais saisis. */
function posteDuStatut(statut: StatutCompare, poste: PosteFrais, options: ComparaisonOptions): number {
  return Math.max(0, options.fraisFonctionnement?.[FRAIS_DES_COLONNES[statut]][poste] ?? 0)
}

/**
 * Écart de frais de fonctionnement supposés entre le statut d'une colonne et le statut actuel de l'activité, poste par
 * poste : ce que la colonne ajoute aux charges saisies dans la grille, ou leur retire s'il est négatif.
 */
export function ecartDeFrais(statut: StatutCompare, actuel: StatutCompare, options: ComparaisonOptions): EcartDeFrais {
  const postes: Partial<Record<PosteFrais, number>> = {}
  for (const poste of POSTES_FRAIS) {
    const ecart = posteDuStatut(statut, poste, options) - posteDuStatut(actuel, poste, options)
    if (ecart !== 0) postes[poste] = ecart
  }
  return { total: Object.values(postes).reduce((somme, montant) => somme + montant, 0), postes }
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
