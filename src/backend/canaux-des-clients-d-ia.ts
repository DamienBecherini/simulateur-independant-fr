// src/backend/canaux-des-clients-d-ia.ts

/*
 * Canaux IPC des clients d'IA (voir l'ADR 011) : configuration du serveur MCP local de cette installation, et boîte
 * aux propositions. Le serveur MCP dépose les propositions dans le dossier de données ; elles sont transmises à
 * l'interface, qui les montre à l'utilisateur et ne les applique qu'avec son accord. Chaque canal passe par
 * `ipcMainHandle` (émetteur vérifié) et vérifie ses paramètres.
 */

import { app, type BrowserWindow } from "electron"
import path from "node:path"
import { infosDeLInstallation, type InfosDuServeurMcp } from "@/lib/configuration-mcp.js"
import { ouvrirLaBoiteAuxPropositions } from "./boite-aux-propositions.js"
import { copierLeServeurMcp } from "./copie-du-serveur-mcp.js"
import { IdentifiantSchema } from "./logic/entrees-ipc.js"
import { ipcMainHandle } from "./util.js"

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

/** Ouvre la boîte aux propositions et déclare les canaux ; à appeler une fois l'application prête. */
export function declarerLesCanauxDesClientsDIa(fenetrePrincipale: () => BrowserWindow | null) {
  const boiteAuxPropositions = ouvrirLaBoiteAuxPropositions(app.getPath("userData"), {
    surChangement: propositions => fenetrePrincipale()?.webContents.send("propositions-en-attente", propositions)
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
  // Un identifiant qui n'est pas un texte ne désigne aucune proposition : rien n'est retiré.
  ipcMainHandle("retirerProposition", async (id: string) => {
    if (!IdentifiantSchema.safeParse(id).success) return false
    return (await (await boiteAuxPropositions)?.retirer(id)) ?? false
  })
}
