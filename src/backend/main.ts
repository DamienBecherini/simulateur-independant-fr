// src/electron/main.ts

import { app, BrowserWindow, dialog } from "electron"
import type { SessionState, SaveSlot, UserPreferences, ExportableState } from "@/types.js"
import { ipcMainHandle } from "./util.js"
import { isDev } from "./isDev.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import path from "path"
import fs from "fs/promises"
import { sanitizeStateAndFillDefaults, sanitizeSlots } from "./logic/data-sanitizer.js"
// --- 1. IMPORTER LA NOUVELLE FONCTION ---
import { runSimulation } from "./logic/simulationOrchestrator.js"

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

async function readSessionFromFile(): Promise<SessionState> {
  try {
    const data = await fs.readFile(sessionStatePath, "utf-8")
    const parsedData = JSON.parse(data)

    const { safeState, report } = sanitizeStateAndFillDefaults(parsedData)

    // Si le rapport indique des suppressions, on prévient l'utilisateur
    if (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0) {
      const message = `Votre session précédente a été chargée, mais des données corrompues ont dû être nettoyées :\n\n- Entités invalides supprimées : ${report.entitiesRemoved}\n- Relations invalides supprimées : ${report.relationshipsRemoved}\n\nVeuillez vérifier votre simulation.`
      dialog
        .showMessageBox({
          type: "info",
          title: "Nettoyage de la session",
          message: message
        })
        .catch()
    }
    return safeState
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue."
    console.warn(`Échec du chargement de la session : ${errorMessage}. Démarrage avec une session par défaut.`)

    // AVERTIR L'UTILISATEUR AU DÉMARRAGE (BONUS)
    dialog
      .showMessageBox({
        type: "warning",
        title: "Chargement échoué",
        message: "Impossible de charger votre session précédente car le fichier est peut-être corrompu ou obsolète. L'application a démarré avec une nouvelle simulation vierge."
      })
      .catch() // On ignore l'erreur si la dialog ne peut pas s'afficher

    return getDefaultSessionState()
  }
}

async function writeSessionToFile(session: SessionState) {
  try {
    await fs.writeFile(sessionStatePath, JSON.stringify(session, null, 2))
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
    const parsedData = JSON.parse(data)

    // ON PASSE LES DONNÉES BRUTES DANS NOTRE NOUVEAU NETTOYEUR DE SLOTS
    const cleanSlots = sanitizeSlots(parsedData)

    // On pourrait même vérifier si des slots ont été supprimés et le logger
    if (cleanSlots.length < (parsedData as unknown[]).length) {
      console.warn("Certains slots de sauvegarde étaient corrompus et ont été ignorés.")
    }

    return cleanSlots
  } catch (error) {
    console.log("Aucun fichier de slots trouvé ou fichier illisible, démarrage avec un état vide.")
    return []
  }
}

async function writeSlotsToFile(slots: SaveSlot[]) {
  try {
    await fs.writeFile(slotsFilePath, JSON.stringify(slots, null, 2))
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

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true
  })
  splashWindow.loadFile(path.join(app.getAppPath(), "splash.html"))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      preload: getPreloadPath()
    }
  })

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3524")
  } else {
    mainWindow.loadFile(getUIPath())
  }

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
    if (mainWindow) {
      mainWindow.show()
    }
  })
}

app.on("ready", () => {
  createSplashWindow()
  createMainWindow()

  ipcMainHandle("getCurrentSession", async () => await readSessionFromFile())
  ipcMainHandle("saveCurrentSession", async (session: SessionState) => await writeSessionToFile(session))

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
        await fs.writeFile(filePath, JSON.stringify(state, null, 2))
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

        if (mainWindow && (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0)) {
          mainWindow.webContents.send("show-notification", {
            message: "Fichier importé avec des corrections. Voir la modale pour les détails.",
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

  // --- 2. AJOUTER LE HANDLER POUR LA SIMULATION ---
  // Il reçoit la session depuis le frontend, la passe à notre orchestrateur,
  // et retourne le résultat de la simulation.
  ipcMainHandle("runSimulation", async (session: SessionState) => {
    return await runSimulation(session)
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
