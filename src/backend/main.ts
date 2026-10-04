// src/backend/main.ts

import { app, BrowserWindow, dialog } from "electron"
import type { SessionState, SaveSlot, UserPreferences, ExportableState, ComparaisonOptions } from "@/types.js"
import { SessionStateSchema } from "@/types.js"
import { runMetaSimulation } from "./logic/simulation-engine.js"
import { comparerStatuts } from "./logic/comparateur.js"
import { ipcMainHandle, validateEventFrame } from "./util.js"
import { isDev } from "./isDev.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import path from "path"
import fs from "fs/promises"
import { writeFileSync } from "fs"
import { ipcMain } from "electron"
import { sanitizeStateAndFillDefaults, sanitizeSlots } from "./logic/data-sanitizer.js"
import { FORMAT_VERSION_ACTUEL, migrerVersFormatActuel, versionDuFormat } from "./logic/migrations.js"

const sessionStatePath = path.join(app.getPath("userData"), "sessionState.json")
const slotsFilePath = path.join(app.getPath("userData"), "simulationSlots.json")
const userPreferencesPath = path.join(app.getPath("userData"), "userPreferences.json")

// --- MISE À JOUR DE LA VALEUR PAR DÉFAUT ---
function getDefaultSessionState(): SessionState {
  return {
    name: "Nouvelle Simulation",
    entities: [],
    relationships: [], // <-- MODIFIÉ
    monthlyData: Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
  }
}

/** Affiche une boîte de dialogue d'information ; si elle ne peut pas s'afficher, l'échec est journalisé. */
function showInfoDialog(options: Electron.MessageBoxOptions) {
  dialog.showMessageBox(options).catch(error => console.error("Boîte de dialogue impossible à afficher :", error))
}

/** Ajoute à un fichier le numéro du format dans lequel il est écrit. */
function withFormatVersion<T extends object>(data: T): T & { formatVersion: number } {
  return { ...data, formatVersion: FORMAT_VERSION_ACTUEL }
}

/**
 * Avant de réécrire un fichier converti d'un format précédent, on en garde une copie à côté
 * (par exemple `sessionState.format-1.json`), au cas où la conversion poserait problème.
 */
async function backupBeforeMigration(filePath: string, rawContent: string, version: number) {
  const backupPath = filePath.replace(/\.json$/, `.format-${version}.json`)
  try {
    await fs.writeFile(backupPath, rawContent, { flag: "wx" })
  } catch {
    // Une copie existe déjà pour cette version : on la conserve.
  }
}

/** Texte des points à vérifier après conversion, pour une boîte de dialogue. */
function formatMigrationNotes(notes: string[]): string {
  return notes.map(note => `- ${note}`).join("\n\n")
}

async function readSessionFromFile(): Promise<SessionState> {
  try {
    const data = await fs.readFile(sessionStatePath, "utf-8")
    const parsedData = JSON.parse(data)
    const originalVersion = versionDuFormat(parsedData)

    const { safeState, report } = sanitizeStateAndFillDefaults(parsedData)

    // Un fichier d'un format précédent est converti une fois pour toutes, après copie de l'original.
    if (originalVersion < FORMAT_VERSION_ACTUEL) {
      await backupBeforeMigration(sessionStatePath, data, originalVersion)
      await writeSessionToFile(safeState)
    }

    const sections: string[] = []
    if (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0) {
      sections.push(`Des données corrompues ont dû être nettoyées :\n- Entités invalides supprimées : ${report.entitiesRemoved}\n- Relations invalides ou orphelines supprimées : ${report.relationshipsRemoved}\n- Flux invalides ou orphelins supprimés : ${report.flowsRemoved}`)
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
    await fs.writeFile(sessionStatePath, JSON.stringify(withFormatVersion(session), null, 2))
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
    const parsedData: unknown = JSON.parse(data)

    // Les slots corrompus sont écartés (et signalés dans la console) par le nettoyeur, les autres sont conservés.
    const slots = sanitizeSlots(parsedData)

    // Des sauvegardes d'un format précédent sont converties une fois pour toutes, après copie de l'original.
    const rawSlots: unknown[] = Array.isArray(parsedData) ? parsedData : []
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
    await fs.writeFile(slotsFilePath, JSON.stringify(slots.map(withFormatVersion), null, 2))
    console.log("Slots de sauvegarde enregistrés avec succès dans:", slotsFilePath)
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des slots:", error)
  }
}

async function readPrefsFromFile(): Promise<UserPreferences> {
  try {
    const data = await fs.readFile(userPreferencesPath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.log("Aucun fichier de préférences trouvé, retour aux valeurs par défaut.", error)
    return { slotOrder: [] }
  }
}

async function writePrefsToFile(prefs: UserPreferences) {
  try {
    await fs.writeFile(userPreferencesPath, JSON.stringify(prefs, null, 2))
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
      writeFileSync(sessionStatePath, JSON.stringify(withFormatVersion(session), null, 2))
      event.returnValue = true
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la session à la fermeture :", error)
      event.returnValue = false
    }
  })

  ipcMainHandle("runMetaSimulation", async (session: SessionState) => runMetaSimulation(validatedSession(session, "runMetaSimulation")))

  ipcMainHandle("compareStatuts", async (session: SessionState, options: ComparaisonOptions) => comparerStatuts(validatedSession(session, "compareStatuts"), options))

  ipcMainHandle("getSaveSlots", async () => await readSlotsFromFile())

  ipcMainHandle("saveSlots", async (slots: SaveSlot[]) => {
    await writeSlotsToFile(slots)
    if (mainWindow) {
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
        await fs.writeFile(filePath, JSON.stringify(withFormatVersion(state), null, 2))
      } catch (error) {
        console.error("Erreur lors de l'exportation :", error)
        dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      }
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
        const importedData = JSON.parse(fileContent)

        const { safeState, report } = sanitizeStateAndFillDefaults(importedData)

        if (mainWindow && (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0 || report.migrationNotes.length > 0)) {
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
        return {
          data: {
            entities: safeState.entities,
            relationships: safeState.relationships,
            monthlyData: safeState.monthlyData
          },
          report: report // Le frontend saura quoi faire de cette information
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue."
        console.error("Erreur lors de l'importation :", errorMessage)
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
