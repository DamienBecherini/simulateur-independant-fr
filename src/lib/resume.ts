// src/lib/resume.ts
// Chiffres clés de la barre de résumé (affichage « Résumé ») : tirés des résultats de l'année et du comparateur.

import type { ComparaisonResult, ScenarioStatut, SimulationReport } from "@/types"
import { ecartSigne, euros } from "@/backend/logic/format"
import { SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"

/** Ce que la barre retient du comparateur : l'activité comparée et le résultat de la comparaison. */
export interface ResumeDeLaComparaison {
  activite: string
  result: ComparaisonResult | null
}


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

/** Les avertissements de la comparaison, sans l'invitation à saisir un chiffre d'affaires, déjà en tête du comparateur. */
export const avertissementsSansLeVerdict = (warnings: string[]) => warnings.filter(w => w !== SANS_CHIFFRE_D_AFFAIRES)

/**
 * « Micro + VL (actuel) », ou « SASU, +1 234 € » quand le meilleur statut n'est pas la situation saisie ; sans chiffre
 * d'affaires, l'invitation à en saisir un.
 */
export function meilleurStatut(result: ComparaisonResult | null): string | null {
  if (result?.sansChiffreDAffaires) return "saisissez un chiffre d'affaires"
  const meilleur = result?.scenarios.find(s => s.statut === result.meilleur)
  if (!result || !meilleur) return null
  if (meilleur.telleQueSaisie) return `${meilleur.libelle} (actuel)`
  const ecart = ecartAvecLaSituationSaisie(result, meilleur)
  return ecart === null ? meilleur.libelle : `${meilleur.libelle}, ${ecartSigne(ecart)}`
}

/** Le verdict : quel statut donne le meilleur net, et de combien il devance la situation saisie ou le suivant. */
export function phraseDuVerdict(result: ComparaisonResult, activite: string): string | null {
  const meilleur = result.scenarios.find(s => s.statut === result.meilleur)
  const saisie = result.situationSaisie
  if (!meilleur || !saisie) return null
  if (meilleur.telleQueSaisie) {
    const suivant = [...result.scenarios].filter(s => !s.telleQueSaisie && !estNonRetenue(s)).sort((a, b) => b.netApresImpots - a.netApresImpots)[0]
    const derriere = suivant ? ` Juste derrière : ${suivant.libelle}, ${ecartSigne(suivant.netApresImpots - saisie.netApresImpots)}.` : ""
    return `Pour « ${activite} », le statut actuel, ${meilleur.libelle}, donne le meilleur net : ${euros(meilleur.netApresImpots)}.${derriere}`
  }
  return `Pour « ${activite} », ${meilleur.libelle} donnerait le meilleur net : ${euros(meilleur.netApresImpots)}, soit ${ecartSigne(meilleur.netApresImpots - saisie.netApresImpots)} par rapport à votre situation telle que saisie (${saisie.libelle}, ${euros(saisie.netApresImpots)}).`
}
