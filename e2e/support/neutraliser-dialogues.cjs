// e2e/support/neutraliser-dialogues.cjs
//
// Chargé dans le process principal d'Electron avant l'application (option `-r` d'Electron), ce module
// remplace les boîtes de dialogue natives d'information et d'enregistrement, qui ne se pilotent pas depuis Playwright.
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

// Fenêtres d'enregistrement : le test choisit le fichier en renseignant `__enregistrementE2E.chemin` (avec
// `electronApp.evaluate`) ; sans chemin, l'enregistrement est annulé, comme si l'utilisateur avait fermé la fenêtre.
// Le titre et le nom de fichier proposés sont consignés dans `__enregistrementE2E.demandes`.
globalThis.__enregistrementE2E = { chemin: null, demandes: [] }

dialog.showSaveDialog = async (...args) => {
  // Les options sont le dernier argument, que la fenêtre parente soit passée ou non.
  const options = args[args.length - 1] ?? {}
  globalThis.__enregistrementE2E.demandes.push({ title: options.title ?? "", defaultPath: options.defaultPath ?? "" })
  const chemin = globalThis.__enregistrementE2E.chemin
  return chemin ? { canceled: false, filePath: chemin } : { canceled: true, filePath: undefined }
}
