// src/backend/main.ts

import { app, BrowserWindow, dialog, shell } from "electron"
import type { SessionState, SaveSlot, UserPreferences, ExportableState, ComparaisonOptions, StatutSociete, FormatFichierTexte } from "@/types.js"
import { SessionStateSchema } from "@/types.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./logic/simulation-pluriannuelle.js"
import { ipcMainHandle, validateEventFrame } from "./util.js"
import { isDev } from "./isDev.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import path from "path"
import fs from "fs/promises"
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs"
import { ipcMain } from "electron"
import { AnneesRefuseesError, rapportAvecCorrections, texteAnneesEcartees } from "./logic/data-sanitizer.js"
import { contenuDesSauvegardes, contenuDuFichier, lireLaSession, lireLesPreferences, lireLesSauvegardes, lireUneSimulationImportee, preferencesParDefaut, preferencesValides, sauvegardesAEcrire } from "./logic/fichiers-de-donnees.js"
import { FORMAT_VERSION_ACTUEL, migrerVersFormatActuel, versionDuFormat } from "./logic/migrations.js"
import { adresseExterneAutorisee } from "@/lib/adresses-des-retours.js"

/** Filtres des fenêtres d'enregistrement et d'ouverture, par format de fichier texte. */
const FILTRES_FICHIERS: Record<FormatFichierTexte, Electron.FileFilter> = {
  csv: { name: "Fichiers CSV", extensions: ["csv"] },
  markdown: { name: "Documents Markdown", extensions: ["md"] },
  json: { name: "Fichiers JSON", extensions: ["json"] }
}

/** Fichiers de données conservés d'une version à l'autre. */
const DATA_FILES = ["sessionState.json", "simulationSlots.json", "userPreferences.json"]

/**
 * Le dossier de données suit le nom du paquet. Jusqu'à la version 0.9, ce nom était « electron-vite-template » :
 * au premier lancement, si le nouveau dossier ne contient encore aucune donnée, on y recopie l'ancien.
 * L'ancien dossier n'est pas supprimé. Un dossier imposé au lancement (--user-data-dir, comme dans les tests
 * de bout en bout) n'est jamais concerné : il doit rester tel qu'on le fournit.
 */
function recopierAncienDossierDeDonnees() {
  if (app.commandLine.hasSwitch("user-data-dir")) return
  const dossier = app.getPath("userData")
  const ancien = path.join(app.getPath("appData"), "electron-vite-template")
  if (ancien === dossier || !existsSync(ancien) || DATA_FILES.some(f => existsSync(path.join(dossier, f)))) return
  mkdirSync(dossier, { recursive: true })
  for (const fichier of DATA_FILES) {
    if (existsSync(path.join(ancien, fichier))) copyFileSync(path.join(ancien, fichier), path.join(dossier, fichier))
  }
  console.info(`Données reprises de l'ancien dossier : ${ancien}`)
}
recopierAncienDossierDeDonnees()

const sessionStatePath = path.join(app.getPath("userData"), "sessionState.json")
const slotsFilePath = path.join(app.getPath("userData"), "simulationSlots.json")
const userPreferencesPath = path.join(app.getPath("userData"), "userPreferences.json")

/** Session vierge : une année, la dernière dont les règles sont connues, sans acteur ni flux. */
function getDefaultSessionState(): SessionState {
  return SessionStateSchema.parse({})
}

/** Affiche une boîte de dialogue d'information ; si elle ne peut pas s'afficher, l'échec est journalisé. */
function showInfoDialog(options: Electron.MessageBoxOptions) {
  dialog.showMessageBox(options).catch(error => console.error("Boîte de dialogue impossible à afficher :", error))
}

/**
 * Avant de réécrire un fichier converti d'un format précédent, on en garde une copie à côté
 * (par exemple `sessionState.format-1.json`), au cas où la conversion poserait problème.
 */
async function backupBeforeMigration(filePath: string, rawContent: string, version: number) {
  await keepCopy(filePath, rawContent, `format-${version}`)
}

/** Garde une copie d'un fichier à côté de lui (`sessionState.<suffixe>.json`), sans écraser une copie existante. */
async function keepCopy(filePath: string, rawContent: string, suffix: string) {
  const backupPath = filePath.replace(/\.json$/, `.${suffix}.json`)
  try {
    await fs.writeFile(backupPath, rawContent, { flag: "wx" })
  } catch {
    // Une copie existe déjà : on la conserve.
  }
}

/** Suffixe de la copie gardée d'un fichier refusé à cause de ses années (trop nombreuses ou non consécutives). */
const SUFFIXE_REFUS = "refuse"

/** Texte des points à vérifier après conversion, pour une boîte de dialogue. */
function formatMigrationNotes(notes: string[]): string {
  return notes.map(note => `- ${note}`).join("\n\n")
}

/** Session refusée au démarrage à cause de ses années : on en garde une copie, on prévient, on repart d'une session vierge. */
async function refuseSession(rawContent: string, reason: string): Promise<SessionState> {
  await keepCopy(sessionStatePath, rawContent, SUFFIXE_REFUS)
  showInfoDialog({
    type: "warning",
    title: "Chargement refusé",
    message: `Votre session précédente n'a pas été chargée.\n\n${reason}\n\nUne copie du fichier a été gardée à côté de lui (sessionState.${SUFFIXE_REFUS}.json). L'application a démarré avec une nouvelle simulation vierge.`
  })
  return getDefaultSessionState()
}

async function readSessionFromFile(): Promise<SessionState> {
  let data = ""
  try {
    data = await fs.readFile(sessionStatePath, "utf-8")
    const { safeState, report, versionOrigine: originalVersion } = lireLaSession(data)

    // Un fichier d'un format précédent est converti une fois pour toutes, après copie de l'original.
    if (originalVersion < FORMAT_VERSION_ACTUEL) {
      await backupBeforeMigration(sessionStatePath, data, originalVersion)
      await writeSessionToFile(safeState)
    }

    const sections: string[] = []
    if (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0 || report.reglagesRemoved > 0) {
      sections.push(`Des données corrompues ont dû être nettoyées :\n- Entités invalides supprimées : ${report.entitiesRemoved}\n- Relations invalides ou orphelines supprimées : ${report.relationshipsRemoved}\n- Flux invalides ou orphelins supprimés : ${report.flowsRemoved}\n- Réglages du comparateur invalides écartés : ${report.reglagesRemoved}`)
    }
    if (report.anneesEcartees.length > 0) {
      sections.push(`${texteAnneesEcartees(report.anneesEcartees)}. Seule la première occurrence de chaque année a été gardée.`)
    }
    if (report.migrationNotes.length > 0) {
      sections.push(`Elle a été convertie au nouveau format du simulateur. Points à vérifier :\n\n${formatMigrationNotes(report.migrationNotes)}`)
    }
    if (sections.length > 0) {
      showInfoDialog({
        type: "info",
        title: "Chargement de la session",
        message: `Votre session précédente a été chargée.\n\n${sections.join("\n\n")}`
      })
    }
    return safeState
  } catch (error) {
    // Premier lancement : il n'y a simplement pas encore de session, ce n'est pas une erreur.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return getDefaultSessionState()
    if (error instanceof AnneesRefuseesError) return refuseSession(data, error.message)

    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue."
    console.warn(`Échec du chargement de la session : ${errorMessage}. Démarrage avec une session par défaut.`)

    // AVERTIR L'UTILISATEUR AU DÉMARRAGE (BONUS)
    showInfoDialog({
      type: "warning",
      title: "Chargement échoué",
      message: "Impossible de charger votre session précédente car le fichier est peut-être corrompu ou obsolète. L'application a démarré avec une nouvelle simulation vierge."
    })

    return getDefaultSessionState()
  }
}

async function writeSessionToFile(session: SessionState) {
  try {
    await fs.writeFile(sessionStatePath, contenuDuFichier(session, app.getVersion()))
    // On envoie une notification de succès au frontend
    // if (mainWindow) {
    //   mainWindow.webContents.send("show-notification", {
    //     message: "Sauvegarde automatique réussie.",
    //     type: "success"
    //   })
    // }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de la session:", error)
    // On notifie l'échec
    if (mainWindow) {
      mainWindow.webContents.send("show-notification", {
        message: "Échec de la sauvegarde automatique.",
        type: "error"
      })
    }
  }
}

async function readSlotsFromFile(): Promise<SaveSlot[]> {
  try {
    const data = await fs.readFile(slotsFilePath, "utf-8")
    // Les slots corrompus sont écartés (et signalés dans la console) par le nettoyeur, les autres sont conservés.
    const { slots, refusees, brutes: rawSlots } = lireLesSauvegardes(data)

    // Des sauvegardes refusées à cause de leurs années disparaîtront à la prochaine écriture : on garde une copie du fichier.
    if (refusees.length > 0) {
      await keepCopy(slotsFilePath, data, SUFFIXE_REFUS)
      showInfoDialog({
        type: "warning",
        title: "Sauvegardes refusées",
        message: `${refusees.length > 1 ? "Ces sauvegardes n'ont pas été chargées" : "Cette sauvegarde n'a pas été chargée"} :\n\n${refusees.map(({ nom, raison }) => `- « ${nom} » : ${raison}`).join("\n\n")}\n\nUne copie du fichier a été gardée à côté de lui (simulationSlots.${SUFFIXE_REFUS}.json).`
      })
    }

    // Des sauvegardes d'un format précédent sont converties une fois pour toutes, après copie de l'original.
    const oldSlots = rawSlots.filter(slot => versionDuFormat(slot) < FORMAT_VERSION_ACTUEL)
    if (oldSlots.length > 0) {
      await backupBeforeMigration(slotsFilePath, data, Math.min(...oldSlots.map(versionDuFormat)))
      await writeSlotsToFile(slots)
      const notes = [...new Set(oldSlots.flatMap(slot => migrerVersFormatActuel(slot).notes))]
      showInfoDialog({
        type: "info",
        title: "Sauvegardes converties",
        message: `${oldSlots.length} sauvegarde${oldSlots.length > 1 ? "s ont été converties" : " a été convertie"} au nouveau format du simulateur.${notes.length > 0 ? `\n\nÀ l'ouverture de chacune, vérifiez :\n\n${formatMigrationNotes(notes)}` : ""}`
      })
    }
    return slots
  } catch {
    console.log("Aucun fichier de slots trouvé ou fichier illisible, démarrage avec un état vide.")
    return []
  }
}

async function writeSlotsToFile(slots: SaveSlot[]) {
  try {
    await fs.writeFile(slotsFilePath, contenuDesSauvegardes(slots))
    console.log("Slots de sauvegarde enregistrés avec succès dans:", slotsFilePath)
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des slots:", error)
  }
}

/**
 * Lit les préférences, validées comme dans la démo web : un champ invalide est écarté seul. Un fichier illisible
 * (JSON abîmé) donne les préférences par défaut ; on en garde une copie (userPreferences.refuse.json), comme des
 * autres fichiers refusés, sans boîte de dialogue : rien de la simulation n'est perdu.
 */
async function readPrefsFromFile(): Promise<UserPreferences> {
  let data = ""
  try {
    data = await fs.readFile(userPreferencesPath, "utf-8")
    return lireLesPreferences(data)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return preferencesParDefaut()
    console.warn("Fichier de préférences illisible, retour aux valeurs par défaut :", error instanceof Error ? error.message : error)
    if (data !== "") await keepCopy(userPreferencesPath, data, SUFFIXE_REFUS)
    return preferencesParDefaut()
  }
}

async function writePrefsToFile(prefs: UserPreferences) {
  try {
    // Validées avant écriture, comme à la lecture. Écrites à côté puis renommées : enregistrées aussi à la fermeture de
    // la fenêtre, elles ne doivent pas rester à moitié écrites si l'application se termine pendant l'écriture.
    const provisoire = `${userPreferencesPath}.tmp`
    await fs.writeFile(provisoire, JSON.stringify(preferencesValides(prefs), null, 2))
    await fs.rename(provisoire, userPreferencesPath)
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des préférences:", error)
  }
}

/** Session reçue de l'interface, revalidée avant calcul ; une session invalide est remplacée par la session par défaut. */
function validatedSession(session: unknown, caller: string): SessionState {
  const parsed = SessionStateSchema.safeParse(session)
  if (parsed.success) return parsed.data
  console.warn(`${caller} : session invalide, utilisation des valeurs par défaut du schéma`, parsed.error.flatten())
  return SessionStateSchema.parse({})
}

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

// Fenêtres discrètes : utilisé par les tests de bout en bout, pour ne pas gêner le travail en cours sur le poste.
// La fenêtre principale reste affichée (une fenêtre cachée ne rafraîchit plus son rendu, ce qui ralentit les tests),
// mais elle est transparente, absente de la barre des tâches, ne prend pas le focus et laisse passer les clics.
const hiddenWindows = process.env.SIMULATEUR_FENETRES_MASQUEES === "1"

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    show: !hiddenWindows,
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true
  })
  splashWindow.loadFile(path.join(app.getAppPath(), "splash.html")).catch(error => console.error("Écran de démarrage introuvable :", error))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    // En dessous, les cartes des acteurs et la grille annuelle ne tiennent plus correctement.
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      preload: getPreloadPath(),
      // Une fenêtre masquée ralentit ses minuteries ; la sauvegarde et le recalcul différés doivent rester ponctuels.
      backgroundThrottling: !hiddenWindows
    }
  })

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3524").catch(error => console.error("Serveur de développement injoignable :", error))
  } else {
    mainWindow.loadFile(getUIPath()).catch(error => console.error("Interface introuvable :", error))
  }

  // Boutons « précédent » et « suivant » de la souris (Windows, Linux) : retour à la vue précédente de l'affichage
  // « Trois vues », comme dans un navigateur. L'historique ne contient que des vues de la même page.
  mainWindow.on("app-command", (_event, commande) => {
    const historique = mainWindow?.webContents.navigationHistory
    if (commande === "browser-backward" && historique?.canGoBack()) historique.goBack()
    if (commande === "browser-forward" && historique?.canGoForward()) historique.goForward()
  })

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
    if (mainWindow && hiddenWindows) {
      mainWindow.setOpacity(0)
      mainWindow.setSkipTaskbar(true)
      mainWindow.setIgnoreMouseEvents(true)
      mainWindow.showInactive()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
}

app.on("ready", () => {
  createSplashWindow()
  createMainWindow()

  ipcMainHandle("getCurrentSession", async () => await readSessionFromFile())
  ipcMainHandle("saveCurrentSession", async (session: SessionState) => await writeSessionToFile(session))

  // Enregistrement synchrone, appelé par l'interface quand la fenêtre se ferme : la sauvegarde automatique
  // est différée d'une seconde, et une modification faite juste avant la fermeture serait sinon perdue.
  ipcMain.on("saveCurrentSessionSync", (event, session: SessionState) => {
    if (event.senderFrame) validateEventFrame(event.senderFrame)
    try {
      writeFileSync(sessionStatePath, contenuDuFichier(session, app.getVersion()))
      event.returnValue = true
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la session à la fermeture :", error)
      event.returnValue = false
    }
  })

  ipcMainHandle("simulerLesAnnees", async (session: SessionState) => simulerLesAnnees(validatedSession(session, "simulerLesAnnees")))

  ipcMainHandle("compareStatuts", async (session: SessionState, options: ComparaisonOptions, annee: number) => comparerStatutsDeLAnnee(validatedSession(session, "compareStatuts"), options, annee))
  ipcMainHandle("optimiserRemuneration", async (session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number) => optimiserRemunerationDeLAnnee(validatedSession(session, "optimiserRemuneration"), options, statut === "EURL" ? "EURL" : "SASU", annee))

  ipcMainHandle("getSaveSlots", async () => await readSlotsFromFile())

  ipcMainHandle("saveSlots", async (slots: SaveSlot[], options?: { silencieux?: boolean }) => {
    // Validation avant écriture, comme à la lecture : un slot invalide est écarté au lieu d'abîmer le fichier.
    const slotsValides = sauvegardesAEcrire(slots)
    if (slotsValides.length < slots.length) console.warn(`Sauvegardes invalides écartées avant écriture : ${slots.length - slotsValides.length}.`)
    await writeSlotsToFile(slotsValides)
    if (mainWindow && !options?.silencieux) {
      mainWindow.webContents.send("show-notification", {
        message: "Sauvegarde réussie !",
        type: "success"
      })
    }
  })

  ipcMainHandle("exportState", async (state: ExportableState) => {
    if (!mainWindow) return
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Exporter la simulation",
      defaultPath: `simulateur-export-${Date.now()}.json`,
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })
    if (!canceled && filePath) {
      try {
        await fs.writeFile(filePath, contenuDuFichier(state, app.getVersion()))
      } catch (error) {
        console.error("Erreur lors de l'exportation :", error)
        dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      }
    }
  })

  // --- FICHIERS TEXTE (exports CSV et Markdown, sauvegardes groupées) ET PDF ---
  ipcMainHandle("saveTextFile", async ({ defaultName, content, format }: { defaultName: string; content: string; format: FormatFichierTexte }) => {
    if (!mainWindow) return false
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: "Exporter", defaultPath: defaultName, filters: [FILTRES_FICHIERS[format]] })
    if (canceled || !filePath) return false
    try {
      await fs.writeFile(filePath, content, "utf-8")
      return true
    } catch (error) {
      console.error("Erreur lors de l'enregistrement :", error)
      dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      return false
    }
  })

  ipcMainHandle("openTextFile", async ({ title, format }: { title: string; format: FormatFichierTexte }) => {
    if (!mainWindow) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title, properties: ["openFile"], filters: [FILTRES_FICHIERS[format]] })
    if (canceled || filePaths.length === 0) return null
    try {
      return await fs.readFile(filePaths[0], "utf-8")
    } catch (error) {
      console.error("Erreur lors de la lecture :", error)
      dialog.showErrorBox("Erreur d'importation", "Impossible de lire le fichier.")
      return null
    }
  })

  ipcMainHandle("printToPdf", async (defaultName: string) => {
    if (!mainWindow) return false
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: "Exporter en PDF", defaultPath: defaultName, filters: [{ name: "Documents PDF", extensions: ["pdf"] }] })
    if (canceled || !filePath) return false
    try {
      // La feuille de style d'impression (@media print) met la page en forme.
      // preferCSSPageSize : les tailles de page viennent de la feuille d'impression (A4 portrait, grille en paysage).
      const pdf = await mainWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
      await fs.writeFile(filePath, pdf)
      return true
    } catch (error) {
      console.error("Erreur lors de l'export PDF :", error)
      dialog.showErrorBox("Erreur d'exportation", "Impossible de créer le PDF.")
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

  // --- GESTION DE L'IMPORT MANUEL ---
  ipcMainHandle("importState", async () => {
    if (!mainWindow) return { error: "La fenêtre principale n'est pas disponible." }
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Importer une simulation",
      properties: ["openFile"],
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })
    if (!canceled && filePaths.length > 0) {
      try {
        const fileContent = await fs.readFile(filePaths[0], "utf-8")
        const { data, report } = lireUneSimulationImportee(fileContent)

        if (mainWindow && rapportAvecCorrections(report)) {
          mainWindow.webContents.send("show-notification", {
            message: "Fichier importé avec des ajustements : vérifiez le détail avant de continuer.",
            type: "warning"
          })
        } else if (mainWindow) {
          mainWindow.webContents.send("show-notification", {
            message: "Simulation importée avec succès !",
            type: "success"
          })
        }

        // On renvoie l'état ET le rapport au frontend
        // On renvoie l'état ET le rapport au frontend, qui saura quoi faire de cette information.
        return { data, report }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue."
        console.error("Erreur lors de l'importation :", errorMessage)
        // Un fichier refusé à cause de ses années n'est pas corrompu : le motif suffit, il dit quoi corriger.
        if (error instanceof AnneesRefuseesError) {
          dialog.showErrorBox("Import impossible", errorMessage)
          return { error: errorMessage }
        }
        dialog.showErrorBox("Erreur d'importation", `Le fichier sélectionné est invalide, corrompu ou d'une version non compatible.\n\nDétails : ${errorMessage}`)
        return { error: errorMessage }
      }
    }
    return { data: undefined }
  })

  ipcMainHandle("getUserPreferences", async () => await readPrefsFromFile())
  ipcMainHandle("saveUserPreferences", async (prefs: UserPreferences) => await writePrefsToFile(prefs))
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
