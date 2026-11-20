// e2e-web/preferences.web.ts
// Préférences retenues par la démo web d'une visite à l'autre : la sauvegarde chargée, que « Sauvegarder » continue
// de mettre à jour, le zoom, et l'état d'une section repliable. Elles sont rangées dans les préférences du navigateur.

import { test, expect, type Page } from "@playwright/test"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
}

async function recharger(page: Page) {
  await page.reload()
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
}

/** Préférences stockées dans le navigateur. */
async function preferences(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}"))
}

test("la sauvegarde chargée reste celle que « Sauvegarder » met à jour, après un rechargement", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Scénario retenu")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()
  await expect.poll(async () => (await preferences(page)).loadedSlotId).toEqual(expect.stringMatching(/^slot-/))
  const sauvegarde = (await preferences(page)).loadedSlotId

  await recharger(page)
  expect((await preferences(page)).loadedSlotId).toBe(sauvegarde)

  // Sans sauvegarde chargée, le même nom demanderait d'écraser la sauvegarde existante : ici, elle est mise à jour.
  await page.getByRole("button", { name: "Paramètres" }).click()
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()
  await expect(page.getByRole("dialog", { name: "Écraser la sauvegarde existante ?" })).toHaveCount(0)

  await page.getByRole("button", { name: "Paramètres" }).click()
  await parametres.getByRole("button", { name: "Charger une sauvegarde..." }).click()
  await expect(page.getByRole("dialog", { name: "Charger une sauvegarde" }).getByRole("button", { name: /^Charger la sauvegarde/ })).toHaveCount(1)
})

test("une sauvegarde chargée puis supprimée est oubliée : « Sauvegarder » en crée une nouvelle", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Paramètres" }).click()
  const parametres = page.getByRole("dialog", { name: "Configuration" })
  await parametres.getByLabel("Nom de la simulation").fill("Éphémère")
  await parametres.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(parametres).toBeHidden()

  await page.getByRole("button", { name: "Paramètres" }).click()
  await parametres.getByRole("button", { name: "Charger une sauvegarde..." }).click()
  const liste = page.getByRole("dialog", { name: "Charger une sauvegarde" })
  await liste.getByRole("button", { name: "Supprimer la sauvegarde « Éphémère »" }).click()
  await expect(liste.getByText("Aucune sauvegarde trouvée.")).toBeVisible()
  await expect.poll(async () => (await preferences(page)).loadedSlotId).toBeUndefined()
})

test("le zoom choisi est retrouvé au rechargement", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Zoom avant" }).click()
  await page.getByRole("button", { name: "Zoom avant" }).click()
  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1.2")
  await expect.poll(async () => (await preferences(page)).zoom).toBe(1.2)

  await recharger(page)

  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1.2")
})

test("le niveau du zoom s'affiche dans la barre d'outils ; un clic dessus ou Ctrl+0 ramène l'interface à 100 %", async ({ page }) => {
  await ouvrir(page)
  const barre = page.getByRole("navigation", { name: "Barre d'outils" })
  const niveau = barre.getByRole("button", { name: /Revenir à 100 %/ })
  // À 100 %, rien de plus dans la barre : l'infobulle du bouton dit le niveau.
  await expect(niveau).toHaveCount(0)
  await expect(barre.getByRole("button", { name: "Zoom avant" })).toHaveAttribute("title", /^Agrandir l'interface\. Interface à 100\s%\.$/)

  await barre.getByRole("button", { name: "Zoom avant" }).click()
  await barre.getByRole("button", { name: "Zoom avant" }).click()
  await expect(niveau).toHaveText(/^120\s%$/)
  await expect(niveau).toHaveAttribute("title", "Revenir à 100 % (Ctrl+0)")
  await expect(barre.getByRole("button", { name: "Zoom avant" })).toHaveAttribute("title", /Interface à 120\s%\. Ctrl\+0 : revenir à 100 %\.$/)

  await niveau.click()
  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1")
  await expect(niveau).toHaveCount(0)

  // Au clavier, y compris depuis un champ de saisie : le zoom n'est pas une frappe.
  await barre.getByRole("button", { name: "Zoom avant" }).click()
  await expect(niveau).toHaveText(/^110\s%$/)
  await page.keyboard.press("Control+Digit0")
  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1")
  await expect.poll(async () => (await preferences(page)).zoom).toBe(1)
})

test("la légende des flux dépliée dans l'affichage « Résumé » l'est encore au rechargement, et se déplie toujours à l'impression", async ({ page }) => {
  await ouvrir(page)
  // « Résumé » est l'affichage par défaut.
  await expect(page.getByRole("combobox", { name: "Affichage : Résumé" })).toBeVisible()
  const legende = page.locator("details").filter({ has: page.locator("summary", { hasText: "Légende des flux" }) })
  await expect(legende).not.toHaveAttribute("open")

  await legende.locator("summary").click()
  await expect(legende).toHaveAttribute("open")
  await expect.poll(async () => (await preferences(page)).sectionsOuvertes).toEqual({ "legende-des-flux": true })

  await recharger(page)
  await expect(legende).toHaveAttribute("open")

  // Repliée à nouveau, elle le reste au rechargement ; l'impression la déplie sans changer ce qui est retenu.
  await legende.locator("summary").click()
  await expect(legende).not.toHaveAttribute("open")
  await expect.poll(async () => (await preferences(page)).sectionsOuvertes).toEqual({ "legende-des-flux": false })
  await page.emulateMedia({ media: "print" })
  // Le titre est celui de la section repliée ; son contenu (« Gains », « Dépenses ») n'est visible que dépliée.
  await expect(page.getByRole("heading", { name: "Gains" })).toBeVisible()
  await page.emulateMedia({ media: "screen" })
  await recharger(page)
  await expect(legende).not.toHaveAttribute("open")
})
