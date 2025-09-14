// renderer.js - VERSION FINALE AVEC TOASTS ET SANS CONFIRM
import { initializeTheme } from "./ui/theme.js"
import { displayComparatorView } from "./ui/views/comparatorView.js"
import { initializeStatusTabs, displayStatusDetailView, attachTooltips, generateWarningContentHTML } from "./ui/views/statusDetailView.js"
import { formatDate } from "./ui/utils/formatters.js"

window.addEventListener("DOMContentLoaded", async () => {
  // --- ÉLÉMENTS DU DOM ---
  const form = document.getElementById("simulation-form")
  const errorContainer = document.getElementById("error-container")
  const errorMessage = document.getElementById("error-message")
  const copyErrorBtn = document.getElementById("copy-error-btn")
  const tabsNav = document.getElementById("tabs-nav")
  const tabPanes = document.querySelectorAll(".tab-pane")
  const comparatorPane = document.getElementById("tab-comparator")
  const statusPanes = { "Micro-Entreprise": document.getElementById("tab-me"), "EI (Régime Réel)": document.getElementById("tab-ei"), "SASU (IS)": document.getElementById("tab-sasu"), "EURL (IS)": document.getElementById("tab-eurl") }
  const infoModal = document.getElementById("info-modal")
  const modalBody = document.getElementById("modal-body")
  const modalCloseBtn = document.getElementById("modal-close-btn")
  const settingsOpenBtn = document.getElementById("settings-open-btn")
  const settingsCloseBtn = document.getElementById("settings-close-btn")
  const settingsOverlay = document.getElementById("settings-overlay")
  const settingsTitle = document.getElementById("settings-title")
  const configNameInput = document.getElementById("config-name")
  const saveConfigBtn = document.getElementById("save-config-btn")
  const loadConfigBtn = document.getElementById("load-config-btn")
  const resetConfigBtn = document.getElementById("reset-config-btn")
  const mainSettingsView = document.getElementById("settings-main-view")
  const loadSettingsView = document.getElementById("settings-load-view")
  const backToMainBtn = document.getElementById("back-to-main-settings-btn")
  const backupsList = document.getElementById("backups-list")
  const toastContainer = document.getElementById("toast-container")

  // --- SYSTÈME DE NOTIFICATIONS ---
  const showToast = (message, type = "success") => {
    const toast = document.createElement("div")
    toast.className = `toast ${type}`
    toast.textContent = message
    toastContainer.appendChild(toast)

    setTimeout(() => {
      toast.classList.add("fade-out")
      toast.addEventListener("animationend", () => toast.remove())
    }, 3000)
  }

  // --- GESTION DE L'ÉTAT DE L'UI ---
  const saveCurrentUIState = () => {
    const formInputs = {
      partsFiscales: parseFloat(document.getElementById("parts-fiscales").value) || 1,
      salaireNet: parseFloat(document.getElementById("salaire-net").value) || 0,
      caServices: parseFloat(document.getElementById("ca-services").value) || 0,
      caVente: parseFloat(document.getElementById("ca-vente").value) || 0,
      chargesDeductibles: parseFloat(document.getElementById("charges-deductibles").value) || 0
    }
    const activeTab = tabsNav.querySelector(".active")?.dataset.tab || "tab-comparator"
    const theme = document.body.classList.contains("dark-mode") ? "dark" : "light"
    const configName = configNameInput.value
    const uiState = { formInputs, activeTab, theme, configName }
    window.api.updateUIState(uiState)
  }

  // --- INITIALISATION AU CHARGEMENT ---
  try {
    const appState = (await window.api.getState()) || {}
    const savedUIState = appState.ui || {}
    const formInputs = savedUIState.formInputs || {}

    initializeTheme(savedUIState.theme, saveCurrentUIState)

    document.getElementById("parts-fiscales").value = formInputs.partsFiscales || 1
    document.getElementById("salaire-net").value = formInputs.salaireNet || 0
    document.getElementById("ca-services").value = formInputs.caServices || 0
    document.getElementById("ca-vente").value = formInputs.caVente || 0
    document.getElementById("charges-deductibles").value = formInputs.chargesDeductibles || 0
    configNameInput.value = savedUIState.configName || "Ma Simulation"

    const activeTabId = savedUIState.activeTab || "tab-comparator"
    tabsNav.querySelector(".active")?.classList.remove("active")
    tabPanes.forEach(pane => pane.classList.remove("active"))
    document.querySelector(`[data-tab="${activeTabId}"]`)?.classList.add("active")
    document.getElementById(activeTabId)?.classList.add("active")

    const content = await window.api.getContent()
    window.pedagogicalContent = content
    await initializeStatusTabs(content, statusPanes)
    attachTooltips(content.tooltips)

    window.lastSimulationData = {}

    form.addEventListener("submit", async event => {
      event.preventDefault()
      clearUI()
      try {
        const inputs = collectInputs()
        const { results, config } = await window.api.runSimulation(inputs)
        window.lastSimulationData = { results, config }
        displayComparatorView(results, comparatorPane)
        results.forEach(res => {
          const guideKey = res.statut
            .toLowerCase()
            .replace(/ \(.+\)/, "")
            .replace(" ", "-")
          const resultsContainer = document.getElementById(`results-placeholder-${guideKey}`)
          if (resultsContainer) {
            displayStatusDetailView(res, resultsContainer, config)
          }
        })
        attachTooltips(window.pedagogicalContent.tooltips)
      } catch (error) {
        console.error("Une erreur est survenue lors de la simulation:", error)
        errorMessage.textContent = error.stack
        errorContainer.style.display = "block"
      }
    })

    form.addEventListener("input", saveCurrentUIState)
    configNameInput.addEventListener("input", saveCurrentUIState)
    tabsNav.addEventListener("click", event => {
      if (event.target.tagName === "BUTTON") {
        tabsNav.querySelector(".active")?.classList.remove("active")
        event.target.classList.add("active")
        tabPanes.forEach(pane => pane.classList.remove("active"))
        document.getElementById(event.target.dataset.tab).classList.add("active")
        saveCurrentUIState()
      }
    })

    const showMainSettingsView = () => {
      settingsTitle.textContent = "Configuration"
      mainSettingsView.classList.remove("is-hidden")
      loadSettingsView.classList.add("is-hidden")
    }

    const openSettingsMenu = () => settingsOverlay.classList.add("is-open")

    const closeSettingsMenu = () => {
      settingsOverlay.classList.remove("is-open")
      setTimeout(showMainSettingsView, 300)
    }

    settingsOpenBtn.addEventListener("click", openSettingsMenu)
    settingsCloseBtn.addEventListener("click", closeSettingsMenu)
    settingsOverlay.addEventListener("click", event => {
      if (event.target === settingsOverlay) {
        closeSettingsMenu()
      }
    })

    saveConfigBtn.addEventListener("click", async () => {
      const configName = configNameInput.value.trim() || "Sauvegarde sans nom"
      const result = await window.api.createBackup(configName)
      if (result.success) {
        showToast(`Configuration '${configName}' enregistrée !`)
      } else {
        showToast(`Erreur : ${result.error}`, "error")
      }
    })

    resetConfigBtn.addEventListener("click", () => {
      // NOTE : On garde confirm() ici car c'est une action destructive.
      // Le rechargement complet de la page qui suit "nettoie" le bug de focus.
      if (confirm("Êtes-vous sûr de vouloir réinitialiser la configuration ? Cette action est irréversible.")) {
        window.api.resetToFactory()
      }
    })

    const showLoadView = async () => {
      settingsTitle.textContent = "Charger une sauvegarde"
      const backups = await window.api.listBackups()
      backupsList.innerHTML = ""
      if (backups.length === 0) {
        backupsList.innerHTML = "<li><div class='backup-info'>Aucune sauvegarde trouvée.</div></li>"
      } else {
        backups.forEach(backup => {
          const li = document.createElement("li")
          const formattedDate = formatDate(backup.modified)
          li.innerHTML = `
            <div class="backup-info">
              <span class="backup-name">${backup.name}</span>
              <span class="backup-date">Le ${formattedDate}</span>
            </div>
            <div class="backup-actions">
              <button class="export-btn" title="Exporter">📥</button>
              <button class="delete-btn" title="Supprimer">🗑️</button>
              <button class="load-btn" title="Charger">✅</button>
            </div>
          `
          // CORRECTION : On retire les confirm()
          li.querySelector(".load-btn").addEventListener("click", () => {
            window.api.loadBackup(backup.name)
          })
          li.querySelector(".delete-btn").addEventListener("click", async () => {
            await window.api.deleteBackup(backup.name)
            showToast(`Sauvegarde '${backup.name}' supprimée.`)
            showLoadView() // Rafraîchir la liste
          })
          li.querySelector(".export-btn").addEventListener("click", () => {
            window.api.exportBackup(backup.name)
          })
          backupsList.appendChild(li)
        })
      }
      mainSettingsView.classList.add("is-hidden")
      loadSettingsView.classList.remove("is-hidden")
    }

    loadConfigBtn.addEventListener("click", showLoadView)
    backToMainBtn.addEventListener("click", showMainSettingsView)

    document.body.addEventListener("click", event => {
      const tooltip = event.target.closest(".warning-tooltip")
      if (tooltip) {
        const row = tooltip.closest("tr")
        const statutText = row.querySelector(".statut").textContent
        const statut = statutText.replace("⚠️", "").trim()
        const { results, config } = window.lastSimulationData
        const resultData = results.find(r => r.statut === statut)
        if (resultData && resultData.warning) {
          modalBody.innerHTML = generateWarningContentHTML(resultData, config, { accordionOpen: true })
          infoModal.style.display = "flex"
        }
      }
    })

    const closeModal = () => {
      infoModal.style.display = "none"
    }
    modalCloseBtn.addEventListener("click", closeModal)
    infoModal.addEventListener("click", event => {
      if (event.target === infoModal) {
        closeModal()
      }
    })

    const collectInputs = () => ({
      partsFiscales: parseFloat(document.getElementById("parts-fiscales").value) || 1,
      autresRevenusImposablesFoyer: parseFloat(document.getElementById("salaire-net").value) || 0,
      chiffreAffaires: (parseFloat(document.getElementById("ca-services").value) || 0) + (parseFloat(document.getElementById("ca-vente").value) || 0),
      ca_services: parseFloat(document.getElementById("ca-services").value) || 0,
      ca_vente: parseFloat(document.getElementById("ca-vente").value) || 0,
      chargesDeductibles: parseFloat(document.getElementById("charges-deductibles").value) || 0,
      remunerationNetteVisee: ((parseFloat(document.getElementById("ca-services").value) || 0) + (parseFloat(document.getElementById("ca-vente").value) || 0) - (parseFloat(document.getElementById("charges-deductibles").value) || 0)) * 0.5
    })

    const clearUI = () => {
      errorContainer.style.display = "none"
    }

    copyErrorBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(errorMessage.textContent).then(() => {
        copyErrorBtn.textContent = "Copié !"
        setTimeout(() => {
          copyErrorBtn.textContent = "Copier l'erreur"
        }, 2000)
      })
    })

    if (formInputs.caServices > 0 || formInputs.caVente > 0) {
      form.dispatchEvent(new Event("submit"))
    }
  } catch (error) {
    console.error("Erreur critique lors de l'initialisation du renderer :", error)
    errorMessage.textContent = "Impossible d'initialiser l'application. Une erreur de chargement est survenue. Détails : \n" + error.stack
    errorContainer.style.display = "block"
  }
})
