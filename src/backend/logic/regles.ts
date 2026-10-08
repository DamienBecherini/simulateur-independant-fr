// src/backend/logic/regles.ts

import type { CotisationSalarie, PuissanceFiscale } from "../../types.js"
import config from "../config.json" with { type: "json" }
import regles2024 from "../regles/2024.json" with { type: "json" }
import regles2025 from "../regles/2025.json" with { type: "json" }

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
 * Une tranche du barème kilométrique : pour une distance annuelle `d` jusqu'à `jusquA` kilomètres (`null` : sans limite),
 * le montant est `d x taux + forfait`.
 */
export interface TrancheKilometrique {
  jusquA: number | null
  taux: number
  forfait: number
}

/** Barème kilométrique des voitures, par puissance fiscale, et règles des trajets domicile-travail. */
export interface BaremeKilometrique {
  /** Majoration du montant pour un véhicule 100 % électrique (0,2 pour 20 %). */
  majorationElectrique: number
  voitures: Record<PuissanceFiscale, TrancheKilometrique[]>
  /** Distance retenue par trajet domicile-travail, sauf distance plus longue justifiée. */
  domicileTravail: { distanceMaxParTrajet: number }
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
  baremeKilometrique: BaremeKilometrique
  IS: {
    tauxReduit: number
    plafondTauxReduit: number
    tauxNormal: number
    /** Imputation d'un déficit sur les bénéfices suivants : au plus le plafond fixe, plus une part du bénéfice qui le dépasse. */
    reportEnAvantDesDeficits: { plafondFixe: number; partAuDela: number }
  }
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
  /** Réserve légale des sociétés à l'IS : une part du bénéfice y est affectée tant qu'elle n'atteint pas une part du capital. */
  reserveLegale: { partDuBenefice: number; plafondPartDuCapital: number }
  /** Seuils de la franchise en base de TVA : au-delà du seuil de base l'année suivante, au-delà du seuil majoré immédiatement. */
  TVA: Record<"services" | "vente", { franchiseBase: number; seuilMajore: number }>
  /** Cotisation foncière des entreprises d'une activité créée récemment : part due l'année de création et la suivante. */
  CFE: { partDueAnneeDeCreation: number; partDueAnneeSuivante: number }
  microEntreprise: {
    plafonds: { services: number; vente: number }
    cotisations: TauxMicro
    /**
     * Contribution à la formation professionnelle, en part du chiffre d'affaires : elle s'ajoute aux cotisations, l'ACRE
     * ne la réduit pas et elle n'ouvre aucun droit à la retraite.
     */
    formationProfessionnelle: TauxMicro
    /** Réduction de l'ACRE sur toute l'année, quand la date de création de la micro-entreprise n'est pas connue. */
    reductionACRE: number
    /**
     * ACRE quand la date de création est connue : du mois de création à la fin du n-ième trimestre civil suivant, avec
     * la réduction de la dernière entrée dont le mois « AAAA-MM » ne dépasse pas celui de la création.
     */
    ACRE: { trimestresCivilsApresLeDebut: number; reductionsParDateDeCreation: { aPartirDe: string; reduction: number }[] }
    abattement: TauxMicro & { minimum: number }
    versementLiberatoire: { plafondRfrParPart: number; taux: TauxMicro }
  }
}

/** Les règles de l'année en cours, telles que définies dans `config.json`. */
export const reglesEnVigueur: ReglesFiscales = config

/*
 * Règles par année (convention : ADR 007, l'année N d'un fichier est celle de l'activité et des revenus).
 * Une année après la dernière connue reprend les dernières règles, avec un avertissement : l'écart vient surtout de
 * la revalorisation annuelle des seuils, que l'on ne peut pas deviner. Une année avant la première connue n'est pas
 * simulée : les règles ont changé de structure (assiette des indépendants avant 2025, taux micro de 2024, etc.) et
 * reprendre celles de 2024 donnerait des résultats faux sans qu'on puisse le chiffrer.
 */
const REGLES_PAR_ANNEE: ReadonlyMap<number, ReglesFiscales> = new Map<number, ReglesFiscales>([
  [2024, regles2024],
  [2025, regles2025],
  [config.annee, config]
])

/** Première et dernière années dont le simulateur connaît les règles. */
export const PREMIERE_ANNEE_DES_REGLES = Math.min(...REGLES_PAR_ANNEE.keys())
export const DERNIERE_ANNEE_DES_REGLES = Math.max(...REGLES_PAR_ANNEE.keys())

/** Les règles qui s'appliquent à une année, ou la raison pour laquelle l'année ne peut pas être simulée. */
export type ReglesDeLAnnee = { regles: ReglesFiscales; avertissement: string | null } | { regles: null; erreur: string }

export function reglesDeLAnnee(annee: number): ReglesDeLAnnee {
  const connues = REGLES_PAR_ANNEE.get(annee)
  if (connues) return { regles: connues, avertissement: null }
  if (annee > DERNIERE_ANNEE_DES_REGLES) {
    return {
      regles: REGLES_PAR_ANNEE.get(DERNIERE_ANNEE_DES_REGLES)!,
      avertissement: `Les règles de ${annee} ne sont pas encore connues : ${annee} est simulée avec celles de ${DERNIERE_ANNEE_DES_REGLES}, les dernières connues. Les seuils et barèmes revalorisés chaque année (plafond de la sécurité sociale, SMIC, barème de l'impôt) n'en tiennent pas compte.`
    }
  }
  return { regles: null, erreur: `Le simulateur ne connaît pas les règles d'avant ${PREMIERE_ANNEE_DES_REGLES} : l'année ${annee} n'est pas simulée.` }
}
