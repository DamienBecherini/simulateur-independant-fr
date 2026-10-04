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
  TNS: { tauxCotisationsSurRevenuNet: 0.5, cotisationsMinimales: 1000 },
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
