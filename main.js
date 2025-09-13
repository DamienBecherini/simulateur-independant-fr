// main.js - NOUVELLE VERSION AVEC IPC
const { app, BrowserWindow, ipcMain } = require("electron") // <-- ipcMain ajouté
const path = require("path")
const config = require("./config.json")

// On importe TOUTES les fonctions de calcul ici, dans le processus principal
const { simulerMicroEntreprise } = require("./src/calculsAE.js")
const { simulerEI } = require("./src/calculsEI.js")
const { simulerSASU } = require("./src/calculsSASU.js")
const { simulerEURL } = require("./src/calculsEURL.js")

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

  // Dé-commentez la ligne suivante pour ouvrir les outils de dev au démarrage
  // mainWindow.webContents.openDevTools()
  mainWindow.loadFile("index.html")
}

app.whenReady().then(() => {
  // On met en place un "écouteur" pour la requête 'run-simulation'
  ipcMain.handle("run-simulation", (event, inputs) => {
    console.log("Simulation demandée avec les inputs:", inputs)
    // On exécute toutes les simulations ici
    const resultatAE = simulerMicroEntreprise(inputs)
    const resultatEI = simulerEI(inputs)
    const resultatSASU = simulerSASU(inputs)
    const resultatEURL = simulerEURL(inputs)

    const results = [resultatAE, resultatEI, resultatSASU, resultatEURL]

    return { results, config }
  })

  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
