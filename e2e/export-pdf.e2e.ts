// e2e/export-pdf.e2e.ts
// Export de la simulation en document PDF, depuis la fenêtre « Exporter ». La fenêtre d'enregistrement native
// est remplacée par celle de neutraliser-dialogues.cjs : le test choisit le fichier écrit.

import fs from "node:fs/promises"
import path from "node:path"
import { test, expect, choisirFichiers, demandesDEnregistrement, deposerSession, orientationsDesPages } from "./support/fixtures"
import { sessionMicroBnc } from "./support/sessions"

test("le document PDF est enregistré sous le nom de la simulation, et la page retrouve son état", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  const { electronApp, page, erreursConsole } = await lancer()
  const chemin = path.join(dossierDonnees, "simulation.pdf")
  await choisirFichiers(electronApp, { enregistrer: chemin })

  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  const fenetre = page.getByRole("dialog", { name: "Exporter" })
  await fenetre.getByRole("button", { name: /Document PDF/ }).click()
  await expect(fenetre).toBeHidden()

  // Le fichier est complet quand il se termine par le marqueur de fin des PDF.
  await expect.poll(async () => (await fs.readFile(chemin).catch(() => Buffer.alloc(0))).toString("latin1").trimEnd().endsWith("%%EOF"), { timeout: 20_000 }).toBe(true)
  const pdf = (await fs.readFile(chemin)).toString("latin1")
  expect(pdf.startsWith("%PDF-")).toBe(true)
  // Une page par objet « /Type /Page » : acteurs, grille, résultats et comparateur n'en tiennent pas sur une seule.
  expect(pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThan(1)
  // La grille annuelle a sa page en paysage ; le reste du document est en portrait.
  const orientations = orientationsDesPages(pdf)
  expect(orientations).toContain("paysage")
  expect(orientations[0]).toBe("portrait")

  const demandes = await demandesDEnregistrement(electronApp)
  expect(demandes).toEqual([{ title: "Exporter en PDF", defaultPath: expect.stringMatching(/^micro-bnc-30-000-\d{4}\.pdf$/) }])

  // Les sections repliables, dépliées le temps de l'export, sont refermées.
  await expect(page.locator("details[open]")).toHaveCount(0)
  expect(erreursConsole).toEqual([])
})

test("une simulation au nom très long propose un nom de PDF court, et le fichier est écrit", async ({ dossierDonnees, lancer }) => {
  // Plus de 300 caractères, accents et ponctuation : le nom proposé doit rester un nom de fichier valide.
  await deposerSession(dossierDonnees, { ...sessionMicroBnc(), name: `Scénario « très » long : ${"hypothèse prudente, ".repeat(16)}fin` })
  const { electronApp, page, erreursConsole } = await lancer()
  const chemin = path.join(dossierDonnees, "nom-long.pdf")
  await choisirFichiers(electronApp, { enregistrer: chemin })

  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  await page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: /Document PDF/ }).click()

  await expect.poll(async () => (await fs.readFile(chemin).catch(() => Buffer.alloc(0))).toString("latin1").trimEnd().endsWith("%%EOF"), { timeout: 20_000 }).toBe(true)
  // Le nom est raccourci à 60 caractères, comme pour les autres exports, avant l'année.
  expect(await demandesDEnregistrement(electronApp)).toEqual([{ title: "Exporter en PDF", defaultPath: "scenario-tres-long-hypothese-prudente-hypothese-prudente-hyp-2026.pdf" }])
  expect(erreursConsole).toEqual([])
})

test("annuler la fenêtre d'enregistrement n'écrit aucun fichier", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  const { electronApp, page, erreursConsole } = await lancer()
  await choisirFichiers(electronApp, { enregistrer: null })

  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  await page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: /Document PDF/ }).click()

  await expect.poll(async () => (await demandesDEnregistrement(electronApp)).length).toBe(1)
  await expect(page.locator("details[open]")).toHaveCount(0)
  expect((await fs.readdir(dossierDonnees)).filter(fichier => fichier.endsWith(".pdf"))).toEqual([])
  expect(erreursConsole).toEqual([])
})
