// src/backend/logic/messages-des-fichiers.ts

/*
 * Textes des fenêtres de fichiers de l'application de bureau (export, import, fichiers texte, PDF) : filtres des
 * fenêtres d'enregistrement et d'ouverture, notification après un import, messages d'erreur. Sans Electron, pour être
 * testé seul ; src/backend/canaux-des-fichiers.ts les affiche.
 */

import { AnneesRefuseesError, rapportAvecCorrections } from "./data-sanitizer.js"
import type { FormatFichierTexte, NotificationPayload, SanitizationReport } from "../../types.js"

/** Filtre d'une fenêtre d'enregistrement ou d'ouverture (la forme de `Electron.FileFilter`). */
export interface FiltreDeFichiers {
  name: string
  extensions: string[]
}

/** Filtres des fenêtres d'enregistrement et d'ouverture, par format de fichier texte. */
export const FILTRES_FICHIERS: Record<FormatFichierTexte, FiltreDeFichiers> = {
  csv: { name: "Fichiers CSV", extensions: ["csv"] },
  markdown: { name: "Documents Markdown", extensions: ["md"] },
  json: { name: "Fichiers JSON", extensions: ["json"] }
}

export const FILTRE_PDF: FiltreDeFichiers = { name: "Documents PDF", extensions: ["pdf"] }

/** Une boîte d'erreur : son titre et son message. */
export interface BoiteDErreur {
  titre: string
  message: string
}

/** Échecs d'écriture ou de lecture d'un fichier choisi par l'utilisateur. */
export const ERREURS_DE_FICHIER = {
  enregistrement: { titre: "Erreur d'exportation", message: "Impossible d'enregistrer le fichier." },
  pdf: { titre: "Erreur d'exportation", message: "Impossible de créer le PDF." },
  lecture: { titre: "Erreur d'importation", message: "Impossible de lire le fichier." }
} satisfies Record<string, BoiteDErreur>

/** Nom proposé pour l'export JSON de la simulation, horodaté pour ne jamais en remplacer un autre. */
export function nomDeLExport(maintenant: number): string {
  return `simulateur-export-${maintenant}.json`
}

/** Notification après un import réussi : un fichier corrigé ou converti invite à vérifier le détail. */
export function notificationDeLImport(report: SanitizationReport): NotificationPayload {
  return rapportAvecCorrections(report) ? { message: "Fichier importé avec des ajustements : vérifiez le détail avant de continuer.", type: "warning" } : { message: "Simulation importée avec succès !", type: "success" }
}

/**
 * Import refusé : la boîte d'erreur à montrer et le motif renvoyé à l'interface. Un fichier refusé à cause de ses
 * années n'est pas corrompu : son motif suffit, il dit quoi corriger.
 */
export function refusDeLImport(erreur: unknown): BoiteDErreur & { motif: string } {
  const motif = erreur instanceof Error ? erreur.message : "Erreur inconnue."
  if (erreur instanceof AnneesRefuseesError) return { titre: "Import impossible", message: motif, motif }
  return { titre: "Erreur d'importation", message: `Le fichier sélectionné est invalide, corrompu ou d'une version non compatible.\n\nDétails : ${motif}`, motif }
}
