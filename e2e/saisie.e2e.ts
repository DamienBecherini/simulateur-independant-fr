// e2e/saisie.e2e.ts
// Parcours de saisie complet, de la session vierge aux résultats, et annulation dans l'historique.

import { test, expect, deposerSession } from "./support/fixtures"
import { montant, netDansLaPoche, valeurDeLigne } from "./support/interface"
import { sessionAliceSeule } from "./support/sessions"

test("créer une personne et sa micro-entreprise, saisir un chiffre d'affaires, puis lire résultats et comparateur", async ({ lancer }) => {
  const { page } = await lancer()

  // Une personne, puis une micro-entreprise.
  await page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  await page.getByRole("button", { name: "+ Ajouter une Activité" }).click()
  await page.getByRole("dialog", { name: "Ajouter une activité" }).getByRole("button", { name: /Micro-Entreprise/ }).click()
  await expect(page.getByRole("textbox", { name: "Nom" })).toHaveCount(2)

  // La personne devient titulaire de la micro-entreprise : seul lien possible, il est retenu d'office.
  await page.getByRole("button", { name: "Relation", exact: true }).first().click()
  await page.getByRole("combobox", { name: "Avec qui" }).click()
  await page.getByRole("option", { name: "Ma Micro-Entreprise" }).click()
  await expect(page.getByText("Titulaire", { exact: true })).toHaveCount(2)

  // 30 000 € de chiffre d'affaires en janvier, saisis au clavier dans la fenêtre des flux.
  await page.getByRole("button", { name: "Flux de janvier : Ma Micro-Entreprise" }).click()
  const fenetreFlux = page.getByRole("dialog", { name: /Opérations de Janvier/ })
  await expect(fenetreFlux).toBeVisible()
  await fenetreFlux.getByRole("textbox", { name: "Montant du nouveau flux" }).click()
  await page.keyboard.type("30000")
  await page.keyboard.press("Enter")
  await expect(fenetreFlux.getByRole("button", { name: "Supprimer le flux" })).toHaveCount(1)
  await fenetreFlux.getByRole("button", { name: "Terminé" }).click()
  await expect(fenetreFlux).toBeHidden()

  // Résultats : le chiffre d'affaires saisi, et un net positif amputé des cotisations et de l'impôt.
  await expect(valeurDeLigne(page, "Chiffre d'affaires")).toHaveText(/^30\s000\s€/)
  await expect.poll(() => netDansLaPoche(page)).toBeGreaterThan(0)
  const net = await netDansLaPoche(page)
  expect(net).toBeLessThan(30_000)
  expect(montant(await valeurDeLigne(page, "Cotisations sociales").innerText())).toBeLessThan(0)

  // Le comparateur simule l'activité dans chaque statut.
  const comparateur = page.getByRole("region", { name: "Comparateur de statuts" })
  for (const statut of ["SASU", "EURL", "EI au réel", "Micro-entreprise", "Micro + versement libératoire"]) {
    await expect(comparateur.getByRole("columnheader", { name: statut })).toBeVisible()
  }
  await expect(comparateur.getByRole("columnheader", { name: "Micro-entreprise actuel" })).toBeVisible()
  // La colonne du statut actuel (micro, 4e colonne) reprend le net du bilan, diminué des frais de fonctionnement
  // que le comparateur ajoute dans chaque colonne.
  const cellule = (ligne: RegExp) => comparateur.getByRole("row", { name: ligne }).getByRole("cell").nth(3)
  await expect(cellule(/^Net dans la poche/)).not.toHaveText("")
  const fraisMicro = montant(await cellule(/^Frais de fonctionnement/).innerText())
  expect(fraisMicro).toBeGreaterThan(0)
  expect(montant(await cellule(/^Net dans la poche/).innerText())).toBe(net - fraisMicro)
})

test("Ctrl+Z annule la dernière modification et Ctrl+Y la rétablit", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionAliceSeule())
  const { page } = await lancer()

  const nom = page.getByRole("textbox", { name: "Nom" })
  await expect(nom).toHaveValue("Alice Martin")
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()

  await nom.fill("Alice Durand")
  await nom.press("Enter")
  await expect(nom).toHaveValue("Alice Durand")
  await expect(page.getByRole("button", { name: "Annuler" })).toBeEnabled()

  await page.keyboard.press("Control+z")
  await expect(nom).toHaveValue("Alice Martin")
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()

  await page.keyboard.press("Control+y")
  await expect(nom).toHaveValue("Alice Durand")
})
