// src/electron/preload.cts

/// <reference path="../../types.d.ts" />

const { contextBridge, ipcRenderer } = require("electron")

const api: EventPayloadMapping = {
  // Fonctions pour la session de travail
  getCurrentSession: () => ipcRenderer.invoke("getCurrentSession"),
  saveCurrentSession: (session: SessionState) => ipcRenderer.invoke("saveCurrentSession", session),

  // Fonctions pour les slots de sauvegarde
  getSaveSlots: () => ipcRenderer.invoke("getSaveSlots"),
  saveSlots: (slots: SaveSlot[]) => ipcRenderer.invoke("saveSlots", slots),

  // Fonctions pour l'import/export
  exportState: (entities: Entity[]) => ipcRenderer.invoke("exportState", entities),
  importState: () => ipcRenderer.invoke("importState"),

  getUserPreferences: () => ipcRenderer.invoke("getUserPreferences"),
  saveUserPreferences: (prefs: UserPreferences) => ipcRenderer.invoke("saveUserPreferences", prefs)
}

contextBridge.exposeInMainWorld("api", api)
