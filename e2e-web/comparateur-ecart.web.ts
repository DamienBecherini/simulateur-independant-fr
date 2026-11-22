// e2e-web/comparateur-ecart.web.ts
// Comparateur, colonne du statut actuel d'une société au meilleur net. Son écart avec la situation saisie ne vient pas
// d'un changement de statut mais d'un autre partage du bénéfice : une bulle ouverte par (?) le dit, poste par poste. Et quand
// cet écart est négligeable (moins de 100 € de net par an), la colonne reste la situation saisie : aucun gain annoncé.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { deplierLeTableauDuComparateur } from "./support/affichage"

const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })
const colonne = (page: Page, nom: RegExp) => tableau(page).getByRole("columnheader", { name: nom })
/** La case de la première colonne de statut (celle du statut actuel) dans la ligne de l'écart. */
const ecartDuStatutActuel = (page: Page) => tableau(page).getByRole("row", { name: /^Écart avec votre situation actuelle/ }).getByRole("cell").first()

/** Ouvre une situation type par son adresse, dans l'affichage « Résumé » des tests de la démo. */
async function ouvrir(page: Page, situation: string) {
  await page.goto(`./#situation=${situation}`)
  await deplierLeTableauDuComparateur(page)
}

test("écart négligeable : 15 € de mieux avec 400 € de salaire ne font pas un conseil, la colonne reste la situation saisie", async ({ page }) => {
  await ouvrir(page, "sasu-en-zone-franche-urbaine")
  const sasu = colonne(page, /^Meilleur net\s*SASU/)
  await expect(sasu).toContainText(/^Meilleur netSASU\s*actuel/)
  await expect(sasu).toContainText(/votre répartition, au meilleur net à moins de 100\s€ près/)
  await expect(sasu).not.toContainText("rémunération optimale")
  await expect(sasu).not.toContainText("rémunération optimisée")
  await expect(ecartDuStatutActuel(page)).toHaveText("—")
  await expect(tableau(page).getByRole("row", { name: /^Net dans la poche/ }).getByRole("cell").first()).toContainText(/55\s191\s€/)

  // La barre de résumé dit la même chose que le tableau.
  await expect(page.getByText(/SASU \(actuel\)/).first()).toBeVisible()
  await expect(page.getByText(/rémunération optimisée, \+15/)).toHaveCount(0)
})

test("écart réel : la bulle de la case dit ce qui distingue la colonne de la situation saisie, poste par poste, sans faire défiler le tableau", async ({ page }) => {
  await ouvrir(page, "sasu-sans-salaire")
  await expect(colonne(page, /^Meilleur net\s*SASU, rémunération optimisée/)).toContainText(/rémunération optimale : 5\s800\s€ nets/)
  const ecart = ecartDuStatutActuel(page)
  await expect(ecart).toContainText(/−756\s€/)

  // La zone du tableau, qui défile de côté, garde sa hauteur et ne gagne pas de défilement vertical à l'ouverture.
  const zone = page.getByRole("region", { name: "Tableau de comparaison" })
  const hauteurs = () => zone.evaluate(element => ({ visible: element.clientHeight, contenu: element.scrollHeight }))
  const avant = await hauteurs()
  await ecart.getByRole("button", { name: "Détail du partage du bénéfice" }).click()
  const detail = page.getByRole("tooltip")
  await expect(detail).toBeVisible()
  await expect(detail).toContainText(/avec 5\s800\s€ de rémunération nette au lieu de 0\s€/)
  expect(await hauteurs()).toEqual(avant)
  expect(avant.contenu).toBeLessThanOrEqual(avant.visible)
  await expect(zone.getByRole("tooltip")).toHaveCount(0)
  await expect(detail.getByRole("listitem")).toHaveText([
    /^Rémunération nette : 5\s800\s€ au lieu de 0\s€, soit \+5\s800\s€$/,
    /^Dividendes : 55\s211\s€ au lieu de 62\s750\s€, soit −7\s539\s€$/,
    /^Impôt sur le revenu : 3\s538\s€ au lieu de 3\s119\s€, soit −419\s€$/,
    /^Prélèvements sociaux : 10\s269\s€ au lieu de 11\s672\s€, soit \+1\s403\s€$/
  ])
  // Les autres colonnes changent de statut : leur écart n'a pas de bulle.
  await expect(tableau(page).getByRole("row", { name: /^Écart avec votre situation actuelle/ }).getByRole("button", { name: "Détail du partage du bénéfice" })).toHaveCount(1)
  await auditer(page, "comparateur, détail de l'écart ouvert")
  // Échap la ferme et rend le focus au (?).
  await page.keyboard.press("Escape")
  await expect(detail).toHaveCount(0)
  await expect(ecart.getByRole("button", { name: "Détail du partage du bénéfice" })).toBeFocused()
})
