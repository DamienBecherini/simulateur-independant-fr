// preload.js
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
  // Fonctions existantes
  getContent: () => ipcRenderer.invoke("get-content"),

  runSimulation: inputs => ipcRenderer.invoke("run-simulation", inputs),
  toHtml: markdownText => ipcRenderer.invoke("markdown-to-html", markdownText),

  // Fonctions pour la gestion de l'état
  getState: () => ipcRenderer.invoke("get-state"),
  updateUIState: uiState => ipcRenderer.invoke("update-ui-state", uiState),

  // Fonctions de gestion des backups
  listBackups: () => ipcRenderer.invoke("list-backups"),
  createBackup: name => ipcRenderer.invoke("create-backup", name),
  deleteBackup: name => ipcRenderer.invoke("delete-backup", name),
  loadBackup: name => ipcRenderer.invoke("load-backup", name),
  exportBackup: name => ipcRenderer.invoke("export-backup", name),
  resetToFactory: () => ipcRenderer.invoke("reset-to-factory")
})
