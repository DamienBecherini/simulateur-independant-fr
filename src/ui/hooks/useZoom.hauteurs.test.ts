// src/ui/hooks/useZoom.hauteurs.test.ts
// Le zoom de l'interface (CSS `zoom` sur le body, voir useZoom) agrandit aussi, dans Chromium, les unités de l'écran :
// à 150 %, « max-h-[90vh] » vaut 135 % de la fenêtre, et une fenêtre de dialogue déborde en haut et en bas. Toute
// hauteur exprimée en vh ou dvh dans l'interface doit donc être divisée par --zoom. Vérification statique.

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const DOSSIER_UI = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Sources de l'interface (hors tests). */
function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return sources(chemin)
    return /\.(tsx?|css)$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name) ? [chemin] : []
  })
}

describe("hauteurs relatives à l'écran sous le zoom de l'interface", () => {
  it("toute valeur en vh ou dvh d'une classe est divisée par --zoom", () => {
    const fautives = sources(DOSSIER_UI).flatMap(fichier =>
      [...readFileSync(fichier, "utf8").matchAll(/\[[^\]\s"'`]*\d+d?vh[^\]\s"'`]*\]/g)].filter(m => !m[0].includes("var(--zoom")).map(m => `${relative(DOSSIER_UI, fichier)} : ${m[0]}`)
    )
    expect(fautives).toEqual([])
  })
})
