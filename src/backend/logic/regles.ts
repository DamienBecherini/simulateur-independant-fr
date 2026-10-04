// src/backend/logic/regles.ts

import type { CotisationSalarie } from "../../types.js"
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

/** Une tranche d'un barème de cotisation à taux marginal, bornée en part du plafond de la sécurité sociale. `jusquA` vaut `null` pour une tranche sans limite. */
export interface TrancheCotisation {
  jusquA: number | null
  taux: number
}

/**
 * Barème à taux progressif : le taux, appliqué à toute l'assiette, varie linéairement entre deux points
 * (seuils en part du plafond de la sécurité sociale). Sous le premier point, le taux est celui du premier point ;
 * au-delà du dernier, le taux du dernier point s'applique jusqu'à son seuil, et `tauxAuDela` sur le surplus.
 */
export interface BaremeProgressif {
  points: { partDuPlafond: number; taux: number }[]
  tauxAuDela: number
}

/** Règles des cotisations et contributions sociales d'un travailleur non salarié. */
export interface ReglesTNS {
  /** Plafond annuel de la sécurité sociale (PASS), auquel se rapportent les seuils exprimés en part du plafond. */
  plafondSecuriteSociale: number
  /** Abattement forfaitaire sur le revenu avant cotisations, borné en part du plafond. */
  abattement: { taux: number; minimumPartDuPlafond: number; maximumPartDuPlafond: number }
  maladieMaternite: BaremeProgressif
  allocationsFamiliales: BaremeProgressif
  indemnitesJournalieres: { tranches: TrancheCotisation[] }
  retraiteDeBase: { tranches: TrancheCotisation[] }
  retraiteComplementaire: { tranches: TrancheCotisation[] }
  invaliditeDeces: { tranches: TrancheCotisation[] }
  /** Taux de CSG et de CRDS, appliqués à la même assiette que les cotisations. */
  csgCrds: { csgDeductible: number; csgNonDeductible: number; crds: number }
  /** Contribution à la formation professionnelle : forfait égal à un taux du plafond. */
  formationProfessionnelle: { tauxSurPlafond: number }
  /** Assiettes minimales (en euros) des risques qui en ont une : la cotisation est due au moins sur ce montant. */
  cotisationsMinimales: { indemnitesJournalieres: number; retraiteDeBase: number; invaliditeDeces: number }
}

/** Les cotisations du régime général qui ont un barème propre : toutes sauf la CSG et la CRDS. */
export type LigneRegimeGeneral = Exclude<CotisationSalarie, "csgDeductible" | "csgNonDeductibleEtCrds">

/** Une cotisation du régime général : parts salariale et patronale, chacune par tranches en part du plafond. */
export interface CotisationRegimeGeneral {
  salariale: TrancheCotisation[]
  patronale: TrancheCotisation[]
  /** Due seulement si le brut dépasse le plafond, et alors sur tout le brut dans la limite de la dernière tranche (CET). */
  auDelaDuPlafondSeulement?: boolean
  /** Due pour un salarié, pas pour un président assimilé salarié sans contrat de travail (assurance chômage, AGS…). */
  salariesSeulement?: boolean
}

/** Règles des cotisations du régime général : président de SASU (assimilé salarié) et salariés. */
export interface ReglesRegimeGeneral {
  /** Plafond annuel de la sécurité sociale (PASS), auquel se rapportent les tranches. */
  plafondSecuriteSociale: number
  cotisations: Record<LigneRegimeGeneral, CotisationRegimeGeneral>
  /** CSG et CRDS du salarié : assiette par tranches (part du brut retenue), taux. */
  csgCrds: { assiette: TrancheCotisation[]; csgDeductible: number; csgNonDeductible: number; crds: number }
  /** Réduction générale dégressive unique des cotisations patronales, pour les salariés. */
  reductionGenerale: { smicAnnuel: number; tMin: number; tDelta: number; puissance: number; plafondEnSmic: number }
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
  regimeGeneral: ReglesRegimeGeneral
  TNS: ReglesTNS
  protectionSociale: {
    /** Revenu soumis à cotisations qui valide un trimestre de retraite. */
    revenuParTrimestre: number
    tauxRetraiteDeBase: number
    partRetraiteDeBaseMicro: TauxMicro
  }
  EURL: { seuilDividendesPartDuCapital: number }
  /** Seuils de la franchise en base de TVA : au-delà du seuil de base l'année suivante, au-delà du seuil majoré immédiatement. */
  TVA: Record<"services" | "vente", { franchiseBase: number; seuilMajore: number }>
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
