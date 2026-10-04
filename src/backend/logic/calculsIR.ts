// src/backend/logic/calculsIR.ts

import { reglesEnVigueur, type ReglesFiscales, type TrancheIR } from "./regles.js"

type ReglesIR = ReglesFiscales["IR"]

export interface EntreesIR {
  revenuNetGlobalImposable: number
  /** Nombre total de parts du foyer (déclarants et personnes à charge). */
  partsFiscales: number
  /** 1 pour une personne seule, 2 pour un couple soumis à imposition commune. */
  nombreDeclarants: 1 | 2
}

/** Impôt d'une part de quotient familial : chaque tranche est taxée à son taux. */
export function impotPourUnePart(revenuParPart: number, bareme: TrancheIR[]): number {
  let impot = 0
  let plancher = 0
  for (const { trancheJusqua, taux } of bareme) {
    if (revenuParPart <= plancher) break
    const plafond = trancheJusqua ?? Infinity
    impot += (Math.min(revenuParPart, plafond) - plancher) * taux
    plancher = plafond
  }
  return impot
}

/**
 * Impôt sur le revenu d'un foyer : barème par part, plafonnement de l'avantage du quotient familial,
 * puis décote. Les réductions et crédits d'impôt ne sont pas modélisés.
 */
export function calculerIR({ revenuNetGlobalImposable, partsFiscales, nombreDeclarants }: EntreesIR, regles: ReglesIR = reglesEnVigueur.IR): number {
  if (revenuNetGlobalImposable <= 0 || !(partsFiscales > 0)) return 0

  const partsDeBase = Math.min(partsFiscales, nombreDeclarants)
  let impot = partsFiscales * impotPourUnePart(revenuNetGlobalImposable / partsFiscales, regles.bareme)

  // Les parts au-delà de celles des déclarants ne peuvent pas faire baisser l'impôt de plus d'un plafond par demi-part.
  if (partsFiscales > partsDeBase) {
    const impotSansPartsSupplementaires = partsDeBase * impotPourUnePart(revenuNetGlobalImposable / partsDeBase, regles.bareme)
    const avantageMax = regles.plafonnementQuotientFamilial.avantageMaxParDemiPart * (partsFiscales - partsDeBase) * 2
    impot = Math.max(impot, impotSansPartsSupplementaires - avantageMax)
  }

  const forfaitDecote = nombreDeclarants === 2 ? regles.decote.forfaitCouple : regles.decote.forfaitSeul
  const decote = Math.max(0, forfaitDecote - regles.decote.taux * impot)

  return Math.round(Math.max(0, impot - decote))
}
