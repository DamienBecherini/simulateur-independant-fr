// scripts/retours/agreger.mjs

// Écrit l'agrégat des retours (note moyenne, préférences d'affichage) servi par la démo web
// et lu par le badge du README.
// Usage : node scripts/retours/agreger.mjs [entrée.json | -] [sortie.json]
// L'entrée est la sortie de `gh issue list --label retour --state all --json author,createdAt,body,labels`,
// lue sur l'entrée standard par défaut ; la sortie vaut public/retours.json par défaut.
// Une entrée absente ou invalide donne un agrégat vide : la publication de la démo n'échoue pas pour autant.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { agregerRetours } from "./retours.mjs"

export const SORTIE_PAR_DEFAUT = "public/retours.json"

/**
 * Tickets lus dans le texte JSON de `gh issue list` ; tableau vide si le texte est invalide.
 * @param {string} texte
 * @returns {unknown[]}
 */
export function lireTickets(texte) {
  try {
    // Un fichier enregistré sous Windows peut commencer par une marque d'ordre des octets.
    const valeur = JSON.parse(texte.replace(/^\uFEFF/, ""))
    return Array.isArray(valeur) ? valeur : []
  } catch {
    return []
  }
}

/**
 * Contenu du fichier retours.json pour le texte JSON reçu.
 * @param {string} texte
 * @param {Date} [maintenant]
 * @returns {string}
 */
export function produireRetoursJson(texte, maintenant = new Date()) {
  return `${JSON.stringify(agregerRetours(lireTickets(texte), maintenant), null, 2)}\n`
}

/**
 * Lit l'entrée, écrit l'agrégat et renvoie le chemin écrit.
 * @param {string[]} args arguments de la ligne de commande (entrée, sortie)
 * @param {{ lire: (chemin: string | number) => string, ecrire: (chemin: string, contenu: string) => void, maintenant?: Date }} es
 * @returns {string}
 */
export function agregerFichier(args, { lire, ecrire, maintenant = new Date() }) {
  const [entree = "-", sortie = SORTIE_PAR_DEFAUT] = args
  let texte
  try {
    texte = lire(entree === "-" ? 0 : entree)
  } catch {
    texte = "[]"
  }
  ecrire(sortie, produireRetoursJson(texte, maintenant))
  return sortie
}

// Point d'entrée en ligne de commande, hors couverture.
/* v8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sortie = agregerFichier(process.argv.slice(2), {
    lire: (chemin) => readFileSync(chemin, "utf-8"),
    ecrire: (chemin, contenu) => {
      mkdirSync(dirname(chemin), { recursive: true })
      writeFileSync(chemin, contenu, "utf-8")
    }
  })
  console.log(`Agrégat des retours écrit dans ${sortie}`)
}
/* v8 ignore stop */
