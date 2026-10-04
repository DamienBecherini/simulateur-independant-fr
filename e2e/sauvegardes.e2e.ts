// e2e/sauvegardes.e2e.ts
// Sauvegardes nommées, depuis le panneau Paramètres.

import { FORMAT_VERSION_ACTUEL } from "../src/backend/logic/migrations"
import type { SaveSlot } from "../src/types"
import { test, expect, deposerSauvegardes, deposerSession, lireFichier } from "./support/fixtures"
import { sessionAliceSeule, sessionMicroBnc, sessionVide } from "./support/sessions"

type FichierSauvegarde = SaveSlot & { formatVersion?: number }

test("enregistrer la session dans une sauvegarde, réinitialiser, puis recharger la sauvegarde", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  const { page } = await lancer()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")

  // Enregistrement sous un nouveau nom.
  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Scénario Alice")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()
  await expect.poll(async () => (await lireFichier<FichierSauvegarde[]>(dossierDonnees, "simulationSlots.json"))?.map(s => [s.name, s.formatVersion])).toEqual([["Scénario Alice", FORMAT_VERSION_ACTUEL]])

  // Réinitialisation : la session repart de zéro.
  await page.getByRole("button", { name: "Paramètres" }).click()
  await parametres.getByRole("button", { name: "Nouvelle Simulation / Réinitialiser" }).click()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nouvelle Simulation")

  // Rechargement de la sauvegarde.
  await page.getByRole("button", { name: "Paramètres" }).click()
  await parametres.getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const chargement = page.getByRole("dialog", { name: "Charger une sauvegarde" })
  await chargement.getByText("Scénario Alice", { exact: true }).click()
  await expect(chargement).toBeHidden()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Scénario Alice")
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")
})

test("une sauvegarde existante est proposée au chargement et restaure toute la simulation", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionVide())
  await deposerSauvegardes(dossierDonnees, [{ ...sessionMicroBnc(), id: "slot-micro", lastModified: Date.UTC(2026, 8, 1) }])
  const { page, dialogues } = await lancer()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  await page.getByRole("dialog", { name: "Charger une sauvegarde" }).getByText("Micro BNC 30 000 €", { exact: true }).click()

  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Flux de décembre : Atelier Martin" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Comparateur de statuts" })).toBeVisible()
  // Fichiers déjà au format actuel : aucune conversion, donc aucune boîte de dialogue.
  expect(await dialogues()).toEqual([])
})
