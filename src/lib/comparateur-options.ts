// src/lib/comparateur-options.ts

import { estEntrepriseOuMicro, STATUTS_FRAIS } from "@/types"
import type { ComparaisonOptions, Comparateur, Company, ConditionsPortage, ConditionsPortageRetenues, EffectifPortage, FraisFonctionnement, MicroEntreprise, ModeRepartition, OptimisationRemuneration, PosteFrais, DonneesDeLAnnee, ReglagesComparateur, RepartitionBenefice, SimulationAnnuelle, StatutCompare, StatutFrais, StatutSociete } from "@/types"
import { euros, pourcent } from "@/backend/logic/format"
import { avecLaRetraiteParDefaut, conditionsPortageRetenues, LIBELLES_DES_CONDITIONS_PORTAGE, optionsDuComparateur } from "@/backend/logic/options-du-comparateur"

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
const EN_STATUT: Record<StatutCompare, string> = { SASU: "en SASU", EURL: "en EURL", EI: "en EI au réel", micro: "en micro-entreprise", "micro-vfl": "en micro-entreprise", portage: "en portage salarial" }

/**
 * L'écart de frais de gestion d'une colonne avec le statut actuel, en une phrase sous son net : « dont environ 2 050 €
 * de frais de gestion en plus qu'en micro-entreprise » ; `null` quand il n'y en a pas (statut actuel, mêmes frais). En
 * portage salarial, ce sont des frais de fonctionnement, qu'assure la société de portage, à ne pas confondre avec ses frais de
 * gestion, comptés dans les charges de la colonne.
 */
export function phraseDeLEcartDeFrais(ecart: number, actuel: StatutCompare, colonne?: StatutCompare): string | null {
  if (Math.round(ecart) === 0) return null
  // Le portage n'a aucun frais de fonctionnement supposé : l'écart est toujours en moins.
  if (colonne === "portage") return `dont environ ${euros(Math.abs(ecart))} de frais de fonctionnement en moins qu'${EN_STATUT[actuel]}`
  return `dont environ ${euros(Math.abs(ecart))} de frais de gestion ${ecart > 0 ? "en plus" : "en moins"} qu'${EN_STATUT[actuel]}`
}

/** L'effectif de la société de portage, dans une phrase. */
const EFFECTIF_EN_PHRASE: Record<EffectifPortage, string> = { moinsDe11: "société de moins de 11 salariés", de11a49: "société de 11 à 49 salariés", "50EtPlus": "société de 50 salariés et plus" }

/** Les frais de gestion de la société de portage, dans une phrase : taux, plancher, plafond, frais fixes. */
function fraisDeGestionEnPhrase(c: ConditionsPortageRetenues): string {
  const bornes = [c.plancherMensuel === null ? null : `au moins ${euros(c.plancherMensuel)}`, c.plafondMensuel === null ? null : `au plus ${euros(c.plafondMensuel)}`].filter(Boolean)
  const fixes = c.fraisFixesMensuels > 0 ? `, plus ${euros(c.fraisFixesMensuels)} de frais fixes par mois` : ""
  const entreBornes = bornes.length > 0 ? ` (${bornes.join(", ")} par mois)` : ""
  return `frais de gestion de ${pourcent(c.tauxFraisDeGestion)} du chiffre d'affaires HT${entreBornes}${fixes}`
}

/**
 * Les conditions de la société de portage de la colonne « Portage salarial », en une phrase, en disant celles qui sont
 * des valeurs typiques : « frais de gestion de 7 % du chiffre d'affaires HT, CDI, … (valeurs typiques) ». Pour les
 * exports.
 */
export function conditionsDuPortageEnPhrase(saisies: ConditionsPortage | undefined): string {
  const { conditions: c, valeursTypiques } = conditionsPortageRetenues(saisies)
  const parties = [
    fraisDeGestionEnPhrase(c),
    c.contrat,
    EFFECTIF_EN_PHRASE[c.effectif],
    ...(c.tauxVersementMobilite > 0 ? [`versement mobilité de ${pourcent(c.tauxVersementMobilite)}`] : []),
    c.reductionGeneraleReversee ? "réduction générale reversée" : "réduction générale gardée par la société",
    c.mutuelleMensuelle > 0 ? `mutuelle de ${euros(c.mutuelleMensuelle)} par mois` : "sans mutuelle"
  ]
  const toutes = valeursTypiques.length === Object.keys(LIBELLES_DES_CONDITIONS_PORTAGE).length
  const typiques = toutes ? "valeurs typiques" : `valeurs typiques : ${valeursTypiques.map(cle => LIBELLES_DES_CONDITIONS_PORTAGE[cle]).join(", ")}`
  const mention = valeursTypiques.length > 0 ? ` (${typiques})` : ""
  return parties.join(", ") + mention
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

/**
 * Activités qu'on peut faire changer de statut dans le comparateur. Pas encore une activité en portage salarial, qui
 * n'a pas sa colonne (voir l'ADR 016).
 */
export function comparableActivities(session: DonneesDeLAnnee): (Company | MicroEntreprise)[] {
  return session.entities.filter(estEntrepriseOuMicro)
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
  if (JSON.stringify(avant.portage) !== JSON.stringify(apres.portage)) retenus.portage = apres.portage
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
