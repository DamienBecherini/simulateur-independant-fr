// src/backupManager.js
const { app, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const stateManager = require("./stateManager")

const stateFilePath = path.join(app.getPath("userData"), "app-state.json")
const backupsDirPath = path.join(app.getPath("userData"), "backups")
if (!fs.existsSync(backupsDirPath)) {
  fs.mkdirSync(backupsDirPath)
}

// MODIFIÉ : La fonction accepte maintenant un ordre de tri
const listBackups = (savedOrder = []) => {
  try {
    const files = fs.readdirSync(backupsDirPath)
    const backups = files
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const stats = fs.statSync(path.join(backupsDirPath, file))
        return {
          name: path.basename(file, ".json"),
          modified: stats.mtime.toISOString()
        }
      })

    // NOUVEAU : Logique de tri personnalisée
    backups.sort((a, b) => {
      const indexA = savedOrder.indexOf(a.name)
      const indexB = savedOrder.indexOf(b.name)

      if (indexA === -1 && indexB === -1) {
        // Si les deux sont nouvelles, tri par date
        return new Date(b.modified) - new Date(a.modified)
      }
      if (indexA === -1) return -1 // a est nouvelle, elle passe avant
      if (indexB === -1) return 1 // b est nouvelle, elle passe avant

      return indexA - indexB // Tri selon l'ordre sauvegardé
    })

    return backups
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
