// e2e/fichiers-abimes.e2e.ts
// Fichiers de données abîmés ou impossibles à écrire : copie gardée et message au démarrage, échec d'enregistrement
// signalé au lieu de « Sauvegarde réussie ! ».

import fs from "node:fs/promises"
import path from "node:path"
import type { SaveSlot } from "../src/types"
import { test, expect, deposerSession, lireFichier } from "./support/fixtures"
import { sessionAliceSeule } from "./support/sessions"

/** Fichiers du dossier de données dont le nom suit le motif. */
async function fichiers(dossierDonnees: string, motif: RegExp): Promise<string[]> {
  return (await fs.readdir(dossierDonnees)).filter(nom => motif.test(nom))
}

test("un fichier de sauvegardes tronqué est mis de côté, intact, et l'utilisateur est prévenu au démarrage", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  const tronque = '[{"id": "slot-1", "name": "Scénario précieux", "entities": [{"id": "pers'
  await fs.writeFile(path.join(dossierDonnees, "simulationSlots.json"), tronque)

  const { page, dialogues } = await lancer()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")

  // La copie porte la date et l'heure, et le message la nomme.
  const [copie] = await fichiers(dossierDonnees, /^simulationSlots\.illisible-\d{8}-\d{6}\.json$/)
  expect(copie).toBeDefined()
  expect(await fs.readFile(path.join(dossierDonnees, copie), "utf-8")).toBe(tronque)
  const messages = await dialogues()
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ title: "Sauvegardes illisibles", message: expect.stringContaining(copie) })

  // Une nouvelle sauvegarde est enregistrée dans un nouveau fichier ; la copie n'est pas touchée.
  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Nouvelle sauvegarde")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(page.getByText("Sauvegarde réussie !")).toBeVisible()
  await expect.poll(async () => (await lireFichier<SaveSlot[]>(dossierDonnees, "simulationSlots.json"))?.map(s => s.name)).toEqual(["Nouvelle sauvegarde"])
  expect(await fs.readFile(path.join(dossierDonnees, copie), "utf-8")).toBe(tronque)
})

test("une session illisible est mise de côté, et l'application démarre sur une simulation vierge", async ({ dossierDonnees, lancer }) => {
  await fs.writeFile(path.join(dossierDonnees, "sessionState.json"), '{"name": "Ma session", "entities": [')

  const { page, dialogues } = await lancer()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()

  const [copie] = await fichiers(dossierDonnees, /^sessionState\.illisible-\d{8}-\d{6}\.json$/)
  expect(copie).toBeDefined()
  const messages = await dialogues()
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ title: "Chargement échoué", message: expect.stringContaining(copie) })
})

test("des sauvegardes impossibles à écrire : message d'échec, et le panneau reste ouvert", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  // Un dossier à la place du fichier : il ne peut être ni lu ni remplacé.
  await fs.mkdir(path.join(dossierDonnees, "simulationSlots.json"))

  const { page, dialogues } = await lancer()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")
  expect((await dialogues())[0]).toMatchObject({ title: "Sauvegardes illisibles" })

  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()

  await expect(page.getByText("Échec de la sauvegarde : le fichier des sauvegardes n'a pas pu être écrit. Vos sauvegardes précédentes sont intactes.")).toBeVisible()
  await expect(page.getByText("Sauvegarde réussie !")).toHaveCount(0)
  await expect(parametres).toBeVisible()
})
