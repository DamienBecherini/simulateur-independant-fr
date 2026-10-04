// e2e/export-pdf.e2e.ts
// Export de la simulation en document PDF, depuis la fenêtre « Exporter ». La fenêtre d'enregistrement native
// est remplacée par celle de neutraliser-dialogues.cjs : le test choisit le fichier écrit.

import type { ElectronApplication } from "@playwright/test"
import fs from "node:fs/promises"
import path from "node:path"
import { test, expect, deposerSession } from "./support/fixtures"
import { sessionMicroBnc } from "./support/sessions"

interface EnregistrementE2E {
  chemin: string | null
  demandes: { title: string; defaultPath: string }[]
}

const enregistrement = (electronApp: ElectronApplication) => electronApp.evaluate(() => (globalThis as unknown as { __enregistrementE2E: EnregistrementE2E }).__enregistrementE2E)

/** Choisit le fichier que la prochaine fenêtre d'enregistrement renverra (`null` : l'utilisateur annule). */
async function choisirLeFichier(electronApp: ElectronApplication, chemin: string | null) {
  await electronApp.evaluate((_electron, fichier) => {
    ;(globalThis as unknown as { __enregistrementE2E: EnregistrementE2E }).__enregistrementE2E.chemin = fichier
  }, chemin)
}

test("le document PDF est enregistré sous le nom de la simulation, et la page retrouve son état", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  const { electronApp, page, erreursConsole } = await lancer()
  const chemin = path.join(dossierDonnees, "simulation.pdf")
  await choisirLeFichier(electronApp, chemin)

  await page.getByRole("button", { name: "Exporter" }).click()
  const fenetre = page.getByRole("dialog", { name: "Exporter" })
  await fenetre.getByRole("button", { name: /Document PDF/ }).click()
  await expect(fenetre).toBeHidden()

  // Le fichier est complet quand il se termine par le marqueur de fin des PDF.
  await expect.poll(async () => (await fs.readFile(chemin).catch(() => Buffer.alloc(0))).toString("latin1").trimEnd().endsWith("%%EOF"), { timeout: 20_000 }).toBe(true)
  const pdf = (await fs.readFile(chemin)).toString("latin1")
  expect(pdf.startsWith("%PDF-")).toBe(true)
  // Une page par objet « /Type /Page » : acteurs, grille, résultats et comparateur n'en tiennent pas sur une seule.
  expect(pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThan(1)

  const { demandes } = await enregistrement(electronApp)
  expect(demandes).toEqual([{ title: "Exporter en PDF", defaultPath: expect.stringMatching(/^micro-bnc-30-000-\d{4}\.pdf$/) }])

  // Les sections repliables, dépliées le temps de l'export, sont refermées.
  await expect(page.locator("details[open]")).toHaveCount(0)
  expect(erreursConsole).toEqual([])
})

test("annuler la fenêtre d'enregistrement n'écrit aucun fichier", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  const { electronApp, page, erreursConsole } = await lancer()
  await choisirLeFichier(electronApp, null)

  await page.getByRole("button", { name: "Exporter" }).click()
  await page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: /Document PDF/ }).click()

  await expect.poll(async () => (await enregistrement(electronApp)).demandes.length).toBe(1)
  await expect(page.locator("details[open]")).toHaveCount(0)
  expect((await fs.readdir(dossierDonnees)).filter(fichier => fichier.endsWith(".pdf"))).toEqual([])
  expect(erreursConsole).toEqual([])
})
