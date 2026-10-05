// e2e-web/reglages-comparateur.web.ts
// Les réglages du comparateur sont enregistrés avec la session : ils survivent au rechargement de la page, et une
// sauvegarde nommée les garde, puis les rend quand on la charge.

import { test, expect, type Page } from "@playwright/test"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
}

const activiteComparee = (page: Page) => page.getByRole("combobox", { name: "Activité comparée" })
const partDistribuee = (page: Page) => page.getByRole("slider", { name: "Part du bénéfice distribuable versée en dividendes" })
const cfeSasu = (page: Page) => page.getByRole("spinbutton", { name: "Cotisation foncière des entreprises (CFE), SASU", includeHidden: true })

/** Compare la SASU de l'exemple, en répartition personnalisée avec la moitié distribuée, et une CFE de 450 €. */
async function regler(page: Page) {
  await activiteComparee(page).click()
  await page.getByRole("option", { name: "Conseil SASU" }).click()
  await expect(activiteComparee(page)).toHaveText("Conseil SASU")
  await page.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).getByText("Sur mesure").click()
  await partDistribuee(page).focus()
  await page.keyboard.press("PageDown")
  await page.keyboard.press("PageDown")
  await expect(partDistribuee(page)).toHaveAttribute("aria-valuenow", "50")
  await page.locator("summary", { hasText: /^Frais de fonctionnement/ }).click()
  await cfeSasu(page).fill("450")
}

/** Les réglages faits par `regler` sont affichés. */
async function verifierLesReglages(page: Page) {
  await expect(activiteComparee(page)).toHaveText("Conseil SASU")
  await expect(page.getByRole("radio", { name: "Sur mesure" })).toBeChecked()
  await expect(partDistribuee(page)).toHaveAttribute("aria-valuenow", "50")
  // Repliés ou non, les frais saisis sont dans la page.
  await expect(cfeSasu(page)).toHaveValue("450")
}

test("les réglages du comparateur survivent au rechargement de la page", async ({ page }) => {
  await ouvrir(page)
  await regler(page)
  // La session est enregistrée dans le navigateur une seconde après la dernière modification.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.session") ?? "")).toContain('"cfe":450')

  await page.reload()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await verifierLesReglages(page)
})

test("une sauvegarde nommée garde les réglages du comparateur et les rend à son chargement", async ({ page }) => {
  await ouvrir(page)
  await regler(page)

  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Avec réglages")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()

  // D'autres réglages : une autre activité, au meilleur net.
  await activiteComparee(page).click()
  await page.getByRole("option", { name: "Atelier de Camille" }).click()
  await expect(activiteComparee(page)).toHaveText("Atelier de Camille")

  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Charger une sauvegarde..." }).click()
  await page.getByRole("dialog", { name: "Charger une sauvegarde" }).getByRole("button", { name: "Charger la sauvegarde « Avec réglages »" }).click()
  await expect(page.getByRole("dialog")).toBeHidden()

  await verifierLesReglages(page)
})
