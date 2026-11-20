// src/backend/logic/dispositifs.ts

/*
 * Dispositifs limités dans le temps, d'après le mois de création d'une activité (« AAAA-MM ») et les années de la
 * session (phase 13, points 6 et 7) :
 * - plafonds du régime micro au prorata des jours d'activité l'année de création, et sortie du régime au 1er janvier
 *   qui suit deux années de suite au-delà des plafonds (service-public.fr, F32353) ;
 * - ACRE d'une micro-entreprise, du mois de création à la fin du 3e trimestre civil suivant (F11677), avec la réduction
 *   de sa date de création (50 %, ou 25 % pour une création depuis le 1er juillet 2026) ;
 * - CFE non due l'année de création, base réduite de moitié l'année suivante (article 1478 II du CGI).
 * Les valeurs (trimestres, réductions, parts dues) sont dans les règles de chaque année. Sans date de création, rien ne
 * change : l'ACRE réduit les cotisations de toute l'année, les plafonds ne sont pas proratisés, la CFE est comptée.
 */

import type { FinancialFlow, MicroEntreprise, MonthlyGridData, SortieDuRegimeMicro } from "../../types.js"
import { depassePlafondMicro, type ChiffreAffairesMicro } from "./calculsAE.js"
import { euros, pourcentDeNombre } from "./format.js"
import { reglesDeLAnnee, type RegimeDeZone, type ReglesFiscales } from "./regles.js"
import { entreprisesDuTitulaire, type Relations } from "./regles-de-structure.js"

/** Un mois du calendrier : son année et son numéro, de 1 (janvier) à 12. */
export interface MoisCivil {
  annee: number
  mois: number
}

const NOMS_DES_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

/** Le mois « AAAA-MM » d'une date de création, ou `null` s'il est absent ou mal formé. */
export function lireMois(valeur: string | undefined): MoisCivil | null {
  const lu = valeur === undefined ? null : /^(\d{4})-(\d{2})$/.exec(valeur)
  if (!lu) return null
  const mois = Number(lu[2])
  return mois >= 1 && mois <= 12 ? { annee: Number(lu[1]), mois } : null
}

/** « 2026-09 ». */
export function ecrireMois({ annee, mois }: MoisCivil): string {
  return `${annee}-${String(mois).padStart(2, "0")}`
}

/** « septembre 2026 » ; « septembre » seul si `avecAnnee` est faux. */
export function libelleDuMois({ annee, mois }: MoisCivil, avecAnnee = true): string {
  return avecAnnee ? `${NOMS_DES_MOIS[mois - 1]} ${annee}` : NOMS_DES_MOIS[mois - 1]
}

/** Rang du mois depuis l'an 0 : deux mois se comparent et s'additionnent comme des nombres. */
const rangDuMois = ({ annee, mois }: MoisCivil) => annee * 12 + mois - 1
const moisDuRang = (rang: number): MoisCivil => ({ annee: Math.floor(rang / 12), mois: (rang % 12) + 1 })

/** Le prorata des plafonds se calcule sur 365 jours (service-public.fr, F32353 : plafond x jours d'existence / 365). */
const JOURS_DU_PRORATA = 365
const MS_PAR_JOUR = 86_400_000

/** Jours d'activité de l'année de création, l'activité commençant le 1er jour de son mois de création. */
export function joursDActivite(creation: MoisCivil): number {
  return (Date.UTC(creation.annee + 1, 0, 1) - Date.UTC(creation.annee, creation.mois - 1, 1)) / MS_PAR_JOUR
}

/**
 * Part des plafonds du régime micro qui s'applique cette année : au prorata des jours d'activité l'année de la création
 * (sauf création en janvier : année entière), l'année entière sinon ou sans date de création.
 */
export function prorataDesPlafonds(creation: MoisCivil | null, annee: number): number {
  if (creation?.annee !== annee) return 1
  return Math.min(1, joursDActivite(creation) / JOURS_DU_PRORATA)
}

/** Chiffre d'affaires d'une micro-entreprise par nature, sur les mois choisis de la grille (tous par défaut). */
export function chiffreAffairesDeLaMicro(monthlyData: MonthlyGridData, microId: string, mois?: number[]): ChiffreAffairesMicro {
  const flux = monthlyData.filter(m => mois === undefined || mois.includes(m.month)).flatMap(m => m.flows.filter(f => f.entityId === microId))
  const total = (type: FinancialFlow["type"]) => flux.filter(f => f.type === type).reduce((somme, f) => somme + f.amount, 0)
  return { caVente: total("ca_micro_vente"), caServicesBic: total("ca_micro_services_bic"), caServicesBnc: total("ca_micro_services_bnc") }
}

/**
 * Les micro-entreprises du titulaire de celle-ci, elle comprise. Une personne n'a qu'une entreprise individuelle : les
 * plafonds du régime micro et de la franchise de TVA s'apprécient sur leur chiffre d'affaires réuni (voir
 * `entreprisesDuTitulaire`, regles-de-structure.ts). Une seule, presque toujours.
 */
export function microsReunies<M extends { id: string; type: string; legalStatus?: string }>(session: { entities: M[]; relationships?: Relations }, microId: string): M[] {
  return entreprisesDuTitulaire(session, microId).filter(e => e.type === "micro-entreprise")
}

/** Chiffre d'affaires réuni de plusieurs micro-entreprises, par nature. */
export function chiffreAffairesReuni(monthlyData: MonthlyGridData, microIds: string[]): ChiffreAffairesMicro {
  return microIds
    .map(id => chiffreAffairesDeLaMicro(monthlyData, id))
    .reduce((somme, ca) => ({ caVente: somme.caVente + ca.caVente, caServicesBic: somme.caServicesBic + ca.caServicesBic, caServicesBnc: somme.caServicesBnc + ca.caServicesBnc }), { caVente: 0, caServicesBic: 0, caServicesBnc: 0 })
}

/**
 * Part des plafonds qui s'applique à l'entreprise que forment ces micro-entreprises : celle de la plus ancienne. Une
 * activité ajoutée en cours d'année à une entreprise qui existait déjà ne réduit pas ses plafonds.
 */
export function prorataDeLEntreprise(micros: Pick<MicroEntreprise, "dateDeCreation">[], annee: number): number {
  return Math.max(...micros.map(micro => prorataDesPlafonds(lireMois(micro.dateDeCreation), annee)))
}

// --- ACRE d'une micro-entreprise ---

/** Période de l'ACRE d'une micro-entreprise et sa réduction, d'après sa date de création. */
export interface PeriodeACRE {
  debut: MoisCivil
  fin: MoisCivil
  reduction: number
}

/**
 * L'ACRE d'une micro-entreprise court du mois de création jusqu'à la fin du 3e trimestre civil qui suit celui du
 * début d'activité (F11677 : début le 3 septembre 2026, fin le 30 juin 2027). Sa réduction est celle de la date de
 * création : la dernière entrée des règles dont le mois ne dépasse pas celui de la création.
 */
export function periodeACRE(creation: MoisCivil, regles: ReglesFiscales): PeriodeACRE {
  const { trimestresCivilsApresLeDebut, reductionsParDateDeCreation } = regles.microEntreprise.ACRE
  const trimestre = Math.floor(rangDuMois(creation) / 3)
  const fin = moisDuRang((trimestre + trimestresCivilsApresLeDebut) * 3 + 2)
  const creee = ecrireMois(creation)
  const applicables = reductionsParDateDeCreation.filter(r => r.aPartirDe <= creee)
  return { debut: creation, fin, reduction: applicables[applicables.length - 1]?.reduction ?? regles.microEntreprise.reductionACRE }
}

/** Mois de l'année (0 pour janvier) couverts par une période. */
export function moisCouverts(periode: Pick<PeriodeACRE, "debut" | "fin">, annee: number): number[] {
  return Array.from({ length: 12 }, (_, mois) => mois).filter(mois => {
    const rang = annee * 12 + mois
    return rang >= rangDuMois(periode.debut) && rang <= rangDuMois(periode.fin)
  })
}

/** L'ACRE d'une micro-entreprise sur une année : sa période, les mois couverts et le chiffre d'affaires de ces mois. */
export interface ACREDuneAnnee extends PeriodeACRE {
  mois: number[]
  chiffreAffaires: ChiffreAffairesMicro
}

/**
 * L'ACRE de l'année, mois par mois, pour une micro-entreprise qui en bénéficie et dont la date de création est connue ;
 * `null` sinon (sans date de création, l'ACRE s'applique à toute l'année, comme avant).
 */
export function acreDeLAnnee(micro: Pick<MicroEntreprise, "id" | "beneficieACRE" | "dateDeCreation">, annee: number, monthlyData: MonthlyGridData, regles: ReglesFiscales): ACREDuneAnnee | null {
  const creation = lireMois(micro.dateDeCreation)
  if (!micro.beneficieACRE || !creation) return null
  const periode = periodeACRE(creation, regles)
  const mois = moisCouverts(periode, annee)
  return { ...periode, mois, chiffreAffaires: chiffreAffairesDeLaMicro(monthlyData, micro.id, mois) }
}

/** Cotisations économisées sur l'année : celles du chiffre d'affaires des mois couverts, multipliées par la réduction. */
export function economieACRE(acre: ACREDuneAnnee, regles: ReglesFiscales): number {
  const { caVente, caServicesBic, caServicesBnc } = acre.chiffreAffaires
  const taux = regles.microEntreprise.cotisations
  return (caVente * taux.venteBic + caServicesBic * taux.servicesBic + caServicesBnc * taux.servicesBnc) * acre.reduction
}

/** « de septembre à décembre 2026 », « en mars 2027 ». */
function moisDeLAnnee(mois: number[], annee: number): string {
  const premier = { annee, mois: mois[0] + 1 }
  if (mois.length === 1) return `en ${libelleDuMois(premier)}`
  return `de ${libelleDuMois(premier, false)} à ${libelleDuMois({ annee, mois: mois[mois.length - 1] + 1 })}`
}

/** Ce que l'ACRE change cette année, pour les résultats et les exports ; `null` si l'aide ne couvre aucun mois de l'année. */
export function noteACRE(acre: ACREDuneAnnee, annee: number, economie: number): string | null {
  if (acre.mois.length === 0) return null
  const pourcentage = pourcentDeNombre(Math.round(acre.reduction * 100))
  return `ACRE : cotisations réduites de ${pourcentage} sur le chiffre d'affaires ${moisDeLAnnee(acre.mois, annee)}, soit ${euros(economie)} de moins ; l'aide court de ${libelleDuMois(acre.debut)} à fin ${libelleDuMois(acre.fin)}. Pendant l'aide, les droits (trimestres de retraite, indemnités journalières) sont calculés sur les cotisations réduites.`
}

/** Plafonds réduits au prorata l'année de création : ce qu'il faut savoir, pour les résultats et les exports. */
export function noteProrata(creation: MoisCivil, plafonds: ReglesFiscales["microEntreprise"]["plafonds"], prorata: number): string {
  return `Année de création (${libelleDuMois(creation)}) : plafonds du régime micro réduits au prorata de ${joursDActivite(creation)} jours d'activité, soit ${euros(plafonds.services * prorata)} de prestations de services et ${euros(plafonds.vente * prorata)} de chiffre d'affaires total.`
}

// --- CFE ---

/** Part de la CFE d'une année pleine due cette année : rien l'année de création (ni avant), la moitié l'année suivante. */
export function partDeCFEDue(creation: MoisCivil | null, annee: number, regles: ReglesFiscales): number {
  if (!creation || annee > creation.annee + 1) return 1
  return annee <= creation.annee ? regles.CFE.partDueAnneeDeCreation : regles.CFE.partDueAnneeSuivante
}

/** Ce qui est retenu pour la CFE cette année, quand elle n'est pas due en entier ; `null` sinon. */
export function noteCFE(creation: MoisCivil | null, annee: number, regles: ReglesFiscales): string | null {
  const part = partDeCFEDue(creation, annee, regles)
  if (!creation || part >= 1) return null
  if (annee < creation.annee) return `CFE non comptée en ${annee} : l'activité n'est créée qu'en ${libelleDuMois(creation)}.`
  if (annee === creation.annee) return `CFE exonérée l'année de création (${annee}) : le poste CFE des frais de fonctionnement n'est pas compté.`
  return `CFE de ${annee}, l'année qui suit la création : base d'imposition réduite de moitié, le poste CFE des frais de fonctionnement est compté pour ${pourcentDeNombre(Math.round(part * 100))}.`
}

// --- Exonération d'impôt sur les bénéfices en zone (ZFU-TE, QPV : voir l'ADR 017) ---

/** Le régime de zone d'une activité d'après son mois de création : celui dont la fenêtre le contient ; `null` s'il n'y en a pas. */
export function regimeDeZone(creation: MoisCivil, regles: Pick<ReglesFiscales, "exonerationsDeZone">): RegimeDeZone | null {
  const creee = ecrireMois(creation)
  return regles.exonerationsDeZone.regimes.find(regime => regime.creationDepuis <= creee && creee <= regime.creationJusquA) ?? null
}

/** Part du bénéfice exonérée un mois donné, d'après son rang depuis le mois de création (0 pour celui-ci) ; 0 avant la création. */
function partExonereeDuMois(rang: number, regime: RegimeDeZone): number {
  if (rang < 0) return 0
  if (rang < regime.moisExonerationTotale) return 1
  return regime.partsExonereesEnsuite[Math.floor((rang - regime.moisExonerationTotale) / 12)] ?? 0
}

/** Moyenne de taux mensuels ; des mois au même taux donnent ce taux, sans erreur d'arrondi (douze fois 0,6 font 0,6). */
function moyenne(taux: number[]): number {
  if (taux.length === 0) return 0
  if (taux.every(t => t === taux[0])) return taux[0]
  return taux.reduce((somme, t) => somme + t, 0) / taux.length
}

/** L'exonération de zone d'une activité sur une année. */
export interface ExonerationDeZone {
  regime: RegimeDeZone
  /** Mois d'activité de l'année : douze, ou moins l'année de création. */
  moisDActivite: number
  /** Part du bénéfice de l'année exonérée (0 à 1) : la moyenne des taux de ses mois d'activité. */
  partExoneree: number
  /** Bénéfice exonéré maximal de l'année, au prorata des mois d'activité ; `null` : aucun plafond. */
  plafond: number | null
  /** Dernier mois exonéré en totalité, et dernier mois exonéré en partie. */
  finExonerationTotale: MoisCivil
  fin: MoisCivil
}

/**
 * L'exonération de zone d'une activité créée ce mois-là, pour une année ; `null` si aucun régime ne couvre sa date de
 * création. Chaque mois d'activité de l'année a son taux, d'après son rang depuis le mois de création ; le bénéfice de
 * l'année est réputé réparti également entre eux (choix de modélisation : aucun texte ne fixe la répartition d'une année
 * à cheval sur deux taux). Avant la création ou après la dernière période, la part exonérée est nulle.
 */
export function exonerationDeZoneDeLAnnee(creation: MoisCivil, annee: number, regles: Pick<ReglesFiscales, "exonerationsDeZone">): ExonerationDeZone | null {
  const regime = regimeDeZone(creation, regles)
  if (!regime) return null
  const debut = rangDuMois(creation)
  const taux = Array.from({ length: 12 }, (_, mois) => annee * 12 + mois - debut)
    .filter(rang => rang >= 0)
    .map(rang => partExonereeDuMois(rang, regime))
  const moisDActivite = taux.length
  return {
    regime,
    moisDActivite,
    partExoneree: moyenne(taux),
    plafond: regime.plafondAnnuel === null ? null : (regime.plafondAnnuel * moisDActivite) / 12,
    finExonerationTotale: moisDuRang(debut + regime.moisExonerationTotale - 1),
    fin: moisDuRang(debut + regime.moisExonerationTotale + regime.partsExonereesEnsuite.length * 12 - 1)
  }
}

/**
 * Bénéfice exonéré d'impôt de l'année : la part du bénéfice imposable réalisée dans la zone, multipliée par la part
 * exonérée, dans la limite du plafond (BOI-BIC-CHAMP-80-10-20-40, § 260 : le plafond s'applique après le taux dégressif).
 * Le bénéfice imposable s'entend après imputation des déficits antérieurs (§ 100) ; une perte n'exonère rien.
 */
export function beneficeExonereEnZone(beneficeImposable: number, partDansLaZone: number, exoneration: Pick<ExonerationDeZone, "partExoneree" | "plafond">): number {
  const exonere = Math.max(0, beneficeImposable) * Math.min(1, Math.max(0, partDansLaZone)) * exoneration.partExoneree
  return exoneration.plafond === null ? exonere : Math.min(exonere, exoneration.plafond)
}

// --- Sortie du régime micro ---

/** Ce que le régime micro devient, une année donnée, pour les micro-entreprises de la session (par identifiant). */
export interface RegimeMicroDeLAnnee {
  /** Passées au réel : deux années de suite au-delà des plafonds avant cette année. Elles sont simulées en EI au réel. */
  sorties: Record<string, SortieDuRegimeMicro>
  /** Deuxième année de suite au-delà des plafonds : sortie au 1er janvier de l'année suivante. */
  annonces: Record<string, SortieDuRegimeMicro>
  /** Revenues au régime micro cette année, après une année au réel : l'une des deux années précédentes est sous les plafonds. */
  retours: string[]
}

/** Le strict nécessaire d'une session pour suivre le régime de ses micro-entreprises. */
export interface SessionPourLeRegimeMicro {
  entities: { id: string; type: string; legalStatus?: string }[]
  /** Pour réunir les micro-entreprises d'un même titulaire ; absentes, chaque micro-entreprise est seule. */
  relationships?: Relations
  annees: { annee: number; monthlyData: MonthlyGridData }[]
}

type Micro = Pick<MicroEntreprise, "id" | "dateDeCreation" | "horsPlafondAnneePrecedente">

/**
 * L'année `x` est-elle au-delà des plafonds en vigueur l'année testée (dont on donne les règles) ? Avant la création,
 * non ; l'année de création, au prorata ; l'année qui précède la session, d'après la case de la fiche ; plus tôt, on
 * ne sait pas : non. Le chiffre d'affaires est celui de toutes les micro-entreprises du titulaire, qui ne forment
 * qu'une entreprise : elles sortent du régime, et y reviennent, ensemble.
 */
function auDelaDesPlafonds(session: SessionPourLeRegimeMicro, micro: Micro, x: number, reglesTestees: ReglesFiscales): boolean {
  const creees = (microsReunies(session, micro.id) as Micro[]).filter(m => !((lireMois(m.dateDeCreation)?.annee ?? x) > x))
  if (creees.length === 0) return false
  const annee = session.annees.find(a => a.annee === x)
  if (!annee) return x === session.annees[0].annee - 1 && creees.some(m => m.horsPlafondAnneePrecedente === true)
  return depassePlafondMicro(chiffreAffairesReuni(annee.monthlyData, creees.map(m => m.id)), reglesTestees, prorataDeLEntreprise(creees, x))
}

/**
 * Le régime d'une micro-entreprise sur chaque année de la session. Le régime micro s'applique en N si le chiffre
 * d'affaires de N-1 ou de N-2 ne dépasse pas les plafonds en vigueur en N (F32353) : deux années de suite au-delà font
 * passer au réel au 1er janvier suivant, une année sous les plafonds y fait revenir. Les années avant la session sont
 * inconnues, sauf celle qui la précède (case « hors plafond l'année précédente ») ; une année sans règles est ignorée.
 */
function regimesDeLaMicro(session: SessionPourLeRegimeMicro, micro: Micro) {
  const sorties = new Map<number, SortieDuRegimeMicro>()
  const annonces = new Map<number, SortieDuRegimeMicro>()
  for (const { annee } of session.annees) {
    const regles = reglesDeLAnnee(annee).regles
    const suivantes = reglesDeLAnnee(annee + 1).regles
    if (!regles || !suivantes) continue
    if (auDelaDesPlafonds(session, micro, annee - 1, regles) && auDelaDesPlafonds(session, micro, annee - 2, regles)) {
      // Toujours au réel l'année suivante : la sortie reste datée du premier 1er janvier, avec ses deux années d'origine.
      sorties.set(annee, sorties.get(annee - 1) ?? { depuis: annee, depassements: [annee - 2, annee - 1] })
    } else if (auDelaDesPlafonds(session, micro, annee, suivantes) && auDelaDesPlafonds(session, micro, annee - 1, suivantes)) {
      annonces.set(annee, { depuis: annee + 1, depassements: [annee - 1, annee] })
    }
  }
  return { sorties, annonces }
}

/** Pour chaque année de la session, le régime de ses micro-entreprises (sorties, annonces, retours). */
export function regimesMicroDesAnnees(session: SessionPourLeRegimeMicro): Map<number, RegimeMicroDeLAnnee> {
  const parAnnee = new Map<number, RegimeMicroDeLAnnee>(session.annees.map(({ annee }) => [annee, { sorties: {}, annonces: {}, retours: [] }]))
  const micros = session.entities.filter((e): e is Micro & { type: "micro-entreprise" } => e.type === "micro-entreprise")
  for (const micro of micros) {
    const { sorties, annonces } = regimesDeLaMicro(session, micro)
    for (const [annee, regime] of parAnnee) {
      const sortie = sorties.get(annee)
      const annonce = annonces.get(annee)
      if (sortie) regime.sorties[micro.id] = sortie
      if (annonce) regime.annonces[micro.id] = annonce
      if (!sortie && sorties.has(annee - 1)) regime.retours.push(micro.id)
    }
  }
  return parAnnee
}

/** « Sortie du régime micro au 1er janvier 2028 : chiffre d'affaires au-delà des plafonds en 2026 et 2027. » */
export function noteSortie({ depuis, depassements }: SortieDuRegimeMicro, annee: number): string {
  const cause = `chiffre d'affaires au-delà des plafonds en ${depassements[0]} et ${depassements[1]}`
  if (depuis === annee) return `Sortie du régime micro au 1er janvier ${depuis} : ${cause}. L'activité est simulée en entreprise individuelle au réel : charges réelles déductibles, cotisations des indépendants sur le bénéfice.`
  return `Régime réel depuis le 1er janvier ${depuis} (sortie du régime micro : ${cause}) : l'activité reste simulée en entreprise individuelle au réel tant que le chiffre d'affaires dépasse les plafonds.`
}

/** L'annonce de la sortie, l'année du second dépassement. */
export function noteAnnonce({ depuis, depassements }: SortieDuRegimeMicro): string {
  return `Deuxième année de suite au-delà des plafonds (${depassements[0]} et ${depassements[1]}) : sortie du régime micro au 1er janvier ${depuis}, l'activité passera au régime réel.`
}

/** Le retour au régime micro, après une année au réel. */
export function noteRetour(annee: number): string {
  return `Retour au régime micro au 1er janvier ${annee} : le chiffre d'affaires de ${annee - 1} ne dépasse pas les plafonds.`
}
