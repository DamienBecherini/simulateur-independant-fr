// src/lib/resume.ts
// Chiffres clés de la barre de résumé (affichage « Résumé ») : tirés des résultats de l'année et du comparateur.

import type { ComparaisonResult, OptimisationRemuneration, RaisonDeNonRetenue, RaisonSousLaSituationSaisie, ScenarioStatut, SimulationReport } from "@/types"
import { ecartSigne, euros } from "@/backend/logic/format"
import { netCompare } from "@/backend/logic/net-compare"
import { AUCUNE_CHARGE, SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"

/**
 * Ce que la barre retient du comparateur : l'activité comparée (`null` quand seuls des couples sont comparés), le
 * résultat de la comparaison, et l'arbitrage rémunération / dividendes d'une société comparée.
 */
export interface ResumeDeLaComparaison {
  activite: string | null
  result: ComparaisonResult | null
  /** « Rémunération ou dividendes ? » de l'activité comparée, quand c'est une société à l'IS ; absent sinon. */
  optimisation?: OptimisationRemuneration | null
}

/**
 * Ce que gagnerait (ou perdrait) le couple en union libre à se marier ou à se pacser, en net après impôts ; le premier
 * couple comparé, presque toujours le seul. `null` sans couple en union libre.
 */
export function gainDuMariageOuDuPacs(result: ComparaisonResult | null): number | null {
  const couple = result?.couples[0]
  return couple ? couple.netApresImpotsMaries - couple.netApresImpotsActuel : null
}

/**
 * La rémunération nette au meilleur net du foyer ; `null` tant que l'arbitrage n'a pas de résultat. Quand la colonne de
 * cette société a gardé la répartition saisie (écart négligeable avec l'arbitrage), c'est la rémunération saisie : la
 * barre ne conseille pas un autre salaire que le tableau.
 */
export function remunerationOptimale(optimisation: OptimisationRemuneration | null | undefined, result?: ComparaisonResult | null): number | null {
  if (!optimisation?.meilleur) return null
  const gardee = result?.scenarios.find(s => s.saisieAuMeilleurNet && s.statut === optimisation.statut)
  return gardee?.remunerationOptimale?.remunerationNette ?? optimisation.meilleur.remunerationNette
}


/** Ce que coûte l'exigence de 4 trimestres de retraite dans une colonne : « 4 trimestres : −1 234 € de net ». */
export const libelleDuCoutDesTrimestres = (cout: number) => `4 trimestres : ${ecartSigne(-cout)} de net`

/** Nombre d'alertes de l'année : règles reprises d'une autre année, avertissements des foyers et des activités. */
export function nombreDAlertes(report: SimulationReport | null): number {
  if (!report) return 0
  return report.avertissements.length + report.foyers.reduce((n, f) => n + f.warnings.length, 0) + report.activities.reduce((n, a) => n + a.warnings.length, 0)
}

/**
 * Ce qui porte la première alerte affichée dans les résultats, où mène le lien « Alertes » de la barre de résumé : les
 * avertissements de l'année, sous le titre ; sinon la première carte qui en a, foyers d'abord, dans l'ordre des cartes.
 * `null` sans alerte.
 */
export function porteurDeLaPremiereAlerte(report: SimulationReport | null): string | null {
  if (!report) return null
  if (report.avertissements.length > 0) return "annee"
  const foyer = report.foyers.find(f => f.warnings.length > 0)
  if (foyer) return cleDuFoyer(foyer.personIds)
  const activite = report.activities.find(a => a.warnings.length > 0)
  return activite ? cleDeLActivite(activite.entityId) : null
}

/** Clés des cartes des résultats, pour désigner celle qui porte la première alerte. */
export const cleDuFoyer = (personIds: string[]) => `foyer:${personIds.join("-")}`
export const cleDeLActivite = (entityId: string) => `activite:${entityId}`

/** Taux global de prélèvement de l'année, comme dans le bilan des résultats. */
export function tauxDePrelevement(report: SimulationReport): string | null {
  const base = report.bilan.revenusAvantPrelevements
  return base > 0 ? (report.bilan.totalPrelevements / base).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 }) : null
}

/**
 * Net de référence des écarts du comparateur : celui de la situation telle que saisie, égal au « Net du foyer » des
 * résultats ; `null` sans activité comparée.
 */
export function netDeLaSituationSaisie(result: ComparaisonResult): number | null {
  return result.situationSaisie?.netApresImpots ?? result.scenarios.find(s => s.telleQueSaisie)?.netApresImpots ?? null
}

/**
 * Référence des écarts du comparateur : le net de la situation telle que saisie, moins la perte qu'elle laisse dans la
 * société (voir src/backend/logic/net-compare.ts) ; `null` sans activité comparée. Sans perte, c'est le « Net du foyer ».
 */
export function referenceDesEcarts(result: ComparaisonResult): number | null {
  const saisie = result.situationSaisie ?? result.scenarios.find(s => s.telleQueSaisie)
  return saisie ? netCompare(saisie) : null
}

/**
 * Écart d'une colonne avec la situation telle que saisie, chacune à son net une fois déduite la perte restée dans la
 * société ; `null` pour cette situation elle-même, ou sans référence.
 */
export function ecartAvecLaSituationSaisie(result: ComparaisonResult, scenario: ScenarioStatut): number | null {
  const reference = referenceDesEcarts(result)
  return reference === null || scenario.telleQueSaisie ? null : netCompare(scenario) - reference
}

/** Une perte restée dans la société est-elle déduite quelque part dans cette comparaison (une colonne, ou la situation saisie) ? */
export const avecUnePerteConservee = (result: ComparaisonResult) => (result.situationSaisie?.perteConservee ?? 0) > 0 || result.scenarios.some(s => (s.perteConservee ?? 0) > 0)

/** Où reste ce que le net du foyer ne montre pas (perte, bénéfice gardé) : dans la société, ou sur le compte d'une activité en portage. */
export const lieuDuReste = (statut: ScenarioStatut["statut"]) => (statut === "portage" ? "sur le compte d'activité" : "dans la société")

/**
 * Un bénéfice gardé dans une société est-il écrit sous le net d'une colonne de cette comparaison ? La réserve du compte
 * d'une activité en portage n'en est pas un : presque toutes les comparaisons en ont une, et sa note l'explique.
 */
export const avecUnBeneficeGarde = (result: ComparaisonResult) => result.scenarios.some(s => s.statut !== "portage" && (s.beneficeGarde ?? 0) > 0)

/**
 * Le net d'une colonne et ce que l'année laisse dans l'activité : « 0 € (et 20 000 € de perte restée dans la société) »,
 * que la comparaison déduit, ou « 39 000 € (et 12 000 € gardés dans la société) », qu'elle ne compte pas.
 */
export function netEtReste(colonne: { statut: ScenarioStatut["statut"]; netApresImpots: number; perteConservee?: number; beneficeGarde?: number }): string {
  const perte = colonne.perteConservee ?? 0
  if (perte > 0) return `${euros(colonne.netApresImpots)} (et ${euros(perte)} de perte restée ${lieuDuReste(colonne.statut)})`
  const garde = colonne.beneficeGarde ?? 0
  return garde > 0 ? `${euros(colonne.netApresImpots)} (et ${euros(garde)} gardés ${lieuDuReste(colonne.statut)})` : euros(colonne.netApresImpots)
}

/** La colonne n'est jamais désignée meilleur statut : le moteur en porte la raison (`ScenarioStatut.nonRetenue`). */
export const estNonRetenue = (s: Pick<ScenarioStatut, "nonRetenue">) => s.nonRetenue !== null

/** Ce que dit la cellule d'une colonne non retenue, raison par raison. */
const RAISONS_ECRITES: Record<RaisonDeNonRetenue, string> = {
  regimeMicroFerme: "non retenue : régime micro fermé",
  plafondDepasse: "non retenue : plafond dépassé",
  portageSansPrestations: "non retenue : aucune prestation à facturer",
  portageADecouvert: "non retenue : frais supérieurs au chiffre d'affaires",
  portageSalaries: "non retenue : salariés de l'activité",
  remunerationNonCouverte: "non retenue : rémunération supérieure au bénéfice",
  societeExerciceLiberal: "non retenue : société d'exercice libéral"
}

/** Pourquoi une colonne n'est jamais retenue, écrit dans la cellule : la couleur seule ne le dit pas. */
export function raisonDeNonRetenue(scenario: Pick<ScenarioStatut, "nonRetenue">): string | null {
  return scenario.nonRetenue ? RAISONS_ECRITES[scenario.nonRetenue] : null
}

/**
 * Les avertissements de la comparaison, sans l'invitation à saisir un chiffre d'affaires, déjà en tête du comparateur,
 * ni la note sur une activité sans charge, écrite à la place du rappel des frais sous le tableau.
 */
export const avertissementsSansLeVerdict = (warnings: string[]) => warnings.filter(w => w !== SANS_CHIFFRE_D_AFFAIRES && w !== AUCUNE_CHARGE)

/** Dans la barre de résumé, pourquoi le meilleur statut fait moins bien que la situation saisie, en quelques mots. */
const POURQUOI_SOUS_LA_SAISIE: Record<RaisonSousLaSituationSaisie, string> = {
  trimestres: "pour 4 trimestres de retraite",
  statutActuelNonRetenu: "(statut actuel non retenu)",
  reglages: "(aucun ne fait mieux que la saisie)"
}

/**
 * « Micro + VL (actuel) », ou « SASU, +1 234 € » quand le meilleur statut n'est pas la situation saisie, avec la raison
 * quand il fait moins bien qu'elle (« SASU, rémunération optimisée, −756 € pour 4 trimestres de retraite ») ; sans
 * chiffre d'affaires, l'invitation à en saisir un.
 */
export function meilleurStatut(result: ComparaisonResult | null): string | null {
  if (result?.sansChiffreDAffaires) return "saisissez un chiffre d'affaires"
  const meilleur = result?.scenarios.find(s => s.statut === result.meilleur)
  if (!result || !meilleur) return null
  if (meilleur.telleQueSaisie) return `${meilleur.libelle} (actuel)`
  const ecart = ecartAvecLaSituationSaisie(result, meilleur)
  if (ecart === null) return meilleur.libelle
  const sous = result.sousLaSituationSaisie
  return `${meilleur.libelle}, ${ecartSigne(ecart)}${sous ? ` ${POURQUOI_SOUS_LA_SAISIE[sous.raison]}` : ""}`
}

/** Le verdict : quel statut donne le meilleur net, et de combien il devance la situation saisie ou le suivant. */
export function phraseDuVerdict(result: ComparaisonResult, activite: string): string | null {
  const meilleur = result.scenarios.find(s => s.statut === result.meilleur)
  const saisie = result.situationSaisie
  if (!meilleur || !saisie) return null
  // Meilleur statut sous la situation saisie : il n'est pas présenté comme un gain, l'écart est expliqué.
  const sous = result.sousLaSituationSaisie
  if (sous) return `Pour « ${activite} », le meilleur des statuts comparés, ${meilleur.libelle}, donnerait ${netEtReste(meilleur)}, contre ${netEtReste(saisie)} pour votre situation telle que saisie (${saisie.libelle}). ${sous.explication}`
  // Les écarts se mesurent sur le net, perte restée dans la société déduite : une société déficitaire ne passe pas devant
  // parce que sa perte ne se voit pas dans le net du foyer.
  if (meilleur.telleQueSaisie) {
    const suivant = [...result.scenarios].filter(s => !s.telleQueSaisie && !estNonRetenue(s)).sort((a, b) => netCompare(b) - netCompare(a))[0]
    const derriere = suivant ? ` Juste derrière : ${suivant.libelle}, ${ecartSigne(netCompare(suivant) - netCompare(saisie))}.` : ""
    return `Pour « ${activite} », le statut actuel, ${meilleur.libelle}, donne le meilleur net : ${netEtReste(meilleur)}.${derriere}`
  }
  return `Pour « ${activite} », ${meilleur.libelle} donnerait le meilleur net : ${netEtReste(meilleur)}, soit ${ecartSigne(netCompare(meilleur) - netCompare(saisie))} par rapport à votre situation telle que saisie (${saisie.libelle}, ${netEtReste(saisie)}).`
}
