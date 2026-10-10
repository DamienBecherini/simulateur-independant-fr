// src/lib/nature-de-l-activite.ts
// La nature du chiffre d'affaires d'une micro-entreprise (vente de marchandises, prestations artisanales ou
// commerciales, prestations libérales) : elle fixe le taux des cotisations, l'abattement et le versement libératoire.
// Les textes qui l'expliquent à la saisie lisent ces taux dans les règles de l'année affichée.

import { pourcent } from "@/backend/logic/format"
import { caisseDe, professionDe, reglesDeLaMicro } from "@/backend/logic/professions"
import type { ReglesFiscales, TauxMicro } from "@/backend/logic/regles"
import type { Entity, FinancialFlow, MicroEntreprise } from "@/types"
import { flowTypeLabels, getFlowTypesForEntity, libelleDuType, type FlowType } from "./flow-constants"

/** Les trois natures du chiffre d'affaires d'une micro-entreprise : chacune est un type de flux. */
export type NatureMicro = Extract<FlowType, "ca_micro_vente" | "ca_micro_services_bic" | "ca_micro_services_bnc">

/** Clé des taux de chaque nature dans les règles. */
const CLE_DES_TAUX: Record<NatureMicro, keyof TauxMicro> = {
  ca_micro_services_bnc: "servicesBnc",
  ca_micro_services_bic: "servicesBic",
  ca_micro_vente: "venteBic"
}

/** Ordre d'affichage, celui de la liste des types (prestations libérales en tête). */
export const NATURES_MICRO = Object.keys(CLE_DES_TAUX) as NatureMicro[]

/** Exemples de métiers, pour reconnaître sa nature sans connaître les sigles BIC et BNC. */
const EXEMPLES: Record<NatureMicro, string> = {
  ca_micro_services_bnc: "développeur, consultant, traducteur, ostéopathe",
  ca_micro_services_bic: "plombier, électricien, coiffeur",
  ca_micro_vente: "revente de marchandises, objets que vous fabriquez et vendez"
}

export function estNatureMicro(type: FlowType): type is NatureMicro {
  return type in CLE_DES_TAUX
}

/**
 * Type prérempli de la ligne d'ajout de la fenêtre des flux. Pour une micro-entreprise : la nature de son premier
 * chiffre d'affaires dans les flux donnés (le mois ouvert, puis le reste de l'année), pour ne pas mélanger les natures
 * par mégarde ; sinon la première de la liste, les prestations libérales. Pour un autre acteur : le premier type permis.
 */
export function typeProposeDOffice(entity: Entity, flux: FinancialFlow[]): FlowType {
  const premier = getFlowTypesForEntity(entity)[0]
  if (entity.type !== "micro-entreprise") return premier
  return flux.find(f => f.entityId === entity.id && estNatureMicro(f.type))?.type ?? premier
}

/** Une nature, telle que la décrit l'aide de la fenêtre des flux. */
export interface DescriptionDeLaNature {
  type: NatureMicro
  libelle: string
  /** Taux de cotisations et abattement de l'année, en une phrase. */
  taux: string
  exemples: string
}

/**
 * Les trois natures avec les taux de l'année et des exemples de métiers. Pour une profession dont la caisse a son
 * propre taux en micro-entreprise (CIPAV), les prestations libérales portent ce taux, celui que le calcul retient.
 */
export function descriptionsDesNatures(activite: Pick<MicroEntreprise, "profession">, regles: ReglesFiscales): DescriptionDeLaNature[] {
  const profession = professionDe(activite, regles)
  const { cotisations, abattement } = reglesDeLaMicro(regles, profession).microEntreprise
  const caisse = cotisations.servicesBnc === regles.microEntreprise.cotisations.servicesBnc ? null : caisseDe(profession)
  return NATURES_MICRO.map(type => {
    const cle = CLE_DES_TAUX[type]
    const tauxPropre = type === "ca_micro_services_bnc" && caisse ? ` (taux de la ${caisse})` : ""
    return {
      type,
      libelle: flowTypeLabels[type],
      taux: `cotisations de ${pourcent(cotisations[cle])} du chiffre d'affaires${tauxPropre}, abattement de ${pourcent(abattement[cle])} pour l'impôt`,
      exemples: EXEMPLES[type]
    }
  })
}

/** Les prestations libérales ont les cotisations les plus élevées et l'abattement le plus faible de l'année. */
function liberalesLesPlusPrudentes(regles: ReglesFiscales): boolean {
  const { cotisations, abattement } = regles.microEntreprise
  return NATURES_MICRO.every(type => cotisations[CLE_DES_TAUX[type]] <= cotisations.servicesBnc && abattement[CLE_DES_TAUX[type]] >= abattement.servicesBnc)
}

/**
 * La phrase qui précède les natures : à quoi sert la nature, laquelle est proposée d'office et pourquoi, et la
 * nature attendue d'une profession libérale réglementée.
 */
export function introductionDesNatures(activite: Pick<MicroEntreprise, "profession">, regles: ReglesFiscales): string {
  const prudence = liberalesLesPlusPrudentes(regles) ? ", la plus prudente (cotisations les plus élevées, abattement le plus faible)" : ""
  const profession = professionDe(activite, regles)
  const reglementee = profession ? ` ${profession.libelle} : prestations libérales (BNC).` : ""
  return `La nature fixe les taux de ${regles.annee}. Proposée d'office : celle déjà saisie pour cette activité dans l'année, sinon les prestations libérales${prudence} ; changez-la si vous êtes artisan, commerçant ou vendeur.${reglementee}`
}

/**
 * Ce que la vente change : les achats ne se déduisent pas en micro-entreprise. L'abattement en tient lieu pour
 * l'impôt, pas pour les cotisations, calculées sur tout le chiffre d'affaires ; le comparateur, qui déduit les charges
 * de l'activité dans ses colonnes au réel, montre quand le réel devient plus intéressant.
 */
export function noteSurLesAchats(regles: ReglesFiscales): string {
  const { cotisations, abattement } = regles.microEntreprise
  return `Vos achats (marchandises, matériaux, outils) ne se déduisent pas en micro-entreprise : pour l'impôt, l'abattement de ${pourcent(abattement.venteBic)} est censé les couvrir, mais les cotisations de ${pourcent(cotisations.venteBic)} portent sur tout le chiffre d'affaires. Saisissez-les en « ${libelleDuType("expense", "micro-entreprise")} » : si vos marges sont faibles, le comparateur de statuts montre si le régime réel, où ils se déduisent, est plus intéressant.`
}
