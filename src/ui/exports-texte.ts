// src/ui/exports-texte.ts
// Enregistrement des exports CSV et Markdown : chaque contenu est produit par une fonction pure de src/lib, puis
// enregistré par window.api, avec une notification de succès ou d'échec (aucune si l'utilisateur annule).
// Ils portent sur une année de la session, celle qui est affichée : son numéro figure dans le nom du fichier.

import { toast } from "sonner"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { reglagesDeLActiviteComparee } from "@/lib/comparateur-options"
import { csvComparaison, csvCourbeRemuneration, csvGrilleMensuelle, csvResultats } from "@/lib/export-csv"
import { nomDeFichier, slugifier } from "@/lib/export-commun"
import { rapportMarkdown, type ComparaisonDuRapport } from "@/lib/export-markdown"
import type { ComparaisonOptions, ComparaisonResult, FormatFichierTexte, OptimisationRemuneration, SessionState, SimulationAnnuelle, SimulationReport } from "@/types"

/** Enregistre un fichier texte et dit si c'est fait ; rien n'est signalé si l'utilisateur annule. */
export async function enregistrerExport(defaultName: string, content: string, format: FormatFichierTexte): Promise<void> {
  try {
    const enregistre = await window.api.saveTextFile({ defaultName, content, format })
    if (enregistre) toast.success(`Export enregistré : ${defaultName}`)
  } catch {
    toast.error("L'export n'a pas pu être enregistré.")
  }
}

export function exporterGrilleCsv(vue: SimulationAnnuelle): Promise<void> {
  return enregistrerExport(nomDeFichier(vue.name, "grille", "csv", vue.annee), csvGrilleMensuelle(vue), "csv")
}

export async function exporterResultatsCsv(vue: SimulationAnnuelle, report: SimulationReport | null): Promise<void> {
  if (!report) {
    toast.error("Les résultats ne sont pas encore calculés : corrigez la simulation ou réessayez dans un instant.")
    return
  }
  await enregistrerExport(nomDeFichier(vue.name, "resultats", "csv", vue.annee), csvResultats(vue, report), "csv")
}

export function exporterComparaisonCsv(vue: SimulationAnnuelle, resultat: ComparaisonResult, options: ComparaisonOptions, nomActivite: string): Promise<void> {
  return enregistrerExport(nomDeFichier(vue.name, `comparateur-${slugifier(nomActivite) || "activite"}`, "csv", vue.annee), csvComparaison(resultat, options, nomActivite), "csv")
}

export function exporterCourbeCsv(vue: SimulationAnnuelle, optimisation: OptimisationRemuneration, nomActivite: string): Promise<void> {
  const contenu = `remuneration-${slugifier(nomActivite) || "activite"}-${optimisation.statut.toLowerCase()}`
  return enregistrerExport(nomDeFichier(vue.name, contenu, "csv", vue.annee), csvCourbeRemuneration(optimisation), "csv")
}

/**
 * Compare l'activité choisie dans le comparateur avec ses réglages enregistrés, comme le comparateur l'affiche pour
 * cette année : la première activité et les réglages proposés par défaut si l'utilisateur n'a rien choisi.
 */
async function comparaisonDuComparateur(session: SessionState, vue: SimulationAnnuelle): Promise<ComparaisonDuRapport | null> {
  const reglages = reglagesDeLActiviteComparee(vue, session.comparateur)
  if (!reglages) return null
  const { activite, options } = reglages
  try {
    return { nomActivite: activite.name, options, resultat: await window.api.compareStatuts(session, options, vue.annee) }
  } catch (e) {
    return { nomActivite: activite.name, erreur: e instanceof Error ? e.message : "la comparaison a échoué." }
  }
}

/** Le rapport porte sur l'année affichée ; le comparateur reçoit toute la session, pour les années qui précèdent. */
export async function exporterRapportMarkdown(session: SessionState, annee: number, report: SimulationReport | null): Promise<void> {
  const vue = vueDeLAnnee(session, annee)
  const comparaison = await comparaisonDuComparateur(session, vue)
  await enregistrerExport(nomDeFichier(vue.name, "rapport", "md", vue.annee), rapportMarkdown({ session: vue, report, comparaison, date: new Date() }), "markdown")
}
