// ui/domElements.js
// Ce fichier centralise la sélection de tous les éléments du DOM
// pour éviter les répétitions et faciliter la maintenance.

export const form = document.getElementById("simulation-form")
export const errorContainer = document.getElementById("error-container")
export const errorMessage = document.getElementById("error-message")
export const copyErrorBtn = document.getElementById("copy-error-btn")
export const tabsNav = document.getElementById("tabs-nav")
export const tabPanes = document.querySelectorAll(".tab-pane")
export const comparatorPane = document.getElementById("tab-comparator")
export const statusPanes = {
  "Micro-Entreprise": document.getElementById("tab-me"),
  "EI (Régime Réel)": document.getElementById("tab-ei"),
  "SASU (IS)": document.getElementById("tab-sasu"),
  "EURL (IS)": document.getElementById("tab-eurl")
}
export const infoModal = document.getElementById("info-modal")
export const modalBody = document.getElementById("modal-body")
export const modalCloseBtn = document.getElementById("modal-close-btn")
export const settingsOpenBtn = document.getElementById("settings-open-btn")
export const settingsCloseBtn = document.getElementById("settings-close-btn")
export const settingsOverlay = document.getElementById("settings-overlay")
export const settingsTitle = document.getElementById("settings-title")
export const configNameInput = document.getElementById("config-name")
export const saveConfigBtn = document.getElementById("save-config-btn")
export const loadConfigBtn = document.getElementById("load-config-btn")
export const resetConfigBtn = document.getElementById("reset-config-btn")
export const mainSettingsView = document.getElementById("settings-main-view")
export const loadSettingsView = document.getElementById("settings-load-view")
export const backToMainBtn = document.getElementById("back-to-main-settings-btn")
export const backupsList = document.getElementById("backups-list")
export const toastContainer = document.getElementById("toast-container")
