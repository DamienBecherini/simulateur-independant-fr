// src/backend/logic/epargne-retraite.ts
// Versements sur un plan d'épargne retraite (PER), voir l'ADR 021.
//   - Déduits du revenu global (article 163 quatervicies du CGI) : le plafond de chaque personne, l'imputation de ses
//     versements sur ce plafond puis sur les plafonds reportés, la mise en commun des plafonds d'un couple, ce que
//     l'année laisse à la suivante.
//   - Pour l'entrepreneur individuel au réel et le gérant d'EURL, ce qui dépasse se déduit du bénéfice ou de la
//     rémunération (article 154 bis) : la limite de l'année, l'activité qui porte la déduction, et ce qu'elle retire
//     du plafond de l'année suivante.
// Et les messages qui le disent. Ce module ne connaît ni les flux ni le barème : impot-du-foyer.ts lui donne les
// versements et les revenus, et en tire les déductions.

import type { DeductionDuRevenuProfessionnel, EpargneRetraiteDeLaPersonne, EpargneRetraiteDuFoyer, OrigineDuPlafondEpargneRetraite, Person, PlafondReporte } from "../../types.js"
import { deNom, euros, pourcent } from "./format.js"
import { premiereAnneeSimulable, type ReglesDeductionDuRevenuProfessionnel, type ReglesEpargneRetraite, type ReglesFiscales } from "./regles.js"

/** Ce qu'une personne reçoit de l'année précédente de la session. */
export interface PlafondsHerites {
  /** Plafond calculé sur ses revenus de l'année précédente : celui de ses versements de l'année. */
  plafondCalcule: number
  /** Ce qui lui restait de ses plafonds à la fin de l'année précédente. */
  plafondsRestants: PlafondReporte[]
  /** Reste du plafond saisi la première année, que le simulateur ne reporte pas. */
  resteNonReporte?: PlafondReporte
}

/**
 * Un membre du foyer, avec ce que l'imputation de ses versements sur les plafonds du revenu global a besoin de savoir :
 * rien qui dépende des revenus de l'année.
 */
export interface VersantDuFoyer {
  personId: string
  /** Déclarant d'un couple marié ou pacsé : ses plafonds et ceux de son conjoint sont mis en commun. */
  enCouple: boolean
  /** Versements de l'année sur un plan d'épargne retraite. */
  verse: number
  /** Plafond saisi dans sa fiche, quand il vaut pour l'année (`plafondSaisiDeLAnnee`) : il l'emporte alors sur tout autre. */
  plafondSaisi: number | undefined
  /** L'année pour laquelle vaut le plafond saisi dans sa fiche, quand ce n'est pas celle-ci. */
  plafondSaisiPour?: number
  /**
   * Ce qu'il reçoit de l'année précédente ; `null` quand elle n'est pas dans la session ; `undefined` la première
   * année simulée de la session.
   */
  herites: PlafondsHerites | null | undefined
}

/**
 * Ce que le plafond saisi dans la fiche d'une personne donne à une année : son montant s'il vaut pour elle ; sinon,
 * l'année pour laquelle il vaut. Il vaut pour l'année enregistrée avec lui ; sans année enregistrée (fichier d'avant cet
 * enregistrement), pour la première année simulée de la session (`premiereAnnee`).
 */
export function plafondSaisiDeLAnnee(personne: Pick<Person, "plafondEpargneRetraite" | "anneeDuPlafondEpargneRetraite"> | undefined, annee: number, premiereAnnee: boolean): Pick<VersantDuFoyer, "plafondSaisi" | "plafondSaisiPour"> {
  const plafond = personne?.plafondEpargneRetraite
  const pour = personne?.anneeDuPlafondEpargneRetraite
  if (plafond === undefined) return { plafondSaisi: undefined }
  if (pour === undefined) return { plafondSaisi: premiereAnnee ? plafond : undefined }
  return pour === annee ? { plafondSaisi: plafond } : { plafondSaisi: undefined, plafondSaisiPour: pour }
}

/**
 * La personne avec ce plafond d'épargne retraite saisi, et l'année pour laquelle il vaut : celle déjà enregistrée avec
 * le plafond, ou la première année que le simulateur sait simuler parmi `annees`. Sans plafond, ni l'un ni l'autre.
 * La saisie dans la fiche et les propositions des clients d'IA passent par elle.
 */
export function avecLePlafondEpargneRetraite(personne: Person, plafond: number | undefined, annees: number[]): Person {
  const { plafondEpargneRetraite: ancien, anneeDuPlafondEpargneRetraite: anneeEnregistree, ...sansPlafond } = personne
  if (plafond === undefined) return sansPlafond
  // Une année seule, sans plafond (fichier modifié à la main), ne compte pas.
  const annee = (ancien === undefined ? undefined : anneeEnregistree) ?? premiereAnneeSimulable(annees)
  return { ...sansPlafond, plafondEpargneRetraite: plafond, ...(annee === undefined ? {} : { anneeDuPlafondEpargneRetraite: annee }) }
}

/** Un membre du foyer, avec en plus ce que ses revenus de l'année donnent : son plafond de l'année suivante. */
export interface MembreDuFoyer extends VersantDuFoyer {
  /** Ses revenus d'activité professionnelle de l'année, après ce qui est déduit de son bénéfice ou de sa rémunération. */
  revenusProfessionnels: number
  /**
   * Ce qu'il déduit de son bénéfice ou de sa rémunération (`deductionDuRevenuProfessionnel`), et le revenu qui reste
   * après cette déduction : ce qu'elle retire du plafond de l'année suivante en dépend.
   */
  duRevenuProfessionnel?: { deduction: DeductionDuRevenuProfessionnel; revenuApresDeduction: number }
}

/**
 * Le bénéfice d'une entreprise individuelle au réel ou la rémunération d'un gérant d'EURL, tels que le calcul de
 * l'activité les donne : ce dont son titulaire ou son gérant peut déduire ce qui dépasse ses plafonds du revenu global.
 */
export interface RevenuProfessionnelDeLActivite {
  activiteId: string
  personId: string
  cadre: DeductionDuRevenuProfessionnel["cadre"]
  /** Bénéfice imposable de l'entreprise individuelle, ou rémunération imposable du gérant avant la déduction pour frais, avant versement. */
  revenuAvantDeduction: number
  /** Plafond de la sécurité sociale de la période d'activité : réduit l'année de création (BOI-BIC-CHG-40-50-40-20, § 60). */
  plafondSecuriteSociale: number
}

/** Ce même revenu, avec celui sur lequel se calcule la limite de la déduction. */
export interface RevenuDeductible extends RevenuProfessionnelDeLActivite {
  /** Ce bénéfice, ou cette rémunération après la déduction pour frais professionnels (hypothèse 2 de l'ADR 021). */
  revenuDeLaLimite: number
}

/** Le revenu retenu pour la limite : jamais négatif, ni au-delà de quelques plafonds de la sécurité sociale. */
function revenuRetenu(revenu: number, plafondSecuriteSociale: number, regles: ReglesDeductionDuRevenuProfessionnel): number {
  return Math.min(Math.max(0, revenu), regles.revenuRetenuEnPlafonds * plafondSecuriteSociale)
}

/** La part ajoutée à la limite sur la fraction du revenu au-delà d'un plafond de la sécurité sociale (15 %). */
function partAuDelaDUnPlafond(revenu: number, plafondSecuriteSociale: number, regles: ReglesDeductionDuRevenuProfessionnel): number {
  return regles.partAuDelaDUnPlafond * Math.max(0, revenuRetenu(revenu, plafondSecuriteSociale, regles) - plafondSecuriteSociale)
}

/**
 * Limite de ce qui se déduit d'un bénéfice ou d'une rémunération sur l'année (article 154 bis, II du CGI) : une part du
 * revenu, retenu dans la limite de quelques plafonds de la sécurité sociale, plus une part de sa fraction au-delà d'un
 * plafond ; au moins une part du plafond, même sans bénéfice. À l'euro.
 */
export function limiteDuRevenuProfessionnel(revenu: number, plafondSecuriteSociale: number, regles: ReglesDeductionDuRevenuProfessionnel): Pick<DeductionDuRevenuProfessionnel, "limite" | "baseDeLaLimite"> {
  const surLeRevenu = regles.partDuRevenu * revenuRetenu(revenu, plafondSecuriteSociale, regles) + partAuDelaDUnPlafond(revenu, plafondSecuriteSociale, regles)
  const minimum = regles.minimumPartDuPlafond * plafondSecuriteSociale
  return surLeRevenu > minimum ? { limite: Math.round(surLeRevenu), baseDeLaLimite: "revenu" } : { limite: Math.round(minimum), baseDeLaLimite: "minimum" }
}

/**
 * Ce qu'une personne déduit de son revenu professionnel : ce qui dépasse ses plafonds du revenu global (`excedent`),
 * dans la limite de l'année. Avec plusieurs activités qui le permettent, une seule porte la déduction, celle dont le
 * revenu est le plus grand, donc la limite la plus haute (hypothèse 4 de l'ADR 021). La rémunération d'un gérant ne
 * devient pas négative ; un bénéfice peut devenir un déficit, que le minimum de la limite permet. Rien à déduire :
 * `undefined`.
 */
export function deductionDuRevenuProfessionnel(excedent: number, candidats: RevenuDeductible[], regles: ReglesDeductionDuRevenuProfessionnel): DeductionDuRevenuProfessionnel | undefined {
  if (excedent <= 0 || candidats.length === 0) return undefined
  const retenu = candidats.reduce((meilleur, candidat) => (candidat.revenuDeLaLimite > meilleur.revenuDeLaLimite ? candidat : meilleur))
  const { limite, baseDeLaLimite } = limiteDuRevenuProfessionnel(retenu.revenuDeLaLimite, retenu.plafondSecuriteSociale, regles)
  const deductible = retenu.cadre === "remuneration" ? Math.min(limite, Math.max(0, Math.floor(retenu.revenuAvantDeduction))) : limite
  const montant = Math.min(Math.round(excedent), deductible)
  if (montant <= 0) return undefined
  return {
    activiteId: retenu.activiteId,
    personId: retenu.personId,
    cadre: retenu.cadre,
    montant,
    limite,
    baseDeLaLimite,
    revenuDeLaLimite: Math.round(retenu.revenuDeLaLimite),
    revenuAvantDeduction: Math.round(retenu.revenuAvantDeduction),
    plafondSecuriteSociale: Math.round(retenu.plafondSecuriteSociale)
  }
}

/**
 * Ce qu'une déduction du bénéfice ou de la rémunération retire du plafond du revenu global de l'année suivante : son
 * montant, moins la part de 15 % du revenu au-delà d'un plafond de la sécurité sociale (article 163 quatervicies, I-2-a
 * du CGI). Cette part se calcule sur le revenu après déduction (BOI-IR-BASE-20-50-20, § 340), avec le plafond de la
 * sécurité sociale de la limite, réduit l'année de création : c'est la même part (hypothèse 7 de l'ADR 021). À l'euro.
 */
export function reductionDuPlafondSuivant(deduit: number, revenuApresDeduction: number, plafondSecuriteSociale: number, regles: ReglesDeductionDuRevenuProfessionnel): number {
  return Math.max(0, Math.round(deduit - partAuDelaDUnPlafond(revenuApresDeduction, plafondSecuriteSociale, regles)))
}

/**
 * Plafond calculé sur les revenus d'activité professionnelle d'une année, pour les versements de la suivante : une part
 * de ces revenus, retenus dans la limite de quelques plafonds de la sécurité sociale, avec un minimum. Un revenu négatif
 * (déficit) donne le minimum. À l'euro, comme l'administration l'imprime sur l'avis d'impôt.
 */
export function plafondCalculeSurLAnnee(revenusProfessionnels: number, plafondSecuriteSociale: number, regles: ReglesEpargneRetraite): Pick<EpargneRetraiteDeLaPersonne, "plafondCalcule" | "baseDuPlafondCalcule"> {
  const minimum = regles.minimumPartDuPlafond * plafondSecuriteSociale
  const maximum = regles.partDesRevenus * regles.revenusRetenusEnPlafonds * plafondSecuriteSociale
  const surLesRevenus = regles.partDesRevenus * revenusProfessionnels
  if (surLesRevenus <= minimum) return { plafondCalcule: Math.round(minimum), baseDuPlafondCalcule: "minimum" }
  if (surLesRevenus >= maximum) return { plafondCalcule: Math.round(maximum), baseDuPlafondCalcule: "maximum" }
  return { plafondCalcule: Math.round(surLesRevenus), baseDuPlafondCalcule: "revenus" }
}

/**
 * Plafond minimal des versements de l'année : le minimum légal, assis sur le plafond de la sécurité sociale de l'année
 * précédente. Une année au-delà des dernières règles connues est simulée avec elles : le plafond de la sécurité sociale
 * de l'année d'avant est alors le dernier connu, celui de ces règles, et non celui de l'année qui les précède.
 */
export function plafondMinimalDeLAnnee(annee: number, regles: ReglesFiscales): number {
  const epargne = regles.IR.epargneRetraite
  const plafondPrecedent = annee > regles.annee ? regles.regimeGeneral.plafondSecuriteSociale : epargne.plafondSecuriteSocialeAnneePrecedente
  return Math.round(epargne.minimumPartDuPlafond * plafondPrecedent)
}

/** Le plafond d'une personne pour l'année, son origine et les plafonds reportés encore utilisables. */
function plafondsDeLAnnee(membre: VersantDuFoyer, annee: number, regles: ReglesFiscales): Pick<EpargneRetraiteDeLaPersonne, "plafond" | "originePlafond" | "plafondSaisiPour" | "plafondsReportes"> {
  // Le plafond de l'avis d'impôt, qui contient déjà les plafonds reportés : il l'emporte sur ce que la session calcule.
  if (membre.plafondSaisi !== undefined) return { plafond: Math.round(membre.plafondSaisi), originePlafond: "saisi", plafondsReportes: [] }
  if (membre.herites === undefined) {
    // Première année de la session, sans plafond saisi pour elle.
    const pour = membre.plafondSaisiPour === undefined ? {} : { plafondSaisiPour: membre.plafondSaisiPour }
    return { plafond: plafondMinimalDeLAnnee(annee, regles), originePlafond: "minimumFauteDeSaisie", ...pour, plafondsReportes: [] }
  }
  if (membre.herites === null) return { plafond: plafondMinimalDeLAnnee(annee, regles), originePlafond: "minimumFauteDAnneePrecedente", plafondsReportes: [] }
  const plafondsReportes = membre.herites.plafondsRestants.filter(reporte => reporte.montant > 0 && reporte.utilisableJusquEn >= annee).sort((a, b) => a.annee - b.annee)
  return { plafond: membre.herites.plafondCalcule, originePlafond: "calcule", plafondsReportes }
}

/** Un plafond de l'année ou reporté, et ce qu'il en reste au fil des imputations. */
interface Disponible {
  plafond: PlafondReporte
  reste: number
}

/** Impute un montant sur des plafonds, dans leur ordre, et rend ce qui a pu l'être. */
function imputer(montant: number, disponibles: Disponible[]): number {
  let impute = 0
  for (const disponible of disponibles) {
    const part = Math.min(montant - impute, disponible.reste)
    disponible.reste -= part
    impute += part
  }
  return impute
}

/** Le reste non reporté de la première année, tant qu'il pourrait encore servir cette année. */
function encoreUtilisableEn(reste: PlafondReporte | undefined, annee: number): PlafondReporte | undefined {
  return reste && reste.utilisableJusquEn >= annee ? reste : undefined
}

/**
 * L'imputation des versements de chaque membre d'un foyer sur les plafonds du revenu global.
 * 1. Chacun impute ses versements sur son plafond de l'année, puis sur ses plafonds reportés, du plus ancien au plus
 *    récent (BOI-IR-BASE-20-50-30, § 50).
 * 2. Dans un couple marié ou pacsé, ce qui dépasse se prend sur ce qui reste au conjoint, dans le même ordre ; le
 *    reste demeure à celui dont le plafond n'est pas épuisé (brochure pratique de l'impôt sur le revenu, exemple).
 * Elle ne dépend ni des revenus de l'année ni de l'impôt : un versement qui ne réduit rien consomme son plafond quand
 * même (hypothèse 3 de l'ADR 021). Ce qui dépasse les plafonds est donc connu avant tout calcul de revenu. Les montants
 * sont à l'euro, comme sur la déclaration.
 */
function imputerLesVersements<M extends VersantDuFoyer>(membres: M[], annee: number, regles: ReglesFiscales) {
  const epargne = regles.IR.epargneRetraite
  const etats = membres.map(membre => {
    const plafonds = plafondsDeLAnnee(membre, annee, regles)
    const deLAnnee: Disponible = { plafond: { annee, montant: plafonds.plafond, utilisableJusquEn: annee + epargne.anneesDeReport }, reste: plafonds.plafond }
    const disponibles = [deLAnnee, ...plafonds.plafondsReportes.map((plafond): Disponible => ({ plafond, reste: plafond.montant }))]
    const verse = Math.max(0, Math.round(membre.verse))
    return { membre, plafonds, deLAnnee, disponibles, verse, imputeSurSesPlafonds: imputer(verse, disponibles), imputeSurLeConjoint: 0, preteAuConjoint: 0 }
  })

  for (const etat of etats.filter(e => e.membre.enCouple)) {
    for (const conjoint of etats.filter(e => e !== etat && e.membre.enCouple)) {
      const pris = imputer(etat.verse - etat.imputeSurSesPlafonds - etat.imputeSurLeConjoint, conjoint.disponibles)
      etat.imputeSurLeConjoint += pris
      conjoint.preteAuConjoint += pris
    }
  }
  return etats
}

/**
 * Ce que les versements de chaque membre d'un foyer dépassent de ses plafonds du revenu global, mise en commun d'un
 * couple comprise, par personne : ce qui peut se déduire de son bénéfice ou de sa rémunération.
 */
export function excedentsSurLesPlafonds(membres: VersantDuFoyer[], annee: number, regles: ReglesFiscales): Map<string, number> {
  return new Map(imputerLesVersements(membres, annee, regles).map(etat => [etat.membre.personId, etat.verse - etat.imputeSurSesPlafonds - etat.imputeSurLeConjoint]))
}

/**
 * L'épargne retraite de chaque membre d'un foyer pour l'année : l'imputation de ses versements sur les plafonds du
 * revenu global (`imputerLesVersements`) ; puis, pour qui a une entreprise individuelle au réel ou une gérance d'EURL,
 * ce qui dépasse encore et se déduit de son bénéfice ou de sa rémunération, pour le montant décidé avant le calcul du
 * foyer (`duRevenuProfessionnel`), qui réduit le plafond calculé sur l'année, sauf pour sa part de 15 % ; le reste n'est
 * ni déduit ni reporté.
 */
export function epargneRetraiteDesMembres(membres: MembreDuFoyer[], annee: number, regles: ReglesFiscales): EpargneRetraiteDeLaPersonne[] {
  return imputerLesVersements(membres, annee, regles).map(({ membre, plafonds, deLAnnee, disponibles, verse, imputeSurSesPlafonds, imputeSurLeConjoint, preteAuConjoint }): EpargneRetraiteDeLaPersonne => {
    // Du plafond saisi, on ne connaît que le total : son reste n'est pas reporté (hypothèse 1 de l'ADR 021), mais dit.
    const saisi = plafonds.originePlafond === "saisi"
    const aReporter = disponibles.filter(d => d.reste > 0 && d.plafond.utilisableJusquEn > annee && !(saisi && d === deLAnnee)).sort((a, b) => a.plafond.annee - b.plafond.annee)
    const resteDuSaisi = deLAnnee.reste > 0 ? { ...deLAnnee.plafond, montant: deLAnnee.reste } : undefined
    const resteNonReporte = saisi ? resteDuSaisi : encoreUtilisableEn(membre.herites?.resteNonReporte, annee)
    const duRevenuProfessionnel = membre.duRevenuProfessionnel
    return {
      personId: membre.personId,
      verse,
      ...plafonds,
      imputeSurSesPlafonds,
      imputeSurLeConjoint,
      preteAuConjoint,
      ...(duRevenuProfessionnel ? { deduitDuRevenuProfessionnel: duRevenuProfessionnel.deduction } : {}),
      nonDeduit: verse - imputeSurSesPlafonds - imputeSurLeConjoint - (duRevenuProfessionnel?.deduction.montant ?? 0),
      plafondsRestants: aReporter.map(d => ({ ...d.plafond, montant: d.reste })),
      ...(resteNonReporte ? { resteNonReporte } : {}),
      revenusProfessionnels: Math.round(membre.revenusProfessionnels),
      ...plafondLaisseALAnneeSuivante(membre, regles)
    }
  })
}

/**
 * Le plafond calculé sur les revenus de l'année pour les versements de la suivante (sur le plafond de la sécurité
 * sociale de l'année entière), diminué de ce qui a été déduit du bénéfice ou de la rémunération, hors sa part de 15 % ;
 * jamais négatif.
 */
function plafondLaisseALAnneeSuivante(membre: MembreDuFoyer, regles: ReglesFiscales): Pick<EpargneRetraiteDeLaPersonne, "plafondCalcule" | "baseDuPlafondCalcule" | "reductionDuPlafondCalcule"> {
  const epargne = regles.IR.epargneRetraite
  const surLesRevenus = plafondCalculeSurLAnnee(membre.revenusProfessionnels, regles.regimeGeneral.plafondSecuriteSociale, epargne)
  const deduit = membre.duRevenuProfessionnel
  const reduction = deduit ? reductionDuPlafondSuivant(deduit.deduction.montant, deduit.revenuApresDeduction, deduit.deduction.plafondSecuriteSociale, epargne.deductionDuRevenuProfessionnel) : 0
  if (reduction === 0) return surLesRevenus
  return { ...surLesRevenus, plafondCalcule: Math.max(0, surLesRevenus.plafondCalcule - reduction), reductionDuPlafondCalcule: reduction }
}

/** Ce que l'année laisse à la suivante pour une personne, d'après son résultat. */
export function plafondsLaissesALAnneeSuivante(personne: EpargneRetraiteDeLaPersonne): PlafondsHerites {
  return {
    plafondCalcule: personne.plafondCalcule,
    plafondsRestants: personne.plafondsRestants,
    ...(personne.resteNonReporte ? { resteNonReporte: personne.resteNonReporte } : {})
  }
}

// --- Messages ---

/** Ce que les avertissements d'un foyer ont besoin de savoir, au-delà de l'épargne retraite de ses membres. */
export interface LectureDeLaDeduction {
  annee: number
  personnes: EpargneRetraiteDeLaPersonne[]
  nomDe: (personId: string) => string
  /** Le nom d'une activité, pour dire de quel bénéfice ou de quelle rémunération un versement est déduit. */
  nomDeLActivite: (activiteId: string) => string
  /** Ce que le revenu imposable au barème a permis de déduire, sur ce qui était imputé sur les plafonds. */
  deduction: number
  /** Revenu imposable au barème du foyer avant cette déduction. */
  revenuAvantDeduction: number
  /** Impôt économisé par la déduction, à l'euro. */
  impotEconomise: number
  /** Le foyer a des revenus de micro-entreprise au versement libératoire, que le barème ne voit pas. */
  auVersementLiberatoire: boolean
}

const JAMAIS_DEDUITS = "ne sont pas déduits, et ne le seront pas les années suivantes."
const OPTION_POUR_LA_NON_DEDUCTION = "L'option pour la non-déduction, à demander à l'assureur lors du versement, évite au moins l'impôt sur ces sommes à la sortie."

/** Les versements d'une personne imputés sur des plafonds, les siens ou ceux de son conjoint. */
const impute = (personne: EpargneRetraiteDeLaPersonne) => personne.imputeSurSesPlafonds + personne.imputeSurLeConjoint

/** « du bénéfice », « de la rémunération » : de quoi se déduit ce qui dépasse les plafonds du revenu global. */
export const DU_REVENU_PROFESSIONNEL: Record<DeductionDuRevenuProfessionnel["cadre"], string> = { benefice: "du bénéfice", remuneration: "de la rémunération" }

/** « du bénéfice », « de la rémunération », ou les deux quand les membres d'un foyer déduisent de l'un et de l'autre. */
export function duRevenuProfessionnelEnClair(deductions: Pick<DeductionDuRevenuProfessionnel, "cadre">[]): string {
  const cadres = [...new Set(deductions.map(deduction => deduction.cadre))]
  return cadres.length === 1 ? DU_REVENU_PROFESSIONNEL[cadres[0]] : "du bénéfice ou de la rémunération"
}

/**
 * Un versement au-delà des plafonds : ce qui dépasse, et ce qui a été dépassé. Pour qui déduit aussi de son bénéfice
 * ou de sa rémunération, ce qui s'en déduit est dépassé de même.
 */
function avertissementDeDepassement(personne: EpargneRetraiteDeLaPersonne, annee: number, sujet: string, nomDeLActivite: LectureDeLaDeduction["nomDeLActivite"]): string {
  const seulPlafond = personne.plafondsReportes.length === 0 && personne.imputeSurLeConjoint === 0
  const plafonds = seulPlafond ? `le plafond de ${annee} (${euros(personne.plafond)})` : `les plafonds utilisables en ${annee} (${euros(impute(personne))}${personne.imputeSurLeConjoint > 0 ? ", avec ce qui restait à son conjoint" : ""})`
  const duRevenu = personne.deduitDuRevenuProfessionnel
  const depassement = duRevenu ? `ne tiennent ni dans ${plafonds}, ni dans ce qui se déduit ${DU_REVENU_PROFESSIONNEL[duRevenu.cadre]} de « ${nomDeLActivite(duRevenu.activiteId)} » (${euros(duRevenu.montant)})` : `dépassent ${plafonds}`
  const reste = personne.originePlafond === "saisi" ? undefined : personne.resteNonReporte
  const resteEcarte = reste ? ` Le plafond saisi pour ${reste.annee} n'avait pas été utilisé en entier : le simulateur ne reporte pas ce reste (${euros(reste.montant)}), faute de connaître l'année d'origine de chaque part. S'il est encore utilisable, la déduction réelle est plus élevée.` : ""
  return `Versement PER${sujet} : ${euros(personne.nonDeduit)} ${depassement}. Ils ${JAMAIS_DEDUITS}${resteEcarte}`
}

/** Une déduction que le revenu imposable ne permet pas, en tout ou partie, ou qui ne réduit pas l'impôt (décision 7 de l'ADR 021). */
function avertissementDeDeductionSansEffet({ personnes, deduction, revenuAvantDeduction, impotEconomise, auVersementLiberatoire }: LectureDeLaDeduction): string[] {
  const total = personnes.reduce((cumul, personne) => cumul + impute(personne), 0)
  const deductions = personnes.flatMap(personne => personne.deduitDuRevenuProfessionnel ?? [])
  const duRevenuProfessionnel = deductions.reduce((cumul, d) => cumul + d.montant, 0)
  if (total > 0 && Math.round(deduction) === 0 && duRevenuProfessionnel === 0) {
    return [`Versement PER sans effet sur l'impôt : ${auVersementLiberatoire ? "avec le versement libératoire, " : ""}le foyer n'a aucun revenu au barème dont le déduire. Les ${euros(total)} ${JAMAIS_DEDUITS} ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  if (Math.round(deduction) < total) {
    // Une déduction du bénéfice ou de la rémunération a pu ne rien laisser au barème.
    const apres = duRevenuProfessionnel > 0 ? `après la déduction ${duRevenuProfessionnelEnClair(deductions)}, ` : ""
    const revenu = revenuAvantDeduction > 0 ? `n'a que ${euros(revenuAvantDeduction)} de revenu imposable au barème` : "n'a plus de revenu imposable au barème"
    return [`Versement PER déduit en partie : ${apres}le foyer ${revenu}. ${euros(total - deduction)} ${JAMAIS_DEDUITS} ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  if (total + duRevenuProfessionnel > 0 && impotEconomise === 0) {
    // Seule la part déduite du revenu global s'impute sur un plafond ; celle du bénéfice ou de la rémunération n'en consomme aucun.
    const plafondConsomme = total > 0 ? " Elle consomme le plafond sans rien économiser." : ""
    return [`Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de ${euros(deduction + duRevenuProfessionnel)}.${plafondConsomme} ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  return []
}

/** Un plafond qui sert sans avoir été saisi ni calculé : le minimum légal, qui peut ne pas être le bon. */
function avertissementDePlafondParDefaut(personne: EpargneRetraiteDeLaPersonne, annee: number, sujet: string): string[] {
  if (impute(personne) + personne.preteAuConjoint + personne.nonDeduit === 0) return []
  // Une fiche qui porte déjà le plafond d'une autre année : la saisie de celui-ci le remplacerait.
  if (personne.originePlafond === "minimumFauteDeSaisie" && personne.plafondSaisiPour !== undefined) {
    return [`Épargne retraite${sujet} : le plafond saisi dans la fiche vaut pour ${personne.plafondSaisiPour} ; pour ${annee}, le minimum légal est retenu (${euros(personne.plafond)}).`]
  }
  if (personne.originePlafond === "minimumFauteDeSaisie") {
    return [`Épargne retraite${sujet} : le plafond de ${annee} n'est pas saisi, le minimum légal est retenu (${euros(personne.plafond)}). Le vôtre est sur l'avis d'impôt reçu en ${annee}, ligne « Plafond pour les cotisations versées en ${annee} » : saisissez-le dans la fiche de la personne.`]
  }
  if (personne.originePlafond === "minimumFauteDAnneePrecedente") {
    return [`Épargne retraite${sujet} : l'année ${annee - 1} n'est pas dans la simulation, le minimum légal est retenu pour le plafond de ${annee} (${euros(personne.plafond)}).`]
  }
  return []
}

/**
 * Avertissements d'un foyer sur ses versements d'épargne retraite : ce qui dépasse les plafonds, ce que le revenu
 * imposable ne permet pas de déduire ou qui ne réduit pas l'impôt, et les plafonds retenus par défaut. Le nom de la
 * personne n'est écrit que dans un foyer de plusieurs personnes.
 */
export function avertissementsEpargneRetraite(lecture: LectureDeLaDeduction): string[] {
  const { annee, personnes, nomDe, nomDeLActivite } = lecture
  const sujet = (personne: EpargneRetraiteDeLaPersonne) => (personnes.length > 1 ? ` ${deNom(nomDe(personne.personId))}` : "")
  return [
    ...personnes.filter(personne => personne.nonDeduit > 0).map(personne => avertissementDeDepassement(personne, annee, sujet(personne), nomDeLActivite)),
    ...avertissementDeDeductionSansEffet(lecture),
    ...personnes.flatMap(personne => avertissementDePlafondParDefaut(personne, annee, sujet(personne)))
  ]
}

/**
 * D'où vient le plafond d'une personne pour l'année, en quelques mots : « saisi dans la fiche », « calculé sur les
 * revenus de 2025 ». Avec son nom, la fiche est nommée : « saisi dans la fiche de Sophie ».
 */
export function origineDuPlafondEnClair(personne: Pick<EpargneRetraiteDeLaPersonne, "originePlafond" | "plafondSaisiPour">, annee: number, nom?: string): string {
  const fiche = nom ? `la fiche ${deNom(nom)}` : "la fiche"
  const origines: Record<OrigineDuPlafondEpargneRetraite, string> = {
    saisi: `saisi dans ${fiche}`,
    calcule: `calculé sur les revenus de ${annee - 1}`,
    minimumFauteDeSaisie: personne.plafondSaisiPour === undefined ? `le minimum légal, faute de plafond saisi dans ${fiche}` : `le minimum légal, celui saisi dans ${fiche} valant pour ${personne.plafondSaisiPour}`,
    minimumFauteDAnneePrecedente: `le minimum légal, ${annee - 1} n'étant pas dans la simulation`
  }
  return origines[personne.originePlafond]
}

/**
 * Ce qui fixe le plafond calculé sur l'année, en quelques mots : la part des revenus d'activité professionnelle, le
 * minimum légal (avec ce que cette part aurait donné) ou le maximum.
 */
export function baseDuPlafondCalculeEnClair(personne: Pick<EpargneRetraiteDeLaPersonne, "baseDuPlafondCalcule" | "revenusProfessionnels">, annee: number, partDesRevenus: number): string {
  const part = `${pourcent(partDesRevenus)} des revenus d'activité professionnelle de ${annee}`
  if (personne.baseDuPlafondCalcule === "revenus") return `${part} (${euros(personne.revenusProfessionnels)})`
  if (personne.baseDuPlafondCalcule === "maximum") return "le maximum légal"
  return personne.revenusProfessionnels > 0 ? `le minimum légal (${part} ne donnent que ${euros(partDesRevenus * personne.revenusProfessionnels)})` : "le minimum légal"
}

/**
 * La limite de ce qui se déduit d'un bénéfice ou d'une rémunération, en quelques mots : son montant et ce qui le fixe.
 * « limite de 7 791 € : 10 % du bénéfice, plus 15 % de sa part au-delà du plafond de la sécurité sociale ».
 */
export function limiteDuRevenuProfessionnelEnClair(deduction: DeductionDuRevenuProfessionnel, regles: ReglesDeductionDuRevenuProfessionnel): string {
  const limite = `limite de ${euros(deduction.limite)}`
  if (deduction.baseDeLaLimite === "minimum") return `${limite} : le minimum, ${pourcent(regles.minimumPartDuPlafond)} du plafond de la sécurité sociale`
  const revenu = deduction.cadre === "benefice" ? "du bénéfice" : "de la rémunération après la déduction pour frais"
  const auDela = deduction.revenuDeLaLimite > deduction.plafondSecuriteSociale ? `, plus ${pourcent(regles.partAuDelaDUnPlafond)} de sa part au-delà du plafond de la sécurité sociale` : ""
  return `${limite} : ${pourcent(regles.partDuRevenu)} ${revenu}${auDela}`
}

/**
 * Ce que la déduction du bénéfice ou de la rémunération change au plafond calculé sur l'année, en quelques mots ;
 * `null` pour qui n'en a pas.
 */
export function effetSurLePlafondCalculeEnClair(personne: Pick<EpargneRetraiteDeLaPersonne, "deduitDuRevenuProfessionnel" | "reductionDuPlafondCalcule">): string | null {
  const deduit = personne.deduitDuRevenuProfessionnel
  if (!deduit) return null
  const duRevenu = DU_REVENU_PROFESSIONNEL[deduit.cadre]
  const reduction = personne.reductionDuPlafondCalcule ?? 0
  if (reduction === 0) return `la part déduite ${duRevenu} ne le réduit pas ici`
  if (reduction === deduit.montant) return `diminué des ${euros(reduction)} déduits ${duRevenu}`
  return `diminué de ${euros(reduction)} sur les ${euros(deduit.montant)} déduits ${duRevenu}`
}

/** Titre de la consigne donnée à un couple dont les plafonds sont mis en commun. */
export const TITRE_DE_LA_MISE_EN_COMMUN = "Plafonds mis en commun."

/**
 * Ce qu'un couple doit faire pour que la mise en commun de ses plafonds soit retenue : cocher la case 6QR de la
 * déclaration de revenus. `null` quand aucun des deux ne dépasse ses plafonds.
 */
export function consigneDeLaMiseEnCommun(epargne: EpargneRetraiteDuFoyer, nomDe: (personId: string) => string): string | null {
  if (!epargne.miseEnCommun) return null
  const { montant, impotEnPlusSansElle, deductibleDuRevenuProfessionnel } = epargne.miseEnCommun
  const conjoints = epargne.personnes.filter(personne => personne.preteAuConjoint > 0).map(personne => deNom(nomDe(personne.personId)))
  const consigne = `Pour déduire les ${euros(montant)} pris sur le plafond ${conjoints.join(" et ")}, cochez la case 6QR de la déclaration de revenus.`
  // Qui peut aussi déduire de son bénéfice ou de sa rémunération ne perd pas ces versements sans la case : l'impôt en
  // plus, calculé comme s'ils l'étaient, serait loin du compte, et n'est pas donné.
  if (deductibleDuRevenuProfessionnel) return `${consigne} Sans elle, ils ne se déduiraient que ${DU_REVENU_PROFESSIONNEL[deductibleDuRevenuProfessionnel]}, dans la limite de l'année.`
  const cout = impotEnPlusSansElle > 0 ? ` : ${euros(impotEnPlusSansElle)} d'impôt en plus` : ""
  return `${consigne} Sans elle, ils ne seraient pas déduits${cout}.`
}
