// src/backend/main.ts

/*
 * Point d'entrée du process principal d'Electron : il reprend les données d'avant le changement de nom, prépare la
 * lecture et l'écriture des données, protège chaque fenêtre, puis, une fois l'application prête, ouvre les fenêtres et
 * déclare les canaux IPC, regroupés par domaine (voir le guide du développeur, § 2) :
 * - canaux-de-la-session.ts : session en cours, sauvegardes nommées, préférences ;
 * - canaux-de-calcul.ts : simulation, comparateur, optimiseur, stratégies de distribution ;
 * - canaux-des-fichiers.ts : export, import, fichiers texte, PDF, adresses des retours ;
 * - canaux-des-clients-d-ia.ts : serveur MCP local et boîte aux propositions.
 * Chaque canal passe par `ipcMainHandle` (util.ts), qui vérifie l'émetteur, et vérifie ses paramètres
 * (logic/entrees-ipc.ts).
 */

import { app, dialog } from "electron"
import { recopierAncienDossierDeDonnees } from "./ancien-dossier-de-donnees.js"
import { donneesDeLApplication } from "./donnees-de-l-application.js"
import { fenetrePrincipale, ouvrirLesFenetres, protegerChaqueFenetre } from "./fenetres.js"
import { declarerLesCanauxDeLaSession } from "./canaux-de-la-session.js"
import { declarerLesCanauxDeCalcul } from "./canaux-de-calcul.js"
import { declarerLesCanauxDesFichiers } from "./canaux-des-fichiers.js"
import { declarerLesCanauxDesClientsDIa } from "./canaux-des-clients-d-ia.js"

recopierAncienDossierDeDonnees()

/** Affiche une boîte de dialogue d'information ; si elle ne peut pas s'afficher, l'échec est journalisé. */
function showInfoDialog(options: Electron.MessageBoxOptions) {
  dialog.showMessageBox(options).catch(error => console.error("Boîte de dialogue impossible à afficher :", error))
}

// Session, sauvegardes et préférences : lecture prudente, écriture atomique, échecs signalés (voir l'ADR 005).
const donnees = donneesDeLApplication({
  dossier: app.getPath("userData"),
  versionDeLApplication: app.getVersion(),
  avertir: showInfoDialog,
  notifier: notification => fenetrePrincipale()?.webContents.send("show-notification", notification)
})

protegerChaqueFenetre()

app.on("ready", () => {
  ouvrirLesFenetres()
  declarerLesCanauxDeLaSession(donnees)
  declarerLesCanauxDeCalcul()
  declarerLesCanauxDesFichiers(fenetrePrincipale)
  declarerLesCanauxDesClientsDIa(fenetrePrincipale)
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
