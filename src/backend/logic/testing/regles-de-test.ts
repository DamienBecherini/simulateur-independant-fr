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
  // Barème kilométrique continu : de 3 à 4 CV, 0,5 €/km jusqu'à 5 000 km (2 500 €), 0,3 €/km + 1 000 € jusqu'à
  // 20 000 km (7 000 €), 0,35 €/km au-delà ; de 5 à 7 CV, 0,6 €/km (3 000 €), 0,4 €/km + 1 000 € (9 000 €), 0,45 €/km.
  // Électrique : + 20 %. Trajets domicile-travail retenus jusqu'à 40 km.
  baremeKilometrique: {
    majorationElectrique: 0.2,
    voitures: {
      "3": [
        { jusquA: 5000, taux: 0.5, forfait: 0 },
        { jusquA: 20000, taux: 0.3, forfait: 1000 },
        { jusquA: null, taux: 0.35, forfait: 0 }
      ],
      "4": [
        { jusquA: 5000, taux: 0.5, forfait: 0 },
        { jusquA: 20000, taux: 0.3, forfait: 1000 },
        { jusquA: null, taux: 0.35, forfait: 0 }
      ],
      "5": [
        { jusquA: 5000, taux: 0.6, forfait: 0 },
        { jusquA: 20000, taux: 0.4, forfait: 1000 },
        { jusquA: null, taux: 0.45, forfait: 0 }
      ],
      "6": [
        { jusquA: 5000, taux: 0.6, forfait: 0 },
        { jusquA: 20000, taux: 0.4, forfait: 1000 },
        { jusquA: null, taux: 0.45, forfait: 0 }
      ],
      "7": [
        { jusquA: 5000, taux: 0.6, forfait: 0 },
        { jusquA: 20000, taux: 0.4, forfait: 1000 },
        { jusquA: null, taux: 0.45, forfait: 0 }
      ]
    },
    domicileTravail: { distanceMaxParTrajet: 40 }
  },
  IS: { tauxReduit: 0.15, plafondTauxReduit: 40000, tauxNormal: 0.25, reportEnAvantDesDeficits: { plafondFixe: 1000000, partAuDela: 0.5 } },
  dividendes: { tauxIrForfaitaire: 0.12, prelevementsSociaux: 0.18, abattementBareme: 0.4, csgDeductible: 0.07 },
  regimeGeneral: {
    // Plafond de 40 000 €. Sous le plafond, cotisations salariales de 10 % (vieillesse 5 + 1, complémentaire 4) et
    // CSG-CRDS de 10 % sur 90 % du brut, soit 9 % : net = 81 % du brut (8 100 € nets pour 10 000 € bruts).
    // Cotisations patronales sous le plafond : 34 % pour le président (maladie 10, vieillesse 10 + 2, famille 5,
    // accidents du travail 1, complémentaire 6), 39 % pour un salarié (chômage 4 et AGS 1 en plus).
    plafondSecuriteSociale: 40000,
    cotisations: {
      maladie: { salariale: [], patronale: [{ jusquA: null, taux: 0.1 }] },
      vieillessePlafonnee: { salariale: [{ jusquA: 1, taux: 0.05 }], patronale: [{ jusquA: 1, taux: 0.1 }] },
      vieillesseDeplafonnee: { salariale: [{ jusquA: null, taux: 0.01 }], patronale: [{ jusquA: null, taux: 0.02 }] },
      allocationsFamiliales: { salariale: [], patronale: [{ jusquA: null, taux: 0.05 }] },
      accidentsDuTravail: { salariale: [], patronale: [{ jusquA: null, taux: 0.01 }] },
      contributionSolidariteAutonomie: { salariale: [], patronale: [] },
      fnal: { salariale: [], patronale: [] },
      // Complémentaire : 4 % et 6 % jusqu'au plafond, 10 % et 15 % au-delà.
      retraiteComplementaire: {
        salariale: [
          { jusquA: 1, taux: 0.04 },
          { jusquA: 8, taux: 0.1 }
        ],
        patronale: [
          { jusquA: 1, taux: 0.06 },
          { jusquA: 8, taux: 0.15 }
        ]
      },
      contributionEquilibreGeneral: { salariale: [], patronale: [] },
      // 1 % salarié et 1 % employeur sur tout le brut, seulement s'il dépasse le plafond.
      contributionEquilibreTechnique: { auDelaDuPlafondSeulement: true, salariale: [{ jusquA: 8, taux: 0.01 }], patronale: [{ jusquA: 8, taux: 0.01 }] },
      assuranceChomage: { salariesSeulement: true, salariale: [], patronale: [{ jusquA: 4, taux: 0.04 }] },
      ags: { salariesSeulement: true, salariale: [], patronale: [{ jusquA: 4, taux: 0.01 }] },
      dialogueSocial: { salariesSeulement: true, salariale: [], patronale: [] },
      formationProfessionnelle: { salariale: [], patronale: [] },
      taxeApprentissage: { salariale: [], patronale: [] }
    },
    // CSG-CRDS de 10 % (7 % déductible, 2 % non déductible, 1 % de CRDS) sur 90 % du brut jusqu'à 4 plafonds, sur tout le brut au-delà.
    csgCrds: {
      assiette: [
        { jusquA: 4, taux: 0.9 },
        { jusquA: null, taux: 1 }
      ],
      csgDeductible: 0.07,
      csgNonDeductible: 0.02,
      crds: 0.01
    },
    // Réduction générale linéaire (puissance 1) : 40 % du brut au SMIC de 20 000 €, 2 % juste sous 3 SMIC (60 000 €).
    reductionGenerale: { smicAnnuel: 20000, tMin: 0.02, tDelta: 0.38, puissance: 1, plafondEnSmic: 3 }
  },
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
  protectionSociale: { revenuParTrimestre: 2000,tauxRetraiteDeBase: 0.2, partRetraiteDeBaseMicro: { venteBic: 0.4, servicesBic: 0.4, servicesBnc: 0.5 } },
  EURL: { seuilDividendesPartDuCapital: 0.1 },
  reserveLegale: { partDuBenefice: 0.05, plafondPartDuCapital: 0.1 },
  TVA: { services: { franchiseBase: 40000, seuilMajore: 45000 }, vente: { franchiseBase: 100000, seuilMajore: 110000 } },
  CFE: { partDueAnneeDeCreation: 0, partDueAnneeSuivante: 0.5 },
  microEntreprise: {
    plafonds: { services: 80000, vente: 200000 },
    cotisations: { venteBic: 0.1, servicesBic: 0.2, servicesBnc: 0.25 },
    reductionACRE: 0.5,
    ACRE: { trimestresCivilsApresLeDebut: 3, reductionsParDateDeCreation: [{ aPartirDe: "2020-01", reduction: 0.5 }] },
    abattement: { venteBic: 0.7, servicesBic: 0.5, servicesBnc: 0.3, minimum: 300 },
    versementLiberatoire: { plafondRfrParPart: 28000, taux: { venteBic: 0.01, servicesBic: 0.02, servicesBnc: 0.02 } }
  }
}
