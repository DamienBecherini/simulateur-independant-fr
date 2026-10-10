// e2e-web/reglages-essentiels.web.ts
// Réglages essentiels du comparateur, visibles dans tous les affichages sans rien déplier : l'activité comparée et
// les cinq modes de partage du bénéfice sur une ligne, la phrase du mode choisi, la case « avec 4 trimestres de
// retraite », cochée d'office. Décochée, elle le reste après rechargement ; ce que coûtent les 4 trimestres est
// affiché. La rémunération saisie se règle aussi au curseur ; les frais de fonctionnement s'ouvrent d'un clic.
// Accessibilité en clair et en sombre, et aucun défilement horizontal sur téléphone.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirLaPolice, POLICES } from "./support/police"

type Affichage = "resume" | "classique" | "vues"
const AFFICHAGES: Affichage[] = ["resume", "classique", "vues"]

/** Ouvre la démo dans l'affichage voulu, sur le comparateur (sa vue, dans l'affichage « Trois vues »). */
async function ouvrir(page: Page, affichage: Affichage) {
  await page.addInitScript(choix => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: choix })), affichage)
  await page.goto(affichage === "vues" ? "./#comparer" : "./")
  await expect(page.getByRole("heading", { name: "Comparateur de statuts" })).toBeVisible()
  // La comparaison est arrivée (sur téléphone, le tableau laisse la place aux cartes des statuts).
  await expect(page.locator("#comparateur-cout-retraite")).toBeVisible()
}

const caseRetraite = (page: Page) => page.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" })
const modes = (page: Page) => page.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).locator("label")
const sectionDesFrais = (page: Page) => page.locator("summary", { hasText: /^Frais de fonctionnement/ })
const curseur = (page: Page) => page.getByRole("slider", { name: "Régler la rémunération nette annuelle" })
const champ = (page: Page) => page.getByLabel("Rémunération nette annuelle (SASU, EURL)")
/** Le net dans la poche de la colonne SASU. */
const netSasu = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("row", { name: /^Net dans la poche/ }).getByRole("cell").first()
/** Lignes occupées par les boutons des modes : leurs hauteurs distinctes. */
const lignesDesModes = (page: Page) => modes(page).evaluateAll(labels => new Set(labels.map(label => Math.round(label.getBoundingClientRect().top))).size)
const enTete = (page: Page, statut: string) => page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("columnheader", { name: new RegExp(`^${statut}`) })
const comparateur = "section[aria-labelledby=comparateur-titre]"

for (const affichage of AFFICHAGES) {
  test(`affichage ${affichage} : les réglages essentiels sont visibles sans rien déplier, 4 trimestres cochés d'office`, async ({ page }) => {
    await ouvrir(page, affichage)
    await expect(page.getByRole("combobox", { name: "Activité comparée" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" })).toBeVisible()
    await expect(page.getByRole("radio", { name: "Meilleur net" })).toBeChecked()
    await expect(page.locator("#comparateur-mode-choisi")).toHaveText("Chaque société verse la rémunération qui donne le meilleur net parmi celles qui valident 4 trimestres de retraite, le reste en dividendes.")
    await expect(caseRetraite(page)).toBeVisible()
    await expect(caseRetraite(page)).toBeChecked()
    // Ce que coûtent les 4 trimestres : près de la case, et dans l'en-tête de la colonne SASU.
    await expect(caseRetraite(page)).toHaveAccessibleDescription(/^coût en net : SASU −[\d\s]+\s€/)
    await expect(enTete(page, "SASU")).toContainText(/4 trimestres : −[\d\s]+\s€ de net/)
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
  await expect(enTete(page, "SASU")).toContainText(/4 trimestres : −[\d\s]+\s€ de net/)
})

for (const affichage of ["classique", "resume"] as const) {
  test(`affichage ${affichage} : les réglages du comparateur ne présentent aucune violation WCAG, en clair et en sombre`, async ({ page }) => {
    await ouvrir(page, affichage)
    await sectionDesFrais(page).click()
    await auditer(page, `réglages du comparateur, ${affichage}, thème clair`, comparateur)
    await page.getByRole("radio", { name: "Ma rémunération" }).check({ force: true })
    await expect(curseur(page)).toBeVisible()
    await auditer(page, `réglages du comparateur et curseur, ${affichage}, thème clair`, comparateur)
    await page.getByRole("switch", { name: "Changer de thème" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await auditer(page, `réglages du comparateur et curseur, ${affichage}, thème sombre`, comparateur)
    await page.getByRole("radio", { name: "Meilleur net" }).check({ force: true })
    await auditer(page, `réglages du comparateur, ${affichage}, thème sombre`, comparateur)
  })

  test(`affichage ${affichage} : les modes sont sur la ligne de l'activité, et la phrase suit le mode choisi`, async ({ page }) => {
    await ouvrir(page, affichage)
    await expect(modes(page)).toHaveText(["Meilleur net", "Ma rémunération", "Tout en rémunération", "Sur mesure", "Selon la grille"])
    expect(await lignesDesModes(page)).toBe(1)
    // Les boutons et la liste des activités partagent la même ligne.
    const activite = (await page.getByRole("combobox", { name: "Activité comparée" }).boundingBox())!
    const boutons = (await modes(page).first().boundingBox())!
    expect(boutons.y + boutons.height / 2).toBeGreaterThan(activite.y)
    expect(boutons.y + boutons.height / 2).toBeLessThan(activite.y + activite.height)
    await page.getByRole("radio", { name: "Selon la grille" }).check({ force: true })
    await expect(page.locator("#comparateur-mode-choisi")).toHaveText("Les rémunérations et dividendes saisis dans la grille.")
  })

  test(`affichage ${affichage} : un seul clic ouvre les frais de fonctionnement, et la section le reste après rechargement`, async ({ page }) => {
    await ouvrir(page, affichage)
    const frais = page.getByRole("table", { name: "Frais de fonctionnement annuels" })
    await expect(frais).toBeHidden()
    await sectionDesFrais(page).click()
    await expect(frais).toBeVisible()
    // Chaque colonne est calée à droite : en-tête, champs de saisie et total finissent au même endroit.
    const bords = await frais.evaluate(table => {
      const droite = (el: Element) => el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight)
      const lignes = Array.from(table.querySelectorAll("tr"))
      const colonnes = (ligne: Element, selecteur: string) => Array.from(ligne.querySelectorAll(selecteur)).map(droite)
      return { entete: colonnes(lignes[0], "th").slice(1), champs: Array.from(lignes[1].querySelectorAll("input")).map(el => el.getBoundingClientRect().right), total: colonnes(lignes[lignes.length - 1], "td") }
    })
    bords.entete.forEach((bord, i) => {
      expect(Math.abs(bords.champs[i] - bord)).toBeLessThan(1.5)
      expect(Math.abs(bords.total[i] - bord)).toBeLessThan(1.5)
    })
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.preferences") ?? "")).toContain('"comparateur-plus-de-reglages":true')
    // Un nouvel onglet relit les préférences enregistrées (celui-ci les réécrit à chaque chargement).
    const autre = await page.context().newPage()
    await autre.goto("./")
    await expect(autre.getByRole("table", { name: "Frais de fonctionnement annuels" })).toBeVisible()
    await autre.close()
  })

  test(`affichage ${affichage} : faire glisser le curseur de rémunération règle la colonne SASU`, async ({ page }) => {
    await ouvrir(page, affichage)
    await page.getByRole("radio", { name: "Ma rémunération" }).check({ force: true })
    await expect(curseur(page)).toBeVisible()
    const maximum = Number(await curseur(page).getAttribute("aria-valuemax"))
    expect(maximum).toBeGreaterThan(0)
    await expect(page.locator("#comparateur-remuneration-plafond")).toHaveText(/^jusqu'à [\d\s]+\s€ en SASU sans déficit$/)
    await expect(netSasu(page)).toBeVisible()
    const avant = await netSasu(page).textContent()

    const piste = (await curseur(page).locator("..").boundingBox())!
    await page.mouse.move(piste.x + 2, piste.y + piste.height / 2)
    await page.mouse.down()
    await page.mouse.move(piste.x + piste.width * 0.5, piste.y + piste.height / 2, { steps: 8 })
    // Pendant le glissement, le champ suit la poignée, par pas de 100 €.
    await expect.poll(async () => Number(await champ(page).inputValue())).toBeGreaterThan(0)
    await page.mouse.up()
    const valeur = Number(await champ(page).inputValue())
    expect(valeur % 100).toBe(0)
    expect(Math.abs(valeur - maximum / 2)).toBeLessThanOrEqual(maximum * 0.05)
    await expect(curseur(page)).toHaveAttribute("aria-valuenow", String(valeur))
    await expect(netSasu(page)).not.toHaveText(avant!)
  })

  test(`affichage ${affichage} : une rémunération saisie au-delà du maximum est acceptée, et le déficit signalé`, async ({ page }) => {
    await ouvrir(page, affichage)
    await page.getByRole("radio", { name: "Ma rémunération" }).check({ force: true })
    const maximum = Number(await curseur(page).getAttribute("aria-valuemax"))
    await champ(page).fill(String(maximum + 20000))
    await expect(curseur(page)).toHaveAttribute("aria-valuenow", String(maximum))
    await expect(curseur(page)).toHaveAttribute("aria-valuetext", /au-delà des/)
    await expect(page.getByText(/La société est déficitaire/).first()).toBeVisible()
    await expect(champ(page)).toHaveValue(String(maximum + 20000))
  })
}

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 800 }, hasTouch: true, isMobile: true })

    for (const police of POLICES) {
      test(`les réglages tiennent dans la largeur, dans tous les affichages, ${police}`, async ({ page, context }) => {
        await choisirLaPolice(context, police)
        for (const affichage of AFFICHAGES) {
          const onglet = await context.newPage()
          await ouvrir(onglet, affichage)
          await expect(caseRetraite(onglet)).toBeVisible()
          expect(await onglet.evaluate(() => document.documentElement.scrollWidth), `largeur de la page, ${affichage}`).toBeLessThanOrEqual(largeur)
          const reglages = await onglet.getByRole("group", { name: "Bénéfice de la société (SASU, EURL)" }).evaluate(e => e.getBoundingClientRect().right)
          expect(reglages).toBeLessThanOrEqual(largeur)
          // Les cinq modes tiennent en deux lignes à 375 px, en trois au plus à 320 px.
          expect(await lignesDesModes(onglet), `lignes des modes, ${affichage}`).toBeLessThanOrEqual(largeur >= 375 ? 2 : 3)
          await onglet.getByRole("radio", { name: "Sur mesure" }).check({ force: true })
          await expect(curseur(onglet)).toBeVisible()
          expect(await onglet.evaluate(() => document.documentElement.scrollWidth), `largeur de la page avec le curseur, ${affichage}`).toBeLessThanOrEqual(largeur)
          await onglet.close()
        }
        await page.close()
      })
    }

    test("les réglages ne présentent aucune violation WCAG", async ({ page }) => {
      await ouvrir(page, "resume")
      await auditer(page, `réglages du comparateur, ${largeur} px`, comparateur)
    })
  })
}
