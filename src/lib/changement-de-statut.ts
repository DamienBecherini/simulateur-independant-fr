// src/lib/changement-de-statut.ts
// Changer le statut d'une activité depuis sa fiche : ce que la conversion garde, retire ou refuse, dit avant de valider,
// puis la conversion elle-même (moteur : changement-de-statut.ts), avec les libellés de flux laissés par défaut qui
// suivent leur nouveau type.

import { changerLeStatut, refusDuChangement, statutDeLActivite, type ChangementDeStatut, type StatutDUneActivite } from "@/backend/logic/changement-de-statut"
import { libelleDuStatut } from "@/backend/logic/colonne-du-comparateur"
import { REGIME_DU_DIRIGEANT } from "@/backend/logic/statuts"
import type { Activite } from "@/backend/logic/conversion-de-statut"
import { plafondsAuProrata } from "@/backend/logic/calculsAE"
import { chiffreAffairesDeLaMicro, lireMois, prorataDesPlafonds } from "@/backend/logic/dispositifs"
import { euros } from "@/backend/logic/format"
import { professionDe } from "@/backend/logic/professions"
import type { ReglesFiscales } from "@/backend/logic/regles"
import { transformerLesGrilles } from "@/backend/logic/annees"
import { CAPITAL_SOCIAL_PAR_DEFAUT, estSocieteIS, type Entity, type SessionState } from "@/types"
import { estLibelleParDefaut, flowTypeLabels, libelleDuType, type FlowType } from "@/lib/flow-constants"
import { getRelationshipLabel } from "@/lib/graph-logic"
import { proposeLaProfession } from "@/lib/professions"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"

export type { StatutDUneActivite }

/** Nature des prestations de services d'une activité qui devient une micro-entreprise. */
export type NatureDesPrestations = "bnc" | "bic"

const PART_BNC: Record<NatureDesPrestations, number> = { bnc: 1, bic: 0 }

/** Ce qu'il faut montrer avant de valider un changement de statut. */
export interface ExamenDuChangement {
  /** Pourquoi le changement est impossible ; `null` s'il est possible. */
  refus: string | null
  /** Ce que la conversion change, garde ou retire, phrase par phrase. */
  consequences: string[]
  /** L'activité a des prestations de services : en micro-entreprise, il faut dire si elles sont libérales ou commerciales. */
  prestationsAQualifier: boolean
}

/** Le statut, dans une phrase : « en micro-entreprise », « en EI au réel », « en SASU ». */
export function nomDuStatut(statut: StatutDUneActivite): string {
  return statut === "micro" ? "micro-entreprise" : libelleDuStatut(statut)
}

/**
 * La nature proposée d'office pour les prestations : celle du réglage du comparateur de cette activité s'il en a un,
 * sinon les prestations libérales, comme le comparateur et la fenêtre des flux d'une micro-entreprise.
 */
export function natureProposee(session: SessionState, activiteId: string): NatureDesPrestations {
  const part = session.comparateur?.reglagesParActivite[activiteId]?.partBncPrestations
  return part !== undefined && part < 0.5 ? "bic" : "bnc"
}

/** Montants de l'activité par type de flux, additionnés sur toutes les années. */
function montantsParType(session: SessionState, activiteId: string): Partial<Record<FlowType, number>> {
  const montants: Partial<Record<FlowType, number>> = {}
  for (const flux of session.annees.flatMap(a => a.monthlyData.flatMap(m => m.flows))) {
    if (flux.entityId === activiteId) montants[flux.type] = (montants[flux.type] ?? 0) + flux.amount
  }
  return montants
}

/**
 * Ce que devient une charge en changeant de régime. En micro-entreprise, un abattement forfaitaire remplace les charges
 * réelles : elles ne réduisent plus ni les cotisations ni l'impôt, mais restent payées ; elles sont donc gardées comme
 * charges de l'activité, qui réduisent le net encaissé, comme dans le comparateur.
 */
const PHRASE_DE_LA_CHARGE: Partial<Record<FlowType, (montant: string) => string>> = {
  expense: montant => `Les charges déductibles (${montant}) ne sont plus déduites : en micro-entreprise, un abattement forfaitaire en tient lieu. Elles restent saisies comme charges de l'activité et réduisent toujours le net encaissé, comme dans le comparateur.`,
  deductible_expense: montant => `Les charges de la micro-entreprise (${montant}) deviennent des charges déductibles : vérifiez qu'elles sont toutes professionnelles.`
}

/** Une phrase par conversion de flux : la charge a la sienne, un chiffre d'affaires change de nom. */
function phrasesDesFluxConvertis(changement: ChangementDeStatut): string[] {
  return changement.fluxConvertis.map(({ de, vers, montant }) => {
    const charge = PHRASE_DE_LA_CHARGE[vers]
    if (charge) return charge(euros(montant))
    return `« ${flowTypeLabels[de]} » (${euros(montant)}) devient « ${libelleDuType(vers, changement.activite.type)} ».`
  })
}

/** Les prestations de services, dans une phrase, selon leur nature. */
const PRESTATIONS: Record<NatureDesPrestations, string> = { bnc: "libérales (BNC)", bic: "artisanales ou commerciales (BIC)" }

/**
 * Les années où la micro-entreprise que devient l'activité dépasserait les plafonds du régime (règles de chaque année,
 * au prorata l'année de la création, comme le moteur) : prestations de services au-delà du plafond des services, sinon
 * chiffre d'affaires total au-delà de celui de la vente. Un avertissement, pas un refus : le régime tient tant que le
 * dépassement ne se répète pas deux années de suite.
 */
function phrasesDesPlafonds(changement: ChangementDeStatut, nature: NatureDesPrestations): string[] {
  const { activite, session } = changement
  if (activite.type !== "micro-entreprise") return []
  const creation = lireMois(activite.dateDeCreation)
  const suite = "le régime est conservé cette année-là, mais deux années de dépassement de suite font passer l'activité au réel le 1er janvier suivant."
  return session.annees.flatMap(({ annee, monthlyData }) => {
    const prorata = prorataDesPlafonds(creation, annee)
    const plafonds = plafondsAuProrata(reglesDeLAnneeAffichee(annee).microEntreprise.plafonds, prorata)
    const auProrata = prorata < 1 ? ", au prorata de l'année de création" : ""
    const ca = chiffreAffairesDeLaMicro(monthlyData, activite.id)
    const services = ca.caServicesBic + ca.caServicesBnc
    const total = ca.caVente + services
    if (services > plafonds.services) return [`En ${annee}, les prestations ${PRESTATIONS[nature]} (${euros(services)}) dépassent le plafond de la micro-entreprise pour cette activité (${euros(plafonds.services)}${auProrata}) : ${suite}`]
    if (total > plafonds.vente) return [`En ${annee}, le chiffre d'affaires (${euros(total)}) dépasse le plafond de la micro-entreprise pour cette activité (${euros(plafonds.vente)}${auProrata}) : ${suite}`]
    return []
  })
}

/** Rémunération et dividendes : retirés d'une activité qui n'est plus une société, à saisir dans une nouvelle société, gardés d'une société à l'autre. */
function phrasesDuPartage(changement: ChangementDeStatut, source: Activite, montants: Partial<Record<FlowType, number>>): string[] {
  const { fluxRetires } = changement
  const cible = statutDeLActivite(changement.activite)
  const phrases: string[] = []
  if (fluxRetires.director_remuneration) phrases.push(`La rémunération du dirigeant (${euros(fluxRetires.director_remuneration)}) est retirée : une entreprise individuelle n'en verse pas, son bénéfice est le revenu de son titulaire.`)
  if (fluxRetires.dividends_payment) phrases.push(`Les dividendes (${euros(fluxRetires.dividends_payment)}) sont retirés : une entreprise individuelle n'en distribue pas.`)
  const depuisUneSociete = source.type === "company" && estSocieteIS(source.legalStatus)
  if (estSocieteIS(cible) && !depuisUneSociete) phrases.push("Aucune rémunération du dirigeant n'est saisie : sans elle, le bénéfice reste dans la société, soumis à l'impôt sur les sociétés. Saisissez-la dans la grille ; « Rémunération ou dividendes ? » aide à la choisir.")
  if (estSocieteIS(cible) && depuisUneSociete && (montants.director_remuneration || montants.dividends_payment)) phrases.push(`La rémunération du dirigeant et les dividendes saisis sont gardés ; leurs cotisations suivent le régime du dirigeant en ${libelleDuStatut(cible)} (${REGIME_DU_DIRIGEANT[cible]}).`)
  return phrases
}

/** Les réglages propres à la micro-entreprise, retirés quand elle passe au réel : ils n'y ont pas de sens. */
function phrasesDesReglagesDeLaMicro(source: Activite): string[] {
  if (source.type !== "micro-entreprise") return []
  return [
    source.beneficieACRE ? "L'ACRE est retirée : l'aide existe aussi au réel, mais le simulateur ne la calcule qu'en micro-entreprise." : null,
    source.opteVFL ? "Le versement libératoire est retiré : il n'existe qu'en micro-entreprise ; l'impôt est calculé au barème." : null,
    source.rfrN2 === undefined ? null : `Le revenu fiscal de référence N-2 (${euros(source.rfrN2)}) est retiré : il ne sert qu'au versement libératoire.`,
    source.horsPlafondAnneePrecedente ? "« Plafonds dépassés l'année précédente » est retiré : il ne concerne que la micro-entreprise." : null
  ].filter((phrase): phrase is string => phrase !== null)
}

/** Capital, réserves et réglages de la micro-entreprise : ce que le nouveau statut reçoit par défaut ou perd. */
function phrasesDesReglages(source: Activite, apres: Activite, regles: ReglesFiscales): string[] {
  const phrases = phrasesDesReglagesDeLaMicro(source)
  const depuisUneSociete = source.type === "company" && estSocieteIS(source.legalStatus)
  const versUneSociete = apres.type === "company" && estSocieteIS(apres.legalStatus)
  if (apres.type === "micro-entreprise") phrases.push("ACRE et versement libératoire ne sont pas choisis : réglez-les sur la carte de l'activité.")
  if (versUneSociete && !depuisUneSociete) phrases.push(`Capital social : ${euros(CAPITAL_SOCIAL_PAR_DEFAUT)} par défaut, à remplacer par le vôtre dans cette fiche.`)
  if (source.type === "company" && source.reservesInitiales && !versUneSociete) phrases.push(`Les réserves au début (${euros(source.reservesInitiales)}) sont retirées : une entreprise individuelle n'en a pas, son bénéfice est imposé chaque année chez son titulaire.`)
  const profession = professionDe(source, regles)
  if (profession && !proposeLaProfession(apres)) phrases.push(`La profession (${profession.libelle}) est gardée, sans effet sur les cotisations : le dirigeant, assimilé salarié en ${libelleDuStatut(statutDeLActivite(apres))}, cotise au régime général. Elle sert aux avertissements et à un retour au statut d'indépendant.`)
  return phrases
}

/** Ce que deviennent les relations : le dirigeant change de titre, les associés d'une société qui n'en est plus une sont retirés. */
function phrasesDesRelations(changement: ChangementDeStatut, entities: Entity[]): string[] {
  const nom = (id: string) => entities.find(e => e.id === id)?.name ?? id
  const personneDe = (rel: { fromId: string; toId: string }) => nom(rel.fromId === changement.activite.id ? rel.toId : rel.fromId)
  const relations = changement.session.relationships.filter(rel => rel.fromId === changement.activite.id || rel.toId === changement.activite.id)
  return [
    ...changement.relationsChangees.map(({ relation, avant }) => `${personneDe(relation)} : « ${getRelationshipLabel(avant)} » devient « ${getRelationshipLabel(relation.type)} ».`),
    ...changement.relationsRetirees.map(rel => `${personneDe(rel)} n'est plus associé : une entreprise individuelle n'a pas d'associé.`),
    ...(changement.activite.type === "micro-entreprise" && relations.some(rel => rel.type === "Salarié") ? ["Les salariés restent : en micro-entreprise, leur coût réduit le net encaissé, mais plus les cotisations ni l'impôt."] : []),
    ...(relations.some(rel => ["Président", "Gérant", "Titulaire"].includes(rel.type)) ? [] : ["Aucune personne n'en est titulaire ou dirigeante : reliez-en une pour que son revenu rejoigne un foyer."])
  ]
}

/**
 * Ce que le passage de l'activité au statut `cible` changerait, sans rien modifier : refus (micro-entreprise interdite
 * à la profession), puis flux, rémunération et dividendes, réglages, relations. `session` est celle de la fiche en cours
 * de modification, l'activité avec ses changements non encore enregistrés.
 */
export function examinerLeChangement(session: SessionState, source: Activite, cible: StatutDUneActivite, regles: ReglesFiscales, nature: NatureDesPrestations): ExamenDuChangement {
  const montants = montantsParType(session, source.id)
  const prestationsAQualifier = cible === "micro" && (montants.ca_services ?? 0) > 0
  const refus = refusDuChangement(source, cible, regles)
  if (refus) return { refus, consequences: [], prestationsAQualifier: false }
  const changement = changerLeStatut(session, source, cible, PART_BNC[nature])
  const consequences = [
    ...phrasesDesFluxConvertis(changement),
    ...phrasesDesPlafonds(changement, nature),
    ...phrasesDuPartage(changement, source, montants),
    ...phrasesDesReglages(source, changement.activite, regles),
    ...phrasesDesRelations(changement, session.entities),
    "Gardés : le nom, la pastille, la date de création, les déplacements professionnels, la profession et sa part conventionnée. Toutes les années de la simulation sont converties."
  ]
  return { refus: null, consequences, prestationsAQualifier }
}

/** Un libellé laissé par défaut, quel que soit son type : il suit le nouveau type du flux. */
function estUnLibelleParDefaut(label: string, typeActeur: Entity["type"]): boolean {
  return (Object.keys(flowTypeLabels) as FlowType[]).some(type => estLibelleParDefaut({ type, label }, typeActeur))
}

/**
 * Passe l'activité au statut `cible` dans toute la session, en une seule nouvelle session (une seule étape
 * d'historique). Les flux convertis dont le libellé était celui par défaut prennent celui de leur nouveau type.
 */
export function appliquerLeChangement(session: SessionState, source: Activite, cible: StatutDUneActivite, nature: NatureDesPrestations): { session: SessionState; activite: Activite } {
  const { session: convertie, activite } = changerLeStatut(session, source, cible, PART_BNC[nature])
  const avecLibelles = transformerLesGrilles(convertie, grille =>
    grille.map(mois => ({
      ...mois,
      flows: mois.flows.map(flux => (flux.entityId === activite.id && estUnLibelleParDefaut(flux.label, source.type) ? { ...flux, label: libelleDuType(flux.type, activite.type) } : flux))
    }))
  )
  return { session: avecLibelles, activite }
}
