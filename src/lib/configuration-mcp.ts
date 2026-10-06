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
  if (plateforme === "win32") return "%APPDATA%\\Claude\\claude_desktop_config.json"
  if (plateforme === "darwin") return "~/Library/Application Support/Claude/claude_desktop_config.json"
  return null
}

/** La commande qui lance le serveur à la main, pour vérifier qu'il démarre (dépannage). */
export function commandeDeVerification({ executable, script, donnees, plateforme }: InfosDuServeurMcp): string {
  if (plateforme === "win32") return `$env:ELECTRON_RUN_AS_NODE=1; & "${executable}" "${script}" --donnees "${donnees}"`
  return `ELECTRON_RUN_AS_NODE=1 "${executable}" "${script}" --donnees "${donnees}"`
}
