// e2e-web/situation-par-l-adresse.web.ts
// L'adresse d'une situation type (#situation=<identifiant>), lien qu'une page extérieure peut publier (« Ouvrir cet
// exemple dans le simulateur ») : chargement direct depuis une première visite, confirmation sur une simulation non
// enregistrée (refus, acceptation, annulation), identifiant inconnu, et « Copier le lien » dans la fenêtre des
// situations types. Une fois lu, le fragment quitte l'adresse : un rechargement garde le travail en cours.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const EXEMPLE = "Famille Martin, simulation 2026"
const UNION_LIBRE = "Couple en union libre, puis marié ou pacsé"
const MICRO = "Micro-entreprise seule (BNC)"

const titre = (page: Page) => page.getByRole("heading", { level: 1 })
const confirmation = (page: Page) => page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
const fragment = (page: Page) => page.evaluate(() => window.location.hash)

/** Ouvre la démo à une adresse, comme un lien suivi depuis une autre page. */
async function suivreLeLien(page: Page, adresse: string) {
  await page.goto(`./${adresse}`)
}

test("depuis une première visite, le lien charge la situation à la place de l'exemple, sans question, et un rechargement la garde", async ({ page }) => {
  await suivreLeLien(page, "#situation=couple-union-libre")

  await expect(titre(page)).toHaveText(UNION_LIBRE)
  await expect(confirmation(page)).toHaveCount(0)
  await expect.poll(() => fragment(page)).toBe("")
  // La situation chargée, l'encart des questions de départ s'efface.
  await expect(page.getByRole("region", { name: "Que voulez-vous savoir ?" })).toHaveCount(0)

  // Un rechargement garde la situation, sans la recharger (le fragment n'est plus là).
  await page.reload()
  await expect(titre(page)).toHaveText(UNION_LIBRE)
  await expect(confirmation(page)).toHaveCount(0)
})

test("le chargement par l'adresse s'annule en une étape", async ({ page }) => {
  await suivreLeLien(page, "#situation=couple-union-libre")
  await expect(titre(page)).toHaveText(UNION_LIBRE)
  await page.getByRole("button", { name: "Annuler" }).click()
  await expect(titre(page)).toHaveText(EXEMPLE)
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()
})

test("sur une simulation non enregistrée, la confirmation de la fenêtre des situations types : refus, puis acceptation et annulation", async ({ page }) => {
  // Une situation chargée puis gardée : elle n'est enregistrée dans aucune sauvegarde.
  await suivreLeLien(page, "#situation=micro-bnc-seule")
  await expect(titre(page)).toHaveText(MICRO)

  // Le lien suivi à l'ouverture de la page : la confirmation, refusée.
  await page.evaluate(() => window.history.replaceState(null, "", `${window.location.pathname}#situation=couple-union-libre`))
  await page.reload()
  await expect(confirmation(page)).toContainText(`« ${MICRO} » n'est pas enregistrée dans une sauvegarde. La situation « ${UNION_LIBRE} » la remplacera`)
  await expect.poll(() => fragment(page)).toBe("")
  await confirmation(page).getByRole("button", { name: "Annuler" }).click()
  await expect(confirmation(page)).toHaveCount(0)
  await expect(titre(page)).toHaveText(MICRO)
  await page.reload()
  await expect(titre(page)).toHaveText(MICRO)
  await expect(confirmation(page)).toHaveCount(0)

  // Le lien suivi en cours de route : la confirmation, acceptée ; « Annuler » de la barre d'outils rétablit la simulation.
  await page.evaluate(() => {
    window.location.hash = "#situation=couple-union-libre"
  })
  await confirmation(page).getByRole("button", { name: "Remplacer" }).click()
  await expect(titre(page)).toHaveText(UNION_LIBRE)
  await expect.poll(() => fragment(page)).toBe("")
  await page.getByRole("button", { name: "Annuler" }).click()
  await expect(titre(page)).toHaveText(MICRO)
})

test("un identifiant inconnu ne change rien et le dit discrètement, avec l'accès aux situations types", async ({ page }) => {
  await suivreLeLien(page, "#situation=inconnue")
  await expect(titre(page)).toHaveText(EXEMPLE)
  const message = page.getByRole("status").filter({ hasText: "Situation introuvable" })
  await expect(message).toContainText("Situation introuvable : le lien « #situation=inconnue » ne correspond à aucune situation type, la simulation en cours n'a pas changé.")
  await expect.poll(() => fragment(page)).toBe("")
  await auditer(page, "situation introuvable", "[role=status]")

  await message.getByRole("button", { name: "Voir les situations types" }).click()
  const fenetre = page.getByRole("dialog", { name: "Partir d'une situation type" })
  await expect(fenetre).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(fenetre).toBeHidden()
  await page.getByRole("button", { name: "Fermer le message" }).click()
  await expect(page.getByText("Situation introuvable")).toHaveCount(0)
  await expect(titre(page)).toHaveText(EXEMPLE)
})

test("« Copier le lien » d'une situation donne l'adresse de la démo suivie de son fragment, qui l'ouvre", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("./")
  await expect(titre(page)).toHaveText(EXEMPLE)
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Partir d'une situation type..." }).click()
  const fenetre = page.getByRole("dialog", { name: "Partir d'une situation type" })

  const bouton = fenetre.getByRole("button", { name: `Copier le lien de la situation « ${UNION_LIBRE} »` })
  await bouton.click()
  await expect(bouton).toHaveText("Lien copié")
  const lien = await page.evaluate(() => navigator.clipboard.readText())
  expect(lien).toMatch(/^http:\/\/localhost:\d+\/simulateur-independant-fr\/#situation=couple-union-libre$/)
  await expect(fenetre.getByRole("status")).toHaveText(`Lien de « ${UNION_LIBRE} » copié : ${lien}`)
  await auditer(page, "fenêtre des situations types, lien copié", "[role=dialog]")

  // Le lien copié, ouvert dans un nouvel onglet, mène à la situation.
  const onglet = await context.newPage()
  await onglet.goto(lien)
  await expect(titre(onglet)).toHaveText(UNION_LIBRE)
})
