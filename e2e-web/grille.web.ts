// e2e-web/grille.web.ts
// Une charge qui revient chaque mois, saisie dans la grille de la démo web : ajout sur toute l'année, hausse à
// partir de juillet, suppression sur toute l'année, puis annulation. Les totaux de la grille suivent chaque étape.

import { test, expect, type Locator, type Page } from "@playwright/test"

const SOCIETE = "Conseil SASU"

/** Ouvre la case d'un mois de la société et renvoie sa fenêtre des flux. */
async function ouvrirLeMois(page: Page, mois: string): Promise<Locator> {
  await page.getByRole("button", { name: `Flux ${mois} : ${SOCIETE}` }).click()
  const fenetre = page.getByRole("dialog", { name: new RegExp(`^Opérations de .* / ${SOCIETE}$`) })
  await expect(fenetre).toBeVisible()
  return fenetre
}

async function terminer(fenetre: Locator) {
  await fenetre.getByRole("button", { name: "Terminé" }).click()
  await expect(fenetre).toBeHidden()
}

/** Total des dépenses affiché dans une case : la seconde valeur, après celle des gains. */
const depensesDuMois = (page: Page, mois: string) => page.getByRole("button", { name: `Flux ${mois} : ${SOCIETE}` }).locator(".font-mono").nth(1)
/** La case du total annuel précède celle de janvier sur la ligne de la société. */
const depensesDeLAnnee = (page: Page) => page.getByRole("button", { name: `Flux de janvier : ${SOCIETE}` }).locator("xpath=preceding-sibling::div[1]").locator(".font-mono").nth(1)

test("une charge mensuelle ajoutée sur l'année, augmentée en juillet puis supprimée se retrouve d'une seule annulation", async ({ page }) => {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  // La société de l'exemple n'a aucune charge : ses cases de dépenses sont à zéro.
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*0$/)

  // Loyer du bureau de 400 € par mois, saisi en mars pour tous les mois de l'année.
  let fenetre = await ouvrirLeMois(page, "de mars")
  await fenetre.getByRole("combobox", { name: "Type de flux" }).last().click()
  await page.getByRole("option", { name: "Charge déductible" }).click()
  await fenetre.getByLabel("Appliquer à :").selectOption("annee")
  await fenetre.getByLabel("Libellé du nouveau flux").fill("Loyer du bureau")
  await fenetre.getByLabel("Montant du nouveau flux").fill("400")
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(page.getByText("Flux ajouté à ce mois et recopié sur 11 autres mois.")).toBeVisible()
  await terminer(fenetre)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*4\s800$/)
  await expect(depensesDuMois(page, "de janvier")).toHaveText(/^\s*400$/)

  // 450 € à partir de juillet : le premier semestre ne change pas.
  fenetre = await ouvrirLeMois(page, "de juillet")
  await fenetre.getByLabel("Appliquer à :").selectOption("suivants")
  const montant = fenetre.getByRole("textbox", { name: "Montant", exact: true }).last()
  await montant.fill("450")
  await montant.press("Enter")
  await expect(page.getByText("Modifié aussi sur 5 autres mois.")).toBeVisible()
  await terminer(fenetre)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*5\s100$/)
  await expect(depensesDuMois(page, "de juin")).toHaveText(/^\s*400$/)
  await expect(depensesDuMois(page, "de décembre")).toHaveText(/^\s*450$/)

  // Suppression depuis décembre, sur toute l'année : les deux montants disparaissent ensemble.
  fenetre = await ouvrirLeMois(page, "de décembre")
  await fenetre.getByLabel("Appliquer à :").selectOption("annee")
  await fenetre.getByRole("button", { name: "Supprimer le flux" }).last().click()
  await expect(page.getByText("Supprimé aussi sur 11 autres mois.")).toBeVisible()
  await terminer(fenetre)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*0$/)

  // Une seule annulation rend toute la série, avec ses deux montants.
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*5\s100$/)
  await expect(depensesDuMois(page, "de mars")).toHaveText(/^\s*400$/)
  await expect(depensesDuMois(page, "de juillet")).toHaveText(/^\s*450$/)
  // Juillet retrouve ses deux flux de l'exemple et le loyer rétabli, sans doublon.
  const fenetreDeJuillet = await ouvrirLeMois(page, "de juillet")
  await expect(fenetreDeJuillet.getByRole("textbox", { name: "Libellé", exact: true })).toHaveCount(3)
})
