// e2e-web/questions.web.ts
// Entrée par les questions (parcours utilisateur, P-02 et P-05) : l'encart « Que voulez-vous savoir ? » au-dessus de
// l'exemple du premier lancement, une question qui charge sa situation type, puis la barre de résumé qui mène à la
// réponse, y compris dans l'affichage « Trois vues ». Fermeture retenue, téléphone, accessibilité.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

const encart = (page: Page) => page.getByRole("region", { name: "Que voulez-vous savoir ?" })
const barre = (page: Page) => page.getByRole("region", { name: "Résumé de l'année" })

/** Ouvre la démo à son premier lancement, sur la simulation d'exemple. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await expect(encart(page)).toBeVisible()
}

/** Choisit une question de l'encart et confirme le remplacement de l'exemple. */
async function choisir(page: Page, question: string, situation: string) {
  await encart(page).getByRole("button", { name: question }).click()
  const confirmation = page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
  await expect(confirmation).toContainText(`La situation « ${situation} » la remplacera`)
  await confirmation.getByRole("button", { name: "Remplacer" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(situation)
}

test("l'encart s'affiche au-dessus de l'exemple ; « Mariage ou Pacs ? » charge le couple, et la barre de résumé mène à la réponse", async ({ page }) => {
  await ouvrir(page)
  // Au-dessus de l'exemple : avant la barre de résumé et le contenu.
  const avantLeContenu = await encart(page).evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById("contenu")!) & Node.DOCUMENT_POSITION_FOLLOWING))
  expect(avantLeContenu).toBe(true)

  await choisir(page, "Mariage ou Pacs ?", "Couple en union libre, puis marié ou pacsé")
  // La session n'est plus l'exemple : l'encart s'efface.
  await expect(encart(page)).toHaveCount(0)

  const reponse = barre(page).getByRole("link", { name: /^Mariage ou Pacs/ })
  await expect(reponse).toContainText(/\+\d/)
  await reponse.click()
  const couple = page.getByRole("heading", { name: "Et si vous étiez mariés ou pacsés ?" })
  await expect(couple).toBeInViewport()
  await expect(page.getByText("Mariage et Pacs ont le même effet sur l'impôt sur le revenu")).toBeVisible()
  // La comparaison du couple passe avant la courbe de l'activité.
  const avantLaCourbe = await couple.evaluate(titre => Boolean(titre.compareDocumentPosition(document.getElementById("optimisation-titre")!) & Node.DOCUMENT_POSITION_FOLLOWING))
  expect(avantLaCourbe).toBe(true)
})

test("dans l'affichage « Trois vues », la rémunération optimale ouvre « Comparer et optimiser » sur la courbe", async ({ page }) => {
  await choisirAvantLeChargement(page, "vues")
  await ouvrir(page)
  await choisir(page, "Rémunération ou dividendes ?", "SASU avec un salaire qui valide 4 trimestres")

  const reponse = barre(page).getByRole("link", { name: /^Rémunération optimale/ })
  await expect(reponse).toBeVisible()
  await reponse.click()
  await expect(page.getByRole("tab", { name: /Comparer/ })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("heading", { name: "Rémunération ou dividendes ?" })).toBeFocused()
  await expect(page.getByRole("heading", { name: "Rémunération ou dividendes ?" })).toBeInViewport()
})

test("« Mes cotisations sont-elles justes ? » charge le kinésithérapeute au réel, dont la carte détaille les cotisations", async ({ page }) => {
  await ouvrir(page)
  await choisir(page, "Mes cotisations sont-elles justes ?", "Kinésithérapeute conventionné en entreprise individuelle")
  await page.getByRole("button", { name: /^Afficher le détail/ }).first().click()
  await expect(page.getByText("dont retraite complémentaire (CARPIMKO)")).toBeVisible()
})

test("l'encart fermé ne revient pas au rechargement", async ({ page }) => {
  await ouvrir(page)
  await encart(page).getByRole("button", { name: "Fermer « Que voulez-vous savoir ? »" }).click()
  await expect(encart(page)).toHaveCount(0)
  // Les préférences sont enregistrées peu après chaque changement.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.preferences"))).toContain('"questionsFermees":true')
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await expect(encart(page)).toHaveCount(0)
})

test("« Partir de zéro » remplace l'exemple après confirmation et porte le focus sur l'ajout d'une personne", async ({ page }) => {
  await ouvrir(page)
  await encart(page).getByRole("button", { name: "Partir de zéro" }).click()
  await page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" }).getByRole("button", { name: "Remplacer" }).click()
  await expect(page.getByRole("button", { name: "+ Ajouter une personne" })).toBeFocused()
  // Simulation vide : l'encart reste proposé.
  await expect(encart(page)).toBeVisible()
  await expect(page.getByRole("button", { name: "Annuler" })).toBeEnabled()
})

for (const theme of ["clair", "sombre"] as const) {
  test(`l'encart ne présente aucune violation WCAG, thème ${theme}`, async ({ page }) => {
    await ouvrir(page)
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await auditer(page, `encart des questions, ${theme}`, "#que-voulez-vous-savoir")
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  for (const police of POLICES) {
    test(`l'encart tient dans 375 px, sans violation WCAG, ${police}`, async ({ page, context }) => {
      await choisirLaPolice(context, police)
      await ouvrir(page)
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(debordement).toBe(false)
      // Deux colonnes de questions, sans leur précision (lue comme description).
      const question = encart(page).getByRole("button", { name: "Combien me restera-t-il ?" })
      await expect(question).toHaveAccessibleDescription("Une micro-entreprise seule : le net après cotisations et impôt.")
      await expect(encart(page).getByText("Une micro-entreprise seule : le net après cotisations et impôt.")).toBeHidden()
      await auditer(page, `encart des questions, 375 px, ${police}`, "#que-voulez-vous-savoir")
    })
  }

  test("les réponses de la barre attendent qu'on la déplie, une fois la page défilée", async ({ page }) => {
    await ouvrir(page)
    await choisir(page, "Mariage ou Pacs ?", "Couple en union libre, puis marié ou pacsé")
    const reponse = barre(page).getByRole("link", { name: /^Mariage ou Pacs/ })
    await expect(reponse).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect(page.locator("[data-barre-collante]")).toHaveAttribute("data-reduite", "true")
    await expect(reponse).toBeHidden()
    await barre(page).getByRole("button", { name: /^Taux et alertes/ }).click()
    await expect(reponse).toBeVisible()
  })
})
