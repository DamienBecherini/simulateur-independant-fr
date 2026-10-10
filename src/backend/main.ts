// src/backend/main.ts

import { app, BrowserWindow, dialog, shell } from "electron"
import type { SessionState, SaveSlot, UserPreferences, ExportableState, ComparaisonOptions, StatutSociete, FormatFichierTexte } from "@/types.js"
import { calculsDuPont } from "./logic/calculs-du-pont.js"
import { ipcMainHandle, validateEventFrame } from "./util.js"
import { isDev } from "./isDev.js"
import { getPreloadPath, getUIPath } from "./pathResolver.js"
import path from "path"
import fs from "fs/promises"
import { copyFileSync, existsSync, mkdirSync } from "fs"
import { ipcMain } from "electron"
import { AnneesRefuseesError, rapportAvecCorrections } from "./logic/data-sanitizer.js"
import { contenuDuFichier, lireUneSimulationImportee } from "./logic/fichiers-de-donnees.js"
import { donneesDeLApplication } from "./donnees-de-l-application.js"
import { adresseExterneAutorisee } from "@/lib/adresses-des-retours.js"
import { infosDeLInstallation, type InfosDuServeurMcp } from "@/lib/configuration-mcp.js"
import { ouvrirLaBoiteAuxPropositions } from "./boite-aux-propositions.js"
import { copierLeServeurMcp } from "./copie-du-serveur-mcp.js"

/** Filtres des fenêtres d'enregistrement et d'ouverture, par format de fichier texte. */
const FILTRES_FICHIERS: Record<FormatFichierTexte, Electron.FileFilter> = {
  csv: { name: "Fichiers CSV", extensions: ["csv"] },
  markdown: { name: "Documents Markdown", extensions: ["md"] },
  json: { name: "Fichiers JSON", extensions: ["json"] }
}

/** Fichiers de données conservés d'une version à l'autre. */
const DATA_FILES = ["sessionState.json", "simulationSlots.json", "userPreferences.json"]

/**
 * Le dossier de données suit le nom du paquet. Jusqu'à la version 0.9, ce nom était « electron-vite-template » :
 * au premier lancement, si le nouveau dossier ne contient encore aucune donnée, on y recopie l'ancien.
 * L'ancien dossier n'est pas supprimé. Un dossier imposé au lancement (--user-data-dir, comme dans les tests
 * de bout en bout) n'est jamais concerné : il doit rester tel qu'on le fournit.
 */
function recopierAncienDossierDeDonnees() {
  if (app.commandLine.hasSwitch("user-data-dir")) return
  const dossier = app.getPath("userData")
  const ancien = path.join(app.getPath("appData"), "electron-vite-template")
  if (ancien === dossier || !existsSync(ancien) || DATA_FILES.some(f => existsSync(path.join(dossier, f)))) return
  mkdirSync(dossier, { recursive: true })
  for (const fichier of DATA_FILES) {
    if (existsSync(path.join(ancien, fichier))) copyFileSync(path.join(ancien, fichier), path.join(dossier, fichier))
  }
  console.info(`Données reprises de l'ancien dossier : ${ancien}`)
}
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
  notifier: notification => mainWindow?.webContents.send("show-notification", notification)
})

/** Le serveur MCP livré avec l'application : hors de l'archive asar une fois packagé. */
const serveurMcpLivre = () => (app.isPackaged ? path.join(process.resourcesPath, "mcp", "serveur-mcp.mjs") : path.join(app.getAppPath(), "dist-electron", "mcp", "serveur-mcp.mjs"))

/**
 * Chemins du serveur MCP local de cette installation (voir les ADR 011 et 013) : l'exécutable de l'application, lancé
 * en mode Node, le serveur empaqueté et le dossier de données à lui passer. Version du Microsoft Store : l'alias
 * d'exécution du paquet et la copie du serveur dans le dossier de données.
 */
function infosDuServeurMcp(): InfosDuServeurMcp {
  return infosDeLInstallation({
    executable: app.getPath("exe"),
    serveurLivre: serveurMcpLivre(),
    donnees: app.getPath("userData"),
    plateforme: process.platform,
    dossierLocalAppData: process.windowsStore ? (process.env.LOCALAPPDATA ?? path.join(app.getPath("home"), "AppData", "Local")) : null
  })
}

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

// Fenêtres discrètes : utilisé par les tests de bout en bout, pour ne pas gêner le travail en cours sur le poste.
// La fenêtre principale reste affichée (une fenêtre cachée ne rafraîchit plus son rendu, ce qui ralentit les tests),
// mais elle est transparente, absente de la barre des tâches, ne prend pas le focus et laisse passer les clics.
const hiddenWindows = process.env.SIMULATEUR_FENETRES_MASQUEES === "1"

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    show: !hiddenWindows,
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    center: true
  })
  splashWindow.loadFile(path.join(app.getAppPath(), "splash.html")).catch(error => console.error("Écran de démarrage introuvable :", error))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    // En dessous, les cartes des acteurs et la grille annuelle ne tiennent plus correctement.
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#111827",
    webPreferences: {
      preload: getPreloadPath(),
      // Une fenêtre masquée ralentit ses minuteries ; la sauvegarde et le recalcul différés doivent rester ponctuels.
      backgroundThrottling: !hiddenWindows
    }
  })

  if (isDev()) {
    mainWindow.loadURL("http://localhost:3524").catch(error => console.error("Serveur de développement injoignable :", error))
  } else {
    mainWindow.loadFile(getUIPath()).catch(error => console.error("Interface introuvable :", error))
  }

  // Liens vers une page externe (sources officielles des montages types) : ouverts dans le navigateur du système,
  // jamais dans une fenêtre de l'application.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url).catch(error => console.error("Lien externe impossible à ouvrir :", error))
    return { action: "deny" }
  })

  // Boutons « précédent » et « suivant » de la souris (Windows, Linux) : retour à la vue précédente de l'affichage
  // « Trois vues », comme dans un navigateur. L'historique ne contient que des vues de la même page.
  mainWindow.on("app-command", (_event, commande) => {
    const historique = mainWindow?.webContents.navigationHistory
    if (commande === "browser-backward" && historique?.canGoBack()) historique.goBack()
    if (commande === "browser-forward" && historique?.canGoForward()) historique.goForward()
  })

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
    if (mainWindow && hiddenWindows) {
      mainWindow.setOpacity(0)
      mainWindow.setSkipTaskbar(true)
      mainWindow.setIgnoreMouseEvents(true)
      mainWindow.showInactive()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
}

app.on("ready", () => {
  createSplashWindow()
  createMainWindow()

  ipcMainHandle("getCurrentSession", async () => await donnees.lireLaSession())
  ipcMainHandle("saveCurrentSession", async (session: SessionState) => {
    await donnees.ecrireLaSession(session)
  })

  // Enregistrement synchrone, appelé par l'interface quand la fenêtre se ferme : la sauvegarde automatique
  // est différée d'une seconde, et une modification faite juste avant la fermeture serait sinon perdue.
  ipcMain.on("saveCurrentSessionSync", (event, session: SessionState) => {
    if (event.senderFrame) validateEventFrame(event.senderFrame)
    event.returnValue = donnees.ecrireLaSessionSync(session)
  })

  // Calculs communs avec la démo web (logic/calculs-du-pont.ts) : la session reçue y est revalidée.
  ipcMainHandle("simulerLesAnnees", async (session: SessionState) => calculsDuPont.simulerLesAnnees(session))

  ipcMainHandle("compareStatuts", async (session: SessionState, options: ComparaisonOptions, annee: number) => calculsDuPont.compareStatuts(session, options, annee))
  ipcMainHandle("optimiserRemuneration", async (session: SessionState, options: ComparaisonOptions, statut: StatutSociete, annee: number) => calculsDuPont.optimiserRemuneration(session, options, statut, annee))
  ipcMainHandle("comparerStrategies", async (session: SessionState, activityId: string) => calculsDuPont.comparerStrategies(session, activityId))

  ipcMainHandle("getSaveSlots", async () => await donnees.lireLesSauvegardes())
  ipcMainHandle("saveSlots", async (slots: SaveSlot[], options?: { silencieux?: boolean }) => await donnees.ecrireLesSauvegardes(slots, options))

  ipcMainHandle("exportState", async (state: ExportableState) => {
    if (!mainWindow) return
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Exporter la simulation",
      defaultPath: `simulateur-export-${Date.now()}.json`,
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })
    if (!canceled && filePath) {
      try {
        await fs.writeFile(filePath, contenuDuFichier(state, app.getVersion()))
      } catch (error) {
        console.error("Erreur lors de l'exportation :", error)
        dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      }
    }
  })

  // --- FICHIERS TEXTE (exports CSV et Markdown, sauvegardes groupées) ET PDF ---
  ipcMainHandle("saveTextFile", async ({ defaultName, content, format }: { defaultName: string; content: string; format: FormatFichierTexte }) => {
    if (!mainWindow) return false
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: "Exporter", defaultPath: defaultName, filters: [FILTRES_FICHIERS[format]] })
    if (canceled || !filePath) return false
    try {
      await fs.writeFile(filePath, content, "utf-8")
      return true
    } catch (error) {
      console.error("Erreur lors de l'enregistrement :", error)
      dialog.showErrorBox("Erreur d'exportation", "Impossible d'enregistrer le fichier.")
      return false
    }
  })

  ipcMainHandle("openTextFile", async ({ title, format }: { title: string; format: FormatFichierTexte }) => {
    if (!mainWindow) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title, properties: ["openFile"], filters: [FILTRES_FICHIERS[format]] })
    if (canceled || filePaths.length === 0) return null
    try {
      return await fs.readFile(filePaths[0], "utf-8")
    } catch (error) {
      console.error("Erreur lors de la lecture :", error)
      dialog.showErrorBox("Erreur d'importation", "Impossible de lire le fichier.")
      return null
    }
  })

  ipcMainHandle("printToPdf", async (defaultName: string) => {
    if (!mainWindow) return false
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: "Exporter en PDF", defaultPath: defaultName, filters: [{ name: "Documents PDF", extensions: ["pdf"] }] })
    if (canceled || !filePath) return false
    try {
      // La feuille de style d'impression (@media print) met la page en forme.
      // preferCSSPageSize : les tailles de page viennent de la feuille d'impression (A4 portrait, grille en paysage).
      const pdf = await mainWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
      await fs.writeFile(filePath, pdf)
      return true
    } catch (error) {
      console.error("Erreur lors de l'export PDF :", error)
      dialog.showErrorBox("Erreur d'exportation", "Impossible de créer le PDF.")
      return false
    }
  })

  // Retours des utilisateurs : seuls le formulaire de ticket du dépôt et l'e-mail des retours s'ouvrent hors de
  // l'application, dans le navigateur ou la messagerie du système. L'adresse est revérifiée ici, quoi qu'envoie la page.
  ipcMainHandle("ouvrirAdresseExterne", async (adresse: string) => {
    if (!adresseExterneAutorisee(adresse)) {
      console.warn("Adresse externe refusée.")
      return false
    }
    try {
      await shell.openExternal(adresse)
      return true
    } catch (error) {
      console.error("Ouverture de l'adresse externe impossible :", error)
      return false
    }
  })

  // --- GESTION DE L'IMPORT MANUEL ---
  ipcMainHandle("importState", async () => {
    if (!mainWindow) return { error: "La fenêtre principale n'est pas disponible." }
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Importer une simulation",
      properties: ["openFile"],
      filters: [{ name: "Fichiers JSON", extensions: ["json"] }]
    })
    if (!canceled && filePaths.length > 0) {
      try {
        const fileContent = await fs.readFile(filePaths[0], "utf-8")
        const { data, report } = lireUneSimulationImportee(fileContent)

        if (mainWindow && rapportAvecCorrections(report)) {
          mainWindow.webContents.send("show-notification", {
            message: "Fichier importé avec des ajustements : vérifiez le détail avant de continuer.",
            type: "warning"
          })
        } else if (mainWindow) {
          mainWindow.webContents.send("show-notification", {
            message: "Simulation importée avec succès !",
            type: "success"
          })
        }

        // On renvoie l'état ET le rapport au frontend
        // On renvoie l'état ET le rapport au frontend, qui saura quoi faire de cette information.
        return { data, report }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue."
        console.error("Erreur lors de l'importation :", errorMessage)
        // Un fichier refusé à cause de ses années n'est pas corrompu : le motif suffit, il dit quoi corriger.
        if (error instanceof AnneesRefuseesError) {
          dialog.showErrorBox("Import impossible", errorMessage)
          return { error: errorMessage }
        }
        dialog.showErrorBox("Erreur d'importation", `Le fichier sélectionné est invalide, corrompu ou d'une version non compatible.\n\nDétails : ${errorMessage}`)
        return { error: errorMessage }
      }
    }
    return { data: undefined }
  })

  // --- CLIENTS D'IA : SERVEUR MCP LOCAL ET BOÎTE AUX PROPOSITIONS (voir l'ADR 011) ---
  // Le serveur MCP dépose les propositions dans le dossier de données ; on les transmet à l'interface, qui les montre
  // à l'utilisateur et ne les applique qu'avec son accord.
  const boiteAuxPropositions = ouvrirLaBoiteAuxPropositions(app.getPath("userData"), {
    surChangement: propositions => mainWindow?.webContents.send("propositions-en-attente", propositions)
  }).catch(error => {
    console.error("Boîte aux propositions impossible à ouvrir :", error)
    return null
  })
  // Version du Microsoft Store : copie du serveur à un chemin stable, avant de donner la configuration (voir l'ADR 013).
  const copieDuServeurMcp = process.windowsStore
    ? copierLeServeurMcp(serveurMcpLivre(), infosDuServeurMcp().script).catch(error => console.error("Serveur MCP impossible à copier dans le dossier de données :", error))
    : Promise.resolve()
  ipcMainHandle("infosDuServeurMcp", async () => {
    await copieDuServeurMcp
    return infosDuServeurMcp()
  })
  ipcMainHandle("propositionsEnAttente", async () => (await boiteAuxPropositions)?.enAttente() ?? [])
  ipcMainHandle("retirerProposition", async (id: string) => (typeof id === "string" ? ((await (await boiteAuxPropositions)?.retirer(id)) ?? false) : false))

  ipcMainHandle("getUserPreferences", async () => await donnees.lireLesPreferences())
  ipcMainHandle("saveUserPreferences", async (prefs: UserPreferences) => await donnees.ecrireLesPreferences(prefs))
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
