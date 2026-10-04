// e2e-web/exports.web.ts
// Exports CSV et Markdown dans la démo web : chacun se télécharge, sous un nom tiré de la simulation, avec le
// contenu attendu (BOM et point-virgule pour les CSV, titres pour le rapport), et une notification le confirme.

import { readFile } from "node:fs/promises"
import { test, expect, type Download, type Page } from "@playwright/test"
import { auditerAccessibilite } from "../e2e/support/accessibilite"

/** Ouvre la démo et attend la simulation d'exemple et le comparateur. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
}

async function contenu(telechargement: Download): Promise<string> {
  return readFile(await telechargement.path(), "utf-8")
}

/** Clique sur un bouton et renvoie le fichier téléchargé. */
async function telecharger(page: Page, declencher: () => Promise<void>): Promise<Download> {
  const [telechargement] = await Promise.all([page.waitForEvent("download"), declencher()])
  return telechargement
}

async function exporterDepuisLaFenetre(page: Page, option: RegExp): Promise<Download> {
  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  return telecharger(page, () => page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: option }).click())
}

test("la grille mensuelle se télécharge en CSV pour un tableur français", async ({ page }) => {
  await ouvrir(page)
  const fichier = await exporterDepuisLaFenetre(page, /Grille mensuelle \(CSV\)/)

  expect(fichier.suggestedFilename()).toMatch(/^famille-martin-simulation-2026-grille\.csv$/)
  const texte = await contenu(fichier)
  expect(texte.startsWith("\uFEFFActeur;Nature;Flux;Sens;Janvier;Février;")).toBe(true)
  expect(texte).toContain(";Décembre;Total\r\n")
  await expect(page.getByText("Export enregistré : famille-martin-simulation-2026-grille.csv")).toBeVisible()
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("les résultats se téléchargent en CSV", async ({ page }) => {
  await ouvrir(page)
  const texte = await contenu(await exporterDepuisLaFenetre(page, /Résultats \(CSV\)/))

  expect(texte).toMatch(/^\uFEFFBilan;Montant\r\nAnnée des règles fiscales;\d{4}\r\n/)
  expect(texte).toContain("\r\nFoyer fiscal;Parts;Revenus encaissés;")
})

test("le rapport Markdown se télécharge, avec le comparateur de la première activité", async ({ page }) => {
  await ouvrir(page)
  const fichier = await exporterDepuisLaFenetre(page, /Rapport complet \(Markdown\)/)

  expect(fichier.suggestedFilename()).toBe("famille-martin-simulation-2026-rapport.md")
  const texte = await contenu(fichier)
  expect(texte).toMatch(/^# Simulation « Famille Martin, simulation 2026 »\n/)
  for (const titre of ["## Hypothèses et limites", "## Acteurs", "## Relations", "## Flux saisis", "## Résultats (règles fiscales", "## Comparateur de statuts : «", "## Avertissements"]) expect(texte).toContain(titre)
})

test("le tableau du comparateur et les valeurs de la courbe s'exportent en CSV depuis le comparateur", async ({ page }) => {
  await ouvrir(page)
  const comparaison = await telecharger(page, () => page.getByRole("button", { name: "Exporter en CSV le tableau de comparaison" }).click())
  expect(comparaison.suggestedFilename()).toMatch(/^famille-martin-simulation-2026-comparateur-[a-z0-9-]+\.csv$/)
  expect(await contenu(comparaison)).toMatch(/^\uFEFFIndicateur;SASU;EURL;/)

  await page.locator("summary").filter({ hasText: "Valeurs de la courbe" }).click()
  const courbe = await telecharger(page, () => page.getByRole("button", { name: "Exporter en CSV toutes les valeurs de la courbe" }).click())
  expect(courbe.suggestedFilename()).toMatch(/-remuneration-[a-z0-9-]+-(sasu|eurl)\.csv$/)
  expect(await contenu(courbe)).toMatch(/^\uFEFFStatut;Rémunération nette;Dividendes;Net du foyer;/)
})

test("la fenêtre « Exporter » ne présente aucune violation WCAG, et ses boutons sont assez grands", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  const fenetre = page.getByRole("dialog", { name: "Exporter" })
  await expect(fenetre).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))

  await auditerAccessibilite(page, "fenêtre Exporter", "[role=dialog]")
  for (const bouton of await fenetre.getByRole("button").all()) {
    const zone = await bouton.boundingBox()
    expect(zone && Math.min(zone.width, zone.height), (await bouton.textContent()) ?? "").toBeGreaterThanOrEqual(24)
  }
})
