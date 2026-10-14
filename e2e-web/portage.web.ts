// e2e-web/portage.web.ts
// La colonne « Portage salarial » du comparateur (voir l'ADR 016), sur la simulation d'exemple : l'atelier de Camille
// (micro-entreprise mixte, prestations et ventes) converti en portage, ses conditions de société de portage réglables
// dans une section repliée, et le chiffre d'affaires du calcul à l'envers.

import { test, expect, type Page } from "@playwright/test"

/** Un montant affiché (« 53 271 € »), première ligne d'une cellule, lu comme un nombre positif, quelles que soient les espaces. */
const enNombre = (texte: string) => Number(texte.split("\n")[0].replace(/\D/g, ""))

const tableau = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })

/** Le net de la colonne du portage salarial, la dernière du tableau. */
async function netDuPortage(page: Page): Promise<number> {
  return enNombre(await tableau(page).getByRole("row", { name: /^Net dans la poche/ }).getByRole("cell").last().innerText())
}

test("le comparateur a une colonne « Portage salarial », qui dit la vente écartée et ses conditions typiques", async ({ page }) => {
  await page.goto("./")
  await expect(tableau(page).getByRole("columnheader", { name: /^Portage salarial/ })).toBeVisible()
  expect(await netDuPortage(page)).toBeGreaterThan(0)
  // Les ventes de l'atelier ne se facturent pas en portage : la note de la colonne le dit, avec les conditions typiques.
  const notes = page.getByText(/^Notes sur « Atelier de Camille »/).locator("..")
  await expect(notes.getByText(/La vente de marchandises n'est pas permise en portage salarial/)).toBeVisible()
  await expect(notes.getByText(/Conditions typiques d'une société de portage/)).toBeVisible()
})

test("un réglage des conditions de la société de portage change le net de la colonne, et reste après rechargement", async ({ page }) => {
  await page.goto("./")
  await expect(tableau(page).getByRole("columnheader", { name: /^Portage salarial/ })).toBeVisible()
  const avant = await netDuPortage(page)

  const section = page.locator("details", { has: page.locator("summary", { hasText: "Conditions de la société de portage" }) })
  await section.locator("summary").click()
  await expect(section.getByText(/Les valeurs par défaut sont typiques/)).toBeVisible()
  const frais = section.getByRole("spinbutton", { name: "Frais de gestion (% du chiffre d'affaires HT)" })
  await expect(frais).toHaveValue("7")
  await frais.fill("3")
  // Des frais de gestion plus bas laissent une plus grande enveloppe, donc un salaire net plus haut.
  await expect.poll(() => netDuPortage(page)).toBeGreaterThan(avant)
  const apres = await netDuPortage(page)

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("simulateur.session") ?? "")).toContain('"tauxFraisDeGestion":0.03')
  await page.reload()
  await expect(tableau(page).getByRole("columnheader", { name: /^Portage salarial/ })).toBeVisible()
  await expect.poll(() => netDuPortage(page)).toBe(apres)
})

test("le calcul à l'envers donne le chiffre d'affaires du portage salarial", async ({ page }) => {
  await page.goto("./")
  const section = page.locator("section[aria-labelledby=combien-facturer-titre]")
  await section.getByText("Combien facturer pour un net visé ?").click()
  await section.getByLabel("Net visé du foyer (€ par an)").fill("90000")
  const ligne = section.getByRole("table").getByRole("row", { name: /^Portage salarial/ })
  await expect(ligne.getByRole("cell").first()).toHaveText(/^\d[\d\s]*\s€$/)
  // Pour un même net, le portage demande plus de chiffre d'affaires que la micro-entreprise : frais de gestion et
  // cotisations d'un salarié.
  const portage = enNombre(await ligne.getByRole("cell").first().innerText())
  const vfl = enNombre(await section.getByRole("table").getByRole("row", { name: /^Micro \+ versement libératoire/ }).getByRole("cell").first().innerText())
  expect(portage).toBeGreaterThan(vfl)
})
