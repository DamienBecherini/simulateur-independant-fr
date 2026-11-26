// src/backend/logic/epargne-retraite.ts
// Versements sur un plan d'épargne retraite (PER) déduits du revenu global, article 163 quatervicies du CGI (voir
// l'ADR 021) : le plafond de chaque personne, l'imputation de ses versements sur ce plafond puis sur les plafonds
// reportés, la mise en commun des plafonds d'un couple, ce que l'année laisse à la suivante, et les messages qui le
// disent. Ce module ne connaît ni les flux ni le barème : impot-du-foyer.ts lui donne les versements et en tire la
// déduction.

import type { EpargneRetraiteDeLaPersonne, EpargneRetraiteDuFoyer, OrigineDuPlafondEpargneRetraite, PlafondReporte } from "../../types.js"
import { deNom, euros, pourcent } from "./format.js"
import type { ReglesEpargneRetraite } from "./regles.js"

/** Ce qu'une personne reçoit de l'année précédente de la session. */
export interface PlafondsHerites {
  /** Plafond calculé sur ses revenus de l'année précédente : celui de ses versements de l'année. */
  plafondCalcule: number
  /** Ce qui lui restait de ses plafonds à la fin de l'année précédente. */
  plafondsRestants: PlafondReporte[]
  /** Reste du plafond saisi la première année, que le simulateur ne reporte pas. */
  resteNonReporte?: PlafondReporte
}

/** Un membre du foyer, avec ce que l'année sait de lui avant d'imputer ses versements. */
export interface MembreDuFoyer {
  personId: string
  /** Déclarant d'un couple marié ou pacsé : ses plafonds et ceux de son conjoint sont mis en commun. */
  enCouple: boolean
  /** Versements de l'année sur un plan d'épargne retraite. */
  verse: number
  /** Plafond saisi dans sa fiche, pour la première année de la session. */
  plafondSaisi: number | undefined
  /**
   * Ce qu'il reçoit de l'année précédente ; `null` quand elle n'est pas dans la session ; `undefined` la première
   * année de la session, la seule où le plafond saisi s'applique.
   */
  herites: PlafondsHerites | null | undefined
  /** Ses revenus d'activité professionnelle de l'année. */
  revenusProfessionnels: number
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

/** Plafond minimal des versements de l'année : le minimum légal, assis sur le plafond de la sécurité sociale de l'année précédente. */
export function plafondMinimalDeLAnnee(regles: ReglesEpargneRetraite): number {
  return Math.round(regles.minimumPartDuPlafond * regles.plafondSecuriteSocialeAnneePrecedente)
}

/** Le plafond d'une personne pour l'année, son origine et les plafonds reportés encore utilisables. */
function plafondsDeLAnnee(membre: MembreDuFoyer, annee: number, regles: ReglesEpargneRetraite): { plafond: number; originePlafond: OrigineDuPlafondEpargneRetraite; plafondsReportes: PlafondReporte[] } {
  if (membre.herites === undefined) {
    // Première année de la session : le plafond de l'avis d'impôt, qui contient déjà les plafonds reportés.
    if (membre.plafondSaisi !== undefined) return { plafond: Math.round(membre.plafondSaisi), originePlafond: "saisi", plafondsReportes: [] }
    return { plafond: plafondMinimalDeLAnnee(regles), originePlafond: "minimumFauteDeSaisie", plafondsReportes: [] }
  }
  if (membre.herites === null) return { plafond: plafondMinimalDeLAnnee(regles), originePlafond: "minimumFauteDAnneePrecedente", plafondsReportes: [] }
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
 * L'épargne retraite de chaque membre d'un foyer pour l'année.
 * 1. Chacun impute ses versements sur son plafond de l'année, puis sur ses plafonds reportés, du plus ancien au plus
 *    récent (BOI-IR-BASE-20-50-30, § 50).
 * 2. Dans un couple marié ou pacsé, ce qui dépasse se prend sur ce qui reste au conjoint, dans le même ordre ; le
 *    reste demeure à celui dont le plafond n'est pas épuisé (brochure pratique de l'impôt sur le revenu, exemple).
 * 3. Ce qui dépasse encore n'est ni déduit ni reporté.
 * L'imputation ne dépend pas de l'impôt : un versement qui ne réduit rien consomme son plafond quand même (hypothèse 3
 * de l'ADR 021). Les montants sont à l'euro, comme sur la déclaration.
 */
export function epargneRetraiteDesMembres(membres: MembreDuFoyer[], annee: number, plafondSecuriteSociale: number, regles: ReglesEpargneRetraite): EpargneRetraiteDeLaPersonne[] {
  const etats = membres.map(membre => {
    const plafonds = plafondsDeLAnnee(membre, annee, regles)
    const deLAnnee: Disponible = { plafond: { annee, montant: plafonds.plafond, utilisableJusquEn: annee + regles.anneesDeReport }, reste: plafonds.plafond }
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

  return etats.map(({ membre, plafonds, deLAnnee, disponibles, verse, imputeSurSesPlafonds, imputeSurLeConjoint, preteAuConjoint }): EpargneRetraiteDeLaPersonne => {
    // Du plafond saisi, on ne connaît que le total : son reste n'est pas reporté (hypothèse 1 de l'ADR 021), mais dit.
    const saisi = plafonds.originePlafond === "saisi"
    const aReporter = disponibles.filter(d => d.reste > 0 && d.plafond.utilisableJusquEn > annee && !(saisi && d === deLAnnee)).sort((a, b) => a.plafond.annee - b.plafond.annee)
    const resteDuSaisi = deLAnnee.reste > 0 ? { ...deLAnnee.plafond, montant: deLAnnee.reste } : undefined
    const resteNonReporte = saisi ? resteDuSaisi : encoreUtilisableEn(membre.herites?.resteNonReporte, annee)
    return {
      personId: membre.personId,
      verse,
      ...plafonds,
      imputeSurSesPlafonds,
      imputeSurLeConjoint,
      preteAuConjoint,
      nonDeduit: verse - imputeSurSesPlafonds - imputeSurLeConjoint,
      plafondsRestants: aReporter.map(d => ({ ...d.plafond, montant: d.reste })),
      ...(resteNonReporte ? { resteNonReporte } : {}),
      revenusProfessionnels: Math.round(membre.revenusProfessionnels),
      ...plafondCalculeSurLAnnee(membre.revenusProfessionnels, plafondSecuriteSociale, regles)
    }
  })
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

/** Un versement au-delà des plafonds : ce qui dépasse, et ce qui a été dépassé. */
function avertissementDeDepassement(personne: EpargneRetraiteDeLaPersonne, annee: number, sujet: string): string {
  const seulPlafond = personne.plafondsReportes.length === 0 && personne.imputeSurLeConjoint === 0
  const depasse = seulPlafond ? `le plafond de ${annee} (${euros(personne.plafond)})` : `les plafonds utilisables en ${annee} (${euros(impute(personne))}${personne.imputeSurLeConjoint > 0 ? ", avec ce qui restait à son conjoint" : ""})`
  const reste = personne.originePlafond === "saisi" ? undefined : personne.resteNonReporte
  const resteEcarte = reste ? ` Le plafond saisi pour ${reste.annee} n'avait pas été utilisé en entier : le simulateur ne reporte pas ce reste (${euros(reste.montant)}), faute de connaître l'année d'origine de chaque part. S'il est encore utilisable, la déduction réelle est plus élevée.` : ""
  return `Versement PER${sujet} : ${euros(personne.nonDeduit)} dépassent ${depasse}. Ils ${JAMAIS_DEDUITS}${resteEcarte}`
}

/** Une déduction que le revenu imposable ne permet pas, en tout ou partie, ou qui ne réduit pas l'impôt (décision 7 de l'ADR 021). */
function avertissementDeDeductionSansEffet({ personnes, deduction, revenuAvantDeduction, impotEconomise, auVersementLiberatoire }: LectureDeLaDeduction): string[] {
  const total = personnes.reduce((cumul, personne) => cumul + impute(personne), 0)
  if (total === 0) return []
  if (Math.round(deduction) === 0) {
    return [`Versement PER sans effet sur l'impôt : ${auVersementLiberatoire ? "avec le versement libératoire, " : ""}le foyer n'a aucun revenu au barème dont le déduire. Les ${euros(total)} ${JAMAIS_DEDUITS} ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  if (Math.round(deduction) < total) {
    return [`Versement PER déduit en partie : le foyer n'a que ${euros(revenuAvantDeduction)} de revenu imposable au barème. ${euros(total - deduction)} ${JAMAIS_DEDUITS} ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  if (impotEconomise === 0) {
    return [`Versement PER sans effet sur l'impôt : le foyer ne paie pas d'impôt au barème, avec ou sans la déduction de ${euros(deduction)}. Elle consomme le plafond sans rien économiser. ${OPTION_POUR_LA_NON_DEDUCTION}`]
  }
  return []
}

/** Un plafond qui sert sans avoir été saisi ni calculé : le minimum légal, qui peut ne pas être le bon. */
function avertissementDePlafondParDefaut(personne: EpargneRetraiteDeLaPersonne, annee: number, sujet: string): string[] {
  if (impute(personne) + personne.preteAuConjoint + personne.nonDeduit === 0) return []
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
  const { annee, personnes, nomDe } = lecture
  const sujet = (personne: EpargneRetraiteDeLaPersonne) => (personnes.length > 1 ? ` ${deNom(nomDe(personne.personId))}` : "")
  return [
    ...personnes.filter(personne => personne.nonDeduit > 0).map(personne => avertissementDeDepassement(personne, annee, sujet(personne))),
    ...avertissementDeDeductionSansEffet(lecture),
    ...personnes.flatMap(personne => avertissementDePlafondParDefaut(personne, annee, sujet(personne)))
  ]
}

/**
 * D'où vient le plafond d'une personne pour l'année, en quelques mots : « saisi dans la fiche », « calculé sur les
 * revenus de 2025 ». Avec son nom, la fiche est nommée : « saisi dans la fiche de Sophie ».
 */
export function origineDuPlafondEnClair(personne: Pick<EpargneRetraiteDeLaPersonne, "originePlafond">, annee: number, nom?: string): string {
  const fiche = nom ? `la fiche ${deNom(nom)}` : "la fiche"
  const origines: Record<OrigineDuPlafondEpargneRetraite, string> = {
    saisi: `saisi dans ${fiche}`,
    calcule: `calculé sur les revenus de ${annee - 1}`,
    minimumFauteDeSaisie: `le minimum légal, faute de plafond saisi dans ${fiche}`,
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

/** Titre de la consigne donnée à un couple dont les plafonds sont mis en commun. */
export const TITRE_DE_LA_MISE_EN_COMMUN = "Plafonds mis en commun."

/**
 * Ce qu'un couple doit faire pour que la mise en commun de ses plafonds soit retenue : cocher la case 6QR de la
 * déclaration de revenus. `null` quand aucun des deux ne dépasse ses plafonds.
 */
export function consigneDeLaMiseEnCommun(epargne: EpargneRetraiteDuFoyer, nomDe: (personId: string) => string): string | null {
  if (!epargne.miseEnCommun) return null
  const { montant, impotEnPlusSansElle } = epargne.miseEnCommun
  const conjoints = epargne.personnes.filter(personne => personne.preteAuConjoint > 0).map(personne => deNom(nomDe(personne.personId)))
  const cout = impotEnPlusSansElle > 0 ? ` : ${euros(impotEnPlusSansElle)} d'impôt en plus` : ""
  return `Pour déduire les ${euros(montant)} pris sur le plafond ${conjoints.join(" et ")}, cochez la case 6QR de la déclaration de revenus. Sans elle, ils ne seraient pas déduits${cout}.`
}
