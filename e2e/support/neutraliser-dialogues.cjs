// e2e/support/neutraliser-dialogues.cjs
//
// Chargé dans le process principal d'Electron avant l'application (option `-r` d'Electron), ce module
// remplace les boîtes de dialogue natives d'information, qui ne se pilotent pas depuis Playwright.
// Les messages sont consignés dans `globalThis.__dialoguesE2E`, que les tests relisent avec
// `electronApp.evaluate`. Le remplacement a lieu avant le chargement de la session : aucune course
// possible avec la boîte affichée au démarrage (conversion d'un fichier d'un format précédent).

const { dialog } = require("electron")

globalThis.__dialoguesE2E = []

/** Consigne le message d'une boîte de dialogue, quelle que soit la forme de l'appel (avec ou sans fenêtre parente). */
function consigner(type, args) {
  const options = args.find(arg => arg && typeof arg === "object" && "message" in arg) ?? {}
  globalThis.__dialoguesE2E.push({ type, title: options.title ?? "", message: options.message ?? "" })
}

dialog.showMessageBox = async (...args) => {
  consigner("message", args)
  return { response: 0, checkboxChecked: false }
}

dialog.showMessageBoxSync = (...args) => {
  consigner("message", args)
  return 0
}

dialog.showErrorBox = (title, content) => {
  globalThis.__dialoguesE2E.push({ type: "erreur", title, message: content })
}
