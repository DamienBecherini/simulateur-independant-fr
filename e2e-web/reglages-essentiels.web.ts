// e2e-web/reglages-essentiels.web.ts
// Réglages essentiels du comparateur, visibles dans tous les affichages sans rien déplier : l'activité comparée, le
// partage du bénéfice et la case « avec 4 trimestres de retraite », cochée d'office. Décochée, elle le reste après
// rechargement ; ce que coûtent les 4 trimestres est affiché. Accessibilité en clair et en sombre, et aucun
// défilement horizontal sur téléphone.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

type Affichage = "classique" | "resume" | "panneaux" | "vues"
const AFFICHAGES: Affichage[] = ["classique", "resume", "panneaux", "vues"]

/** Ouvre la démo dans l'affichage voulu, sur le comparateur (sa vue, dans l'affichage « Trois vues »). */
async function ouvrir(page: Page, affichage: Affichage) {
  await page.addInitScript(choix => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: choix })), affichage)
  await page.goto(affichage === "vues" ? "./#comparer" : "./")
  await expect(page.getByRole("heading", { name: "Comparateur de statuts" })).toBeVisible()
  // La comparaison est arrivée (sur téléphone, le tableau laisse la place aux cartes des statuts).
  await expect(page.locator("#comparateur-cout-retraite")).toBeVisible()
}

const caseRetraite = (page: Page) => page.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
const enTete = (page: Page, statut: string) => page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("columnheader", { name: new RegExp(`^${statut}`) })
const comparateur = "section[aria-labelledby=comparateur-titre]"

for (const affichage of AFFICHAGES) {
  test(`affichage ${affichage} : les réglages essentiels sont visibles sans rien déplier, 4 trimestres cochés d'office`, async ({ page }) => {
    await ouvrir(page, affichage)
    await expect(page.getByRole("combobox", { name: "Activité comparée" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" })).toBeVisible()
    await expect(page.getByRole("radio", { name: "Au meilleur net" })).toBeChecked()
    await expect(caseRetraite(page)).toBeVisible()
    await expect(caseRetraite(page)).toBeChecked()
    // Ce que coûtent les 4 trimestres : près de la case, et dans l'en-tête de la colonne SASU.
    await expect(caseRetraite(page)).toHaveAccessibleDescription(/^coût en net : SASU −[\d\s]+ €/)
    await expect(enTete(page, "SASU")).toContainText(/4 trimestres : −[\d\s]+ € de net/)
  })
}

test("décochée, la case des 4 trimestres le reste après rechargement, et la colonne revient au meilleur net", async ({ page }) => {
  await ouvrir(page, "resume")
  await expect(enTete(page, "SASU")).toContainText("avec 4 trimestres de retraite")
  await caseRetraite(page).uncheck()
  await expect(enTete(page, "SASU")).not.toContainText("avec 4 trimestres de retraite")
  // La session est enregistrée dans le navigateur peu après la dernière modification.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.session") ?? "")).toContain('"avecRetraite":false')

  await page.reload()
  await expect(enTete(page, "SASU")).toContainText("rémunération optimale")
  await expect(caseRetraite(page)).not.toBeChecked()
  await expect(enTete(page, "SASU")).not.toContainText("avec 4 trimestres de retraite")
  // Le coût reste dit, pour revenir sur ce choix en connaissance de cause.
  await expect(enTete(page, "SASU")).toContainText(/4 trimestres : −[\d\s]+ € de net/)
})

for (const affichage of ["classique", "resume"] as const) {
  test(`affichage ${affichage} : les réglages du comparateur ne présentent aucune violation WCAG, en clair et en sombre`, async ({ page }) => {
    await ouvrir(page, affichage)
    if (affichage === "resume") await page.getByText("Plus de réglages").click()
    await auditer(page, `réglages du comparateur, ${affichage}, thème clair`, comparateur)
    await page.getByRole("switch", { name: "Changer de thème" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await auditer(page, `réglages du comparateur, ${affichage}, thème sombre`, comparateur)
  })
}

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 800 }, hasTouch: true, isMobile: true })

    test("les réglages tiennent dans la largeur, dans tous les affichages", async ({ page, context }) => {
      for (const affichage of AFFICHAGES) {
        const onglet = await context.newPage()
        await ouvrir(onglet, affichage)
        await expect(caseRetraite(onglet)).toBeVisible()
        expect(await onglet.evaluate(() => document.documentElement.scrollWidth), `largeur de la page, ${affichage}`).toBeLessThanOrEqual(largeur)
        const reglages = await onglet.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).evaluate(e => e.getBoundingClientRect().right)
        expect(reglages).toBeLessThanOrEqual(largeur)
        await onglet.close()
      }
      await page.close()
    })

    test("les réglages ne présentent aucune violation WCAG", async ({ page }) => {
      await ouvrir(page, "resume")
      await auditer(page, `réglages du comparateur, ${largeur} px`, comparateur)
    })
  })
}
