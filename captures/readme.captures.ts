// captures/readme.captures.ts
// Génère les captures d'écran du README (docs/captures/) à partir de la simulation fictive de la démo web.

import path from "node:path"
import type { ElectronApplication, Page } from "@playwright/test"
import { test, expect, deposerSession } from "../e2e/support/fixtures"
import { sessionExemple } from "../src/web/session-exemple"

// À l'échelle CSS (1 pixel par pixel de la page) : des images de même taille quel que soit le facteur d'échelle de l'écran.
const DOSSIER = path.resolve("docs/captures")

// Pour les captures d'une zone, la barre du haut (fixe) et la barre de résumé (collante) sont masquées : elles la recouvriraient.
const SANS_BARRE = "nav, [data-barre-collante] { visibility: hidden !important; }"

/**
 * Agrandit la page pour qu'une zone haute y tienne entière : une zone plus haute que la page est capturée décalée (la
 * page, recalculée sans barre de défilement, se recentre pendant la capture). Une fenêtre de cette hauteur dépasserait
 * l'écran, que Windows lui impose : la taille est imposée à la page elle-même.
 */
async function pageHaute(electronApp: ElectronApplication, page: Page) {
  const cdp = await electronApp.context().newCDPSession(page)
  const facteur = await page.evaluate(() => window.devicePixelRatio)
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: facteur, mobile: false })
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(2400)
}

test("captures du README", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionExemple())
  const { page, electronApp } = await lancer()
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 900))

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  // Fenêtre plus haute pour cette capture : les personnes et activités, puis plusieurs lignes de la grille de saisie.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 1500))
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBeGreaterThan(1300)
  await page.screenshot({ path: path.join(DOSSIER, "acteurs-et-grille.png"), scale: "css" })

  await pageHaute(electronApp, page)

  // Les résultats avec leur détail : celui du net dans la poche, puis celui de chaque carte. La capture va du titre des
  // résultats à celui du comparateur, qui les suit, sans la barre de défilement de la page.
  await page.locator("summary", { hasText: "Détail du calcul" }).click()
  await page.getByRole("button", { name: "Afficher le détail (toutes les cartes)" }).first().click()
  await expect(page.getByRole("button", { name: "Masquer le détail (toutes les cartes)" }).first()).toBeVisible()
  const titreDesResultats = page.getByRole("heading", { name: "Résultats de simulation" })
  await titreDesResultats.evaluate(titre => window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 24))
  const [haut, bas, largeur] = await page.evaluate(() => {
    const bord = (nom: string) => Array.from(document.querySelectorAll("h2")).find(titre => titre.textContent?.trim() === nom)!.getBoundingClientRect().top
    return [bord("Résultats de simulation"), bord("Comparateur de statuts"), document.documentElement.clientWidth]
  })
  await page.screenshot({ path: path.join(DOSSIER, "resultats.png"), scale: "css", style: SANS_BARRE, clip: { x: 0, y: haut - 24, width: largeur, height: bas - haut } })

  const comparateur = page.getByRole("region", { name: "Comparateur de statuts" })
  const optimisation = page.getByRole("region", { name: "Rémunération ou dividendes ?" })
  await expect(comparateur.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await expect(optimisation.getByRole("group", { name: /Net du foyer selon la rémunération/ })).toBeVisible()
  // Le tableau des statuts seul, sans la section d'optimisation qui le suit ; une référence à l'élément la retrouve une fois masquée.
  const sectionOptimisation = await optimisation.elementHandle()
  await sectionOptimisation!.evaluate(section => section.setAttribute("hidden", ""))
  await comparateur.screenshot({ path: path.join(DOSSIER, "comparateur.png"), scale: "css", style: SANS_BARRE })
  await sectionOptimisation!.evaluate(section => section.removeAttribute("hidden"))
  await optimisation.screenshot({ path: path.join(DOSSIER, "optimisation.png"), scale: "css", style: SANS_BARRE })
})

test("capture du couple en union libre", async ({ dossierDonnees, lancer }) => {
  // La simulation de la démo, Camille et Julien en union libre au lieu d'être pacsés : le comparateur montre alors ce que
  // changerait un mariage ou un PACS. La démo elle-même n'est pas touchée.
  const exemple = sessionExemple()
  const enUnionLibre = { ...exemple, relationships: exemple.relationships.map(relation => (relation.type === "PACSé(e)" ? { ...relation, type: "En couple" as const } : relation)) }
  await deposerSession(dossierDonnees, enUnionLibre)
  const { page, electronApp } = await lancer()
  await pageHaute(electronApp, page)

  const carte = page.getByRole("region", { name: "Et si vous étiez mariés ou pacsés ?" })
  await expect(carte).toBeVisible()
  await carte.screenshot({ path: path.join(DOSSIER, "couple.png"), scale: "css", style: SANS_BARRE })
})
