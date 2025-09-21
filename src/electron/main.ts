// src/electron/main.ts

import { app, BrowserWindow } from "electron"
import { ipcMainHandle, isDev } from "./util.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import { simulerMicroEntreprise } from "./logic/calculsAE.js"
import path from "path"
import fs from "fs/promises"

// --- DÉBUT DE LA NOUVELLE LOGIQUE DE SAUVEGARDE ---

// On définit un chemin de sauvegarde sécurisé dans le dossier de l'application de l'utilisateur
const stateFilePath = path.join(app.getPath("userData"), "appState.json")

// Fonction pour lire l'état depuis le fichier JSON
async function readStateFromFile() {
  try {
    const data = await fs.readFile(stateFilePath, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    // Si le fichier n'existe pas ou est corrompu, on retourne un état vide
    console.log("Aucun fichier d'état trouvé, démarrage avec un état vide.", error)
    return []
  }
}

// Fonction pour écrire l'état dans le fichier JSON
async function writeStateToFile(entities: Entity[]) {
  try {
    await fs.writeFile(stateFilePath, JSON.stringify(entities, null, 2))
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de l'état:", error)
  }
}

// --- FIN DE LA NOUVELLE LOGIQUE DE SAUVEGARDE ---

app.on("ready", () => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: getPreloadPath()
    }
  })

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3524")
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(getUIPath())
  }

  // C'est notre seule et unique fonction de communication pour le moment.
  // Tout le code d'exemple du template a été retiré.
  ipcMainHandle("runTestSimulation", async () => {
    console.log("IPC: 'run-test-simulation' a été appelé !")

    const testInputs: SimulationInputs = {
      // Utilise le type global
      ca_services_bnc: 50000,
      chargesDeductibles: 2000,
      autresRevenusImposablesFoyer: 0,
      partsFiscales: 1
    }

    try {
      // Note: simulerMicroEntreprise est synchrone, mais le handler est async
      // pour retourner une Promise, ce qui est parfait.
      const result = simulerMicroEntreprise(testInputs)
      console.log("Résultat du calcul:", result)
      return result
    } catch (error) {
      console.error("Erreur dans le moteur de calcul:", error)
      return {
        statut: "Erreur",
        chiffreAffaires: 0,
        netDansLaPoche: 0,
        error: (error as Error).message
      }
    }
  })

  // Quand le frontend demande l'état, on le lit depuis le fichier
  ipcMainHandle("getState", async () => {
    console.log("IPC: 'getState' a été appelé !")
    return await readStateFromFile()
  })

  ipcMainHandle("saveState", async entities => {
    console.log("IPC: 'saveState' a été appelé avec de nouvelles données.")
    await writeStateToFile(entities)
    // ipcMain.handle ATTEND une promesse en retour.
    // Comme writeStateToFile ne retourne rien, la promesse se résout en 'void'. C'est parfait.
  })
})

// Ce bout de code est nécessaire pour corriger une limitation de ipcMain.on avec le preload
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
