// src/electron/preload.cts

const { contextBridge, ipcRenderer } = require("electron");

// On combine les deux corrections :
// 1. Ajouter l'extension '.js' aux chemins relatifs.
// 2. Conserver l'assertion 'with { "resolution-mode": "import" }'.
const api: import("../globals.js", { with: { "resolution-mode": "import" } }).EventPayloadMapping = {
  // Fonctions pour la session
  getCurrentSession: () => ipcRenderer.invoke("getCurrentSession"),
  saveCurrentSession: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState) => ipcRenderer.invoke("saveCurrentSession", session),
  saveCurrentSessionSync: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState) => {
    ipcRenderer.sendSync("saveCurrentSessionSync", session)
  },
  runMetaSimulation: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState) => ipcRenderer.invoke("runMetaSimulation", session),
  compareStatuts: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState, options: import('../types.js', { with: { "resolution-mode": "import" } }).ComparaisonOptions) => ipcRenderer.invoke("compareStatuts", session, options),
  optimiserRemuneration: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState, options: import('../types.js', { with: { "resolution-mode": "import" } }).ComparaisonOptions, statut: import('../types.js', { with: { "resolution-mode": "import" } }).StatutSociete) => ipcRenderer.invoke("optimiserRemuneration", session, options, statut),

  // Fonctions pour les slots
  getSaveSlots: () => ipcRenderer.invoke("getSaveSlots"),
  saveSlots: (slots: import('../types.js', { with: { "resolution-mode": "import" } }).SaveSlot[]) => ipcRenderer.invoke("saveSlots", slots),

  // Fonctions d'import/export
  exportState: (state: import('../types.js', { with: { "resolution-mode": "import" } }).ExportableState) => ipcRenderer.invoke("exportState", state),
  importState: () => ipcRenderer.invoke("importState"),
  saveTextFile: (options: { defaultName: string; content: string; format: import('../types.js', { with: { "resolution-mode": "import" } }).FormatFichierTexte }) => ipcRenderer.invoke("saveTextFile", options),
  openTextFile: (options: { title: string; format: import('../types.js', { with: { "resolution-mode": "import" } }).FormatFichierTexte }) => ipcRenderer.invoke("openTextFile", options),
  printToPdf: (defaultName: string) => ipcRenderer.invoke("printToPdf", defaultName),

  // Fonctions pour les préférences
  getUserPreferences: () => ipcRenderer.invoke("getUserPreferences"),
  saveUserPreferences: (prefs: import('../types.js', { with: { "resolution-mode": "import" } }).UserPreferences) => ipcRenderer.invoke("saveUserPreferences", prefs),

  // Gestionnaire d'événements pour les notifications
  onShowNotification: (callback) => {
    const listener = (
      _event: import("electron").IpcRendererEvent, 
      payload: import('../types.js', { with: { "resolution-mode": "import" } }).NotificationPayload
    ) => callback(payload);
    
    ipcRenderer.on("show-notification", listener);

    return () => ipcRenderer.removeListener("show-notification", listener);
  }
};

contextBridge.exposeInMainWorld("api", api);