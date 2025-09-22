// src/electron/main.ts

import { app, BrowserWindow, dialog } from "electron"
import { ipcMainHandle, isDev } from "./util.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import path from "path"
import fs from "fs/promises"
import { fileURLToPath } from "url"

// --- CORRECTION : On définit __dirname manuellement pour la compatibilité ESM ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- Début de la logique de sauvegarde de l'état ---

const stateFilePath = path.join(app.getPath("userData"), "appState.json")

async function readStateFromFile() {
  try {
    const data = await fs.readFile(stateFilePath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // --- CORRECTION ICI ---
    // On affiche l'erreur pour savoir pourquoi la lecture a échoué.
    // Cela résout l'avertissement "variable non utilisée".
    console.log("Aucun fichier d'état trouvé ou erreur de lecture, démarrage avec un état vide. Détails:", error)
    return []
  }
}

async function writeStateToFile(entities: Entity[]) {
  try {
    await fs.writeFile(stateFilePath, JSON.stringify(entities, null, 2))
    console.log("État sauvegardé avec succès dans:", stateFilePath)
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de l'état:", error)
  }
}

// --- Fin de la logique de sauvegarde de l'état ---

// --- Début de la gestion des fenêtres (Splash & Main) ---

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
  splashWindow.loadFile(path.join(__dirname, "../../splash.html"))
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
      // if (isDev()) {
      //   mainWindow.webContents.openDevTools();
      // }
    }
  })
}

// --- Fin de la gestion des fenêtres ---

// --- Point d'entrée de l'application Electron ---

app.on("ready", () => {
  createSplashWindow()
  createMainWindow()

  ipcMainHandle("getState", async () => {
    console.log("IPC: 'getState' a été appelé !")
    return await readStateFromFile()
  })

  ipcMainHandle("saveState", async (entities: Entity[]) => {
    console.log("IPC: 'saveState' a été appelé.")
    await writeStateToFile(entities)
  })

  ipcMainHandle("exportState", async (entities: Entity[]) => {
    if (!mainWindow) return // S'assure que la fenêtre principale existe

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Exporter la configuration",
      defaultPath: `simulateur-config-${Date.now()}.json`,
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })

    if (!canceled && filePath) {
      try {
        await fs.writeFile(filePath, JSON.stringify(entities, null, 2))
        console.log(`Configuration exportée avec succès vers : ${filePath}`)
      } catch (error) {
        console.error("Erreur lors de l'exportation :", error)
        dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      }
    }
  })

  // --- NOUVEAU HANDLER POUR L'IMPORTATION ---
  ipcMainHandle("importState", async () => {
    if (!mainWindow) return { error: "La fenêtre principale n'est pas disponible." }

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Importer une configuration",
      properties: ["openFile"],
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })

    if (!canceled && filePaths.length > 0) {
      try {
        const data = await fs.readFile(filePaths[0], "utf-8")
        const entities = JSON.parse(data)
        // On pourrait ajouter une validation ici pour s'assurer que le fichier est correct
        return { data: entities }
      } catch (error) {
        console.error("Erreur lors de l'importation :", error)
        dialog.showErrorBox("Erreur d'importation", "Le fichier sélectionné est invalide ou corrompu.")
        return { error: "Erreur de lecture du fichier." }
      }
    }
    return { data: null } // L'utilisateur a annulé
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
