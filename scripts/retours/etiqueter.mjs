// scripts/retours/etiqueter.mjs

// Pose les étiquettes d'un ticket de retour d'après ses réponses (workflow .github/workflows/retours.yml).
// Entrées par l'environnement : ISSUE_NUMBER, ISSUE_BODY (saisie non fiable), ISSUE_LABELS (tableau JSON des noms).
// Les commandes `gh` reçoivent leurs arguments en tableau, sans shell : le corps du ticket n'est jamais interprété.

import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { calculerEtiquettes, DEFINITIONS_ETIQUETTES } from "./retours.mjs"

/**
 * Noms des étiquettes actuelles, lus dans un tableau JSON ; tableau vide si le texte est absent ou invalide.
 * @param {string | undefined} texte
 * @returns {string[]}
 */
export function lireEtiquettesActuelles(texte) {
  try {
    const valeur = JSON.parse(texte ?? "[]")
    return Array.isArray(valeur) ? valeur.filter((nom) => typeof nom === "string") : []
  } catch {
    return []
  }
}

/**
 * Commandes `gh` à lancer : création (idempotente) des étiquettes ajoutées, puis une seule modification du ticket.
 * @param {string} numero
 * @param {{ ajouter: string[], retirer: string[] }} changements
 * @returns {string[][]}
 */
export function commandesGh(numero, { ajouter, retirer }) {
  if (ajouter.length === 0 && retirer.length === 0) return []
  const creations = ajouter.map((nom) => {
    const { couleur, description } = DEFINITIONS_ETIQUETTES[nom]
    return ["label", "create", nom, "--color", couleur, "--description", description, "--force"]
  })
  const edition = ["issue", "edit", numero]
  if (ajouter.length > 0) edition.push("--add-label", ajouter.join(","))
  if (retirer.length > 0) edition.push("--remove-label", retirer.join(","))
  return [...creations, edition]
}

/**
 * Étiquette le ticket décrit par l'environnement.
 * @param {Record<string, string | undefined>} env
 * @param {(commande: string, args: string[]) => void} executer
 * @returns {{ ajouter: string[], retirer: string[] }}
 */
export function etiqueterTicket(env, executer) {
  const numero = env.ISSUE_NUMBER ?? ""
  if (!/^\d+$/.test(numero)) throw new Error(`Numéro de ticket invalide : « ${numero} »`)
  const changements = calculerEtiquettes(env.ISSUE_BODY ?? "", lireEtiquettesActuelles(env.ISSUE_LABELS))
  for (const args of commandesGh(numero, changements)) executer("gh", args)
  return changements
}

// Point d'entrée en ligne de commande, hors couverture.
/* v8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ajouter, retirer } = etiqueterTicket(process.env, (commande, args) =>
    execFileSync(commande, args, { stdio: "inherit" })
  )
  console.log(`Étiquettes ajoutées : ${ajouter.join(", ") || "aucune"} ; retirées : ${retirer.join(", ") || "aucune"}`)
}
/* v8 ignore stop */
