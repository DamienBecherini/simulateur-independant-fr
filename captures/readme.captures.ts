// captures/readme.captures.ts
// Génère les captures d'écran du README (docs/captures/) à partir de la simulation fictive de la démo web.

import path from "node:path"
import { test, expect, deposerSession } from "../e2e/support/fixtures"
import { sessionExemple } from "../src/web/session-exemple"

const DOSSIER = path.resolve("docs/captures")

test("captures du README", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionExemple())
  const { page, electronApp } = await lancer()
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 900))

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  // Fenêtre plus haute pour cette capture : les personnes et activités, puis plusieurs lignes de la grille de saisie.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 1500))
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBeGreaterThan(1300)
  await page.screenshot({ path: path.join(DOSSIER, "acteurs-et-grille.png") })
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 900))
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBeLessThan(1000)

  // La barre du haut est fixe : on fait défiler pour que la section commence juste en dessous.
  await page.getByRole("heading", { name: "Résultats de simulation" }).evaluate(titre => window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 110))
  await page.screenshot({ path: path.join(DOSSIER, "resultats.png") })

  // Pour les captures d'une zone, la barre du haut (fixe) et la barre de résumé (collante) sont masquées : elles la
  // recouvriraient. La fenêtre s'agrandit pour que le comparateur y tienne entier : une zone plus haute que la fenêtre
  // est capturée décalée (la page, recalculée sans barre de défilement, se recentre pendant la capture).
  const sansBarre = "nav, [data-barre-collante] { visibility: hidden !important; }"
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 1150))
  const comparateur = page.getByRole("region", { name: "Comparateur de statuts" })
  const optimisation = page.getByRole("region", { name: "Rémunération ou dividendes ?" })
  await expect(comparateur.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await expect(optimisation.getByRole("group", { name: /Net du foyer selon la rémunération/ })).toBeVisible()
  // Le tableau des statuts seul, sans la section d'optimisation qui le suit ; une référence à l'élément la retrouve une fois masquée.
  const sectionOptimisation = await optimisation.elementHandle()
  await sectionOptimisation!.evaluate(section => section.setAttribute("hidden", ""))
  await comparateur.screenshot({ path: path.join(DOSSIER, "comparateur.png"), style: sansBarre })
  await sectionOptimisation!.evaluate(section => section.removeAttribute("hidden"))
  await optimisation.screenshot({ path: path.join(DOSSIER, "optimisation.png"), style: sansBarre })
})
