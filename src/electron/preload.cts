// src/electron/preload.cts

import { contextBridge, ipcRenderer } from "electron"

const api: EventPayloadMapping = {
  // Fonctions pour la session
  getCurrentSession: () => ipcRenderer.invoke("getCurrentSession"),
  saveCurrentSession: (session: SessionState) => ipcRenderer.invoke("saveCurrentSession", session),

  // Fonctions pour les slots
  getSaveSlots: () => ipcRenderer.invoke("getSaveSlots"),
  saveSlots: (slots: SaveSlot[]) => ipcRenderer.invoke("saveSlots", slots),

  // La fonction attend maintenant un objet 'state'
  exportState: (state: { entities: Entity[]; monthlyData: MonthlyGridData }) => ipcRenderer.invoke("exportState", state),

  // L'appel reste le même
  importState: () => ipcRenderer.invoke("importState"),

  // Fonctions pour les préférences
  getUserPreferences: () => ipcRenderer.invoke("getUserPreferences"),
  saveUserPreferences: (prefs: UserPreferences) => ipcRenderer.invoke("saveUserPreferences", prefs)
}

contextBridge.exposeInMainWorld("api", api)

// PAS D'EXPORT ICI. Le type est déjà global.
