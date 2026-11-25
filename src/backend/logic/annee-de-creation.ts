// src/backend/logic/annee-de-creation.ts

/*
 * L'année de création d'une activité, et les années qui la précèdent (voir l'ADR 020). Les calculs ne changent pas :
 * ils reçoivent les règles de l'année ramenées à la période d'activité.
 *   - L'année de création (sauf création en janvier), le plafond de la sécurité sociale est réduit aux mois d'activité :
 *     pour les indépendants (article R613-17 du code de la sécurité sociale), et pour le président et les salariés
 *     (article R242-2, un plafond mensuel par mois d'emploi). La limite du taux réduit d'impôt sur les sociétés l'est
 *     aussi (article 219 I b du CGI). Le minimum de retraite de base des indépendants n'est dû qu'après 90 jours
 *     d'affiliation dans l'année (articles D633-2 et D642-4) ; celui des indemnités journalières et la formation
 *     professionnelle restent entiers (Urssaf) ; celui de l'invalidité-décès suit le plafond (hypothèse, ADR 020).
 *   - Une année avant la création, l'activité n'est pas affiliée : aucune cotisation minimale, aucun forfait. Ce qui y
 *     est saisi reste compté, avec un avertissement.
 * Le simulateur ne connaît que le mois de création : l'activité commence le 1er de ce mois.
 */

import type { FinancialFlow, MonthlyGridData } from "../../types.js"
import { joursDActivite, libelleDuMois, lireMois, type MoisCivil } from "./dispositifs.js"
import { euros } from "./format.js"
import type { BaremeInvaliditeDecesLiberal, ReglesFiscales } from "./regles.js"

/** L'année de création d'une activité, quand elle ne compte pas douze mois d'activité. */
export interface AnneeDeCreation {
  creation: MoisCivil
  /** Mois d'activité, du mois de création à décembre : de 1 à 11. */
  mois: number
  /** Jours d'activité, le 1er du mois de création compris. */
  jours: number
}

/** L'année de création, quand c'est `annee` et que la création n'est pas en janvier ; `null` sinon. */
export function anneeDeCreation(dateDeCreation: string | undefined, annee: number): AnneeDeCreation | null {
  const creation = lireMois(dateDeCreation)
  if (creation?.annee !== annee || creation.mois === 1) return null
  return { creation, mois: 13 - creation.mois, jours: joursDActivite(creation) }
}

/** Le mois de création, quand il est postérieur à l'année `annee` ; `null` sinon. */
export function creationApres(dateDeCreation: string | undefined, annee: number): MoisCivil | null {
  const creation = lireMois(dateDeCreation)
  return creation !== null && creation.annee > annee ? creation : null
}

/** Ce que l'année est pour l'activité : entière, l'année de sa création, ou une année avant celle-ci. */
export type PeriodeDeLActivite = { cas: "entiere" } | ({ cas: "creation" } & AnneeDeCreation) | { cas: "avant"; creation: MoisCivil }

export function periodeDeLActivite(dateDeCreation: string | undefined, annee: number): PeriodeDeLActivite {
  const creation = anneeDeCreation(dateDeCreation, annee)
  if (creation) return { cas: "creation", ...creation }
  const apres = creationApres(dateDeCreation, annee)
  return apres ? { cas: "avant", creation: apres } : { cas: "entiere" }
}

/** Les minimums d'une année où la retraite de base n'en a pas : moins de jours d'affiliation que le seuil. */
function sansMinimumDeRetraiteSousLeSeuil<M extends { retraiteDeBase: number; joursDAffiliationMinimumRetraiteDeBase: number }>(minimums: M, jours: number): M {
  return jours < minimums.joursDAffiliationMinimumRetraiteDeBase ? { ...minimums, retraiteDeBase: 0 } : minimums
}

/** Les règles de l'année de création : plafonds et limites au prorata des mois d'activité (tableau de l'ADR 020). */
export function reglesDeLAnneeDeCreation(regles: ReglesFiscales, { mois, jours }: AnneeDeCreation): ReglesFiscales {
  const part = mois / 12
  const { TNS, liberauxReglementes, regimeGeneral, IS } = regles
  return {
    ...regles,
    TNS: {
      ...TNS,
      plafondSecuriteSociale: TNS.plafondSecuriteSociale * part,
      formationProfessionnelle: { ...TNS.formationProfessionnelle, plafondEntier: TNS.formationProfessionnelle.plafondEntier ?? TNS.plafondSecuriteSociale },
      cotisationsMinimales: sansMinimumDeRetraiteSousLeSeuil({ ...TNS.cotisationsMinimales, invaliditeDeces: TNS.cotisationsMinimales.invaliditeDeces * part }, jours)
    },
    liberauxReglementes: {
      ...liberauxReglementes,
      commun: { ...liberauxReglementes.commun, cotisationsMinimales: sansMinimumDeRetraiteSousLeSeuil(liberauxReglementes.commun.cotisationsMinimales, jours) }
    },
    regimeGeneral: {
      ...regimeGeneral,
      plafondSecuriteSociale: regimeGeneral.plafondSecuriteSociale * part,
      reductionGenerale: { ...regimeGeneral.reductionGenerale, smicAnnuel: regimeGeneral.reductionGenerale.smicAnnuel * part }
    },
    IS: { ...IS, plafondTauxReduit: IS.plafondTauxReduit * part }
  }
}

/** Une invalidité-décès de caisse sans forfait ni assiette minimale. */
const sansForfait = (bareme: BaremeInvaliditeDecesLiberal): BaremeInvaliditeDecesLiberal => ({ ...bareme, forfait: 0, assietteMinimalePartDuPlafond: 0 })

/**
 * Les règles d'une année avant la création : l'activité n'est pas affiliée, elle ne doit ni cotisation minimale ni
 * forfait (formation professionnelle, forfaits des caisses de libéraux). Ce qui y est saisi est calculé sans eux.
 */
export function reglesAvantLaCreation(regles: ReglesFiscales): ReglesFiscales {
  const { TNS, liberauxReglementes } = regles
  const { CIPAV, CARPIMKO, commun } = liberauxReglementes
  return {
    ...regles,
    TNS: {
      ...TNS,
      formationProfessionnelle: { ...TNS.formationProfessionnelle, tauxSurPlafond: 0 },
      cotisationsMinimales: { ...TNS.cotisationsMinimales, indemnitesJournalieres: 0, retraiteDeBase: 0, invaliditeDeces: 0 }
    },
    liberauxReglementes: {
      ...liberauxReglementes,
      commun: { ...commun, cotisationsMinimales: { ...commun.cotisationsMinimales, indemnitesJournalieres: 0, retraiteDeBase: 0 } },
      CIPAV: { ...CIPAV, invaliditeDeces: sansForfait(CIPAV.invaliditeDeces) },
      CARPIMKO: {
        ...CARPIMKO,
        invaliditeDeces: sansForfait(CARPIMKO.invaliditeDeces),
        retraiteComplementaire: { ...CARPIMKO.retraiteComplementaire, forfait: 0, assietteMinimale: 0 },
        asv: { ...CARPIMKO.asv, forfaitPraticien: 0, forfaitAssuranceMaladie: 0 }
      }
    }
  }
}

/** Les règles qu'applique une activité pour l'année, d'après sa période. */
export function reglesDeLaPeriode(regles: ReglesFiscales, periode: PeriodeDeLActivite): ReglesFiscales {
  if (periode.cas === "creation") return reglesDeLAnneeDeCreation(regles, periode)
  if (periode.cas === "avant") return reglesAvantLaCreation(regles)
  return regles
}

// --- Ce que les résultats en disent ---


/** « avril 2026, 9 mois d'activité ». */
export function periodeEnClair({ creation, mois }: AnneeDeCreation): string {
  return `${libelleDuMois(creation)}, ${mois} mois d'activité`
}

/** La limite du taux réduit d'impôt sur les sociétés, réduite aux mois d'activité. */
function phraseDeLImpotSurLesSocietes(a: AnneeDeCreation, regles: ReglesFiscales): string {
  return `taux réduit d'impôt sur les sociétés (${Math.round(regles.IS.tauxReduit * 100)} %) jusqu'à ${euros((regles.IS.plafondTauxReduit * a.mois) / 12)} de bénéfice (${euros(regles.IS.plafondTauxReduit)} réduits à ${a.mois} mois)`
}

const PREMIER_EXERCICE = "Le premier exercice est compté sur l'année civile ; une société peut aussi clore son premier exercice l'année suivante, ce que le simulateur ne modélise pas."

/**
 * Ce que les résultats disent de l'année de création d'un indépendant (EI au réel ; gérant d'EURL, `societe` : avec la
 * limite de l'impôt sur les sociétés). `regles` sont celles de l'année entière ; `ecart`, les cotisations de l'année de
 * création moins celles d'une année pleine.
 */
export function noteDeCreationIndependant(a: AnneeDeCreation, regles: ReglesFiscales, ecart: number, minimumsAppliques: boolean, societe: boolean): string {
  const plafond = regles.TNS.plafondSecuriteSociale * (a.mois / 12)
  const phrases = [`Année de création (${periodeEnClair(a)}) : les cotisations se calculent sur un plafond de la sécurité sociale réduit aux mois d'activité, ${euros(plafond)}.`]
  if (Math.abs(ecart) >= 1) {
    phrases.push(ecart > 0 ? `Elles coûtent ${euros(ecart)} de plus qu'en année pleine : le même revenu, gagné en ${a.mois} mois, pèse plus lourd face au plafond.` : `Elles coûtent ${euros(-ecart)} de moins qu'en année pleine.`)
  }
  if (a.jours < regles.TNS.cotisationsMinimales.joursDAffiliationMinimumRetraiteDeBase) {
    phrases.push(`Moins de ${regles.TNS.cotisationsMinimales.joursDAffiliationMinimumRetraiteDeBase} jours d'activité en ${a.creation.annee} : pas de cotisation minimale de retraite de base.`)
  }
  if (minimumsAppliques) {
    phrases.push(`Minimum d'invalidité-décès réduit à ${a.mois} mois (lecture de l'article R613-17, à confirmer) ; minimum des indemnités journalières et formation professionnelle entiers, comme le prévoit l'Urssaf.`)
  }
  if (societe) phrases.push(`Société : ${phraseDeLImpotSurLesSocietes(a, regles)}. ${PREMIER_EXERCICE}`)
  return phrases.join(" ")
}

/** Ce que les résultats disent de l'année de création d'une SASU : plafond du président, limite du taux réduit. */
export function noteDeCreationSociete(a: AnneeDeCreation, regles: ReglesFiscales, presidentRemunere: boolean): string {
  const reduits = [phraseDeLImpotSurLesSocietes(a, regles)]
  if (presidentRemunere) {
    const mensuel = regles.regimeGeneral.plafondSecuriteSociale / 12
    reduits.unshift(`plafond de la sécurité sociale du président de ${euros(mensuel * a.mois)} (${euros(mensuel)} × ${a.mois} mois de mandat)`)
  }
  return `Année de création (${periodeEnClair(a)}) : ${reduits.join(" ; ")}. ${PREMIER_EXERCICE}`
}

/** Une année entière avant la création. */
export function noteAvantLaCreation(creation: MoisCivil, annee: number): string {
  return `Activité créée en ${libelleDuMois(creation)} : en ${annee}, elle n'est pas encore affiliée, et ne doit ni cotisation minimale ni forfait.`
}

// --- Montants saisis avant la création ---

/** Les montants qu'une activité a saisis, cette année, avant son mois de création : les mois concernés et leur total par nature. */
export interface SaisiAvantLaCreation {
  /** Mois concernés (0 pour janvier). */
  mois: number[]
  /** Totaux par nature, dans l'ordre de `NATURES` : « 4 000 € de chiffre d'affaires ». */
  montants: { nature: string; montant: number }[]
}

/** La nature d'un flux d'activité, telle que l'avertissement la nomme. */
function natureDuFlux(type: FinancialFlow["type"]): string {
  if (type.startsWith("ca_")) return "de chiffre d'affaires"
  if (type === "deductible_expense" || type === "expense") return "de charges"
  if (type === "director_remuneration") return "de rémunération du dirigeant"
  if (type === "dividends_payment") return "de dividendes"
  return "d'autres montants"
}

const NATURES = ["de chiffre d'affaires", "de charges", "de rémunération du dirigeant", "de dividendes", "d'autres montants"]

/** Les mois de l'année antérieurs à la création (0 pour janvier) : tous pour une année avant la création. */
export function moisAvantLaCreation(dateDeCreation: string | undefined, annee: number): number[] {
  const creation = lireMois(dateDeCreation)
  if (!creation || creation.annee < annee) return []
  const nombre = creation.annee > annee ? 12 : creation.mois - 1
  return Array.from({ length: nombre }, (_, mois) => mois)
}

/** Ce qu'une activité a saisi avant sa création cette année ; `null` si rien. Les montants de la personne n'en sont pas. */
export function saisiAvantLaCreation(monthlyData: MonthlyGridData, entityId: string, dateDeCreation: string | undefined, annee: number): SaisiAvantLaCreation | null {
  const avant = moisAvantLaCreation(dateDeCreation, annee)
  if (avant.length === 0) return null
  const flux = monthlyData.filter(m => avant.includes(m.month)).flatMap(m => m.flows.filter(f => f.entityId === entityId && f.amount !== 0).map(f => ({ ...f, month: m.month })))
  if (flux.length === 0) return null
  const parNature = new Map<string, number>()
  for (const f of flux) parNature.set(natureDuFlux(f.type), (parNature.get(natureDuFlux(f.type)) ?? 0) + f.amount)
  return {
    mois: [...new Set(flux.map(f => f.month))].sort((a, b) => a - b),
    montants: NATURES.filter(nature => parNature.has(nature)).map(nature => ({ nature, montant: parNature.get(nature) ?? 0 }))
  }
}

/** L'avertissement des montants saisis avant la création : ils sont comptés quand même (décision du 2026-11-24). */
export function avertissementSaisiAvantLaCreation(saisi: SaisiAvantLaCreation, creation: MoisCivil, annee: number, nom?: string): string {
  const mois = saisi.mois.map(m => libelleDuMois({ annee, mois: m + 1 }, false)).join(", ")
  const montants = saisi.montants.map(({ nature, montant }) => `${euros(montant)} ${nature}`).join(", ")
  // Sur la carte de l'activité, son nom est déjà là ; au-dessus de la grille, il dit de quelle activité il s'agit.
  const qui = nom === undefined ? "Activité créée" : `« ${nom} » est créée`
  return `${qui} en ${libelleDuMois(creation)} : ${montants} saisis avant la création (${mois} ${annee}), comptés quand même. Corrigez la date de création, ou déplacez ces montants.`
}

/** L'avertissement de l'activité, quand des montants sont saisis avant sa création cette année ; rien sinon. */
export function avertissementsAvantLaCreation(monthlyData: MonthlyGridData, activite: { id: string; dateDeCreation?: string }, annee: number, nom?: string): string[] {
  const creation = lireMois(activite.dateDeCreation)
  const saisi = saisiAvantLaCreation(monthlyData, activite.id, activite.dateDeCreation, annee)
  return creation && saisi ? [avertissementSaisiAvantLaCreation(saisi, creation, annee, nom)] : []
}
