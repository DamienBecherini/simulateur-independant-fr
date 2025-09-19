// src/stateManager.js
const { app } = require("electron")
const path = require("path")
const fs = require("fs")

const stateFilePath = path.join(app.getPath("userData"), "app-state.json")
const factoryConfig = require("../config.json")

let appState = null // Cache en mémoire

function getDefaultState() {
  return {
    // Les paramètres qui ne changent pas souvent, chargés depuis config.json
    parameters: JSON.parse(JSON.stringify(factoryConfig)),

    // L'état de la simulation en cours, entièrement réinitialisable
    simulation: {
      entities: [
        {
          id: `person-${Date.now()}`, // ID unique simple pour commencer
          type: "person",
          name: "Personne 1",
          properties: {
            partsFiscales: 1,
            are: { dailyRate: 0, daysPerMonth: 0 }
          }
        }
      ],
      relationships: [],
      monthlyData: Array(12)
        .fill(null)
        .map((_, index) => ({
          month: index,
          incomes: [],
          expenses: [],
          remunerations: []
        })),
      globalSettings: {
        applyACRE: false,
        simulationMode: "single", // 'single', 'couple_married', 'couple_separate'
        dividendDistribution: {
          percentage: 100, // Par défaut, tout est distribuable en dividende
          strategy: "auto"
        }
      }
    },

    // La partie UI est conservée pour le thème, l'onglet actif, etc.
    ui: {
      theme: "light",
      activeTab: "tab-simulation", // On changera les noms d'onglets plus tard
      configName: "Nouvelle Simulation",
      backupOrder: []
    }
  }
}

function loadState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const rawData = fs.readFileSync(stateFilePath, "utf-8")
      appState = JSON.parse(rawData)

      // Si l'état chargé n'a pas la nouvelle structure (pas de clé 'simulation'),
      // on considère que c'est un ancien état invalide et on réinitialise.
      if (!appState.simulation) {
        console.warn("Ancienne structure de l'état détectée. Réinitialisation à l'état par défaut.")
        appState = getDefaultState()
        saveStateSync() // On sauvegarde immédiatement le nouvel état propre.
      }

      // On s'assure que la nouvelle clé existe pour les utilisateurs existants
      if (!appState.ui.backupOrder) {
        appState.ui.backupOrder = []
      }
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
  if (!appState) {
    return loadState()
  }
  return appState
}

function updateState(newState) {
  appState = { ...appState, ...newState }
}

module.exports = {
  getState,
  updateState,
  saveStateSync,
  getDefaultState,
  reloadStateFromDisk
}
