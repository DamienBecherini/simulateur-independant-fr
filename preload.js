// preload.js - NOUVELLE VERSION AVEC IPC
const { contextBridge, ipcRenderer } = require("electron")

// On expose une seule fonction au renderer : 'runSimulation'
// Cette fonction prend les 'inputs' et utilise ipcRenderer pour appeler 'run-simulation' dans le processus principal.
// Elle retourne une Promesse qui sera résolue avec les résultats renvoyés par main.js.
contextBridge.exposeInMainWorld("api", {
  runSimulation: inputs => ipcRenderer.invoke("run-simulation", inputs)
})
