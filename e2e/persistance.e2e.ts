// e2e/persistance.e2e.ts
// Sauvegarde automatique de la session en cours et conversion d'un fichier d'un format précédent.

import fs from "node:fs/promises"
import path from "node:path"
import { FORMAT_VERSION_ACTUEL } from "../src/backend/logic/migrations"
import type { SessionState } from "../src/types"
import { test, expect, lireFichier } from "./support/fixtures"
import { ALICE, ATELIER, grilleMensuelle } from "./support/sessions"

type FichierSession = SessionState & { formatVersion?: number }

test("la session est sauvegardée automatiquement et retrouvée au lancement suivant", async ({ dossierDonnees, lancer }) => {
  const premier = await lancer()
  await premier.page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  const nom = premier.page.getByRole("textbox", { name: "Nom" })
  await nom.fill("Bernard Petit")
  await nom.press("Enter")

  // La sauvegarde automatique part une seconde après la dernière modification : on attend le fichier.
  await expect
    .poll(async () => (await lireFichier<FichierSession>(dossierDonnees, "sessionState.json"))?.entities.map(e => e.name))
    .toEqual(["Bernard Petit"])
  const fichier = await lireFichier<FichierSession>(dossierDonnees, "sessionState.json")
  expect(fichier?.formatVersion).toBe(FORMAT_VERSION_ACTUEL)
  await premier.electronApp.close()

  const second = await lancer()
  await expect(second.page.getByRole("textbox", { name: "Nom" })).toHaveValue("Bernard Petit")
  expect(await second.dialogues()).toEqual([])
})

test("une modification faite juste avant la fermeture n'est pas perdue", async ({ lancer }) => {
  const premier = await lancer()
  await premier.page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  const nom = premier.page.getByRole("textbox", { name: "Nom" })
  await nom.fill("Claire Moreau")
  await nom.press("Enter")
  // Fermeture immédiate, avant la sauvegarde automatique différée d'une seconde.
  await premier.electronApp.close()

  const second = await lancer()
  await expect(second.page.getByRole("textbox", { name: "Nom" })).toHaveValue("Claire Moreau")
})

test("une session au format 1 est convertie au format actuel, après copie de l'original", async ({ dossierDonnees, lancer }) => {
  // Format 1 : pas de numéro de format. Une EURL, dont la conversion appelle un point à vérifier.
  const ancienneSession = {
    name: "Session d'avant le versionnage",
    entities: [ALICE, { id: "company-eurl", type: "company", name: "Mon EURL", legalStatus: "EURL", avatar: { type: "icon", value: "Building", color: "#22c55e" }, locked: false }],
    relationships: [{ id: "rel-gerant", fromId: ALICE.id, toId: "company-eurl", type: "Gérant" }],
    monthlyData: grilleMensuelle()
  }
  const contenuOriginal = JSON.stringify(ancienneSession, null, 2)
  await fs.writeFile(path.join(dossierDonnees, "sessionState.json"), contenuOriginal)

  const { page, dialogues } = await lancer()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)
  await expect(page.getByText("Gérant", { exact: true })).toHaveCount(2)

  // L'original est conservé tel quel à côté, et le fichier est réécrit au format actuel.
  expect(await fs.readFile(path.join(dossierDonnees, "sessionState.format-1.json"), "utf-8")).toBe(contenuOriginal)
  const converti = await lireFichier<FichierSession>(dossierDonnees, "sessionState.json")
  expect(converti?.formatVersion).toBe(FORMAT_VERSION_ACTUEL)
  expect(converti?.entities.find(e => e.type === "company")).toMatchObject({ name: "Mon EURL", capitalSocial: 1000 })

  // L'utilisateur est informé de la conversion par une boîte de dialogue (interceptée pendant les tests).
  const messages = await dialogues()
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ title: "Chargement de la session", message: expect.stringContaining("convertie au nouveau format") })
  expect(messages[0].message).toContain("capital social des EURL")
})

test("une session au format 2 devient une session d'une année, 2026, après copie de l'original", async ({ dossierDonnees, lancer }) => {
  // Format 2 : une seule grille, sans année. Alice et sa micro-entreprise, avec 2 500 € de chiffre d'affaires en janvier.
  const ancienneSession = {
    formatVersion: 2,
    name: "Session d'une année",
    entities: [ALICE, ATELIER],
    relationships: [{ id: "rel-titulaire", fromId: ALICE.id, toId: ATELIER.id, type: "Titulaire" }],
    monthlyData: grilleMensuelle([{ mois: 0, flux: { id: "flow-ca", entityId: ATELIER.id, type: "ca_micro_services_bnc", label: "Prestations", amount: 2500 } }])
  }
  const contenuOriginal = JSON.stringify(ancienneSession, null, 2)
  await fs.writeFile(path.join(dossierDonnees, "sessionState.json"), contenuOriginal)

  const { page, dialogues } = await lancer()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)

  // L'original est gardé à côté ; le fichier réécrit place la grille dans l'année 2026.
  expect(await fs.readFile(path.join(dossierDonnees, "sessionState.format-2.json"), "utf-8")).toBe(contenuOriginal)
  const converti = await lireFichier<FichierSession & { monthlyData?: unknown }>(dossierDonnees, "sessionState.json")
  expect(converti?.formatVersion).toBe(3)
  expect(converti?.monthlyData).toBeUndefined()
  expect(converti?.annees.map(a => a.annee)).toEqual([2026])
  expect(converti?.annees[0].monthlyData[0].flows).toEqual([expect.objectContaining({ id: "flow-ca", amount: 2500 })])

  // Les résultats de 2026 sont calculés sur cette grille.
  const carteActivite = page.getByRole("article").filter({ hasText: ATELIER.name })
  await expect(carteActivite).toContainText(/2\s500\s€/)

  const messages = await dialogues()
  expect(messages).toHaveLength(1)
  expect(messages[0].message).toContain("votre grille a été placée en 2026")
})
