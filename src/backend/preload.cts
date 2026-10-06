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
  simulerLesAnnees: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState) => ipcRenderer.invoke("simulerLesAnnees", session),
  compareStatuts: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState, options: import('../types.js', { with: { "resolution-mode": "import" } }).ComparaisonOptions, annee: number) => ipcRenderer.invoke("compareStatuts", session, options, annee),
  optimiserRemuneration: (session: import('../types.js', { with: { "resolution-mode": "import" } }).SessionState, options: import('../types.js', { with: { "resolution-mode": "import" } }).ComparaisonOptions, statut: import('../types.js', { with: { "resolution-mode": "import" } }).StatutSociete, annee: number) => ipcRenderer.invoke("optimiserRemuneration", session, options, statut, annee),

  // Fonctions pour les slots
  getSaveSlots: () => ipcRenderer.invoke("getSaveSlots"),
  saveSlots: (slots: import('../types.js', { with: { "resolution-mode": "import" } }).SaveSlot[], options?: { silencieux?: boolean }) => ipcRenderer.invoke("saveSlots", slots, options),

  // Fonctions d'import/export
  exportState: (state: import('../types.js', { with: { "resolution-mode": "import" } }).ExportableState) => ipcRenderer.invoke("exportState", state),
  importState: () => ipcRenderer.invoke("importState"),
  saveTextFile: (options: { defaultName: string; content: string; format: import('../types.js', { with: { "resolution-mode": "import" } }).FormatFichierTexte }) => ipcRenderer.invoke("saveTextFile", options),
  openTextFile: (options: { title: string; format: import('../types.js', { with: { "resolution-mode": "import" } }).FormatFichierTexte }) => ipcRenderer.invoke("openTextFile", options),
  printToPdf: (defaultName: string) => ipcRenderer.invoke("printToPdf", defaultName),
  ouvrirAdresseExterne: (adresse: string) => ipcRenderer.invoke("ouvrirAdresseExterne", adresse),

  // Fonctions pour les préférences
  getUserPreferences: () => ipcRenderer.invoke("getUserPreferences"),
  saveUserPreferences: (prefs: import('../types.js', { with: { "resolution-mode": "import" } }).UserPreferences) => ipcRenderer.invoke("saveUserPreferences", prefs),

  // Serveur MCP local et boîte aux propositions d'un client d'IA (voir l'ADR 011)
  infosDuServeurMcp: () => ipcRenderer.invoke("infosDuServeurMcp"),
  propositionsEnAttente: () => ipcRenderer.invoke("propositionsEnAttente"),
  retirerProposition: (id: string) => ipcRenderer.invoke("retirerProposition", id),
  onPropositionsEnAttente: (callback) => {
    const listener = (
      _event: import("electron").IpcRendererEvent,
      propositions: import('./mcp/proposition-en-attente.js', { with: { "resolution-mode": "import" } }).PropositionRecue[]
    ) => callback(propositions);

    ipcRenderer.on("propositions-en-attente", listener);

    return () => ipcRenderer.removeListener("propositions-en-attente", listener);
  },

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