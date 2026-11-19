// src/backend/logic/exoneration-de-zone.ts
// Exonération d'impôt sur les bénéfices d'une activité implantée en zone (ZFU-TE, QPV : voir l'ADR 017). L'activité porte
// une case cochée (`implantationEnZone`) ; le régime, le taux de l'année et le plafond se déduisent de son mois de
// création et des règles de l'année (dispositifs.ts). Ce module dit ce que la zone donne à une activité une année
// donnée, calcule son bénéfice exonéré et rédige ce que l'activité en montre : sa note, ses avertissements.

import type { ActivityResult, Company, ExonerationDeZoneDeLActivite, MicroEntreprise } from "../../types.js"
import { beneficeExonereEnZone, ecrireMois, exonerationDeZoneDeLAnnee, libelleDuMois, lireMois, type ExonerationDeZone, type MoisCivil } from "./dispositifs.js"
import { euros, pourcentDeNombre } from "./format.js"
import type { ReglesFiscales } from "./regles.js"

type ActiviteEnZone = Pick<Company | MicroEntreprise, "implantationEnZone" | "dateDeCreation">
type ReglesDeZone = Pick<ReglesFiscales, "exonerationsDeZone">

/**
 * Ce que l'implantation en zone donne à une activité une année : un régime et son taux, ou la raison pour laquelle
 * aucun ne s'applique (sans date de création, le régime ne peut pas être déduit ; hors de toute fenêtre, il n'y en a pas).
 */
export type ZoneDeLActivite = { etat: "sansDateDeCreation" } | { etat: "sansRegime"; creation: MoisCivil } | { etat: "applicable"; exoneration: ExonerationDeZone; partDansLaZone: number }

/** L'implantation en zone de l'activité pour l'année ; `null` si la case n'est pas cochée. */
export function zoneDeLActivite(activite: ActiviteEnZone, annee: number, regles: ReglesDeZone): ZoneDeLActivite | null {
  if (!activite.implantationEnZone) return null
  const creation = lireMois(activite.dateDeCreation)
  if (!creation) return { etat: "sansDateDeCreation" }
  const exoneration = exonerationDeZoneDeLAnnee(creation, annee, regles)
  if (!exoneration) return { etat: "sansRegime", creation }
  return { etat: "applicable", exoneration, partDansLaZone: activite.implantationEnZone.partDuChiffreDAffaires ?? 1 }
}

/** Ce qu'un calcul de bénéfice doit connaître de l'exonération : la part réalisée dans la zone, le taux de l'année, le plafond. */
export interface ParametresDExoneration {
  partDansLaZone: number
  partExoneree: number
  plafond: number | null
}

/** Les paramètres de l'exonération de l'année, pour le calcul de l'activité ; `undefined` quand rien n'est exonérable. */
export function parametresDExoneration(zone: ZoneDeLActivite | null): ParametresDExoneration | undefined {
  if (zone?.etat !== "applicable" || zone.exoneration.partExoneree <= 0) return undefined
  return { partDansLaZone: zone.partDansLaZone, partExoneree: zone.exoneration.partExoneree, plafond: zone.exoneration.plafond }
}

/** Bénéfice exonéré d'impôt de l'activité cette année, d'après son bénéfice imposable ; 0 sans exonération. */
export function beneficeExonereDeLActivite(zone: ZoneDeLActivite | null, beneficeImposable: number): number {
  const parametres = parametresDExoneration(zone)
  return parametres ? beneficeExonereEnZone(beneficeImposable, parametres.partDansLaZone, parametres) : 0
}

/** Ce que le calcul de l'activité a donné, et ce qui change le discours : versement libératoire, recettes libérales. */
export interface CalculEnZone {
  beneficeExonere: number
  /** Micro-entreprise au versement libératoire cette année : l'exonération, calculée sur un bénéfice, ne joue pas. */
  versementLiberatoire?: boolean
  /** Recettes d'une profession libérale qui n'est pas, à coup sûr, une profession de santé. */
  recettesLiberales?: boolean
}

const pourcentage = (part: number) => pourcentDeNombre(part * 100, 1)

/** « Exonération totale jusqu'à fin décembre 2028, puis dégressive (60 %, 40 %, 20 %) jusqu'à fin décembre 2031. » */
function calendrier({ regime, finExonerationTotale, fin }: ExonerationDeZone, annee: number): string {
  const parts = regime.partsExonereesEnsuite.map(pourcentage).join(", ")
  const totaleEnCours = finExonerationTotale.annee > annee || (finExonerationTotale.annee === annee && finExonerationTotale.mois === 12)
  if (totaleEnCours) return `Exonération totale jusqu'à fin ${libelleDuMois(finExonerationTotale)}, puis dégressive (${parts}) jusqu'à fin ${libelleDuMois(fin)}.`
  return `Exonération dégressive (${parts} par périodes de douze mois) jusqu'à fin ${libelleDuMois(fin)}.`
}

/** « ZFU-TE : créations de janvier 2015 à décembre 2025 ; QPV : de janvier 2026 à décembre 2030 ». */
function fenetresDesRegimes(regles: ReglesDeZone): string {
  return regles.exonerationsDeZone.regimes
    .map((regime, i) => `${regime.nom} : ${i === 0 ? "créations " : ""}de ${libelleDuMois(lireMois(regime.creationDepuis)!)} à ${libelleDuMois(lireMois(regime.creationJusquA)!)}`)
    .join(" ; ")
}

/**
 * Ce que la fiche de l'activité dit de la case cochée, d'après sa date de création : le régime et son calendrier, ou la
 * raison pour laquelle rien n'est exonéré, et les hypothèses du calcul à montrer (ADR 017, décision 5). `null` si la
 * case n'est pas cochée.
 */
export function descriptionDeLaZone(activite: ActiviteEnZone, annee: number, regles: ReglesDeZone): { texte: string; hypotheses: string[] } | null {
  const zone = zoneDeLActivite(activite, annee, regles)
  if (!zone) return null
  if (zone.etat === "sansDateDeCreation") {
    const sigles = regles.exonerationsDeZone.regimes.map(regime => regime.nom).join(" ou ")
    return { texte: `Indiquez la date de création de l'activité, plus haut : le régime (${sigles}) et le taux d'exonération en dépendent. Rien n'est exonéré en attendant.`, hypotheses: [] }
  }
  if (zone.etat === "sansRegime") {
    return { texte: `Aucun régime d'exonération pour une activité créée en ${libelleDuMois(zone.creation)} (${fenetresDesRegimes(regles)}). Rien n'est exonéré.`, hypotheses: [] }
  }
  const { regime, finExonerationTotale, fin } = zone.exoneration
  const creation = libelleDuMois(lireMois(activite.dateDeCreation)!)
  if (fin.annee < annee) return { texte: `Créée en ${creation} : régime ${regime.nom}, dont l'exonération est terminée depuis fin ${libelleDuMois(fin)}.`, hypotheses: [] }
  const parts = regime.partsExonereesEnsuite.map(pourcentage)
  const degressif = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}` : parts.join("")
  const plafond = regime.plafondAnnuel === null ? "Aucun plafond annuel." : `Bénéfice exonéré plafonné à ${euros(regime.plafondAnnuel)} par an.`
  return {
    texte: `Créée en ${creation} : régime ${regime.nom}. Bénéfice exonéré d'impôt en totalité jusqu'à fin ${libelleDuMois(finExonerationTotale)}, puis à ${degressif} par périodes de douze mois, jusqu'à fin ${libelleDuMois(fin)}. ${plafond}`,
    hypotheses: regime.hypotheses
  }
}

/** Ce que l'activité montre de son implantation en zone : le détail chiffré, la note de l'année, les avertissements. */
export interface DetailDeLaZone {
  exonerationDeZone?: ExonerationDeZoneDeLActivite
  dispositifs: string[]
  warnings: string[]
}

const SANS_ZONE: DetailDeLaZone = { dispositifs: [], warnings: [] }

/** Case cochée sans régime applicable : rien n'est exonéré, et la note dit pourquoi. */
function detailSansRegime(sansExoneration: "sansDateDeCreation" | "sansRegime", note: string): DetailDeLaZone {
  return { exonerationDeZone: { partExoneree: 0, partDansLaZone: 1, beneficeExonere: 0, plafondAtteint: false, sansExoneration, hypotheses: [] }, dispositifs: [note], warnings: [] }
}

/** Ce que tout détail d'un régime applicable porte : le régime, la part dans la zone, le calendrier, le plafond, les hypothèses. */
function communAuRegime({ exoneration, partDansLaZone }: Extract<ZoneDeLActivite, { etat: "applicable" }>) {
  const { regime } = exoneration
  return {
    regime: regime.id,
    nom: regime.nom,
    partDansLaZone,
    finExonerationTotale: ecrireMois(exoneration.finExonerationTotale),
    fin: ecrireMois(exoneration.fin),
    ...(exoneration.plafond === null ? {} : { plafond: exoneration.plafond }),
    hypotheses: regime.hypotheses
  }
}

/** La note d'une exonération appliquée : son taux, son montant, le plafond s'il est atteint, puis le calendrier. */
function noteDeLExoneration(exoneration: ExonerationDeZone, partDansLaZone: number, beneficeExonere: number, plafondAtteint: boolean, annee: number): string {
  const taux = `à ${pourcentage(exoneration.partExoneree)} en ${annee}`
  const dansLaZone = partDansLaZone < 1 ? ` (${pourcentage(partDansLaZone)} du chiffre d'affaires réalisé dans la zone)` : ""
  const plafond = plafondAtteint ? ` : plafond de ${euros(exoneration.plafond ?? 0)} atteint` : ""
  const chiffre = beneficeExonere > 0 ? `bénéfice exonéré d'impôt ${taux}${dansLaZone}, soit ${euros(beneficeExonere)}${plafond}` : `exonération d'impôt ${taux}, sans bénéfice imposable à exonérer cette année`
  return `${exoneration.regime.nom} : ${chiffre}. ${calendrier(exoneration, annee)}`
}

/** Les avertissements d'une exonération appliquée : les conditions non vérifiées, et le rappel sur les recettes libérales. */
function avertissementsDeLExoneration({ regime }: ExonerationDeZone, recettesLiberales: boolean | undefined): string[] {
  const conditions = `Exonération ${regime.nom} appliquée sans vérifier ses conditions : ${regime.conditionsNonVerifiees}. Hypothèses du calcul dans la fiche de l'activité.`
  const liberales = `Recettes libérales en ${regime.nom} : parmi les professions libérales, seules les professions de santé ont droit à cette exonération.`
  return regime.liberauxHorsSanteExclus && recettesLiberales ? [conditions, liberales] : [conditions]
}

/**
 * Le détail de l'implantation en zone d'une activité pour l'année. Rien si la case n'est pas cochée, ni avant la création
 * de l'activité. Les avertissements (conditions non vérifiées, recettes libérales) n'accompagnent qu'une exonération
 * effectivement appliquée : une exonération terminée, ou écartée par le versement libératoire, n'en a pas besoin.
 */
export function detailDeLaZone(zone: ZoneDeLActivite | null, annee: number, regles: ReglesDeZone, calcul: CalculEnZone): DetailDeLaZone {
  if (!zone) return SANS_ZONE
  if (zone.etat === "sansDateDeCreation") {
    return detailSansRegime("sansDateDeCreation", "Implantation en zone : indiquez le mois de création de l'activité dans sa fiche. Le régime et le taux d'exonération en dépendent ; rien n'est exonéré en attendant.")
  }
  if (zone.etat === "sansRegime") {
    return detailSansRegime("sansRegime", `Implantation en zone : aucun régime d'exonération d'impôt pour une activité créée en ${libelleDuMois(zone.creation)} (${fenetresDesRegimes(regles)}).`)
  }

  const { exoneration, partDansLaZone } = zone
  const { regime } = exoneration
  if (exoneration.moisDActivite === 0) return SANS_ZONE
  const commun = communAuRegime(zone)
  if (exoneration.partExoneree <= 0) {
    return {
      exonerationDeZone: { ...commun, partExoneree: 0, beneficeExonere: 0, plafondAtteint: false, sansExoneration: "terminee" },
      dispositifs: [`${regime.nom} : exonération d'impôt terminée depuis fin ${libelleDuMois(exoneration.fin)}.`],
      warnings: []
    }
  }
  if (calcul.versementLiberatoire) {
    const note = `${regime.nom} : aucune exonération d'impôt avec le versement libératoire, qui porte sur le chiffre d'affaires et non sur un bénéfice. Pour en bénéficier, renoncez au versement libératoire jusqu'à fin ${libelleDuMois(exoneration.fin)}.`
    return { exonerationDeZone: { ...commun, partExoneree: exoneration.partExoneree, beneficeExonere: 0, plafondAtteint: false, sansExoneration: "versementLiberatoire" }, dispositifs: [], warnings: [note] }
  }

  const plafondAtteint = exoneration.plafond !== null && calcul.beneficeExonere > 0 && calcul.beneficeExonere >= exoneration.plafond - 0.5
  return {
    exonerationDeZone: { ...commun, partExoneree: exoneration.partExoneree, beneficeExonere: Math.round(calcul.beneficeExonere), plafondAtteint },
    dispositifs: [noteDeLExoneration(exoneration, partDansLaZone, calcul.beneficeExonere, plafondAtteint, annee)],
    warnings: avertissementsDeLExoneration(exoneration, calcul.recettesLiberales)
  }
}

/** Le résultat de l'activité, complété de son implantation en zone : la note rejoint ses dispositifs, les avertissements les siens. */
export function avecLaZone(resultat: ActivityResult, detail: DetailDeLaZone): ActivityResult {
  if (!detail.exonerationDeZone && detail.dispositifs.length === 0 && detail.warnings.length === 0) return resultat
  const dispositifs = [...(resultat.dispositifs ?? []), ...detail.dispositifs]
  return {
    ...resultat,
    ...(detail.exonerationDeZone ? { exonerationDeZone: detail.exonerationDeZone } : {}),
    ...(dispositifs.length > 0 ? { dispositifs } : {}),
    warnings: [...resultat.warnings, ...detail.warnings]
  }
}
