// src/lib/configuration-mcp.ts
// La configuration à copier dans un client d'IA de bureau (Claude Desktop, LM Studio…) pour qu'il lance le serveur MCP
// local du simulateur (voir documentation/utiliser-avec-une-ia.md et l'ADR 011). Le serveur se lance avec l'exécutable
// de l'application en mode Node (ELECTRON_RUN_AS_NODE=1) : rien d'autre à installer.

/** Les chemins de cette installation, fournis par le process principal. */
export interface InfosDuServeurMcp {
  /** L'exécutable de l'application (ou d'Electron, en développement). */
  executable: string
  /** Le fichier du serveur MCP, hors de l'archive de l'application. */
  script: string
  /** Le dossier de données de l'application, où elle enregistre la session. */
  donnees: string
  /** `process.platform` : win32, darwin, linux… */
  plateforme: string
  /** Vrai pour la version du Microsoft Store (paquet MSIX) : l'exécutable est alors l'alias d'exécution du paquet. */
  microsoftStore?: boolean
}

/**
 * L'installation vue du process principal. `dossierLocalAppData` (le dossier `%LOCALAPPDATA%` de l'utilisateur) n'est
 * donné que pour la version du Microsoft Store (`process.windowsStore`), `null` sinon.
 */
export interface Installation {
  executable: string
  /** Le serveur MCP livré avec l'application (`resources/mcp/serveur-mcp.mjs`). */
  serveurLivre: string
  donnees: string
  plateforme: string
  dossierLocalAppData: string | null
}

/**
 * Alias d'exécution déclaré par le paquet du Microsoft Store (build/store/extensions-appx.xml). Windows le crée dans
 * `%LOCALAPPDATA%\Microsoft\WindowsApps` : un chemin stable, alors que le dossier du paquet change à chaque version.
 */
export const ALIAS_D_EXECUTION = "simulateur-independant-fr.exe"

/**
 * Les chemins à donner au client d'IA. Version classique : l'exécutable et le serveur livré. Version du Microsoft
 * Store : l'alias d'exécution, qui lance l'exécutable du paquet avec l'identité du paquet (donc la même vue du dossier
 * de données que l'application), et une copie du serveur dans le dossier de données, faite à chaque démarrage de
 * l'application : le dossier du paquet, sous `C:\Program Files\WindowsApps`, change à chaque mise à jour.
 */
export function infosDeLInstallation({ executable, serveurLivre, donnees, plateforme, dossierLocalAppData }: Installation): InfosDuServeurMcp {
  if (dossierLocalAppData === null) return { executable, script: serveurLivre, donnees, plateforme }
  return { executable: `${dossierLocalAppData}\\Microsoft\\WindowsApps\\${ALIAS_D_EXECUTION}`, script: copieDuServeur(donnees), donnees, plateforme, microsoftStore: true }
}

/** Où la version du Microsoft Store copie le serveur MCP : dans son dossier de données, sous Windows. */
export function copieDuServeur(donnees: string): string {
  return String.raw`${donnees}\mcp\serveur-mcp.mjs`
}

/** Nom du serveur dans la configuration du client. */
export const NOM_DU_SERVEUR_MCP = "simulateur-independant-fr"

/** L'entrée du serveur dans `mcpServers` : la notation commune à Claude Desktop, LM Studio, Cursor et la plupart des clients. */
export function entreeDuServeur({ executable, script, donnees }: InfosDuServeurMcp) {
  return { command: executable, args: [script, "--donnees", donnees], env: { ELECTRON_RUN_AS_NODE: "1" } }
}

/** Le fichier de configuration complet, à coller dans un fichier vide (ou à fusionner dans `mcpServers`). */
export function configurationDuClient(infos: InfosDuServeurMcp): string {
  return JSON.stringify({ mcpServers: { [NOM_DU_SERVEUR_MCP]: entreeDuServeur(infos) } }, null, 2)
}

/** Où se trouve le fichier de configuration de Claude Desktop sur ce système ; `null` s'il n'y existe pas officiellement. */
export function configurationDeClaudeDesktop(plateforme: string): string | null {
  if (plateforme === "win32") return String.raw`%APPDATA%\Claude\claude_desktop_config.json`
  if (plateforme === "darwin") return "~/Library/Application Support/Claude/claude_desktop_config.json"
  return null
}

/** La commande qui lance le serveur à la main, pour vérifier qu'il démarre (dépannage). */
export function commandeDeVerification({ executable, script, donnees, plateforme }: InfosDuServeurMcp): string {
  if (plateforme === "win32") return `$env:ELECTRON_RUN_AS_NODE=1; & "${executable}" "${script}" --donnees "${donnees}"`
  return `ELECTRON_RUN_AS_NODE=1 "${executable}" "${script}" --donnees "${donnees}"`
}
