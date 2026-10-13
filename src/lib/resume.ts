// src/lib/resume.ts
// Chiffres clés de la barre de résumé (affichage « Résumé ») : tirés des résultats de l'année et du comparateur.

import type { ComparaisonResult, OptimisationRemuneration, RaisonSousLaSituationSaisie, ScenarioStatut, SimulationReport } from "@/types"
import { ecartSigne, euros } from "@/backend/logic/format"
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

/** Ancres des réponses vers lesquelles mène la barre de résumé, dans la section du comparateur. */
export const ANCRE_DU_COUPLE = "comparaison-du-couple"
export const ANCRE_DE_LA_REMUNERATION = "optimisation-titre"

/**
 * Ce que gagnerait (ou perdrait) le couple en union libre à se marier ou à se pacser, en net après impôts ; le premier
 * couple comparé, presque toujours le seul. `null` sans couple en union libre.
 */
export function gainDuMariageOuDuPacs(result: ComparaisonResult | null): number | null {
  const couple = result?.couples[0]
  return couple ? couple.netApresImpotsMaries - couple.netApresImpotsActuel : null
}

/** La rémunération nette au meilleur net du foyer ; `null` tant que l'arbitrage n'a pas de résultat. */
export const remunerationOptimale = (optimisation: OptimisationRemuneration | null | undefined): number | null => optimisation?.meilleur?.remunerationNette ?? null


/** Ce que coûte l'exigence de 4 trimestres de retraite dans une colonne : « 4 trimestres : −1 234 € de net ». */
export const libelleDuCoutDesTrimestres = (cout: number) => `4 trimestres : ${ecartSigne(-cout)} de net`

/** Au meilleur net, les colonnes de société où exiger 4 trimestres de retraite coûte du net, avec ce coût. */
export function coutsDesQuatreTrimestres(scenarios: ScenarioStatut[]): { libelle: string; cout: number }[] {
  return scenarios.flatMap(s => (s.remunerationOptimale?.coutDesQuatreTrimestres ? [{ libelle: s.libelle, cout: s.remunerationOptimale.coutDesQuatreTrimestres }] : []))
}

/** Nombre d'alertes de l'année : règles reprises d'une autre année, avertissements des foyers et des activités. */
export function nombreDAlertes(report: SimulationReport | null): number {
  if (!report) return 0
  return report.avertissements.length + report.foyers.reduce((n, f) => n + f.warnings.length, 0) + report.activities.reduce((n, a) => n + a.warnings.length, 0)
}

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

/** Écart du net d'une colonne avec la situation telle que saisie ; `null` pour cette situation elle-même, ou sans référence. */
export function ecartAvecLaSituationSaisie(result: ComparaisonResult, scenario: ScenarioStatut): number | null {
  const reference = netDeLaSituationSaisie(result)
  return reference === null || scenario.telleQueSaisie ? null : scenario.netApresImpots - reference
}

/** Une colonne micro hors plafond ou au régime fermé : jamais retenue comme meilleur statut. */
export const estNonRetenue = (s: ScenarioStatut) => s.horsPlafond || s.regimeMicroFerme !== undefined

/** Pourquoi une colonne micro n'est jamais retenue, écrit dans la cellule : la couleur seule ne le dit pas. */
export function raisonDeNonRetenue(scenario: ScenarioStatut): string | null {
  if (scenario.regimeMicroFerme) return "non retenue : régime micro fermé"
  return scenario.horsPlafond ? "non retenue : plafond dépassé" : null
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
  if (sous) return `Pour « ${activite} », le meilleur des statuts comparés, ${meilleur.libelle}, donnerait ${euros(meilleur.netApresImpots)}, contre ${euros(saisie.netApresImpots)} pour votre situation telle que saisie (${saisie.libelle}). ${sous.explication}`
  if (meilleur.telleQueSaisie) {
    const suivant = [...result.scenarios].filter(s => !s.telleQueSaisie && !estNonRetenue(s)).sort((a, b) => b.netApresImpots - a.netApresImpots)[0]
    const derriere = suivant ? ` Juste derrière : ${suivant.libelle}, ${ecartSigne(suivant.netApresImpots - saisie.netApresImpots)}.` : ""
    return `Pour « ${activite} », le statut actuel, ${meilleur.libelle}, donne le meilleur net : ${euros(meilleur.netApresImpots)}.${derriere}`
  }
  return `Pour « ${activite} », ${meilleur.libelle} donnerait le meilleur net : ${euros(meilleur.netApresImpots)}, soit ${ecartSigne(meilleur.netApresImpots - saisie.netApresImpots)} par rapport à votre situation telle que saisie (${saisie.libelle}, ${euros(saisie.netApresImpots)}).`
}
