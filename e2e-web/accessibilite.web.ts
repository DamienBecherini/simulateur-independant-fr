// e2e-web/accessibilite.web.ts
// Audit automatique de l'accessibilité de la démo web avec axe-core, sur les critères WCAG 2.2 niveau AA
// (ceux que reprend le RGAA), dans plusieurs états de l'interface : chaque violation fait échouer le test.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement, deplierLeTableauDuComparateur } from "./support/affichage"
import { ajouterLesAnneesJusqua, ANNEE_DE_L_EXEMPLE, PREMIERE_ANNEE_FUTURE } from "./support/annees"

/** Ouvre la démo (affichage « Résumé », par défaut) et attend la simulation d'exemple, le comparateur et la courbe. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("button", { name: /^Voir le détail : taux/ })).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
}

/** Ouvre tout le tableau du comparateur et toutes les sections repliables, y compris les valeurs de la courbe. */
async function deplierLeComparateur(page: Page) {
  await deplierLeTableauDuComparateur(page)
  const sections = page.locator("details")
  const nombre = await sections.count()
  for (let i = 0; i < nombre; i++) {
    const section = sections.nth(i)
    if (!(await section.evaluate(element => (element as HTMLDetailsElement).open))) await section.locator("summary").click()
  }
  await expect(page.getByRole("table", { name: /Net du foyer selon la rémunération en/ })).toBeVisible()
}

test("la démo ne présente aucune violation WCAG au premier affichage", async ({ page }) => {
  await ouvrir(page)
  await auditer(page, "premier affichage")
})

test("le comparateur déplié, valeurs de la courbe comprises, ne présente aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await deplierLeComparateur(page)
  // La courbe parcourue au clavier affiche son info-bulle.
  await page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("status").filter({ hasText: "dans la poche du foyer" })).toBeVisible()
  await auditer(page, "comparateur déplié")
})

test("le thème sombre ne présente aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await deplierLeComparateur(page)
  await auditer(page, "thème sombre")
})

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("la démo ne présente aucune violation WCAG à 375 px de large", async ({ page }) => {
    await ouvrir(page)
    await auditer(page, "375 px, premier affichage")
    await deplierLeComparateur(page)
    await auditer(page, "375 px")
  })

  test("l'affichage classique ne présente aucune violation WCAG à 375 px de large", async ({ page }) => {
    await choisirAvantLeChargement(page, "classique")
    await page.goto("./")
    await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
    await auditer(page, "375 px, affichage classique")
  })
})

/** Ouvre chaque fenêtre de l'application et l'audite, dans le thème affiché. */
async function auditerLesFenetres(page: Page, theme: string) {
  const fenetre = page.getByRole("dialog")
  const fermer = async () => {
    await page.keyboard.press("Escape")
    await expect(fenetre).toBeHidden()
  }

  await page.getByRole("button", { name: "Paramètres" }).click()
  await expect(fenetre).toBeVisible()
  await auditer(page, `paramètres, ${theme}`, "[role=dialog]")
  // Une sauvegarde, pour auditer aussi la liste des sauvegardes et sa poignée de glisser-déposer.
  await fenetre.getByRole("button", { name: "Sauvegarder" }).click()
  await expect(fenetre).toBeHidden()
  await page.getByRole("button", { name: "Paramètres" }).click()
  await fenetre.getByRole("button", { name: "Charger une sauvegarde..." }).click()
  await expect(fenetre.getByRole("button", { name: /^Charger la sauvegarde/ })).toBeVisible()
  await auditer(page, `liste des sauvegardes, ${theme}`, "[role=dialog]")
  await fermer()

  await page.getByRole("button", { name: "Modifier les autres réglages" }).first().click()
  await expect(fenetre).toBeVisible()
  await fenetre.getByRole("button", { name: "Ajouter une relation" }).click()
  // Les champs des frais réels, dépliés, avec deux trajets.
  await fenetre.getByRole("switch", { name: "Comparer mes frais réels à la déduction de 10 %" }).click()
  await fenetre.getByRole("button", { name: "Ajouter un trajet" }).click()
  await expect(fenetre.getByRole("group", { name: "Trajet 2" }).getByLabel("Jours travaillés par an", { exact: true })).toBeVisible()
  await auditer(page, `réglages d'une entité, ${theme}`, "[role=dialog]")
  await fermer()

  await page.getByRole("button", { name: "Modifier les autres réglages" }).last().click()
  await fenetre.getByRole("switch", { name: "Déplacements avec une voiture personnelle" }).click()
  await expect(fenetre.getByLabel("Kilomètres professionnels par an", { exact: true })).toBeVisible()
  await auditer(page, `réglages d'une activité, ${theme}`, "[role=dialog]")
  await fermer()

  await page.getByRole("button", { name: "+ Ajouter une Activité" }).click()
  await expect(fenetre).toBeVisible()
  await auditer(page, `choix du type d'activité, ${theme}`, "[role=dialog]")
  await fermer()

  await page.getByRole("button", { name: /^Flux de janvier/ }).last().click()
  await expect(fenetre).toBeVisible()
  await auditer(page, `flux d'un mois, ${theme}`, "[role=dialog]")
  await fermer()

  // Affichage « Résumé » : la légende des flux, repliée, est d'abord dépliée.
  await page.locator("summary", { hasText: "Légende des flux" }).click()
  await page.getByRole("button", { name: "Gérer les couleurs" }).click()
  await expect(fenetre).toBeVisible()
  await auditer(page, `couleurs des flux, ${theme}`, "[role=dialog]")
  await fermer()
}

test("les fenêtres ne présentent aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await auditerLesFenetres(page, "thème clair")
})

test("les fenêtres ne présentent aucune violation WCAG en thème sombre", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditerLesFenetres(page, "thème sombre")
})

test("l'ajout d'une relation sur la carte d'une entité ne présente aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Relation", exact: true }).first().click()
  await expect(page.getByRole("combobox", { name: "Avec qui" })).toBeVisible()
  await auditer(page, "ajout d'une relation")
})

test("plusieurs années (sélecteur, synthèse, fenêtres d'ajout et de suppression) ne présentent aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await expect(page.getByRole("dialog", { name: "Ajouter une année" })).toBeVisible()
  await auditer(page, "ajout d'une année")
  await page.getByRole("button", { name: "Annuler" }).click()
  // Jusqu'à l'année qui suit l'année en cours, pour que l'avertissement des règles pas encore connues s'affiche.
  await ajouterLesAnneesJusqua(page, PREMIERE_ANNEE_FUTURE)
  await expect(page.getByText(new RegExp(`^Les règles de ${PREMIERE_ANNEE_FUTURE} ne sont pas encore connues`))).toBeVisible()
  await expect(page.getByRole("table", { name: /chaque année de la session/ })).toBeVisible()
  await auditer(page, "plusieurs années, avertissement et synthèse")
  // La fenêtre des flux propose alors les autres années ; cochée, l'une d'elles est mise en évidence et annoncée.
  await page.getByRole("button", { name: /^Flux de janvier/ }).last().click()
  await page.getByRole("dialog").getByRole("checkbox", { name: String(ANNEE_DE_L_EXEMPLE) }).check()
  await expect(page.getByRole("dialog").getByText(new RegExp(`au même mois en ${ANNEE_DE_L_EXEMPLE}`))).toBeVisible()
  await auditer(page, "fenêtre des flux, autre année cochée", "[role=dialog]")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
  await page.getByRole("button", { name: `Supprimer ${PREMIERE_ANNEE_FUTURE}` }).click()
  await expect(page.getByRole("dialog", { name: `Supprimer l'année ${PREMIERE_ANNEE_FUTURE} ?` })).toBeVisible()
  await auditer(page, "suppression d'une année")
})
