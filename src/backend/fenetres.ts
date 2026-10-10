// src/backend/fenetres.ts

/*
 * Les fenêtres de l'application de bureau : l'écran de démarrage, la fenêtre principale qui affiche l'interface, et
 * les protections appliquées à chaque fenêtre dès sa création (voir l'ADR 003). Les options de sécurité et les
 * adresses permises sont décidées dans securite-des-fenetres.ts ; ce module les applique.
 */

import { app, BrowserWindow, shell } from "electron"
import path from "node:path"
import { isDev } from "./isDev.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import { ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT, PREFERENCES_SURES, adresseAOuvrirHorsDeLApplication, navigationAutorisee } from "./securite-des-fenetres.js"

let fenetreDeLInterface: BrowserWindow | null = null
let ecranDeDemarrage: BrowserWindow | null = null

/** La fenêtre principale, une fois créée : les canaux s'en servent pour leurs boîtes de dialogue et leurs messages. */
export function fenetrePrincipale(): BrowserWindow | null {
  return fenetreDeLInterface
}

// Fenêtres discrètes : utilisé par les tests de bout en bout, pour ne pas gêner le travail en cours sur le poste.
// La fenêtre principale reste affichée (une fenêtre cachée ne rafraîchit plus son rendu, ce qui ralentit les tests),
// mais elle est transparente, absente de la barre des tâches, ne prend pas le focus et laisse passer les clics.
const hiddenWindows = process.env.SIMULATEUR_FENETRES_MASQUEES === "1"

function createSplashWindow() {
  ecranDeDemarrage = new BrowserWindow({
    show: !hiddenWindows,
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    // Page locale sans script ni preload : les mêmes options de sécurité que la fenêtre principale.
    webPreferences: { ...PREFERENCES_SURES }
  })
  ecranDeDemarrage.loadFile(path.join(app.getAppPath(), "splash.html")).catch(error => console.error("Écran de démarrage introuvable :", error))
}

/** Montre la fenêtre principale prête et ferme l'écran de démarrage ; en fenêtres discrètes, sans la rendre visible. */
function montrer(fenetre: BrowserWindow) {
  ecranDeDemarrage?.close()
  ecranDeDemarrage = null
  if (!hiddenWindows) {
    fenetre.show()
    return
  }
  fenetre.setOpacity(0)
  fenetre.setSkipTaskbar(true)
  fenetre.setIgnoreMouseEvents(true)
  fenetre.showInactive()
}

function createMainWindow() {
  const fenetre = new BrowserWindow({
    width: 1440,
    height: 900,
    // En dessous, les cartes des acteurs et la grille annuelle ne tiennent plus correctement.
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      // Options de sécurité, chacune avec sa raison, dans securite-des-fenetres.ts (voir l'ADR 003).
      ...PREFERENCES_SURES,
      // Seul pont entre la page et le process principal : il expose `window.api` par contextBridge.
      preload: getPreloadPath(),
      // Une fenêtre masquée ralentit ses minuteries ; la sauvegarde et le recalcul différés doivent rester ponctuels.
      backgroundThrottling: !hiddenWindows
    }
  })
  fenetreDeLInterface = fenetre

  if (isDev()) {
    fenetre.loadURL(ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT).catch(error => console.error("Serveur de développement injoignable :", error))
  } else {
    fenetre.loadFile(getUIPath()).catch(error => console.error("Interface introuvable :", error))
  }

  // Boutons « précédent » et « suivant » de la souris (Windows, Linux) : retour à la vue précédente de l'affichage
  // « Trois vues », comme dans un navigateur. L'historique ne contient que des vues de la même page.
  fenetre.on("app-command", (_event, commande) => {
    const historique = fenetre.webContents.navigationHistory
    if (commande === "browser-backward" && historique.canGoBack()) historique.goBack()
    if (commande === "browser-forward" && historique.canGoForward()) historique.goForward()
  })

  fenetre.once("ready-to-show", () => montrer(fenetre))
}

/** L'écran de démarrage, puis la fenêtre principale, qui le remplace dès que l'interface est prête. */
export function ouvrirLesFenetres() {
  createSplashWindow()
  createMainWindow()
}

/** Ouvre une adresse dans le navigateur ou la messagerie du système, si elle fait partie de celles qui le peuvent. */
function ouvrirHorsDeLApplication(adresse: string) {
  if (!adresseAOuvrirHorsDeLApplication(adresse)) {
    console.warn("Adresse externe refusée.")
    return
  }
  shell.openExternal(adresse).catch(error => console.error("Lien externe impossible à ouvrir :", error))
}

/**
 * Chaque fenêtre de l'application, dès sa création (voir l'ADR 003) :
 * - aucune nouvelle fenêtre : un lien vers une page externe (sources officielles des montages types, liens des
 *   mentions légales) s'ouvre dans le navigateur du système ; toute autre adresse est refusée ;
 * - la fenêtre ne quitte jamais l'interface : une navigation vers une autre page est annulée, et une page externe
 *   permise s'ouvre dans le navigateur à la place ;
 * - aucune balise <webview> attachée, en plus de l'option `webviewTag: false`.
 * À appeler avant la création de la première fenêtre.
 */
export function protegerChaqueFenetre() {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      ouvrirHorsDeLApplication(url)
      return { action: "deny" }
    })
    contents.on("will-navigate", event => {
      if (navigationAutorisee(event.url, contents.getURL(), isDev())) return
      event.preventDefault()
      ouvrirHorsDeLApplication(event.url)
    })
    contents.on("will-attach-webview", event => event.preventDefault())
  })
}
