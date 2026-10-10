// src/lib/comparateur-options.ts

import { STATUTS_FRAIS } from "@/types"
import type { ComparaisonOptions, Comparateur, Company, FraisFonctionnement, MicroEntreprise, ModeRepartition, OptimisationRemuneration, PosteFrais, DonneesDeLAnnee, ReglagesComparateur, RepartitionBenefice, SimulationAnnuelle, StatutCompare, StatutFrais, StatutSociete } from "@/types"
import { euros } from "@/backend/logic/format"
import { avecLaRetraiteParDefaut, optionsDuComparateur } from "@/backend/logic/options-du-comparateur"

// Réglages proposés par défaut : ils vivent avec le moteur, pour servir aussi aux outils des clients d'IA (ADR 010).
export { defaultComparisonOptions, defaultFraisFonctionnement } from "@/backend/logic/options-du-comparateur"
export { avecLaRetraiteParDefaut, optionsDuComparateur }

/** Libellés des postes de frais, dans l'ordre d'affichage. */
export const posteFraisLabels: Record<PosteFrais, string> = {
  expertComptable: "Expert-comptable",
  banque: "Compte bancaire professionnel",
  logiciel: "Logiciel de facturation et de comptabilité",
  assurance: "Assurance responsabilité civile professionnelle",
  cfe: "Cotisation foncière des entreprises (CFE)"
}

export const statutsFrais: StatutFrais[] = [...STATUTS_FRAIS]

/** « en micro-entreprise », « en SASU » : le statut actuel dans la phrase de l'écart de frais. */
const EN_STATUT: Record<StatutCompare, string> = { SASU: "en SASU", EURL: "en EURL", EI: "en EI au réel", micro: "en micro-entreprise", "micro-vfl": "en micro-entreprise" }

/**
 * L'écart de frais de gestion d'une colonne avec le statut actuel, en une phrase sous son net : « dont environ 2 050 €
 * de frais de gestion en plus qu'en micro-entreprise » ; `null` quand il n'y en a pas (statut actuel, mêmes frais).
 */
export function phraseDeLEcartDeFrais(ecart: number, actuel: StatutCompare): string | null {
  if (Math.round(ecart) === 0) return null
  return `dont environ ${euros(Math.abs(ecart))} de frais de gestion ${ecart > 0 ? "en plus" : "en moins"} qu'${EN_STATUT[actuel]}`
}

/**
 * Modes de partage du bénéfice en SASU et EURL, dans l'ordre d'affichage, avec leur libellé explicite : celui des
 * exports et du partage du bénéfice, lus sans les boutons du comparateur.
 */
export const libellesRepartition: Record<ModeRepartition, string> = {
  meilleurNet: "Au meilleur net",
  dividendes: "Rémunération saisie, le reste en dividendes",
  remuneration: "Tout en rémunération",
  personnalisee: "Répartition personnalisée",
  grille: "Dividendes saisis dans la grille"
}

/** Libellés courts des boutons du comparateur, dans le même ordre ; la phrase de chaque mode les explique. */
export const libellesCourtsRepartition: Record<ModeRepartition, string> = {
  meilleurNet: "Meilleur net",
  dividendes: "Ma rémunération",
  remuneration: "Tout en rémunération",
  personnalisee: "Sur mesure",
  grille: "Selon la grille"
}

/**
 * Ce que fait un mode de partage, en une phrase, sous les boutons du comparateur. Au meilleur net, la phrase dit
 * si la rémunération retenue doit valider 4 trimestres de retraite.
 */
export function descriptionDuMode(mode: ModeRepartition, avecRetraite = false): string {
  const descriptions: Record<ModeRepartition, string> = {
    meilleurNet: avecRetraite ? "Chaque société verse la rémunération qui donne le meilleur net parmi celles qui valident 4 trimestres de retraite, le reste en dividendes." : "Chaque société verse la rémunération qui donne le meilleur net, le reste en dividendes.",
    dividendes: "La rémunération que vous saisissez, tout le reste du bénéfice en dividendes.",
    remuneration: "La rémunération la plus haute que la société peut verser, sans dividendes.",
    personnalisee: "Vous réglez la rémunération et la part du bénéfice distribuée ; le reste reste dans la société.",
    grille: "Les rémunérations et dividendes saisis dans la grille."
  }
  return descriptions[mode]
}

/** Modes où l'on saisit soi-même la rémunération : un champ et un curseur la règlent. */
export const avecRemunerationSaisie = (mode: ModeRepartition) => mode === "dividendes" || mode === "personnalisee"

/**
 * Plafond du curseur de rémunération : la plus haute rémunération que la société peut verser sans déficit dans le
 * statut étudié, d'après son arbitrage ; `null` tant que l'arbitrage de ce statut n'est pas arrivé.
 */
export function plafondDeRemuneration(optimisation: OptimisationRemuneration | null, statut: StatutSociete): number | null {
  return optimisation?.statut === statut ? Math.max(0, optimisation.remunerationMaximale) : null
}

/**
 * La part BNC ne sert qu'à convertir en micro-entreprise le chiffre d'affaires de prestations d'une société ou d'une
 * EI : une micro a déjà ses prestations en BNC ou en BIC, une activité sans prestations n'a rien à répartir.
 */
export function partBncUtile(vue: DonneesDeLAnnee, activite: Company | MicroEntreprise): boolean {
  if (activite.type === "micro-entreprise") return false
  return vue.monthlyData.some(mois => mois.flows.some(flux => flux.entityId === activite.id && flux.type === "ca_services" && flux.amount > 0))
}

/**
 * Reporte une rémunération dans le comparateur, tout le bénéfice restant étant distribué : en répartition
 * personnalisée, on y reste, avec 100 % distribué ; sinon, on passe à « le reste en dividendes ».
 */
export function avecRemuneration(options: ComparaisonOptions, remunerationNette: number): ComparaisonOptions {
  const mode = options.repartition.mode === "personnalisee" ? "personnalisee" : "dividendes"
  return { ...options, remunerationNette, repartition: { mode, partDistribuee: 1 } }
}

/**
 * Reporte dans le comparateur une rémunération de l'arbitrage. Au meilleur net, ses deux meilleurs points y restent :
 * on coche ou décoche seulement « avec 4 trimestres de retraite » ; toute autre rémunération est reportée telle quelle.
 */
export function appliquerRemuneration(options: ComparaisonOptions, remunerationNette: number, optimisation: OptimisationRemuneration | null): ComparaisonOptions {
  const { meilleur, meilleurAvecRetraite } = optimisation ?? {}
  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  if (auMeilleurNet && remunerationNette === meilleur?.remunerationNette) return { ...options, repartition: { ...options.repartition, avecRetraite: false } }
  if (auMeilleurNet && remunerationNette === meilleurAvecRetraite?.remunerationNette) return { ...options, repartition: { ...options.repartition, avecRetraite: true } }
  return avecRemuneration(options, remunerationNette)
}

/** Activités qu'on peut faire changer de statut dans le comparateur. */
export function comparableActivities(session: DonneesDeLAnnee): (Company | MicroEntreprise)[] {
  return session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person")
}

/**
 * Le partage du bénéfice dans un autre mode. La case « 4 trimestres » ne suit que si elle a été décochée : cochée,
 * c'est la valeur par défaut, qui n'a pas à être enregistrée avec un mode où elle n'a pas de sens.
 */
export function avecLeMode(repartition: RepartitionBenefice, mode: ModeRepartition): RepartitionBenefice {
  const { avecRetraite, ...reste } = repartition
  return { ...reste, mode, ...(avecRetraite === false ? { avecRetraite } : {}) }
}

/**
 * Activité comparée : celle que l'utilisateur a choisie, ou la première si elle n'est pas (ou plus) dans la session.
 * `undefined` sans activité.
 */
export function activiteComparee(session: DonneesDeLAnnee, comparateur: Comparateur | undefined): Company | MicroEntreprise | undefined {
  const activites = comparableActivities(session)
  return activites.find(activite => activite.id === comparateur?.activiteComparee) ?? activites[0]
}

/** Réglages du comparateur de l'activité comparée dans une session, pour l'année affichée ; `null` sans activité. */
export function reglagesDeLActiviteComparee(vue: SimulationAnnuelle, comparateur: Comparateur | undefined): { activite: Company | MicroEntreprise; options: ComparaisonOptions } | null {
  const activite = activiteComparee(vue, comparateur)
  if (!activite) return null
  return { activite, options: optionsDuComparateur(vue, activite.id, comparateur?.reglagesParActivite[activite.id]) }
}

const avecRetraite = (repartition: RepartitionBenefice) => avecLaRetraiteParDefaut(repartition).avecRetraite ?? false
const memeRepartition = (a: RepartitionBenefice, b: RepartitionBenefice) => a.mode === b.mode && a.partDistribuee === b.partDistribuee && avecRetraite(a) === avecRetraite(b)
const memesFrais = (a: FraisFonctionnement | undefined, b: FraisFonctionnement | undefined) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Retient ce que l'utilisateur vient de changer dans le comparateur, en passant des réglages affichés (`avant`) aux
 * nouveaux (`apres`) : seuls les champs modifiés rejoignent ses réglages, les autres gardent leur valeur choisie,
 * ou restent absents pour suivre la grille. Une rémunération modifiée est retenue pour l'année affichée.
 */
export function retenirLesReglages(reglages: ReglagesComparateur | undefined, avant: ComparaisonOptions, apres: ComparaisonOptions, annee: number): ReglagesComparateur {
  const retenus: ReglagesComparateur = { ...reglages }
  if (!memeRepartition(avant.repartition, apres.repartition)) retenus.repartition = apres.repartition
  if (avant.remunerationNette !== apres.remunerationNette) retenus.remunerationParAnnee = { ...reglages?.remunerationParAnnee, [String(annee)]: apres.remunerationNette }
  if (avant.partBncPrestations !== apres.partBncPrestations) retenus.partBncPrestations = apres.partBncPrestations
  if (!memesFrais(avant.fraisFonctionnement, apres.fraisFonctionnement)) retenus.fraisFonctionnement = apres.fraisFonctionnement
  return retenus
}

/** Le comparateur avec de nouveaux réglages pour une activité, qui devient l'activité comparée. */
export function avecReglagesDeLActivite(comparateur: Comparateur | undefined, activityId: string, reglages: ReglagesComparateur): Comparateur {
  return { ...comparateur, activiteComparee: activityId, reglagesParActivite: { ...comparateur?.reglagesParActivite, [activityId]: reglages } }
}

/** Le comparateur avec une autre activité comparée ; les réglages de chaque activité sont conservés. */
export function avecActiviteComparee(comparateur: Comparateur | undefined, activityId: string): Comparateur {
  return { reglagesParActivite: {}, ...comparateur, activiteComparee: activityId }
}
