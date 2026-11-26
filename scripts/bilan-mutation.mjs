// scripts/bilan-mutation.mjs

// Écrit le bilan des tests de mutation (.github/workflows/mutation.yml), lancés par lots : le score d'ensemble des
// rapports JSON de Stryker, en Markdown, pour le résumé du run.
// Usage : node scripts/bilan-mutation.mjs <dossier> [--partiel]
// Le dossier contient un sous-dossier par lot, avec son mutation.json ; « --partiel » signale qu'un lot n'a pas abouti.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

/**
 * Nombre de mutants par statut (Killed, Survived, Timeout, NoCoverage…) dans des rapports de Stryker.
 * @param {{ files: Record<string, { mutants: { status: string }[] }> }[]} rapports
 * @returns {Record<string, number>}
 */
export function compterLesStatuts(rapports) {
  const statuts = {}
  for (const rapport of rapports) {
    for (const fichier of Object.values(rapport.files)) {
      for (const { status } of fichier.mutants) statuts[status] = (statuts[status] ?? 0) + 1
    }
  }
  return statuts
}

/**
 * Le score de Stryker, en pourcents : mutants tués ou arrêtés par un délai, sur les mutants valides (ni ignorés, ni
 * en erreur). `null` sans mutant valide.
 * @param {Record<string, number>} statuts
 * @returns {number | null}
 */
export function scoreDeMutation(statuts) {
  const detectes = (statuts.Killed ?? 0) + (statuts.Timeout ?? 0)
  const valides = detectes + (statuts.Survived ?? 0) + (statuts.NoCoverage ?? 0)
  return valides === 0 ? null : (detectes / valides) * 100
}

/**
 * Le bilan en Markdown.
 * @param {{ files: Record<string, { mutants: { status: string }[] }> }[]} rapports un rapport par lot
 * @param {{ partiel?: boolean }} [options]
 * @returns {string}
 */
export function bilanEnMarkdown(rapports, { partiel = false } = {}) {
  const statuts = compterLesStatuts(rapports)
  const mutants = Object.values(statuts).reduce((somme, nombre) => somme + nombre, 0)
  const score = scoreDeMutation(statuts)
  const lignes = [
    "## Tests de mutation du moteur fiscal",
    "",
    `Score : **${score === null ? "aucun mutant valide" : `${score.toFixed(2).replace(".", ",")} %`}** (${mutants} mutants, ${rapports.length} lot${rapports.length > 1 ? "s" : ""}).`
  ]
  if (partiel) lignes.push("", "**Bilan partiel : un lot au moins n'a pas abouti.**")
  lignes.push(
    "",
    "| Tués | Délai dépassé | Survivants | Sans couverture |",
    "| ---: | ---: | ---: | ---: |",
    `| ${statuts.Killed ?? 0} | ${statuts.Timeout ?? 0} | ${statuts.Survived ?? 0} | ${statuts.NoCoverage ?? 0} |`
  )
  return `${lignes.join("\n")}\n`
}

/**
 * Les rapports mutation.json des sous-dossiers d'un dossier, dans l'ordre de leurs noms ; aucun si le dossier manque.
 * @param {string} dossier
 * @returns {{ files: Record<string, { mutants: { status: string }[] }> }[]}
 */
export function lireLesRapports(dossier) {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .sort()
    .map((lot) => join(dossier, lot, "mutation.json"))
    .filter((chemin) => existsSync(chemin))
    .map((chemin) => JSON.parse(readFileSync(chemin, "utf-8")))
}

// Point d'entrée en ligne de commande, hors couverture.
/* v8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dossier = "reports/mutation", ...options] = process.argv.slice(2)
  process.stdout.write(bilanEnMarkdown(lireLesRapports(dossier), { partiel: options.includes("--partiel") }))
}
/* v8 ignore stop */
