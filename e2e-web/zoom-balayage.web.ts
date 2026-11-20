// e2e-web/zoom-balayage.web.ts
// Le zoom et la largeur de la fenêtre se combinent : la place réellement disponible est la largeur divisée par le zoom,
// les points de rupture de la page suivent la largeur de la fenêtre, ceux de la barre d'outils sa largeur zoomée, et le
// zoom lui-même est borné par la largeur. Un défaut peut donc n'apparaître qu'à 170 % en plein écran, ou à 130 % dans une
// fenêtre de 900 px, juste avant qu'un point de rupture ne change la mise en page. zoom-lisibilite.web.ts contrôle cinq
// couples en profondeur (toutes les fenêtres) ; ici, on balaie les deux dimensions : à chaque zoom des boutons (50 % à
// 200 %), la fenêtre rétrécit de 1 920 à 320 px par pas de 16 px, et la page est relevée à chaque pas (aucun texte ni
// aucune commande hors de l'écran, coupé, sorti de son cadre, trop petit ou écrit sur un autre : support/lisibilite.ts).
// Un pas coûte quelques dizaines de millisecondes : la page n'est chargée qu'une fois par zoom, et les 4 848 relevés
// (16 zooms, 101 largeurs, 3 affichages) prennent un peu plus d'une minute sur huit processus.
// Interface réduite (moins de 100 %), un texte plus petit que 12 px est le choix de l'utilisateur : ce défaut-là n'y est
// pas relevé.

import { test, expect, type Page } from "@playwright/test"
import { AFFICHAGES, ouvrirLaSessionAgrandie } from "./support/interface-agrandie"
import { defautsDeLisibilite } from "./support/lisibilite"

/** Les zooms qu'offrent les boutons : de 50 % à 200 %, par pas de 10 %. */
const ZOOMS = Array.from({ length: 16 }, (_, i) => (5 + i) / 10)
const LARGEUR_MAXIMALE = 1920
const LARGEUR_MINIMALE = 320
const PAS = 16
const HAUTEUR = 900

const largeurs = () => Array.from({ length: Math.floor((LARGEUR_MAXIMALE - LARGEUR_MINIMALE) / PAS) + 1 }, (_, i) => LARGEUR_MAXIMALE - i * PAS)

/** Donne à la fenêtre cette largeur, et attend que la page l'ait prise en compte : zoom borné de nouveau, mise en page refaite. */
async function retrecir(page: Page, largeur: number) {
  await page.setViewportSize({ width: largeur, height: HAUTEUR })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** « 1 920 à 1 808 px » : les largeurs voisines où le même défaut se répète, réunies en plages. */
function plages(valeurs: number[]): string {
  const triees = [...valeurs].sort((a, b) => b - a)
  const groupes: number[][] = []
  for (const valeur of triees) {
    const dernier = groupes[groupes.length - 1]
    if (dernier && dernier[dernier.length - 1] - valeur === PAS) dernier.push(valeur)
    else groupes.push([valeur])
  }
  return groupes.map(groupe => (groupe.length === 1 ? `${groupe[0]} px` : `${groupe[0]} à ${groupe[groupe.length - 1]} px`)).join(", ")
}

for (const affichage of AFFICHAGES) {
  test.describe(`affichage « ${affichage} » : la fenêtre rétrécit de ${LARGEUR_MAXIMALE} à ${LARGEUR_MINIMALE} px`, () => {
    test.use({ viewport: { width: LARGEUR_MAXIMALE, height: HAUTEUR } })

    for (const zoom of ZOOMS) {
      test(`zoom demandé de ${Math.round(zoom * 100)} % : la page reste lisible à chaque largeur`, async ({ page }) => {
        test.slow()
        await ouvrirLaSessionAgrandie(page, zoom, affichage)
        await expect(page.getByText(/ZFU-TE : bénéfice exonéré d'impôt/).first()).toBeAttached()

        // Chaque défaut, sans ses mesures (elles changent à chaque pas), avec les largeurs où il apparaît.
        const releve = new Map<string, number[]>()
        for (const largeur of largeurs()) {
          await retrecir(page, largeur)
          const reduite = (await page.evaluate(() => Number.parseFloat(document.body.style.zoom))) < 1
          for (const defaut of await defautsDeLisibilite(page)) {
            if (reduite && defaut.startsWith("trop petit")) continue
            const cle = defaut.replace(/\s*\([^)]*\)/, "")
            releve.set(cle, [...(releve.get(cle) ?? []), largeur])
          }
        }
        expect([...releve].map(([defaut, ou]) => `${defaut} — fenêtre de ${plages(ou)}`)).toEqual([])
      })
    }
  })
}
