// renderer.js - Mis à jour pour utiliser la nouvelle structure de fichiers
import { initializeTheme } from "./ui/theme.js"
import { displayComparatorView } from "./ui/views/comparatorView.js"
import { initializeStatusTabs, displayStatusDetailView, attachTooltips, generateWarningContentHTML } from "./ui/views/statusDetailView.js"

window.addEventListener("DOMContentLoaded", async () => {
  // --- INITIALISATION ---
  initializeTheme()

  // --- ÉLÉMENTS DU DOM ---
  const form = document.getElementById("simulation-form")
  const errorContainer = document.getElementById("error-container")
  const errorMessage = document.getElementById("error-message")
  const copyErrorBtn = document.getElementById("copy-error-btn")
  const infoModal = document.getElementById("info-modal")
  const modalBody = document.getElementById("modal-body")
  const modalCloseBtn = document.getElementById("modal-close-btn")
  const tabsNav = document.getElementById("tabs-nav")
  const tabPanes = document.querySelectorAll(".tab-pane")
  const comparatorPane = document.getElementById("tab-comparator")
  const statusPanes = {
    "Micro-Entreprise": document.getElementById("tab-me"),
    "EI (Régime Réel)": document.getElementById("tab-ei"),
    "SASU (IS)": document.getElementById("tab-sasu"),
    "EURL (IS)": document.getElementById("tab-eurl")
  }

  try {
    const content = await window.api.getContent()
    window.pedagogicalContent = content // On stocke pour y accéder plus tard (tooltips)
    await initializeStatusTabs(content, statusPanes)
    attachTooltips(content.tooltips) // On attache les tooltips une fois au début
  } catch (error) {
    console.error("Erreur lors du chargement du contenu initial:", error)
    // Afficher une erreur si le contenu ne peut être chargé
  }

  window.lastSimulationData = {}

  // --- ÉVÉNEMENT PRINCIPAL DE SIMULATION ---
  form.addEventListener("submit", async event => {
    event.preventDefault()
    clearUI()
    try {
      const inputs = collectInputs()
      const { results, config } = await window.api.runSimulation(inputs) // config est récupéré ici
      window.lastSimulationData = { results, config } // config est stocké ici

      displayComparatorView(results, comparatorPane)

      results.forEach(res => {
        const guideKey = res.statut
          .toLowerCase()
          .replace(/ \(.+\)/, "")
          .replace(" ", "-")
        const resultsContainer = document.getElementById(`results-placeholder-${guideKey}`)
        if (resultsContainer) {
          // LA MODIFICATION EST ICI : on passe 'config' en 3e argument
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

  // ... (le reste du fichier ne change pas)
  // --- GESTION DES ONGLETS ---
  tabsNav.addEventListener("click", event => {
    if (event.target.tagName === "BUTTON") {
      tabsNav.querySelector(".active").classList.remove("active")
      event.target.classList.add("active")
      tabPanes.forEach(pane => pane.classList.remove("active"))
      document.getElementById(event.target.dataset.tab).classList.add("active")
    }
  })

  // --- GESTION DE LA MODALE D'INFORMATION ---
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
    if (event.target === infoModal) closeModal()
  })

  // --- FONCTIONS UTILITAIRES ---
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
})
