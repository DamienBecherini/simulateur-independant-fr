// src/backend/logic/regles.ts

import config from "../config.json" with { type: "json" }

/** Une tranche du barème de l'impôt sur le revenu. `trancheJusqua` vaut `null` pour la dernière tranche. */
export interface TrancheIR {
  trancheJusqua: number | null
  taux: number
}

/** Taux applicables au chiffre d'affaires d'une micro-entreprise, par nature d'activité. */
export interface TauxMicro {
  venteBic: number
  servicesBic: number
  servicesBnc: number
}

/**
 * Les règles fiscales et sociales lues par le moteur.
 * Elles vivent dans `config.json` : changer d'année ne demande aucune modification du code.
 */
export interface ReglesFiscales {
  annee: number
  IR: {
    bareme: TrancheIR[]
    plafonnementQuotientFamilial: { avantageMaxParDemiPart: number }
    decote: { taux: number; forfaitSeul: number; forfaitCouple: number }
    abattementSalaires: { taux: number; minimum: number; maximum: number }
    partsParEnfant: { deuxPremiers: number; suivants: number }
  }
  IS: { tauxReduit: number; plafondTauxReduit: number; tauxNormal: number }
  dividendes: { tauxIrForfaitaire: number; prelevementsSociaux: number; abattementBareme: number; csgDeductible: number }
  SASU: { ratioCoutTotalSurNet: number }
  TNS: { tauxCotisationsSurRevenuNet: number }
  EURL: { seuilDividendesPartDuCapital: number }
  microEntreprise: {
    plafonds: { services: number; vente: number }
    cotisations: TauxMicro
    reductionACRE: number
    abattement: TauxMicro & { minimum: number }
    versementLiberatoire: { plafondRfrParPart: number; taux: TauxMicro }
  }
}

/** Les règles de l'année en cours, telles que définies dans `config.json`. */
export const reglesEnVigueur: ReglesFiscales = config
