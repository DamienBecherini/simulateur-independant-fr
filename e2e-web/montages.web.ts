// e2e-web/montages.web.ts
// Montages types dans la démo web : la fenêtre s'ouvre depuis les paramètres, montre le détail d'un montage et le
// charge à la place de la simulation d'exemple, après confirmation. Accessibilité en clair, en sombre et à 375 px.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirLaPolice, POLICES } from "./support/police"

const SASU_SANS_SALAIRE = "SASU sans salaire, tout en dividendes"

/** Ouvre la démo sur la simulation d'exemple, puis la fenêtre des montages types depuis les paramètres. */
async function ouvrirLesMontages(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: "Partir d'un montage type..." }).click()
  const montages = page.getByRole("dialog", { name: "Partir d'un montage type" })
  await expect(montages).toBeVisible()
  return montages
}

/** Aucune barre de défilement horizontale dans la page ni dans la fenêtre. */
async function sansDefilementHorizontal(page: Page) {
  const debordements = await page.evaluate(() => [document.documentElement, ...Array.from(document.querySelectorAll("[role=dialog]"))].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.tagName))
  expect(debordements).toEqual([])
}

test("charger « SASU sans salaire » depuis les paramètres, après confirmation : la session prend son nom et ses chiffres", async ({ page }) => {
  const montages = await ouvrirLesMontages(page)

  await montages.getByRole("button", { name: `Détails du montage « ${SASU_SANS_SALAIRE} »` }).click()
  const detail = page.getByRole("dialog", { name: SASU_SANS_SALAIRE })
  await expect(detail.getByRole("heading", { name: "Points d'attention et risques" })).toBeVisible()
  await expect(detail.getByRole("link", { name: /Imposition des dividendes/ })).toHaveAttribute("href", "https://entreprendre.service-public.gouv.fr/vosdroits/F32963")
  await detail.getByRole("button", { name: "Charger ce montage" }).click()

  // La simulation d'exemple n'est enregistrée dans aucune sauvegarde : son remplacement est confirmé.
  const confirmation = page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
  await expect(confirmation).toContainText("« Famille Martin, simulation 2026 »")
  await confirmation.getByRole("button", { name: "Remplacer" }).click()

  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SASU_SANS_SALAIRE)
  // 62 750 € de dividendes après 15 250 € d'impôt sur les sociétés : 47 960 € nets pour le foyer (montages.reference.test.ts).
  await expect(page.getByText(/^47\s960\s€$/).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  // Le montage remplace la simulation sans effacer l'historique : « Annuler » la restaure.
  await expect(page.getByRole("button", { name: "Annuler" })).toBeEnabled()

  // Le montage est conservé dans le navigateur, comme toute modification de la démo.
  await page.reload()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SASU_SANS_SALAIRE)
})

test("« Annuler » dans la confirmation garde la simulation d'exemple", async ({ page }) => {
  const montages = await ouvrirLesMontages(page)
  await montages.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" }).click()
  const confirmation = page.getByRole("dialog", { name: "Remplacer la simulation en cours ?" })
  await confirmation.getByRole("button", { name: "Annuler" }).click()
  await expect(confirmation).toBeHidden()
  // Le focus revient sur le bouton du montage ; Échap referme la fenêtre des montages, puis les paramètres.
  await expect(montages.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" })).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(montages).toBeHidden()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
})

for (const theme of ["clair", "sombre"] as const) {
  test(`la fenêtre des montages et le détail d'un montage ne présentent aucune violation WCAG, thème ${theme}`, async ({ page }) => {
    await page.goto("./")
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    const montages = await ouvrirLesMontages(page)
    await auditer(page, `montages types, ${theme}`, "[role=dialog]")
    await montages.getByRole("button", { name: "Détails du montage « Conjoint salarié de la SASU »" }).click()
    await expect(page.getByRole("dialog", { name: "Conjoint salarié de la SASU" })).toBeVisible()
    await auditer(page, `détail d'un montage, ${theme}`, "[role=dialog]")
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const police of POLICES) {
    test(`la fenêtre et le détail tiennent dans 375 px, sans violation WCAG, ${police}`, async ({ page, context }) => {
      await choisirLaPolice(context, police)
      const montages = await ouvrirLesMontages(page)
      await sansDefilementHorizontal(page)
      await auditer(page, "montages types, 375 px", "[role=dialog]")
      await montages.getByRole("button", { name: "Détails du montage « Couple en union libre, puis marié ou pacsé »" }).click()
      await expect(page.getByRole("button", { name: "Charger ce montage" })).toBeVisible()
      await sansDefilementHorizontal(page)
      await auditer(page, "détail d'un montage, 375 px", "[role=dialog]")
    })
  }
})
