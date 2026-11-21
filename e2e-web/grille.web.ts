// e2e-web/grille.web.ts
// Une charge qui revient chaque mois, saisie dans la grille de la démo web : ajout sur toute l'année, hausse à
// partir de juillet, suppression sur toute l'année, puis annulation. Une modification ou un retrait vaut d'abord pour le
// mois ouvert ; la barre qui apparaît sous la ligne l'étend aux autres mois. Les totaux de la grille suivent chaque étape.

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

/** Après une modification ou un retrait, la barre propose de faire de même dans d'autres mois : on choisit. */
async function aussi(fenetre: Locator, choix: string) {
  const barre = fenetre.getByRole("group", { name: /aussi d'autres mois$/ })
  await expect(barre).toBeVisible()
  await barre.getByRole("button", { name: choix }).click()
  await expect(barre).toHaveCount(0)
}

/** Total des dépenses affiché dans une case : la seconde valeur, après celle des gains. */
const depensesDuMois = (page: Page, mois: string) => page.getByRole("button", { name: `Flux ${mois} : ${SOCIETE}` }).locator(".font-mono").nth(1)
/** La case du total annuel précède celle de janvier sur la ligne de la société. */
const depensesDeLAnnee = (page: Page) => page.getByRole("button", { name: `Flux de janvier : ${SOCIETE}` }).locator("xpath=preceding-sibling::div[1]").locator(".font-mono").nth(1)

test("une charge mensuelle ajoutée sur l'année, augmentée en juillet puis supprimée se retrouve d'une seule annulation", async ({ page }) => {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  // Les sorties de la société de l'exemple : 45 130 € sur l'année. Ses charges courantes, 3 130 € (expert-comptable 170 €
  // et banque 20 € par mois, assurance 400 € en janvier, CFE 450 € en décembre), la rémunération du dirigeant, 2 500 € par
  // mois, et les dividendes, 12 000 € en décembre.
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*45\s130$/)

  // Loyer du bureau de 400 € par mois, saisi en mars pour tous les mois de l'année.
  let fenetre = await ouvrirLeMois(page, "de mars")
  await fenetre.getByRole("combobox", { name: "Type de flux" }).last().click()
  await page.getByRole("option", { name: "Charge déductible" }).click()
  await fenetre.getByLabel("Ajouter à :").selectOption("annee")
  await fenetre.getByLabel("Libellé du nouveau flux").fill("Loyer du bureau")
  await fenetre.getByLabel("Montant du nouveau flux").fill("400")
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(page.getByText("Flux ajouté à ce mois et recopié sur 11 autres mois.")).toBeVisible()
  await terminer(fenetre)
  // 4 800 € de loyer de plus sur l'année ; janvier : 590 € de charges de l'exemple, 2 500 € de rémunération et 400 € de loyer.
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*49\s930$/)
  await expect(depensesDuMois(page, "de janvier")).toHaveText(/^\s*3\s490$/)

  // 450 € en juillet, puis à partir de juillet : le premier semestre ne change pas.
  fenetre = await ouvrirLeMois(page, "de juillet")
  const montant = fenetre.getByRole("textbox", { name: "Montant", exact: true }).last()
  await montant.fill("450")
  await montant.press("Enter")
  await aussi(fenetre, "juillet à décembre")
  await expect(page.getByText("Modifié aussi sur 5 autres mois.")).toBeVisible()
  await terminer(fenetre)
  // 5 100 € de loyer sur l'année ; en juin et en décembre, 190 € et 640 € de charges de l'exemple, 2 500 € de rémunération
  // et, en décembre, 12 000 € de dividendes.
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*50\s230$/)
  await expect(depensesDuMois(page, "de juin")).toHaveText(/^\s*3\s090$/)
  await expect(depensesDuMois(page, "de décembre")).toHaveText(/^\s*15\s590$/)

  // Suppression en décembre, puis sur toute l'année : les deux montants disparaissent ensemble.
  fenetre = await ouvrirLeMois(page, "de décembre")
  await fenetre.getByRole("button", { name: "Supprimer le flux" }).last().click()
  await aussi(fenetre, "toute l'année")
  await expect(page.getByText("Retiré aussi sur 11 autres mois.")).toBeVisible()
  await terminer(fenetre)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*45\s130$/)

  // Un flux à 0 € ne s'ajoute pas : la ligne d'ajout le refuse et dit comment retirer un flux.
  fenetre = await ouvrirLeMois(page, "de mars")
  const lignes = fenetre.getByRole("textbox", { name: "Libellé", exact: true })
  const avant = await lignes.count()
  await fenetre.getByLabel("Ajouter à :").selectOption("annee")
  await fenetre.getByLabel("Montant du nouveau flux").fill("0")
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(fenetre.getByRole("alert")).toContainText("Un flux à 0 € n'est pas ajouté.")
  await expect(lignes).toHaveCount(avant)
  await fenetre.getByLabel("Montant du nouveau flux").fill("")
  await terminer(fenetre)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*45\s130$/)
  // Le retrait de la série reste la dernière modification : c'est lui que l'annulation défait.

  // Une annulation rend les onze autres mois, avec leurs deux montants ; la suivante, décembre (450 €). En mars et
  // juillet, en plus du loyer, 190 € de charges et 2 500 € de rémunération.
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*49\s780$/)
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*50\s230$/)
  await expect(depensesDuMois(page, "de mars")).toHaveText(/^\s*3\s090$/)
  await expect(depensesDuMois(page, "de juillet")).toHaveText(/^\s*3\s140$/)
  // Juillet retrouve ses quatre flux de l'exemple (facturation, expert-comptable, banque, rémunération) et le loyer rétabli, sans doublon.
  const fenetreDeJuillet = await ouvrirLeMois(page, "de juillet")
  await expect(fenetreDeJuillet.getByRole("textbox", { name: "Libellé", exact: true })).toHaveCount(5)

  // Le loyer ramené à 0 € en juillet, puis sur toute l'année : la série est retirée, sans ligne à 0 € dans aucun mois.
  const loyer = fenetreDeJuillet.getByRole("textbox", { name: "Montant", exact: true }).last()
  await loyer.fill("0")
  await loyer.press("Enter")
  await expect(page.getByText("Montant à 0 € : le flux est retiré.")).toBeVisible()
  await aussi(fenetreDeJuillet, "toute l'année")
  // La notification de la première suppression peut être encore affichée : on regarde la dernière.
  await expect(page.getByText("Retiré aussi sur 11 autres mois.").last()).toBeVisible()
  await expect(fenetreDeJuillet.getByRole("textbox", { name: "Libellé", exact: true })).toHaveCount(4)
  await terminer(fenetreDeJuillet)
  await expect(depensesDeLAnnee(page)).toHaveText(/^\s*45\s130$/)
  const fenetreDeMars = await ouvrirLeMois(page, "de mars")
  await expect(fenetreDeMars.getByRole("textbox", { name: "Libellé", exact: true })).toHaveCount(avant)
})
