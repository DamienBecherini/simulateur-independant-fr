// src/backend/logic/outils/isolement.test.ts
// Les outils ne peuvent rien atteindre hors de la simulation : vérification statique. Le module et tout ce qu'il
// importe, de proche en proche, ne dépendent que de Zod, des types et du moteur pur (src/backend/logic), sans
// accès au disque, au réseau, au processus ou à Electron.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const DOSSIER_DES_OUTILS = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(DOSSIER_DES_OUTILS, "../../..")

const importsDe = (source: string) => [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/g)].map(m => m[1])

/** Le fichier TypeScript ou JSON d'un import relatif (« ./a.js » désigne « ./a.ts »). */
function fichierImporte(depuis: string, chemin: string): string {
  const cible = resolve(dirname(depuis), chemin)
  const candidats = [cible.replace(/\.js$/, ".ts"), cible]
  const fichier = candidats.find(existsSync)
  if (!fichier) throw new Error(`Import introuvable : ${chemin} depuis ${relative(SRC, depuis)}`)
  return fichier
}

/** Tous les fichiers atteints depuis les sources des outils, et les modules externes qu'ils importent. */
function ferme(): { fichiers: Set<string>; externes: Set<string> } {
  const sources = readdirSync(DOSSIER_DES_OUTILS)
    .filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map(f => join(DOSSIER_DES_OUTILS, f))
  const fichiers = new Set<string>()
  const externes = new Set<string>()
  const aVoir = [...sources]
  while (aVoir.length > 0) {
    const fichier = aVoir.pop()!
    if (fichiers.has(fichier)) continue
    fichiers.add(fichier)
    if (fichier.endsWith(".json")) continue
    for (const chemin of importsDe(readFileSync(fichier, "utf-8"))) {
      if (chemin.startsWith(".")) aVoir.push(fichierImporte(fichier, chemin))
      else externes.add(chemin)
    }
  }
  return { fichiers, externes }
}

describe("isolement des outils", () => {
  const { fichiers, externes } = ferme()

  it("n'importent que Zod comme module externe", () => {
    expect([...externes]).toEqual(["zod"])
  })

  it("ne touchent qu'au moteur pur, aux types et aux règles fiscales", () => {
    const horsDuMoteur = [...fichiers].map(f => relative(SRC, f).replace(/\\/g, "/")).filter(f => !f.startsWith("backend/logic/") && f !== "types.ts" && !/^backend\/regles\/(\d{4}\.json|index\.ts)$/.test(f))
    expect(horsDuMoteur).toEqual([])
    expect(fichiers.size).toBeGreaterThan(20)
  })

  it("n'utilisent ni réseau, ni disque, ni processus, ni exécution de code", () => {
    const interdits = /\b(fetch|XMLHttpRequest|WebSocket|require|eval|localStorage|sessionStorage|indexedDB|globalThis|window|document)\b|\bprocess\.|\bnew Function\(|\bimport\(/
    const fautifs = [...fichiers].filter(f => f.endsWith(".ts") && interdits.test(readFileSync(f, "utf-8").replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")))
    expect(fautifs.map(f => relative(SRC, f))).toEqual([])
  })
})
