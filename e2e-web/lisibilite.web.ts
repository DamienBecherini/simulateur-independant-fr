// e2e-web/lisibilite.web.ts
// Le contrôle de lisibilité (support/lisibilite.ts) contrôlé lui-même, sur de petites pages écrites pour lui : chaque
// défaut qu'il doit relever y est provoqué seul, et ce qui lui ressemble sans en être un (texte sous une barre collée
// ou fixe, nom tronqué exprès, texte réservé aux lecteurs d'écran, section repliée) n'est pas relevé. Sans ce test, un
// contrôle devenu sourd laisserait passer tous les écrans, et e2e-web/zoom-lisibilite.web.ts ne prouverait plus rien.

import { test, expect, type Page } from "@playwright/test"
import { defautsDeLisibilite } from "./support/lisibilite"

test.use({ viewport: { width: 800, height: 600 } })

async function afficher(page: Page, corps: string, styleDuCorps = "") {
  await page.setContent(`<!doctype html><html lang="fr"><body style="margin:0;font:16px/1.5 sans-serif;${styleDuCorps}">${corps}</body></html>`)
}

const LIGNES = Array.from({ length: 20 }, (_, rang) => `<p style="margin:0">Ligne ${rang + 1} de la zone qui défile</p>`).join("")

test("un écran sain n'a aucun défaut : barre fixe, en-tête collé sur une zone qui défile, nom tronqué, texte pour lecteurs d'écran, section repliée", async ({ page }) => {
  await afficher(
    page,
    `<div style="position:fixed;top:0;left:0;right:0;background:white">Barre fixe, devant le haut de la page</div>
     <p style="margin:0">Texte de la page, sous la barre fixe</p>
     <p style="margin:0">Second paragraphe, à sa place</p>
     <button type="button">Valider</button>
     <span class="sr-only" style="position:absolute;margin-top:-30px">Texte pour les lecteurs d'écran, posé sur le bouton</span>
     <div id="zone" style="height:100px;overflow:auto;border:1px solid black"><div style="position:sticky;top:0;background:white">En-tête collé</div>${LIGNES}</div>
     <p style="width:80px;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid black">Un nom trop long, tronqué exprès</p>
     <details><summary>Section repliée</summary><p style="margin:-40px 0 0">Son contenu, qui recouvrirait le titre s'il était affiché</p></details>`
  )
  // Les lignes de la zone passent sous son en-tête collé, et sortent par le haut.
  await page.locator("#zone").evaluate(zone => zone.scrollTo(0, 35))
  expect(await defautsDeLisibilite(page)).toEqual([])
})

test("deux textes écrits l'un sur l'autre : chevauchement", async ({ page }) => {
  await afficher(page, `<p style="margin:0">Premier texte</p><p style="margin:-16px 0 0">Second texte</p><p style="margin:0">Troisième texte, à sa place</p>`)
  expect(await defautsDeLisibilite(page)).toEqual([expect.stringMatching(/^chevauchement \(\d+ × \d+ px\) : « Premier texte » et « Second texte »$/)])
})

test("un mot plus large que la carte qui le porte : il déborde de son cadre", async ({ page }) => {
  await afficher(page, `<div style="width:60px;border:1px solid black">Anticonstitutionnellement</div>`)
  expect(await defautsDeLisibilite(page)).toEqual([expect.stringMatching(/^déborde de son cadre \(de \d+ px\) : « Anticonstitutionnellement »$/)])
})

test("un texte masqué par son cadre, sans points de suspension : coupé", async ({ page }) => {
  await afficher(page, `<div style="width:60px;overflow:hidden;white-space:nowrap">Texte coupé sans prévenir</div>`)
  expect(await defautsDeLisibilite(page)).toEqual([expect.stringMatching(/^coupé en largeur \(\d+ px dans 60\) : « Texte coupé sans prévenir »$/)])
})

test("un bouton au-delà du bord droit de la fenêtre : hors de l'écran", async ({ page }) => {
  await afficher(page, `<button type="button" style="position:absolute;left:700px;width:200px">Valider</button>`)
  expect(await defautsDeLisibilite(page)).toEqual(["hors de l'écran (700 à 900 px pour 800) : « Valider »"])
})

test("un texte de 9 px : trop petit ; sous un zoom, c'est la taille réelle qui compte", async ({ page }) => {
  await afficher(page, `<p style="font-size:9px">Petit texte</p>`)
  expect(await defautsDeLisibilite(page)).toEqual(["trop petit (9.0 px) : « Petit texte »"])

  // Zoomé à 200 %, un texte de 7 px en fait 14 à l'écran ; un texte de 5 px n'en fait que 10.
  await afficher(page, `<p style="font-size:7px">Texte agrandi par le zoom</p><p style="font-size:5px">Texte encore trop petit</p>`, "zoom:2")
  expect(await defautsDeLisibilite(page)).toEqual(["trop petit (10.0 px) : « Texte encore trop petit »"])
})

test("le relevé se limite à l'élément demandé", async ({ page }) => {
  await afficher(page, `<p style="font-size:9px">Petit texte hors de la fenêtre contrôlée</p><section id="fenetre"><p>Texte lisible</p></section>`)
  expect(await defautsDeLisibilite(page, page.locator("#fenetre"))).toEqual([])
})
