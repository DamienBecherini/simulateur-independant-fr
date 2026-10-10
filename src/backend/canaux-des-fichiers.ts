// src/backend/canaux-des-fichiers.ts

/*
 * Canaux IPC des fichiers choisis par l'utilisateur et des adresses ouvertes hors de l'application : export et import
 * de la simulation (JSON), fichiers texte (exports CSV et Markdown, sauvegardes groupées), PDF, formulaire et e-mail
 * des retours. Chaque canal passe par `ipcMainHandle` (émetteur vérifié) et vérifie ses paramètres
 * (logic/entrees-ipc.ts) ; les textes des fenêtres et des erreurs sont dans logic/messages-des-fichiers.ts.
 */

import { app, dialog, shell, type BrowserWindow } from "electron"
import fs from "node:fs/promises"
import type { ExportableState, FormatFichierTexte } from "../types.js"
import { adresseExterneAutorisee } from "@/lib/adresses-des-retours.js"
import { contenuDuFichier, lireUneSimulationImportee } from "./logic/fichiers-de-donnees.js"
import { FichierTexteAEnregistrerSchema, FichierTexteAOuvrirSchema, NomDeFichierSchema, SimulationRecueSchema, entreeValide } from "./logic/entrees-ipc.js"
import { ERREURS_DE_FICHIER, FILTRES_FICHIERS, FILTRE_PDF, nomDeLExport, notificationDeLImport, refusDeLImport, type BoiteDErreur } from "./logic/messages-des-fichiers.js"
import { ipcMainHandle } from "./util.js"

/** Écrit un fichier choisi par l'utilisateur ; un échec est journalisé et montré dans une boîte d'erreur. */
async function ecrire(chemin: string, contenu: string | Buffer, erreur: BoiteDErreur): Promise<boolean> {
  try {
    await fs.writeFile(chemin, contenu, typeof contenu === "string" ? "utf-8" : undefined)
    return true
  } catch (error) {
    console.error("Erreur lors de l'enregistrement :", error)
    dialog.showErrorBox(erreur.titre, erreur.message)
    return false
  }
}

/** Fait choisir un fichier à ouvrir ; `null` si l'utilisateur a annulé. */
async function cheminAOuvrir(fenetre: BrowserWindow, options: Electron.OpenDialogOptions): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(fenetre, { ...options, properties: ["openFile"] })
  return canceled || filePaths.length === 0 ? null : filePaths[0]
}

/** Fait choisir où enregistrer ; `null` si l'utilisateur a annulé. */
async function cheminAEnregistrer(fenetre: BrowserWindow, options: Electron.SaveDialogOptions): Promise<string | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(fenetre, options)
  return canceled || !filePath ? null : filePath
}

export function declarerLesCanauxDesFichiers(fenetrePrincipale: () => BrowserWindow | null) {
  // L'export est écrit tel que l'interface l'envoie, s'il a la forme d'une simulation : il est nettoyé à son import.
  ipcMainHandle("exportState", async (state: ExportableState) => {
    entreeValide(SimulationRecueSchema, state, "exportState")
    const fenetre = fenetrePrincipale()
    if (!fenetre) return
    const chemin = await cheminAEnregistrer(fenetre, { title: "Exporter la simulation", defaultPath: nomDeLExport(Date.now()), filters: [FILTRES_FICHIERS.json] })
    if (chemin) await ecrire(chemin, contenuDuFichier(state, app.getVersion()), ERREURS_DE_FICHIER.enregistrement)
  })

  ipcMainHandle("importState", async () => {
    const fenetre = fenetrePrincipale()
    if (!fenetre) return { error: "La fenêtre principale n'est pas disponible." }
    const chemin = await cheminAOuvrir(fenetre, { title: "Importer une simulation", filters: [FILTRES_FICHIERS.json] })
    if (!chemin) return { data: undefined }
    try {
      const { data, report } = lireUneSimulationImportee(await fs.readFile(chemin, "utf-8"))
      fenetrePrincipale()?.webContents.send("show-notification", notificationDeLImport(report))
      // L'interface reçoit la simulation nettoyée et le rapport : elle demande confirmation si le fichier a été corrigé.
      return { data, report }
    } catch (error) {
      const refus = refusDeLImport(error)
      console.error("Erreur lors de l'importation :", refus.motif)
      dialog.showErrorBox(refus.titre, refus.message)
      return { error: refus.motif }
    }
  })

  // Fichiers texte : exports CSV et Markdown, sauvegardes groupées.
  ipcMainHandle("saveTextFile", async (fichier: { defaultName: string; content: string; format: FormatFichierTexte }) => {
    const { defaultName, content, format } = entreeValide(FichierTexteAEnregistrerSchema, fichier, "saveTextFile")
    const fenetre = fenetrePrincipale()
    if (!fenetre) return false
    const chemin = await cheminAEnregistrer(fenetre, { title: "Exporter", defaultPath: defaultName, filters: [FILTRES_FICHIERS[format]] })
    return chemin !== null && (await ecrire(chemin, content, ERREURS_DE_FICHIER.enregistrement))
  })

  ipcMainHandle("openTextFile", async (demande: { title: string; format: FormatFichierTexte }) => {
    const { title, format } = entreeValide(FichierTexteAOuvrirSchema, demande, "openTextFile")
    const fenetre = fenetrePrincipale()
    if (!fenetre) return null
    const chemin = await cheminAOuvrir(fenetre, { title, filters: [FILTRES_FICHIERS[format]] })
    if (!chemin) return null
    try {
      return await fs.readFile(chemin, "utf-8")
    } catch (error) {
      console.error("Erreur lors de la lecture :", error)
      dialog.showErrorBox(ERREURS_DE_FICHIER.lecture.titre, ERREURS_DE_FICHIER.lecture.message)
      return null
    }
  })

  ipcMainHandle("printToPdf", async (nom: string) => {
    const defaultName = entreeValide(NomDeFichierSchema, nom, "printToPdf")
    const fenetre = fenetrePrincipale()
    if (!fenetre) return false
    const chemin = await cheminAEnregistrer(fenetre, { title: "Exporter en PDF", defaultPath: defaultName, filters: [FILTRE_PDF] })
    if (!chemin) return false
    try {
      // La feuille de style d'impression (@media print) met la page en forme.
      // preferCSSPageSize : les tailles de page viennent de la feuille d'impression (A4 portrait, grille en paysage).
      const pdf = await fenetre.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
      return await ecrire(chemin, pdf, ERREURS_DE_FICHIER.pdf)
    } catch (error) {
      console.error("Erreur lors de l'export PDF :", error)
      dialog.showErrorBox(ERREURS_DE_FICHIER.pdf.titre, ERREURS_DE_FICHIER.pdf.message)
      return false
    }
  })

  // Retours des utilisateurs : seuls le formulaire de ticket du dépôt et l'e-mail des retours s'ouvrent hors de
  // l'application, dans le navigateur ou la messagerie du système. L'adresse est revérifiée ici, quoi qu'envoie la page.
  ipcMainHandle("ouvrirAdresseExterne", async (adresse: string) => {
    if (!adresseExterneAutorisee(adresse)) {
      console.warn("Adresse externe refusée.")
      return false
    }
    try {
      await shell.openExternal(adresse)
      return true
    } catch (error) {
      console.error("Ouverture de l'adresse externe impossible :", error)
      return false
    }
  })
}
