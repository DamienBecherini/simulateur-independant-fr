// src/electron/preload.cts

/// <reference path="../../types.d.ts" />

const { contextBridge, ipcRenderer } = require("electron")

// La liste des canaux (fonctions) valides que nous exposons
const validChannels: (keyof EventPayloadMapping)[] = ["runTestSimulation", "getState", "saveState"]

contextBridge.exposeInMainWorld("api", {
  // On boucle sur la liste pour créer dynamiquement les fonctions exposées
  ...validChannels.reduce((acc, channelName) => {
    acc[channelName] = (...args: any[]) => ipcRenderer.invoke(channelName, ...args)
    return acc
  }, {} as any)
})
