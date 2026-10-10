// src/backend/securite-des-fenetres.ts

/*
 * Sécurité des fenêtres de l'application (voir l'ADR 003) : options de leur moteur de rendu, navigation permise, et
 * adresses qui s'ouvrent hors de l'application. Sans Electron, pour être testé seul ; main.ts les applique.
 */

import { adresseExterneAutorisee } from "@/lib/adresses-des-retours.js"

/** Serveur de développement de l'interface (`npm run dev`), chargé par la fenêtre principale hors version compilée. */
export const ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT = "http://localhost:3524"

/**
 * Options de sécurité de chaque fenêtre. Ce sont, pour la plupart, les valeurs par défaut d'Electron : elles sont
 * écrites pour que rien ne dépende d'un changement de ces valeurs, ni d'un oubli en ajoutant une fenêtre.
 */
export const PREFERENCES_SURES = {
  // La page et le script de preload ont des contextes JavaScript séparés : la page ne voit que `window.api`, exposé
  // par contextBridge, et ne peut pas atteindre les objets du preload (ipcRenderer) ni les modifier.
  contextIsolation: true,
  // Le moteur de rendu tourne dans le bac à sable de Chromium : ni Node.js, ni accès direct au système, même pour le
  // preload, qui n'a besoin que de contextBridge et d'ipcRenderer.
  sandbox: true,
  // Pas de Node.js (require, process, fs) dans la page, ni dans ses workers, ni dans d'éventuels cadres.
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  // Politique de même origine et protections du navigateur actives.
  webSecurity: true,
  // Une page chargée en https ne peut pas exécuter de script venu en http.
  allowRunningInsecureContent: false,
  // Pas de balise <webview> : elle permettrait d'ouvrir une page web avec ses propres options.
  webviewTag: false,
  // Fonctions expérimentales de Chromium désactivées : elles n'ont pas les garanties des fonctions publiées.
  experimentalFeatures: false,
  // Un fichier déposé sur la fenêtre n'est pas ouvert à la place de l'interface.
  navigateOnDragDrop: false
} as const satisfies Electron.WebPreferences

function lire(adresse: string): URL | null {
  try {
    return new URL(adresse)
  } catch {
    return null
  }
}

/**
 * Vrai si l'adresse s'ouvre dans le navigateur ou la messagerie du système : une page web en https sans identifiants
 * (sources officielles des montages types, liens des mentions légales), ou l'une des adresses des retours
 * (src/lib/adresses-des-retours.ts). Tout le reste (fichier local, http, protocole d'une autre application) est refusé.
 */
export function adresseAOuvrirHorsDeLApplication(adresse: string): boolean {
  if (adresseExterneAutorisee(adresse)) return true
  const url = lire(adresse)
  return url !== null && url.protocol === "https:" && url.username === "" && url.password === ""
}

/** L'adresse sans son fragment (#resultats) : le fragment désigne une vue de la même page. */
function sansFragment(url: URL): string {
  const copie = new URL(url)
  copie.hash = ""
  return copie.toString()
}

/**
 * Vrai si la fenêtre peut suivre la navigation demandée par la page : vers la même page (seul le fragment change, ou
 * rechargement), ou, en développement, vers le serveur de développement. La fenêtre ne quitte jamais l'interface.
 */
export function navigationAutorisee(cible: string, actuelle: string, enDeveloppement: boolean): boolean {
  const urlCible = lire(cible)
  if (urlCible === null) return false
  if (enDeveloppement && urlCible.origin === ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT) return true
  const urlActuelle = lire(actuelle)
  return urlActuelle !== null && sansFragment(urlCible) === sansFragment(urlActuelle)
}
