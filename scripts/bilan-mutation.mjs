// scripts/bilan-mutation.mjs

// Écrit le bilan des tests de mutation (.github/workflows/mutation.yml), lancés par lots : le score d'ensemble des
// rapports JSON de Stryker, en Markdown, pour le résumé du run.
// Usage : node scripts/bilan-mutation.mjs <dossier> [--partiel] [--seuil <pourcents>]
// Le dossier contient un sous-dossier par lot, avec son mutation.json ; « --partiel » signale qu'un lot n'a pas abouti ;
// « --seuil 80 » fait échouer la commande (code 1) quand le score d'ensemble est sous 80 %.

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
 * Le score d'ensemble atteint-il le seuil ? Sans mutant valide (aucun rapport arrivé), non : rien n'a été mesuré.
 * @param {number | null} score
 * @param {number} seuil en pourcents
 * @returns {boolean}
 */
export function seuilAtteint(score, seuil) {
  return score !== null && score >= seuil
}

/**
 * Le bilan en Markdown.
 * @param {{ files: Record<string, { mutants: { status: string }[] }> }[]} rapports un rapport par lot
 * @param {{ partiel?: boolean, seuil?: number }} [options] `seuil` : le score d'ensemble exigé, en pourcents
 * @returns {string}
 */
export function bilanEnMarkdown(rapports, { partiel = false, seuil } = {}) {
  const statuts = compterLesStatuts(rapports)
  const mutants = Object.values(statuts).reduce((somme, nombre) => somme + nombre, 0)
  const score = scoreDeMutation(statuts)
  const lignes = [
    "## Tests de mutation du moteur fiscal",
    "",
    `Score : **${score === null ? "aucun mutant valide" : `${score.toFixed(2).replace(".", ",")} %`}** (${mutants} mutants, ${rapports.length} lot${rapports.length > 1 ? "s" : ""}).`
  ]
  if (partiel) lignes.push("", "**Bilan partiel : un lot au moins n'a pas abouti.**")
  if (seuil !== undefined) {
    const exige = `${String(seuil).replace(".", ",")} %`
    lignes.push("", seuilAtteint(score, seuil) ? `Seuil de ${exige} atteint.` : `**Seuil de ${exige} non atteint : le run échoue.**`)
  }
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

/**
 * Les arguments de la ligne de commande : le dossier des rapports, « --partiel » et « --seuil <pourcents> ».
 * @param {string[]} args
 * @returns {{ dossier: string, partiel: boolean, seuil: number | undefined }}
 */
export function lireLaCommande(args) {
  const position = args.indexOf("--seuil")
  const seuil = position === -1 ? undefined : Number.parseFloat(args[position + 1])
  if (seuil !== undefined && !(seuil >= 0 && seuil <= 100)) throw new Error(`« --seuil » attend un nombre de 0 à 100, reçu : ${args[position + 1]}`)
  const autres = position === -1 ? args : args.filter((_, rang) => rang !== position && rang !== position + 1)
  return { dossier: autres.find((argument) => !argument.startsWith("--")) ?? "reports/mutation", partiel: autres.includes("--partiel"), seuil }
}

// Point d'entrée en ligne de commande, hors couverture.
/* v8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { dossier, partiel, seuil } = lireLaCommande(process.argv.slice(2))
  const rapports = lireLesRapports(dossier)
  process.stdout.write(bilanEnMarkdown(rapports, { partiel, seuil }))
  // Le bilan est écrit dans tous les cas ; sous le seuil, la commande échoue ensuite.
  if (seuil !== undefined && !seuilAtteint(scoreDeMutation(compterLesStatuts(rapports)), seuil)) process.exitCode = 1
}
/* v8 ignore stop */
