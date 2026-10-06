// captures/store.captures.ts
// Captures d'écran de la fiche du Microsoft Store (documentation/microsoft-store/captures/), à partir de la simulation
// fictive de la démo web : 1366 × 768 pixels exactement, la taille minimale demandée par le Store pour une application
// de bureau. Lancées avec les captures du README : « npm run captures » (application compilée au préalable).

import path from "node:path"
import type { Page } from "@playwright/test"
import { test, expect, deposerSession } from "../e2e/support/fixtures"
import { sessionExemple } from "../src/web/session-exemple"

const DOSSIER = path.resolve("documentation/microsoft-store/captures")
const LARGEUR = 1366
const HAUTEUR = 768

const capturer = (page: Page, nom: string) => page.screenshot({ path: path.join(DOSSIER, nom), scale: "css" })

/** Fait défiler la page pour que l'élément commence juste sous la barre du haut, qui est fixe. */
async function amenerSousLaBarre(page: Page, nom: string) {
  await page.getByRole("heading", { name: nom }).first().evaluate(titre => window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 130))
}

test("captures de la fiche du Microsoft Store", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionExemple())
  const { page, electronApp } = await lancer()
  // Taille et facteur d'échelle imposés à la page : des captures identiques quel que soit l'écran du poste.
  const cdp = await electronApp.context().newCDPSession(page)
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1, mobile: false })
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([LARGEUR, HAUTEUR])

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await capturer(page, "1-simulation.png")

  await amenerSousLaBarre(page, "Résultats de simulation")
  await capturer(page, "2-resultats.png")

  await expect(page.getByRole("region", { name: "Comparateur de statuts" }).getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await amenerSousLaBarre(page, "Comparateur de statuts")
  await capturer(page, "3-comparateur.png")

  await expect(page.getByRole("region", { name: "Rémunération ou dividendes ?" }).getByRole("group", { name: /Net du foyer selon la rémunération/ })).toBeVisible()
  await amenerSousLaBarre(page, "Rémunération ou dividendes ?")
  await capturer(page, "4-remuneration-ou-dividendes.png")
})
