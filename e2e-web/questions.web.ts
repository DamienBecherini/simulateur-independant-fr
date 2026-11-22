// e2e-web/questions.web.ts
// Entrée par les questions (parcours utilisateur, P-02 et P-05) : « Par où commencer ? » au-dessus de l'exemple du
// premier lancement, sur l'onglet des questions ; une question qui charge sa situation type puis mène à la zone qui y
// répond, y compris dans l'affichage « Trois vues » ; le lien vers la situation, les filtres, la barre de résumé.
// Fermeture retenue, « Partir de zéro », téléphone, accessibilité.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

const bloc = (page: Page) => page.getByRole("region", { name: "Par où commencer ?" })
const barre = (page: Page) => page.getByRole("region", { name: "Résumé de l'année" })

/** Ouvre la démo à son premier lancement, sur la simulation d'exemple. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await expect(bloc(page)).toBeVisible()
}

/** Charge la situation d'une question : l'exemple non modifié est remplacé sans confirmation. */
async function choisir(page: Page, question: string, situation: string) {
  await bloc(page).getByRole("button", { name: `Charger la situation qui répond à « ${question} »` }).click()
  await expect(page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(situation)
}

test("le bloc s'affiche au-dessus de l'exemple, sur les questions ; une question charge sa situation et mène à la zone qui y répond", async ({ page }) => {
  await ouvrir(page)
  // Au-dessus de l'exemple : avant la barre de résumé et le contenu ; l'encadré de la démo reste visible.
  const avantLeContenu = await bloc(page).evaluate(element => Boolean(element.compareDocumentPosition(document.getElementById("contenu")!) & Node.DOCUMENT_POSITION_FOLLOWING))
  expect(avantLeContenu).toBe(true)
  await expect(page.getByRole("complementary", { name: "Démo web" })).toBeInViewport()
  await expect(bloc(page).getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")

  await choisir(page, "Le mariage ou le Pacs réduirait-il notre impôt ?", "Couple en union libre, puis marié ou pacsé")
  // La session n'est plus l'exemple : le bloc s'efface.
  await expect(bloc(page)).toHaveCount(0)
  // La zone qui répond : la comparaison du couple, à l'écran, avec le focus, signalée un instant.
  const zone = page.locator("#comparaison-du-couple")
  await expect(zone).toBeFocused({ timeout: 10_000 })
  await expect(zone).toBeInViewport()
  await expect(page.locator("[data-reperee]")).toHaveCount(1)
  await expect(page.locator("[data-reperee]")).toHaveCount(0, { timeout: 5000 })

  // La barre de résumé y mène aussi.
  const reponse = barre(page).getByRole("link", { name: /^Mariage ou Pacs/ })
  await expect(reponse).toContainText(/\+\d/)
})

test("dans l'affichage « Trois vues », une question sur le partage ouvre « Comparer et optimiser » sur « Rémunération ou dividendes ? »", async ({ page }) => {
  await choisirAvantLeChargement(page, "vues")
  await ouvrir(page)
  await choisir(page, "Où se situe le meilleur partage entre rémunération et dividendes ?", "SASU avec un salaire qui valide 4 trimestres")

  await expect(page.getByRole("tablist", { name: "Vues de la page" }).getByRole("tab", { name: /Comparer/ })).toHaveAttribute("aria-selected", "true", { timeout: 10_000 })
  await expect(page.locator("#optimisation-titre")).toBeFocused()
  await expect(page.locator("#optimisation-titre")).toBeInViewport()
})

test("le nom de la situation d'une question mène à sa carte, mise en avant ; « Retour aux questions »", async ({ page }) => {
  await ouvrir(page)
  await bloc(page).getByRole("button", { name: "Voir la situation « Kinésithérapeute conventionné en entreprise individuelle »" }).first().click()
  await expect(bloc(page).getByRole("tab", { name: /^Situations types/ })).toHaveAttribute("aria-selected", "true")
  await expect(bloc(page).getByRole("button", { name: "Charger la situation « Kinésithérapeute conventionné en entreprise individuelle »" })).toBeFocused()
  await bloc(page).getByRole("button", { name: "Retour aux questions" }).click()
  await expect(bloc(page).getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")
})

test("les filtres et la recherche réduisent les questions", async ({ page }) => {
  await ouvrir(page)
  await bloc(page).getByRole("group", { name: "Foyer" }).getByRole("button", { name: "En couple" }).click()
  await expect(bloc(page).getByText(/^\d+ questions sur 36$/)).toBeVisible()
  await bloc(page).getByRole("searchbox", { name: "Rechercher une question" }).fill("kine")
  await expect(bloc(page).getByText("Aucune question ne correspond.")).toBeVisible()
  await bloc(page).getByRole("button", { name: "Tout afficher" }).click()
  await expect(bloc(page).getByRole("list", { name: "Questions" }).getByRole("listitem")).toHaveCount(36)
})

test("le bloc fermé ne revient pas au rechargement ; la fenêtre reste à portée", async ({ page }) => {
  await ouvrir(page)
  await bloc(page).getByRole("button", { name: "Fermer « Par où commencer ? »" }).click()
  await expect(bloc(page)).toHaveCount(0)
  // Les préférences sont enregistrées peu après chaque changement.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.preferences"))).toContain('"questionsFermees":true')
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await expect(bloc(page)).toHaveCount(0)
  await page.getByRole("button", { name: "Situations types" }).click()
  await page.getByRole("dialog", { name: "Par où commencer ?" }).getByRole("tab", { name: /^Questions/ }).click()
  await expect(page.getByRole("dialog", { name: "Par où commencer ?" }).getByRole("list", { name: "Questions" }).getByRole("listitem")).toHaveCount(36)
})

test("un filtre ou une recherche anime la liste : les éléments qui restent glissent, les autres s'effacent", async ({ page }) => {
  await ouvrir(page)
  const liste = bloc(page).getByRole("list", { name: "Questions" })
  const animees = () => liste.evaluate(element => element.getAnimations({ subtree: true }).length)
  await bloc(page).getByRole("button", { name: "SASU", exact: true }).click()
  await expect.poll(animees).toBeGreaterThan(0)
  await expect.poll(animees).toBe(0)
  await bloc(page).getByRole("searchbox").fill("dividendes")
  await expect.poll(animees).toBeGreaterThan(0)
})

for (const ou of ["bloc", "fenêtre"] as const) {
  test(`le nom d'une situation mène à sa carte, montrée en entier, titre compris (${ou})`, async ({ page }) => {
    await ouvrir(page)
    let contenant = bloc(page)
    if (ou === "fenêtre") {
      await page.getByRole("button", { name: "Situations types", exact: true }).click()
      contenant = page.getByRole("dialog", { name: "Par où commencer ?" })
      await contenant.getByRole("tab", { name: /^Questions/ }).click()
    }
    const question = contenant.getByRole("listitem").filter({ hasText: "Que prend en charge l'Assurance maladie sur mes cotisations ?" })
    await question.getByRole("button", { name: /^Voir la situation/ }).click()
    const charger = page.locator(":focus")
    await expect(charger).toHaveAccessibleName(/^Charger la situation/)
    const titre = charger.locator("xpath=ancestor::li[1]").getByRole("heading", { level: 3 })
    // Le titre est visible dans chaque zone qui défile autour de lui, et dans la fenêtre du navigateur.
    const visible = await titre.evaluate(element => {
      const r = element.getBoundingClientRect()
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (!/auto|scroll/.test(getComputedStyle(parent).overflowY)) continue
        const c = parent.getBoundingClientRect()
        if (r.top < c.top || r.bottom > c.bottom) return false
      }
      return r.top >= 0 && r.bottom <= window.innerHeight
    })
    expect(visible).toBe(true)
  })
}

test("« Partir de zéro » remplace l'exemple sans confirmation, porte le focus sur l'ajout d'une personne, efface le bloc et montre où le retrouver", async ({ page }) => {
  await ouvrir(page)
  await bloc(page).getByRole("button", { name: "Partir de zéro" }).click()
  await expect(page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "+ Ajouter une personne" })).toBeFocused()
  // La page est tout en haut : le focus ne l'a pas fait défiler jusqu'au bouton.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page.getByRole("button", { name: "Annuler" })).toBeEnabled()
  // Le choix est fait : le bloc s'efface ; « Situations types », dans la barre d'outils, est signalé et nommé.
  await expect(bloc(page)).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Situations types", exact: true })).toHaveAttribute("data-reperee", "")
  await expect(page.getByText("Questions et situations types : bouton « Situations types » de la barre d'outils.")).toBeVisible()
  // L'effacement n'est pas retenu : au prochain lancement, sur la simulation vide, le bloc revient.
  await page.reload()
  await expect(bloc(page)).toBeVisible()
})

for (const theme of ["clair", "sombre"] as const) {
  test(`le bloc ne présente aucune violation WCAG, thème ${theme}`, async ({ page }) => {
    await ouvrir(page)
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await auditer(page, `Par où commencer, questions, ${theme}`, "#par-ou-commencer")
    await bloc(page).getByRole("tab", { name: /^Situations types/ }).click()
    await auditer(page, `Par où commencer, situations, ${theme}`, "#par-ou-commencer")
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  for (const police of POLICES) {
    test(`le bloc tient dans 375 px, sa liste défile, sans violation WCAG, ${police}`, async ({ page, context }) => {
      await choisirLaPolice(context, police)
      await ouvrir(page)
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(debordement).toBe(false)
      const liste = bloc(page).getByRole("list", { name: "Questions" })
      expect(await liste.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
      await auditer(page, `Par où commencer, 375 px, ${police}`, "#par-ou-commencer")
    })
  }

  test("« Partir de zéro » signale « Plus d'actions », où sont les situations types", async ({ page }) => {
    await ouvrir(page)
    await bloc(page).getByRole("button", { name: "Partir de zéro" }).click()
    await expect(bloc(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Plus d'actions" })).toHaveAttribute("data-reperee", "")
    await expect(page.getByText("Questions et situations types : menu « Plus d'actions », puis « Partir d'une situation type ».")).toBeVisible()
  })

  test("les réponses de la barre attendent qu'on la déplie, une fois la page défilée", async ({ page }) => {
    await ouvrir(page)
    await choisir(page, "Le mariage ou le Pacs réduirait-il notre impôt ?", "Couple en union libre, puis marié ou pacsé")
    const reponse = barre(page).getByRole("link", { name: /^Mariage ou Pacs/ })
    await expect(page.locator("#comparaison-du-couple")).toBeFocused({ timeout: 10_000 })
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect(page.locator("[data-barre-collante]")).toHaveAttribute("data-reduite", "true")
    await expect(reponse).toBeHidden()
    await barre(page).getByRole("button", { name: /^Taux et alertes/ }).click()
    await expect(reponse).toBeVisible()
  })
})
