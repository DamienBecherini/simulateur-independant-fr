// main.js - VERSION FINALE CORRIGÉE
const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const showdown = require("showdown") // On importe showdown ici
const config = require("./config.json")

// --- MODULES DE CALCUL ---
const { simulerMicroEntreprise } = require("./src/calculsAE.js")
const { simulerEI } = require("./src/calculsEI.js")
const { simulerSASU } = require("./src/calculsSASU.js")
const { simulerEURL } = require("./src/calculsEURL.js")

const markdownConverter = new showdown.Converter()

// On essaie d'activer le reloader. S'il n'est pas trouvé (en production),
// le catch empêche l'application de planter.
try {
  require("electron-reloader")(module)
} catch (_) {}

function loadPedagogicalContent() {
  /* ... (pas de changement ici) ... */
}
const pedagogicalContent = loadPedagogicalContent()

function createWindow() {
  /* ... (pas de changement ici) ... */
}

app.whenReady().then(() => {
  // Écouteur pour récupérer le contenu au démarrage
  ipcMain.handle("get-content", () => {
    return pedagogicalContent
  })

  // Écouteur pour la simulation
  ipcMain.handle("run-simulation", (event, inputs) => {
    const results = [simulerMicroEntreprise(inputs), simulerEI(inputs), simulerSASU(inputs), simulerEURL(inputs)]
    return { results, config, content: pedagogicalContent }
  })

  // NOUVEL ÉCOUTEUR : pour la conversion Markdown
  ipcMain.handle("markdown-to-html", (event, markdownText) => {
    return markdownConverter.makeHtml(markdownText)
  })

  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

// Je recopie les fonctions inchangées pour que vous puissiez faire un copier/coller complet
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

function createWindow() {
  const mainWindow = new BrowserWindow({
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
