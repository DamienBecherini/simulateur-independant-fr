// scripts/empaqueter-serveur-mcp.mjs
// Empaquette le serveur MCP local (src/backend/mcp/serveur.ts) en un seul fichier, avec ses dépendances (SDK MCP,
// Zod, moteur du simulateur) : dist-electron/mcp/serveur-mcp.mjs. L'application packagée le copie hors de l'archive
// asar (extraResources d'electron-builder.json), où l'exécutable de l'application le lance en mode Node
// (ELECTRON_RUN_AS_NODE=1) sans aucun node_modules. Voir l'ADR 011.

import { build } from "esbuild"
import { readFileSync } from "node:fs"

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"))

await build({
  entryPoints: ["src/backend/mcp/serveur.ts"],
  outfile: "dist-electron/mcp/serveur-mcp.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  // Node 24 : la version embarquée par Electron 44.
  target: "node22",
  define: { __VERSION_DU_SERVEUR__: JSON.stringify(version) },
  // Certaines dépendances du SDK sont en CommonJS : `require` leur est rendu dans le module ES.
  banner: { js: "import { createRequire as __creerRequire } from 'node:module'; const require = __creerRequire(import.meta.url);" },
  minify: true,
  legalComments: "none",
  logLevel: "warning"
})
