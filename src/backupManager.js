// src/backupManager.js
const { app, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const stateManager = require("./stateManager") // stateManager est déjà importé ici

const stateFilePath = path.join(app.getPath("userData"), "app-state.json")
const backupsDirPath = path.join(app.getPath("userData"), "backups")

// S'assure que le dossier des sauvegardes existe
if (!fs.existsSync(backupsDirPath)) {
  fs.mkdirSync(backupsDirPath)
}

const listBackups = () => {
  try {
    const files = fs.readdirSync(backupsDirPath)
    return files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const stats = fs.statSync(path.join(backupsDirPath, file))
        return {
          name: path.basename(file, ".json"),
          modified: stats.mtime.toISOString()
        }
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified))
  } catch (error) {
    console.error("Impossible de lister les sauvegardes:", error)
    return []
  }
}

const createBackup = backupName => {
  try {
    // --- CORRECTION POUR LE BUG #1 ---
    // On force la sauvegarde de l'état en mémoire vers le disque AVANT de copier le fichier.
    stateManager.saveStateSync()

    const destPath = path.join(backupsDirPath, `${backupName}.json`)
    fs.copyFileSync(stateFilePath, destPath)
    return { success: true, path: destPath }
  } catch (error) {
    console.error(`Impossible de créer la sauvegarde '${backupName}':`, error)
    return { success: false, error: error.message }
  }
}

const deleteBackup = backupName => {
  try {
    const backupPath = path.join(backupsDirPath, `${backupName}.json`)
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath)
    }
    return { success: true }
  } catch (error) {
    console.error(`Impossible de supprimer la sauvegarde '${backupName}':`, error)
    return { success: false, error: error.message }
  }
}

const loadBackup = backupName => {
  try {
    const backupPath = path.join(backupsDirPath, `${backupName}.json`)
    fs.copyFileSync(backupPath, stateFilePath)
    return { success: true }
  } catch (error) {
    console.error(`Impossible de charger la sauvegarde '${backupName}':`, error)
    return { success: false, error: error.message }
  }
}

const exportBackup = async (backupName, browserWindow) => {
  try {
    const sourcePath = path.join(backupsDirPath, `${backupName}.json`)
    const { canceled, filePath } = await dialog.showSaveDialog(browserWindow, {
      title: "Exporter la configuration",
      defaultPath: `${backupName}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    fs.copyFileSync(sourcePath, filePath)
    return { success: true, path: filePath }
  } catch (error) {
    console.error(`Impossible d'exporter la sauvegarde '${backupName}':`, error)
    return { success: false, error: error.message }
  }
}

// --- CORRECTION POUR LE BUG #2 ---
// On retire le paramètre "stateManager" qui était inutile et causait le crash.
// La fonction utilisera maintenant le module "stateManager" importé en haut du fichier.
const resetToFactory = () => {
  try {
    const defaultState = stateManager.getDefaultState()
    stateManager.updateState(defaultState)
    stateManager.saveStateSync()
    return { success: true }
  } catch (error) {
    console.error("Impossible de réinitialiser la configuration:", error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  listBackups,
  createBackup,
  deleteBackup,
  loadBackup,
  exportBackup,
  resetToFactory
}
