// e2e/preferences.e2e.ts
// Préférences retenues d'un lancement à l'autre (sauvegarde chargée, zoom), leur validation à la lecture, et la
// version de l'application écrite dans les fichiers.

import fs from "node:fs/promises"
import path from "node:path"
import type { SaveSlot, SessionState, UserPreferences } from "../src/types"
import { test, expect, deposerSession, lireFichier } from "./support/fixtures"
import { sessionAliceSeule } from "./support/sessions"

async function versionDuPaquet(): Promise<string> {
  return (JSON.parse(await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8")) as { version: string }).version
}

test("la sauvegarde chargée et le zoom sont retrouvés au lancement suivant", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  const premier = await lancer()
  await expect(premier.page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")

  await premier.page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = premier.page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Scénario Alice")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()
  await premier.page.getByRole("button", { name: "Zoom avant" }).click()

  // Les préférences sont enregistrées une seconde après la dernière modification : on attend le fichier.
  await expect.poll(async () => (await lireFichier<UserPreferences>(dossierDonnees, "userPreferences.json"))?.zoom).toBe(1.1)
  const sauvegardes = await lireFichier<SaveSlot[]>(dossierDonnees, "simulationSlots.json")
  expect((await lireFichier<UserPreferences>(dossierDonnees, "userPreferences.json"))?.loadedSlotId).toBe(sauvegardes?.[0].id)
  await premier.electronApp.close()

  const second = await lancer()
  await expect(second.page.getByRole("heading", { level: 1 })).toHaveText("Scénario Alice")
  await expect.poll(() => second.page.evaluate(() => document.body.style.zoom)).toBe("1.1")

  // La sauvegarde chargée est mise à jour, sans demander d'écraser une sauvegarde du même nom.
  await second.page.getByRole("button", { name: "Paramètres" }).click()
  await second.page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Sauvegarder" }).click()
  await expect(second.page.getByRole("dialog", { name: "Configuration" })).toBeHidden()
  await expect(second.page.getByRole("dialog", { name: "Écraser la sauvegarde existante ?" })).toHaveCount(0)
  await expect.poll(async () => (await lireFichier<SaveSlot[]>(dossierDonnees, "simulationSlots.json"))?.map(s => [s.id, s.lastModified > sauvegardes![0].lastModified])).toEqual([[sauvegardes![0].id, true]])
  expect(await second.dialogues()).toEqual([])
})

test("la session et les sauvegardes portent la version de l'application qui les écrit",async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, { ...sessionAliceSeule(), appVersion: "0.1.0" })
  const { page } = await lancer()
  const version = await versionDuPaquet()

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Sauvegarder" }).click()

  await expect.poll(async () => (await lireFichier<SaveSlot[]>(dossierDonnees, "simulationSlots.json"))?.map(s => s.appVersion)).toEqual([version])
  await page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.appVersion).toBe(version)
})

test("des préférences abîmées sont validées champ par champ, et un fichier illisible est gardé à côté", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  await fs.writeFile(path.join(dossierDonnees, "userPreferences.json"), JSON.stringify({ slotOrder: [], zoom: 1.2, affichage: "inconnu", loadedSlotId: 42 }))
  const premier = await lancer()
  await expect.poll(() => premier.page.evaluate(() => document.body.style.zoom)).toBe("1.2")
  await premier.electronApp.close()

  const illisible = "{ pas du json"
  await fs.writeFile(path.join(dossierDonnees, "userPreferences.json"), illisible)
  const second = await lancer()
  await expect(second.page.getByRole("textbox", { name: "Nom" })).toHaveValue("Alice Martin")
  await expect.poll(() => second.page.evaluate(() => document.body.style.zoom)).toBe("1")
  const [copie] = (await fs.readdir(dossierDonnees)).filter(nom => /^userPreferences\.illisible-\d{8}-\d{6}\.json$/.test(nom))
  expect(await fs.readFile(path.join(dossierDonnees, copie), "utf-8")).toBe(illisible)
  expect(await second.dialogues()).toEqual([])
})
