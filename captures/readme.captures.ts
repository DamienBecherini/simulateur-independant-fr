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
  await page.screenshot({ path: path.join(DOSSIER, "acteurs-et-grille.png") })

  // La barre du haut est fixe : on fait défiler pour que la section commence juste en dessous.
  await page.getByRole("heading", { name: "Résultats de simulation" }).evaluate(titre => window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 110))
  await page.screenshot({ path: path.join(DOSSIER, "resultats.png") })

  // Pour les captures d'une zone plus haute que la fenêtre, la barre du haut (fixe) est masquée : elle la recouvrirait.
  const sansBarre = "nav { visibility: hidden !important; }"
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
