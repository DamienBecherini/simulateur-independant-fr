// scripts/simuler.mjs
// `npm run simuler -- <fichier.json> [--annee AAAA] [--acteur NOM] [--json]` : passe une session dans le moteur et
// affiche le résultat dans le terminal, pour déboguer un calcul sans écrire de test (voir le guide du développeur,
// « Déboguer un calcul signalé faux »). Toute la logique est dans src/lib/simuler-en-ligne-de-commande.ts : ce script
// la compile en mémoire avec esbuild (déjà utilisé pour le serveur MCP), lui donne la lecture du disque et affiche.

import { build } from "esbuild"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const racine = fileURLToPath(new URL("..", import.meta.url))

const { outputFiles } = await build({
  entryPoints: [path.join(racine, "src/lib/simuler-en-ligne-de-commande.ts")],
  // Les alias « @/ » de l'interface.
  tsconfig: path.join(racine, "tsconfig.app.json"),
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning"
})
const { executerSimuler } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString("base64")}`)

// npm lance les scripts depuis la racine du dépôt : un chemin relatif se lit depuis le dossier d'où la commande est tapée.
const dossierDeLAppel = process.env.INIT_CWD ?? process.cwd()
const { code, texte } = executerSimuler(process.argv.slice(2), chemin => readFileSync(path.resolve(dossierDeLAppel, chemin), "utf-8"))
process.exitCode = code
const sortie = code === 0 ? process.stdout : process.stderr
// Sortie coupée par le lecteur (`| head`) : rien de plus à écrire, ce n'est pas une erreur.
sortie.on("error", erreur => {
  if (erreur.code !== "EPIPE") throw erreur
})
sortie.write(`${texte}\n`)
