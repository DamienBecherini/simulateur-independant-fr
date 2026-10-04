// src/backend/logic/references/regles-2026.reference.test.ts

import { expect, it } from "vitest"
import { reglesEnVigueur } from "../regles.js"
import { casDeReference } from "../testing/cas-de-reference.js"

/*
 * Cas de référence 2026 : le moteur est lancé avec les règles réelles (config.json), et chaque montant attendu
 * est dérivé à la main, indépendamment du code, à partir des règles officielles. Si un cas échoue, c'est le
 * moteur qui est suspect, pas l'attendu.
 *
 * Ce fichier recopie, depuis les sources officielles, les valeurs 2026 sur lesquelles reposent toutes les
 * dérivations des autres fichiers. Si config.json est corrigé en cours d'année, ce test dit quelles dérivations
 * refaire, au lieu de laisser des écarts sans explication.
 */

casDeReference("Valeurs officielles utilisées par les cas de référence", () => {
  it("barème 2026 de l'impôt sur le revenu (revenus 2025), service-public.gouv.fr F1419", () => {
    expect(reglesEnVigueur.IR.bareme).toEqual([
      { trancheJusqua: 11600, taux: 0 },
      { trancheJusqua: 29579, taux: 0.11 },
      { trancheJusqua: 84577, taux: 0.3 },
      { trancheJusqua: 181917, taux: 0.41 },
      { trancheJusqua: null, taux: 0.45 }
    ])
  })

  it("quotient familial, décote et déduction de 10 % (F2705, F34328, F1989)", () => {
    expect(reglesEnVigueur.IR).toMatchObject({
      plafonnementQuotientFamilial: { avantageMaxParDemiPart: 1807 },
      decote: { taux: 0.4525, forfaitSeul: 897, forfaitCouple: 1483 },
      abattementSalaires: { taux: 0.1, minimum: 509, maximum: 14555 },
      partsParEnfant: { deuxPremiers: 0.5, suivants: 1 }
    })
  })

  it("impôt sur les sociétés et dividendes (F23575, F32963)", () => {
    expect(reglesEnVigueur.IS).toMatchObject({ tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 })
    expect(reglesEnVigueur.dividendes).toMatchObject({ tauxIrForfaitaire: 0.128, prelevementsSociaux: 0.186, abattementBareme: 0.4, csgDeductible: 0.068 })
    expect(reglesEnVigueur.EURL.seuilDividendesPartDuCapital).toBe(0.1)
  })

  it("micro-entreprise : plafonds, cotisations, ACRE, abattements et versement libératoire (F32353, F36232, F23267)", () => {
    expect(reglesEnVigueur.microEntreprise).toMatchObject({
      plafonds: { services: 83600, vente: 203100 },
      cotisations: { venteBic: 0.123, servicesBic: 0.212, servicesBnc: 0.256 },
      reductionACRE: 0.5,
      abattement: { venteBic: 0.71, servicesBic: 0.5, servicesBnc: 0.34, minimum: 305 },
      versementLiberatoire: { plafondRfrParPart: 29315, taux: { venteBic: 0.01, servicesBic: 0.017, servicesBnc: 0.022 } }
    })
  })

  it("approximations assumées du modèle : ratio du président de SASU et taux des TNS", () => {
    expect(reglesEnVigueur.SASU.ratioCoutTotalSurNet).toBe(1.8)
    expect(reglesEnVigueur.TNS.tauxCotisationsSurRevenuNet).toBe(0.45)
  })
})
