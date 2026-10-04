// src/backend/logic/testing/regles-de-test.ts

import type { ReglesFiscales } from "../regles.js"

/**
 * Règles fictives, aux chiffres ronds, utilisées par les tests du moteur.
 * Les valeurs attendues se vérifient ainsi de tête, et les tests ne cassent pas
 * à chaque mise à jour annuelle de `config.json`.
 */
export const reglesDeTest: ReglesFiscales = {
  annee: 2000,
  IR: {
    bareme: [
      { trancheJusqua: 10000, taux: 0 },
      { trancheJusqua: 30000, taux: 0.1 },
      { trancheJusqua: 80000, taux: 0.3 },
      { trancheJusqua: null, taux: 0.4 }
    ],
    plafonnementQuotientFamilial: { avantageMaxParDemiPart: 1500 },
    decote: { taux: 0.5, forfaitSeul: 800, forfaitCouple: 1400 },
    abattementSalaires: { taux: 0.1, minimum: 500, maximum: 14000 },
    partsParEnfant: { deuxPremiers: 0.5, suivants: 1 }
  },
  IS: { tauxReduit: 0.15, plafondTauxReduit: 40000, tauxNormal: 0.25 },
  dividendes: { tauxIrForfaitaire: 0.12, prelevementsSociaux: 0.18, abattementBareme: 0.4, csgDeductible: 0.07 },
  SASU: { ratioCoutTotalSurNet: 1.8 },
  TNS: {
    // Plafond de 40 000 € : abattement de 25 % borné entre 800 € et 40 000 €.
    plafondSecuriteSociale: 40000,
    abattement: { taux: 0.25, minimumPartDuPlafond: 0.02, maximumPartDuPlafond: 1 },
    // Maladie : 0 % jusqu'à 20 000 €, puis 4 % à 40 000 €, 8 % à 80 000 € ; au-delà, 5 % sur le surplus.
    maladieMaternite: {
      points: [
        { partDuPlafond: 0.5, taux: 0 },
        { partDuPlafond: 1, taux: 0.04 },
        { partDuPlafond: 2, taux: 0.08 }
      ],
      tauxAuDela: 0.05
    },
    // Allocations familiales : 0 % jusqu'à 40 000 €, 4 % à partir de 60 000 €, sur toute l'assiette.
    allocationsFamiliales: {
      points: [
        { partDuPlafond: 1, taux: 0 },
        { partDuPlafond: 1.5, taux: 0.04 }
      ],
      tauxAuDela: 0.04
    },
    indemnitesJournalieres: { tranches: [{ jusquA: 2, taux: 0.01 }] },
    retraiteDeBase: {
      tranches: [
        { jusquA: 1, taux: 0.2 },
        { jusquA: null, taux: 0.01 }
      ]
    },
    retraiteComplementaire: {
      tranches: [
        { jusquA: 1, taux: 0.08 },
        { jusquA: 4, taux: 0.1 }
      ]
    },
    invaliditeDeces: { tranches: [{ jusquA: 1, taux: 0.01 }] },
    // CSG-CRDS de 10 %, dont 3 % non déductibles.
    csgCrds: { csgDeductible: 0.07, csgNonDeductible: 0.02, crds: 0.01 },
    // Formation professionnelle : 100 €.
    formationProfessionnelle: { tauxSurPlafond: 0.0025 },
    // Sans revenu : 160 € (IJ) + 1 200 € (retraite de base, 3 trimestres) + 40 € (invalidité-décès) + 100 € = 1 500 €.
    cotisationsMinimales: { indemnitesJournalieres: 16000, retraiteDeBase: 6000, invaliditeDeces: 4000 }
  },
  protectionSociale: { revenuParTrimestre: 2000, tauxNetSurBrutSalarie: 0.8, tauxRetraiteDeBase: 0.2, partRetraiteDeBaseMicro: { venteBic: 0.4, servicesBic: 0.4, servicesBnc: 0.5 } },
  EURL: { seuilDividendesPartDuCapital: 0.1 },
  microEntreprise: {
    plafonds: { services: 80000, vente: 200000 },
    cotisations: { venteBic: 0.1, servicesBic: 0.2, servicesBnc: 0.25 },
    reductionACRE: 0.5,
    abattement: { venteBic: 0.7, servicesBic: 0.5, servicesBnc: 0.3, minimum: 300 },
    versementLiberatoire: { plafondRfrParPart: 28000, taux: { venteBic: 0.01, servicesBic: 0.02, servicesBnc: 0.02 } }
  }
}
