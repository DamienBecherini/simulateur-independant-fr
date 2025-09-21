// src/electron/preload.cts

import { contextBridge, ipcRenderer } from "electron"

// --- AJOUT : Définissez l'API que vous exposez ---
const api = {
  // Le nom de la fonction que vous appellerez depuis React
  runTestSimulation: () => ipcRenderer.invoke("run-test-simulation")
}

// --- AJOUT : Exposez l'API de manière sécurisée ---
try {
  contextBridge.exposeInMainWorld("api", api)
} catch (error) {
  console.error(error)
}
