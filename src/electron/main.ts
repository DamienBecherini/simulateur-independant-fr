// src/electron/main.ts

import { app, BrowserWindow } from "electron"
import { ipcMainHandle, isDev } from "./util.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import { simulerMicroEntreprise } from "./logic/calculsAE.js"

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
})
