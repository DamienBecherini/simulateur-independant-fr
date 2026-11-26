// src/backend/logic/champs-du-foyer.ts
// Ce que chaque sortie montre d'un foyer fiscal. Une seule table : un champ ajouté à `FoyerFiscalResult` ne compile
// pas tant qu'elle ne dit pas son libellé et les sorties qui le montrent. Avant elle, chaque sortie tenait sa liste, et
// deux montants affichés à l'écran manquaient aux exports (audit du 26 novembre 2026, constat C2).

import type { FoyerFiscalResult } from "../../types.js"

/**
 * Les champs d'un foyer qu'une sortie peut montrer : tous, sauf ses membres, ses avertissements et le détail de son
 * épargne retraite personne par personne, écrits à part.
 */
export type ChampDuFoyer = Exclude<keyof FoyerFiscalResult, "personIds" | "warnings" | "epargneRetraite">

/** Les champs qui sont des nombres : des montants en euros, et le nombre de parts. */
export type ChampNumeriqueDuFoyer = Exclude<ChampDuFoyer, "optionDividendes">

/** Les sorties qui dressent la liste des champs d'un foyer. L'écran a sa mise en page et ses libellés à lui. */
export type SortieDuFoyer = "csv" | "markdown" | "ligneDeCommande"

interface DescriptionDuChamp {
  /** Titre de la colonne (exports) ou de la ligne (ligne de commande). */
  libelle: string
  sorties: readonly SortieDuFoyer[]
  /** Nom du champ dans le résultat de l'outil `simuler` des clients d'IA ; `null` s'il ne le rend pas. */
  pourLesIA: string | null
  /** Champ que la plupart des foyers n'ont pas : montré seulement quand un foyer au moins l'a. */
  siPresent?: true
}

const PARTOUT = ["csv", "markdown", "ligneDeCommande"] as const

/** Les champs, dans l'ordre où les sorties les montrent : un « dont » suit le montant qui le contient. */
export const CHAMPS_DU_FOYER: Record<ChampDuFoyer, DescriptionDuChamp> = {
  // Dans la ligne de commande, les parts sont dans le titre du foyer.
  totalParts: { libelle: "Parts", sorties: ["csv", "markdown"], pourLesIA: "parts" },
  revenusEncaisses: { libelle: "Revenus encaissés", sorties: PARTOUT, pourLesIA: "revenusEncaisses" },
  revenuImposableGlobal: { libelle: "Revenu imposable", sorties: PARTOUT, pourLesIA: "revenuImposable" },
  deductionEpargneRetraite: { libelle: "Versements PER déduits", sorties: PARTOUT, pourLesIA: "deductionEpargneRetraite", siPresent: true },
  revenuFiscalDeReference: { libelle: "Revenu fiscal de référence", sorties: PARTOUT, pourLesIA: "revenuFiscalDeReference" },
  beneficesExoneres: { libelle: "dont bénéfice exonéré en zone", sorties: PARTOUT, pourLesIA: "beneficesExoneres", siPresent: true },
  impotSurLeRevenu: { libelle: "Impôt sur le revenu", sorties: PARTOUT, pourLesIA: "impotSurLeRevenu" },
  versementLiberatoire: { libelle: "dont versement libératoire", sorties: PARTOUT, pourLesIA: "versementLiberatoire", siPresent: true },
  impotEconomiseEpargneRetraite: { libelle: "Impôt économisé par les versements PER", sorties: PARTOUT, pourLesIA: "impotEconomiseEpargneRetraite", siPresent: true },
  prelevementsSociaux: { libelle: "Prélèvements sociaux", sorties: PARTOUT, pourLesIA: "prelevementsSociaux" },
  optionDividendes: { libelle: "Imposition des dividendes", sorties: PARTOUT, pourLesIA: "optionDividendes" },
  netApresImpots: { libelle: "Net après impôts", sorties: PARTOUT, pourLesIA: "netApresImpots" },
  versementsEpargneRetraite: { libelle: "dont épargne retraite (PER)", sorties: PARTOUT, pourLesIA: "versementsEpargneRetraite", siPresent: true },
  revenusAvantPrelevements: { libelle: "Revenus avant prélèvements", sorties: ["csv"], pourLesIA: null },
  totalPrelevements: { libelle: "Total des prélèvements", sorties: ["csv"], pourLesIA: null },
  resultatConserve: { libelle: "Résultat conservé", sorties: ["csv"], pourLesIA: "resultatConserve" },
  depenses: { libelle: "Dépenses", sorties: ["csv"], pourLesIA: null }
}

const TOUS_LES_CHAMPS = Object.keys(CHAMPS_DU_FOYER) as ChampDuFoyer[]

/** Les champs qu'une sortie montre pour ces foyers, dans l'ordre : un champ « si présent » manque quand aucun foyer ne l'a. */
export function champsDuFoyerMontres(sortie: SortieDuFoyer, foyers: FoyerFiscalResult[]): ChampDuFoyer[] {
  return TOUS_LES_CHAMPS.filter(champ => {
    const { sorties, siPresent } = CHAMPS_DU_FOYER[champ]
    return sorties.includes(sortie) && (!siPresent || foyers.some(foyer => foyer[champ] !== undefined))
  })
}

/** La valeur d'un champ numérique ; 0 pour un foyer qui n'a pas ce champ. */
export function nombreDuFoyer(foyer: FoyerFiscalResult, champ: ChampNumeriqueDuFoyer): number {
  return foyer[champ] ?? 0
}

/** Les noms des champs que l'outil `simuler` rend pour un foyer, hors ses membres et ses avertissements. */
export const CHAMPS_DU_FOYER_POUR_LES_IA: string[] = TOUS_LES_CHAMPS.flatMap(champ => CHAMPS_DU_FOYER[champ].pourLesIA ?? [])
