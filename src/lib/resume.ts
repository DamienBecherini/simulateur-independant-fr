// src/lib/resume.ts
// Chiffres clés de la barre de résumé (affichage « Résumé ») : tirés des résultats de l'année et du comparateur.

import type { ComparaisonResult, ScenarioStatut, SimulationReport } from "@/types"

/** Ce que la barre retient du comparateur : l'activité comparée et le résultat de la comparaison. */
export interface ResumeDeLaComparaison {
  activite: string
  result: ComparaisonResult | null
}

/** Montant arrondi à l'euro : « 69 575 € ». */
export const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

/** Écart signé : « +1 234 € », « −850 € ». */
export const ecartSigne = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${euros(Math.abs(n))}`

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

/** « Micro + VL (actuel) », ou « SASU, +1 234 € » quand le meilleur statut n'est pas le statut actuel. */
export function meilleurStatut(result: ComparaisonResult | null): string | null {
  const meilleur = result?.scenarios.find(s => s.statut === result.meilleur)
  if (!meilleur) return null
  if (meilleur.actuel) return `${meilleur.libelle} (actuel)`
  const actuel = result?.scenarios.find(s => s.actuel)
  if (!actuel) return meilleur.libelle
  return `${meilleur.libelle}, ${ecartSigne(meilleur.netApresImpots - actuel.netApresImpots)}`
}

/** Le verdict : quel statut donne le meilleur net, et de combien il devance le statut actuel ou le suivant. */
export function phraseDuVerdict(result: ComparaisonResult, activite: string): string | null {
  const meilleur = result.scenarios.find(s => s.statut === result.meilleur)
  const actuel = result.scenarios.find(s => s.actuel)
  if (!meilleur || !actuel) return null
  if (meilleur.actuel) {
    const suivant = [...result.scenarios].filter(s => !s.actuel && !s.horsPlafond && !s.regimeMicroFerme).sort((a, b) => b.netApresImpots - a.netApresImpots)[0]
    const derriere = suivant ? ` Juste derrière : ${suivant.libelle}, ${ecartSigne(suivant.netApresImpots - actuel.netApresImpots)}.` : ""
    return `Pour « ${activite} », le statut actuel, ${actuel.libelle}, donne le meilleur net : ${euros(actuel.netApresImpots)}.${derriere}`
  }
  return `Pour « ${activite} », ${meilleur.libelle} donnerait le meilleur net : ${euros(meilleur.netApresImpots)}, soit ${ecartSigne(meilleur.netApresImpots - actuel.netApresImpots)} par rapport au statut actuel, ${actuel.libelle}.`
}
