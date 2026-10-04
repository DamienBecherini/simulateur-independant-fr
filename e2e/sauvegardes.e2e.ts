// e2e/sauvegardes.e2e.ts
// Sauvegardes nommées, depuis le panneau Paramètres.

import { FORMAT_VERSION_ACTUEL } from "../src/backend/logic/migrations"
import type { SaveSlot } from "../src/types"
import path from "node:path"
import { test, expect, choisirFichiers, deposerSauvegardes, deposerSession, lireFichier } from "./support/fixtures"
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
  await chargement.getByRole("button", { name: "Charger la sauvegarde « Scénario Alice »" }).click()
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
  await page.getByRole("dialog", { name: "Charger une sauvegarde" }).getByRole("button", { name: "Charger la sauvegarde « Micro BNC 30 000 € »" }).click()

  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Flux de décembre : Atelier Martin" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Comparateur de statuts" })).toBeVisible()
  // Fichiers déjà au format actuel : aucune conversion, donc aucune boîte de dialogue.
  expect(await dialogues()).toEqual([])
})

test("exporter toutes les sauvegardes dans un fichier, les supprimer, puis les retrouver en important ce fichier", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionVide())
  await deposerSauvegardes(dossierDonnees, [
    { ...sessionAliceSeule(), name: "Scénario Alice", id: "slot-alice", lastModified: Date.UTC(2026, 8, 1) },
    { ...sessionMicroBnc(), id: "slot-micro", lastModified: Date.UTC(2026, 8, 2) }
  ])
  const { electronApp, page } = await lancer()
  const cheminExport = path.join(dossierDonnees, "export-des-sauvegardes.json")
  await choisirFichiers(electronApp, { enregistrer: cheminExport, ouvrir: cheminExport })

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const liste = page.getByRole("dialog", { name: "Charger une sauvegarde" })
  const sauvegardes = liste.getByRole("button", { name: /^Charger la sauvegarde/ })
  await expect(sauvegardes).toHaveCount(2)

  // Export : un seul fichier, marqué de son type et du format actuel.
  await liste.getByRole("button", { name: "Exporter toutes les sauvegardes" }).click()
  await expect(page.getByText("2 sauvegardes exportées.")).toBeVisible()
  const fichier = await lireFichier<{ type: string; formatVersion: number; slots: SaveSlot[] }>(dossierDonnees, "export-des-sauvegardes.json")
  expect(fichier).toMatchObject({ type: "sauvegardes-simulateur", formatVersion: FORMAT_VERSION_ACTUEL })
  expect(fichier?.slots.map(slot => slot.name).sort()).toEqual(["Micro BNC 30 000 €", "Scénario Alice"])

  // Suppression des deux sauvegardes : il n'y a plus rien à exporter.
  await liste.getByRole("button", { name: "Supprimer la sauvegarde « Scénario Alice »" }).click()
  await liste.getByRole("button", { name: "Supprimer la sauvegarde « Micro BNC 30 000 € »" }).click()
  await expect(liste.getByText("Aucune sauvegarde trouvée.")).toBeVisible()
  await expect(liste.getByRole("button", { name: "Exporter toutes les sauvegardes" })).toBeDisabled()
  await expect.poll(() => lireFichier<SaveSlot[]>(dossierDonnees, "simulationSlots.json")).toEqual([])

  // Import : les deux sauvegardes reviennent, enregistrées sur le disque.
  await liste.getByRole("button", { name: "Importer des sauvegardes..." }).click()
  const bilan = page.getByRole("dialog", { name: "Import des sauvegardes" })
  await expect(bilan).toContainText("2 sauvegardes ajoutées à la fin de la liste.")
  await bilan.getByRole("button", { name: "OK" }).click()
  await expect(bilan).toBeHidden()
  await expect(sauvegardes).toHaveCount(2)
  await expect.poll(async () => (await lireFichier<FichierSauvegarde[]>(dossierDonnees, "simulationSlots.json"))?.map(s => [s.id, s.formatVersion]).sort()).toEqual([
    ["slot-alice", FORMAT_VERSION_ACTUEL],
    ["slot-micro", FORMAT_VERSION_ACTUEL]
  ])

  // Un second import du même fichier n'ajoute rien : les sauvegardes sont déjà là.
  await liste.getByRole("button", { name: "Importer des sauvegardes..." }).click()
  await expect(bilan).toContainText("2 sauvegardes déjà présentes, ignorées.")
  await bilan.getByRole("button", { name: "OK" }).click()
  await expect(sauvegardes).toHaveCount(2)

  // La sauvegarde importée se charge comme les autres.
  await liste.getByRole("button", { name: "Charger la sauvegarde « Micro BNC 30 000 € »" }).click()
  await expect(page.getByRole("button", { name: "Flux de décembre : Atelier Martin" })).toBeVisible()
})
