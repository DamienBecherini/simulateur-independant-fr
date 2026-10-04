// src/ui/exports-texte.ts
// Enregistrement des exports CSV et Markdown : chaque contenu est produit par une fonction pure de src/lib, puis
// enregistré par window.api, avec une notification de succès ou d'échec (aucune si l'utilisateur annule).

import { toast } from "sonner"
import { comparableActivities, defaultComparisonOptions } from "@/lib/comparateur-options"
import { csvComparaison, csvCourbeRemuneration, csvGrilleMensuelle, csvResultats } from "@/lib/export-csv"
import { nomDeFichier, slugifier } from "@/lib/export-commun"
import { rapportMarkdown, type ComparaisonDuRapport } from "@/lib/export-markdown"
import type { ComparaisonOptions, ComparaisonResult, FormatFichierTexte, OptimisationRemuneration, SessionState, SimulationReport } from "@/types"

/** Enregistre un fichier texte et dit si c'est fait ; rien n'est signalé si l'utilisateur annule. */
export async function enregistrerExport(defaultName: string, content: string, format: FormatFichierTexte): Promise<void> {
  try {
    const enregistre = await window.api.saveTextFile({ defaultName, content, format })
    if (enregistre) toast.success(`Export enregistré : ${defaultName}`)
  } catch {
    toast.error("L'export n'a pas pu être enregistré.")
  }
}

/** Année des fichiers exportés : celle des règles fiscales appliquées, ou l'année en cours sans résultats. */
const anneeDesRegles = (report: SimulationReport | null) => report?.annee ?? new Date().getFullYear()

export function exporterGrilleCsv(session: SessionState, report: SimulationReport | null): Promise<void> {
  return enregistrerExport(nomDeFichier(session.name, "grille", "csv", anneeDesRegles(report)), csvGrilleMensuelle(session), "csv")
}

export async function exporterResultatsCsv(session: SessionState, report: SimulationReport | null): Promise<void> {
  if (!report) {
    toast.error("Les résultats ne sont pas encore calculés : corrigez la simulation ou réessayez dans un instant.")
    return
  }
  await enregistrerExport(nomDeFichier(session.name, "resultats", "csv", report.annee), csvResultats(session, report), "csv")
}

export function exporterComparaisonCsv(session: SessionState, resultat: ComparaisonResult, options: ComparaisonOptions, nomActivite: string): Promise<void> {
  return enregistrerExport(nomDeFichier(session.name, `comparateur-${slugifier(nomActivite) || "activite"}`, "csv"), csvComparaison(resultat, options, nomActivite), "csv")
}

export function exporterCourbeCsv(session: SessionState, optimisation: OptimisationRemuneration, nomActivite: string): Promise<void> {
  const contenu = `remuneration-${slugifier(nomActivite) || "activite"}-${optimisation.statut.toLowerCase()}`
  return enregistrerExport(nomDeFichier(session.name, contenu, "csv"), csvCourbeRemuneration(optimisation), "csv")
}

/** Compare la première activité avec les réglages proposés par défaut, comme le comparateur à son ouverture. */
async function comparaisonParDefaut(session: SessionState): Promise<ComparaisonDuRapport | null> {
  const activite = comparableActivities(session)[0]
  if (!activite) return null
  const options = defaultComparisonOptions(session, activite.id)
  try {
    return { nomActivite: activite.name, options, resultat: await window.api.compareStatuts(session, options) }
  } catch (e) {
    return { nomActivite: activite.name, erreur: e instanceof Error ? e.message : "la comparaison a échoué." }
  }
}

export async function exporterRapportMarkdown(session: SessionState, report: SimulationReport | null): Promise<void> {
  const comparaison = await comparaisonParDefaut(session)
  await enregistrerExport(nomDeFichier(session.name, "rapport", "md"), rapportMarkdown({ session, report, comparaison, date: new Date() }), "markdown")
}
