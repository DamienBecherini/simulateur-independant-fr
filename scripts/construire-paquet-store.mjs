// scripts/construire-paquet-store.mjs
// Construit le paquet du Microsoft Store (.appx, x64) avec electron-builder, à partir de l'application déjà compilée
// (npm run dist:store fait les deux). Windows seulement : electron-builder y télécharge makeappx et makepri, sans SDK.
// L'identité du paquet vient de build/store/identite.json (voir scripts/identite-store.mjs).
//
//   node scripts/construire-paquet-store.mjs            paquet à envoyer au Store (identité remplie)
//   node scripts/construire-paquet-store.mjs --essai    paquet d'essai si l'identité n'est pas encore remplie
//   node scripts/construire-paquet-store.mjs --verifier dit si l'identité est remplie (sortie « prete » de GitHub Actions)

import { appendFileSync, readFileSync } from "node:fs"
import builder from "electron-builder"
import { erreursDeLIdentite, identiteDuPaquet, lireLIdentite } from "./identite-store.mjs"

const options = process.argv.slice(2)
const fichier = JSON.parse(readFileSync(new URL("../build/store/identite.json", import.meta.url), "utf-8"))

if (options.includes("--verifier")) {
  const { identite, complete } = lireLIdentite(fichier, process.env)
  const erreurs = complete ? erreursDeLIdentite(identite) : []
  if (erreurs.length > 0) {
    console.error(`Identité du paquet du Microsoft Store invalide :\n- ${erreurs.join("\n- ")}`)
    process.exit(1)
  }
  console.log(complete ? `Identité du paquet : ${identite.identityName} (${identite.publisherDisplayName})` : "Identité du paquet du Microsoft Store pas encore remplie (build/store/identite.json).")
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `prete=${complete}\n`)
  process.exit(0)
}

const { identite, essai } = identiteDuPaquet(fichier, process.env, { essai: options.includes("--essai") })
if (essai) console.warn("Paquet d'essai, avec une identité fictive : le Microsoft Store le refuserait.")

await builder.build({
  targets: builder.Platform.WINDOWS.createTarget(["appx"], builder.Arch.x64),
  publish: "never",
  config: {
    appx: {
      ...identite,
      ...(essai ? { artifactName: "Simulateur-Independant-FR-${version}-store-essai-${arch}.${ext}" } : {})
    }
  }
})
