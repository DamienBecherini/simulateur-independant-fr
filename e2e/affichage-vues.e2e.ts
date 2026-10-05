// e2e/affichage-vues.e2e.ts
// Affichage « Trois vues » dans l'application de bureau : l'adresse de la page change de fragment à chaque vue, sans
// couper les échanges avec le processus principal ; l'affichage choisi est retrouvé au lancement suivant.

import { test, expect, lireFichier } from "./support/fixtures"
import type { UserPreferences } from "../src/types"

test("les trois vues se parcourent, la simulation suit, et l'affichage est retrouvé au lancement suivant", async ({ dossierDonnees, lancer }) => {
  const premier = await lancer()
  const { page } = premier
  await page.getByRole("combobox", { name: /^Affichage :/ }).click()
  await page.getByRole("option", { name: "Trois vues" }).click()

  const onglets = page.getByRole("tablist", { name: "Vues de la page" })
  await expect(onglets.getByRole("tab", { name: "Ma situation" })).toHaveAttribute("aria-selected", "true")
  await onglets.getByRole("tab", { name: "Mes résultats" }).click()
  await expect(page.getByRole("heading", { name: "Résultats de simulation" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Acteurs de la Simulation" })).toBeHidden()
  expect(page.url()).toMatch(/index\.html#resultats$/)
  await expect(page).toHaveTitle(/^Mes résultats — /)

  // Une modification faite dans « Ma situation » est encore calculée par le processus principal, l'adresse ayant changé.
  await onglets.getByRole("tab", { name: "Ma situation" }).click()
  await page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
  const nom = page.getByRole("textbox", { name: "Nom" })
  await nom.fill("Bernard Petit")
  await nom.press("Enter")
  await onglets.getByRole("tab", { name: "Mes résultats" }).click()
  await expect(page.locator("#vue-resultats").getByText("Bernard Petit").first()).toBeVisible()

  // Retour arrière : la vue précédente.
  await page.goBack()
  await expect(onglets.getByRole("tab", { name: "Ma situation" })).toHaveAttribute("aria-selected", "true")
  expect(premier.erreursConsole).toEqual([])
  // La préférence est enregistrée peu après le choix, dans les préférences de l'utilisateur.
  await expect.poll(async () => (await lireFichier<UserPreferences>(dossierDonnees, "userPreferences.json"))?.affichage).toBe("vues")
  await premier.electronApp.close()

  const second = await lancer()
  await expect(second.page.getByRole("combobox", { name: "Affichage : Trois vues" })).toBeVisible()
  await expect(second.page.getByRole("tablist", { name: "Vues de la page" }).getByRole("tab", { name: "Ma situation" })).toHaveAttribute("aria-selected", "true")
  await expect(second.page.getByRole("textbox", { name: "Nom" })).toHaveValue("Bernard Petit")
})
