// preload.js - VERSION FINALE CORRIGÉE
const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
  getContent: () => ipcRenderer.invoke("get-content"),
  runSimulation: inputs => ipcRenderer.invoke("run-simulation", inputs),
  toHtml: markdownText => ipcRenderer.invoke("markdown-to-html", markdownText)
})
