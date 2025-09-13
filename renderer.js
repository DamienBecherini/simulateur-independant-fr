// renderer.js - VERSION FINALE ET SYNCHRONISÉE
import { initializeTheme } from "./ui/theme.js"
import { displayResults, displayDetails, generateWarningContentHTML } from "./ui/display.js"

window.addEventListener("DOMContentLoaded", () => {
  // --- INITIALISATION ---
  initializeTheme()

  // --- ÉLÉMENTS DU DOM ---
  const form = document.getElementById("simulation-form")
  const resultatsContainer = document.getElementById("resultats-container")
  const errorContainer = document.getElementById("error-container")
  const errorMessage = document.getElementById("error-message")
  const copyErrorBtn = document.getElementById("copy-error-btn")
  const detailsAccordion = document.getElementById("details-accordion")
  const detailsContainer = document.getElementById("details-container")
  const infoModal = document.getElementById("info-modal")
  const modalBody = document.getElementById("modal-body")
  const modalCloseBtn = document.getElementById("modal-close-btn")

  // On sauvegarde les dernières données pour les utiliser dans la modale
  window.lastSimulationData = {}

  // --- ÉVÉNEMENT PRINCIPAL ---
  form.addEventListener("submit", async event => {
    event.preventDefault()
    clearUI()

    try {
      const inputs = collectInputs()
      const { results: resultsArray, config } = await window.api.runSimulation(inputs)

      // Sauvegarde des données pour la modale
      window.lastSimulationData = { results: resultsArray, config }

      displayResults(resultsArray, resultatsContainer)
      displayDetails(resultsArray, detailsContainer)
      detailsAccordion.style.display = "block"
    } catch (error) {
      console.error("Une erreur est survenue lors de la simulation:", error)
      errorMessage.textContent = error.stack
      errorContainer.style.display = "block"
    }
  })

  // --- GESTION DE LA MODALE D'INFORMATION ---
  resultatsContainer.addEventListener("click", event => {
    // On vérifie si l'élément cliqué ou un de ses parents a la classe 'warning-tooltip'
    const tooltip = event.target.closest(".warning-tooltip")
    if (tooltip) {
      const row = tooltip.closest("tr")
      // Le trim() est important pour enlever les espaces superflus
      const statut = row.querySelector(".statut").textContent.trim()
      const { results: lastResults, config: lastConfig } = window.lastSimulationData
      const resultData = lastResults.find(r => r.statut === statut)

      if (resultData && resultData.warning) {
        modalBody.innerHTML = generateWarningContentHTML(resultData, lastConfig)
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
      // Si on clique sur le fond gris
      closeModal()
    }
  })

  // --- FONCTIONS UTILITAIRES ---
  const collectInputs = () => ({
    partsFiscales: parseFloat(document.getElementById("parts-fiscales").value),
    autresRevenusImposablesFoyer: parseFloat(document.getElementById("salaire-net").value),
    chiffreAffaires: parseFloat(document.getElementById("ca-services").value) + parseFloat(document.getElementById("ca-vente").value),
    ca_services: parseFloat(document.getElementById("ca-services").value),
    ca_vente: parseFloat(document.getElementById("ca-vente").value),
    chargesDeductibles: parseFloat(document.getElementById("charges-deductibles").value),
    remunerationNetteVisee: (parseFloat(document.getElementById("ca-services").value) + parseFloat(document.getElementById("ca-vente").value) - parseFloat(document.getElementById("charges-deductibles").value)) * 0.5
  })

  const clearUI = () => {
    resultatsContainer.innerHTML = ""
    detailsContainer.innerHTML = ""
    detailsAccordion.style.display = "none"
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
})
