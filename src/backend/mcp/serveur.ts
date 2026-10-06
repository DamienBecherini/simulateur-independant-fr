// src/backend/mcp/serveur.ts
// Point d'entrée du serveur MCP local, relié à l'entrée et à la sortie standard. Empaqueté en un seul fichier
// (scripts/empaqueter-serveur-mcp.mjs → dist-electron/mcp/serveur-mcp.mjs), il se lance avec l'exécutable de
// l'application, sans installer Node : ELECTRON_RUN_AS_NODE=1 <exécutable> serveur-mcp.mjs --donnees <dossier>.
// Voir documentation/utiliser-avec-une-ia.md et l'ADR 011.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { creerServeurMcp, dossierDesArguments } from "./serveur-mcp.js"

/** Version de l'application, fixée à l'empaquetage. */
declare const __VERSION_DU_SERVEUR__: string | undefined

// La sortie standard ne porte que les messages du protocole : tout journal part sur la sortie d'erreur.
console.log = console.error
console.info = console.error
console.debug = console.error

const dossier = dossierDesArguments(process.argv.slice(2))
if (dossier === null) {
  console.error("Serveur MCP du simulateur : indiquez le dossier de données de l'application avec --donnees <dossier> (voir Paramètres, « Utiliser avec une IA (MCP) », dans l'application).")
  process.exit(2)
}

const version = typeof __VERSION_DU_SERVEUR__ === "string" ? __VERSION_DU_SERVEUR__ : "dev"
await creerServeurMcp({ dossier, version }).connect(new StdioServerTransport())
console.error(`Serveur MCP du simulateur ${version} prêt ; données lues dans ${dossier}.`)
