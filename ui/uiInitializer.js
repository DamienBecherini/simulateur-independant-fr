// ui/uiInitializer.js
import * as DOM from "./domElements.js"
import { initializeTheme } from "./theme.js"
import { initializeStatusTabs, attachTooltips } from "./views/statusDetailView.js"

// Centralise la logique de sauvegarde de l'état UI
export const saveCurrentUIState = () => {
  const formInputs = {
    partsFiscales: parseFloat(DOM.form["parts-fiscales"].value) || 1,
    salaireNet: parseFloat(DOM.form["salaire-net"].value) || 0,
    caServicesBic: parseFloat(DOM.form["ca-services-bic"].value) || 0,
    caServicesBnc: parseFloat(DOM.form["ca-services-bnc"].value) || 0,
    caVente: parseFloat(DOM.form["ca-vente"].value) || 0,
    chargesDeductibles: parseFloat(DOM.form["charges-deductibles"].value) || 0,
    beneficieACRE: document.getElementById("acre-checkbox").checked,
    opteVFL: document.getElementById("vfl-checkbox").checked
  }
  const activeTab = DOM.tabsNav.querySelector(".active")?.dataset.tab || "tab-comparator"
  const theme = document.body.classList.contains("dark-mode") ? "dark" : "light"
  const configName = DOM.configNameInput.value

  // On ne sauvegarde que la partie UI de l'état
  window.api.updateUIState({ formInputs, activeTab, theme, configName, backupOrder: window.appState.ui.backupOrder })
}

export async function initializeAppUI() {
  const appState = (await window.api.getState()) || {}
  window.appState = appState // On stocke l'état global pour un accès facile
  const savedUIState = appState.ui || {}
  const formInputs = savedUIState.formInputs || {}

  // Initialisation du thème
  initializeTheme(savedUIState.theme, saveCurrentUIState)

  // Remplissage du formulaire
  DOM.form["parts-fiscales"].value = formInputs.partsFiscales || 1
  DOM.form["salaire-net"].value = formInputs.salaireNet || 0
  // On gère les deux nouveaux champs. On utilise l'ancien "caServices" pour la rétrocompatibilité
  // si un ancien état est chargé, en l'assignant au champ BNC.
  DOM.form["ca-services-bic"].value = formInputs.caServicesBic || 0
  DOM.form["ca-services-bnc"].value = formInputs.caServicesBnc || formInputs.caServices || 0
  DOM.form["ca-vente"].value = formInputs.caVente || 0
  DOM.form["charges-deductibles"].value = formInputs.chargesDeductibles || 0
  DOM.configNameInput.value = savedUIState.configName || "Ma Simulation"

  document.getElementById("acre-checkbox").checked = formInputs.beneficieACRE || false
  document.getElementById("vfl-checkbox").checked = formInputs.opteVFL || false

  // Définition de l'onglet actif
  const activeTabId = savedUIState.activeTab || "tab-comparator"
  DOM.tabsNav.querySelector(".active")?.classList.remove("active")
  DOM.tabPanes.forEach(pane => pane.classList.remove("active"))
  document.querySelector(`[data-tab="${activeTabId}"]`)?.classList.add("active")
  document.getElementById(activeTabId)?.classList.add("active")

  // Chargement du contenu pédagogique
  const content = await window.api.getContent()
  window.pedagogicalContent = content // Stockage global
  await initializeStatusTabs(content, DOM.statusPanes)
  attachTooltips(content.tooltips)
}
