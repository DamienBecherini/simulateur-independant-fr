// main.js
const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const showdown = require("showdown")

const stateManager = require("./src/stateManager.js")
const backupManager = require("./src/backupManager.js")

// --- MODULES DE CALCUL ---
const { simulerMicroEntreprise } = require("./src/calculsAE.js")
const { simulerEI } = require("./src/calculsEI.js")
const { simulerSASU } = require("./src/calculsSASU.js")
const { simulerEURL } = require("./src/calculsEURL.js")

const markdownConverter = new showdown.Converter()
let isDev = false

// On essaie d'activer le reloader. S'il n'est pas trouvé (en production),
// le catch empêche l'application de planter.
try {
  require("electron-reloader")(module)
  isDev = true
  console.log("Electron-reloader est actif.")
} catch (_) {}

function loadPedagogicalContent() {
  const contentDir = path.join(__dirname, "content")
  const guides = {}
  const tooltips = JSON.parse(fs.readFileSync(path.join(contentDir, "tooltips.json"), "utf-8"))
  const guideFiles = fs.readdirSync(contentDir).filter(file => file.endsWith(".md"))
  for (const file of guideFiles) {
    const key = path.basename(file, ".md")
    guides[key] = fs.readFileSync(path.join(contentDir, file), "utf-8")
  }
  return { guides, tooltips }
}
const pedagogicalContent = loadPedagogicalContent()

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.webContents.session.clearCache()
  mainWindow.loadFile("index.html")
}

app.whenReady().then(() => {
  // On charge l'état depuis le fichier au démarrage de l'application
  stateManager.getState()

  // --- GESTIONNAIRES DE COMMUNICATION (IPC) ---

  // Pour le contenu pédagogique
  ipcMain.handle("get-content", () => {
    return pedagogicalContent
  })

  // Pour la conversion Markdown
  ipcMain.handle("markdown-to-html", (event, markdownText) => {
    return markdownConverter.makeHtml(markdownText)
  })

  // Pour récupérer l'état complet au démarrage du renderer
  ipcMain.handle("get-state", () => {
    return stateManager.getState()
  })

  // Pour mettre à jour l'état DEPUIS le renderer (ne sauvegarde pas sur disque)
  ipcMain.handle("update-ui-state", (event, uiState) => {
    const currentState = stateManager.getState()
    currentState.ui = uiState // On ne met à jour que la partie UI
    stateManager.updateState(currentState)
  })

  ipcMain.handle("run-simulation", (event, inputs) => {
    const currentConfig = stateManager.getState().config

    // TODO: Phase 5 - Les fonctions de calcul devront être adaptées
    // pour accepter `currentConfig` comme second argument.
    const results = [simulerMicroEntreprise(inputs /*, currentConfig */), simulerEI(inputs /*, currentConfig */), simulerSASU(inputs /*, currentConfig */), simulerEURL(inputs /*, currentConfig */)]
    return { results, config: currentConfig, content: pedagogicalContent }
  })

  ipcMain.handle("list-backups", () => backupManager.listBackups())
  ipcMain.handle("create-backup", (event, backupName) => backupManager.createBackup(backupName))
  ipcMain.handle("delete-backup", (event, backupName) => backupManager.deleteBackup(backupName))
  ipcMain.handle("export-backup", (event, backupName) => backupManager.exportBackup(backupName, mainWindow))

  ipcMain.handle("load-backup", (event, backupName) => {
    const result = backupManager.loadBackup(backupName)
    if (result.success) {
      stateManager.reloadStateFromDisk()
      mainWindow.webContents.reload()
    }
    return result
  })

  ipcMain.handle("reset-to-factory", () => {
    const result = backupManager.resetToFactory()
    if (result.success) {
      stateManager.reloadStateFromDisk()
      mainWindow.webContents.reload()
    }
    return result
  })

  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// --- GESTION DU CYCLE DE VIE DE L'APPLICATION ---

// L'événement 'before-quit' est le plus fiable pour les actions finales.
// Il est déclenché par app.quit(), Cmd+Q, ou le rechargement en mode dev.
app.on("before-quit", () => {
  console.log("L'application est sur le point de quitter, sauvegarde de l'état...")
  stateManager.saveStateSync()
})

app.on("window-all-closed", () => {
  // Sur macOS, l'application reste souvent active. `before-quit` gère la sauvegarde.
  if (process.platform !== "darwin") {
    app.quit()
  }
})
