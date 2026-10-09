// src/backend/logic/outils/limites.ts
// Limites des outils et schémas de base de leurs paramètres. Un document lu par le modèle (facture, relevé) peut
// contenir des instructions piégées : les outils n'acceptent que des valeurs bornées, des textes courts et sans
// caractères de contrôle, et des propositions de taille raisonnable. Tout passe ensuite par la validation de l'utilisateur.

import { z } from "zod"
import { ANNEE_COURANTE } from "../regles.js"

export const LIMITES = {
  /** Opérations d'une proposition : 200 séries de flux couvrent une année de relevés détaillés. */
  operationsParProposition: 200,
  /** Suppressions d'une proposition : une série de flux d'une année, ou une relation. Jamais d'acteur. */
  suppressionsParProposition: 1,
  /** Acteurs ajoutés par une proposition. */
  acteursParProposition: 10,
  /** Montant mensuel d'un flux, en euros. */
  montantMaximal: 10_000_000,
  /** Libellé d'un flux. */
  longueurLibelle: 80,
  /** Nom d'un acteur. */
  longueurNom: 60,
  /** Identifiant d'un acteur, d'une relation ou d'une empreinte. */
  longueurIdentifiant: 120,
  /** Lignes rendues par une liste de flux. */
  lignesListees: 500
} as const

/**
 * Caractères refusés dans un texte : caractères de contrôle (sauts de ligne compris), séparateurs de ligne Unicode et
 * caractères de mise en forme bidirectionnelle, qui permettent de déguiser un texte à l'affichage.
 */
const PLAGES_INTERDITES: [number, number][] = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069]
]

const caractereInterdit = (code: number) => PLAGES_INTERDITES.some(([debut, fin]) => code >= debut && code <= fin)

/** Vrai si le texte ne contient aucun caractère interdit. */
export function texteSansControle(texte: string): boolean {
  return ![...texte].some(caractere => caractereInterdit(caractere.codePointAt(0) ?? 0))
}

/** Un texte court, une seule ligne, sans caractère de contrôle, espaces de début et de fin retirés. */
export function texteCourt(quoi: string, longueurMax: number) {
  return z
    .string()
    .trim()
    .min(1, `${quoi} : texte vide.`)
    .max(longueurMax, `${quoi} : ${longueurMax} caractères au plus.`)
    .refine(texteSansControle, `${quoi} : caractères de contrôle, sauts de ligne et caractères de mise en forme interdits.`)
}

export const LibelleSchema = texteCourt("Libellé", LIMITES.longueurLibelle).describe("Libellé du flux dans la grille, sur une ligne.")
export const NomSchema = texteCourt("Nom", LIMITES.longueurNom).describe("Nom affiché de l'acteur.")
export const IdentifiantSchema = texteCourt("Identifiant", LIMITES.longueurIdentifiant)

/** Montant en euros, positif ou nul, borné. Le sens (revenu ou dépense) vient du type de flux, jamais du signe. */
export const MontantSchema = z
  .number()
  .min(0, "Montant négatif : le sens du flux vient de son type (une dépense est un type de flux), le montant est toujours positif.")
  .max(LIMITES.montantMaximal, `Montant supérieur à ${LIMITES.montantMaximal.toLocaleString("fr-FR")} € : vérifiez l'unité (euros, pas centimes) et le séparateur décimal.`)

export const AnneeSchema = z.number().int().min(1900).max(2200).describe(`Année civile, par exemple ${ANNEE_COURANTE}.`)

/** Mois du calendrier, de 1 (janvier) à 12 (décembre) ; la grille de la session les range de 0 à 11. */
export const MoisSchema = z.number().int().min(1, "Mois : de 1 (janvier) à 12 (décembre).").max(12, "Mois : de 1 (janvier) à 12 (décembre).")

export const ListeDeMoisSchema = z
  .array(MoisSchema)
  .min(1, "Indiquez au moins un mois.")
  .max(12)
  .refine(mois => new Set(mois).size === mois.length, "Mois en double.")
  .describe("Mois, de 1 (janvier) à 12 (décembre), sans doublon ; [1,…,12] pour toute l'année.")
