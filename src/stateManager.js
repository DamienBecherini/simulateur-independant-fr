// src/stateManager.js
const { app } = require("electron")
const path = require("path")
const fs = require("fs")

const stateFilePath = path.join(app.getPath("userData"), "app-state.json")
const factoryConfig = require("../config.json")

let appState = null // Cache en mémoire

function getDefaultState() {
  return {
    config: JSON.parse(JSON.stringify(factoryConfig)),
    ui: {
      formInputs: {
        partsFiscales: 1,
        salaireNet: 0,
        caServices: 50000,
        caVente: 0,
        chargesDeductibles: 5000
      },
      activeTab: "tab-comparator",
      theme: "light",
      configName: "Ma Simulation"
    }
  }
}

function loadState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const rawData = fs.readFileSync(stateFilePath, "utf-8")
      appState = JSON.parse(rawData)
    } else {
      appState = getDefaultState()
      saveStateSync()
    }
  } catch (error) {
    console.error("Erreur lors du chargement de l'état, réinitialisation à l'état par défaut.", error)
    appState = getDefaultState()
  }
  return appState
}

function reloadStateFromDisk() {
  appState = null // Invalide le cache en mémoire
  return loadState() // Force la relecture depuis le disque
}

// Fonction de sauvegarde SYNCHRONE, utilisée uniquement à la fermeture.
function saveStateSync() {
  if (!appState) return // Ne rien faire si l'état n'a jamais été chargé
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(appState, null, 2), "utf-8")
    console.log("État de l'application sauvegardé sur le disque.")
  } catch (error) {
    console.error("Impossible de sauvegarder l'état :", error)
  }
}

function getState() {
  // Si l'état n'est pas en mémoire, on le charge.
  // Ne devrait arriver qu'au tout premier appel.
  if (!appState) {
    return loadState()
  }
  return appState
}

// Met à jour l'état en mémoire SANS écrire sur le disque.
function updateState(newState) {
  // Fusionne le nouvel état avec l'ancien pour ne pas écraser des clés non liées
  appState = { ...appState, ...newState }
}

module.exports = {
  getState,
  updateState,
  saveStateSync,
  getDefaultState,
  reloadStateFromDisk
}
