// ui/eventListeners.js
import * as DOM from "./domElements.js"
import { saveCurrentUIState } from "./uiInitializer.js"
import { initializeSettingsMenu } from "./settingsManager.js"
// --- CORRECTION ICI ---
// On importe displayComparatorView depuis son propre fichier
import { displayComparatorView } from "./views/comparatorView.js"
// Et le reste depuis statusDetailView.js
import { displayStatusDetailView, generateWarningContentHTML, attachTooltips } from "./views/statusDetailView.js"
import { manageScrollShadowsWithObserver } from "./utils/scrollManager.js"

// Helper pour collecter les données du formulaire
const collectInputs = () => {
  // DÉBUT DE L'AJOUT : Récupérer les nouveaux CA
  const ca_services_bic = parseFloat(DOM.form["ca-services-bic"].value) || 0
  const ca_services_bnc = parseFloat(DOM.form["ca-services-bnc"].value) || 0
  const ca_vente = parseFloat(DOM.form["ca-vente"].value) || 0
  // FIN DE L'AJOUT

  return {
    partsFiscales: parseFloat(DOM.form["parts-fiscales"].value) || 1,
    autresRevenusImposablesFoyer: parseFloat(DOM.form["salaire-net"].value) || 0,

    // DÉBUT DE LA MODIFICATION : Utiliser les nouvelles variables
    ca_services_bic: ca_services_bic,
    ca_services_bnc: ca_services_bnc,
    ca_vente: ca_vente,
    // FIN DE LA MODIFICATION

    chargesDeductibles: parseFloat(DOM.form["charges-deductibles"].value) || 0,

    // IMPORTANT : On garde ces totaux pour les autres simulations (EI, SASU...) qui n'ont pas besoin de ce détail
    chiffreAffaires: ca_vente + ca_services_bic + ca_services_bnc,
    ca_services: ca_services_bic + ca_services_bnc, // Total des services

    remunerationNetteVisee: (ca_vente + ca_services_bic + ca_services_bnc - (parseFloat(DOM.form["charges-deductibles"].value) || 0)) * 0.5,
    capitalSocial: parseFloat(DOM.form["capital-social"].value) || 0,
    beneficieACRE: document.getElementById("acre-checkbox").checked,
    opteVFL: document.getElementById("vfl-checkbox").checked
  }
}

export function setupEventListeners() {
  window.lastSimulationData = {}

  // Formulaire principal
  DOM.form.addEventListener("submit", async event => {
    event.preventDefault()
    DOM.errorContainer.style.display = "none"
    try {
      const inputs = collectInputs()
      const { results, config } = await window.api.runSimulation(inputs)
      window.lastSimulationData = { results, config }

      displayComparatorView(results, DOM.comparatorPane)
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

      document.querySelectorAll(".table-container").forEach(manageScrollShadowsWithObserver)
      attachTooltips(window.pedagogicalContent.tooltips)
    } catch (error) {
      console.error("Une erreur est survenue lors de la simulation:", error)
      DOM.errorMessage.textContent = error.stack
      DOM.errorContainer.style.display = "block"
    }
  })

  // Sauvegarde de l'état sur modification
  DOM.form.addEventListener("input", saveCurrentUIState)
  DOM.configNameInput.addEventListener("input", saveCurrentUIState)

  // Navigation par onglets
  DOM.tabsNav.addEventListener("click", event => {
    if (event.target.tagName === "BUTTON") {
      DOM.tabsNav.querySelector(".active")?.classList.remove("active")
      event.target.classList.add("active")
      DOM.tabPanes.forEach(pane => pane.classList.remove("active"))
      document.getElementById(event.target.dataset.tab).classList.add("active")
      saveCurrentUIState()
    }
  })

  // Modale d'information
  document.body.addEventListener("click", event => {
    const tooltip = event.target.closest(".warning-tooltip")
    if (tooltip) {
      const row = tooltip.closest("tr")
      const statutText = row.querySelector(".statut").textContent
      const statut = statutText.replace("⚠️", "").trim()
      const { results, config } = window.lastSimulationData
      const resultData = results.find(r => r.statut === statut)
      if (resultData?.warning) {
        DOM.modalBody.innerHTML = generateWarningContentHTML(resultData, config, { accordionOpen: true })
        DOM.infoModal.style.display = "flex"
      }
    }
  })

  const closeModal = () => (DOM.infoModal.style.display = "none")
  DOM.modalCloseBtn.addEventListener("click", closeModal)
  DOM.infoModal.addEventListener("click", event => {
    if (event.target === DOM.infoModal) closeModal()
  })

  // Boîte d'erreur
  DOM.copyErrorBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(DOM.errorMessage.textContent).then(() => {
      DOM.copyErrorBtn.textContent = "Copié !"
      setTimeout(() => {
        DOM.copyErrorBtn.textContent = "Copier l'erreur"
      }, 2000)
    })
  })

  // Initialisation des modules complexes
  initializeSettingsMenu()
}
