// e2e-web/annee-de-perte.web.ts
// Ce que le comparateur et les résultats disent d'une société qui perd de l'argent, ou qui verse plus qu'elle ne gagne.
// Une année de perte : la société affiche 0 € de net, mais sa perte, restée dans la société, est déduite pour la
// comparer à l'entreprise individuelle qui porte la même perte ; le portage, à découvert, n'est pas retenu. Une
// rémunération de la grille supérieure au bénéfice : l'alerte dit où est la limite, et la colonne n'est pas désignée.

import { test, expect, type Locator, type Page } from "@playwright/test"

type Flux = [type: string, montant: number]

/** Une SASU présidée par son associée, avec ces flux sur janvier. */
function session(nom: string, flux: Flux[]) {
  return {
    formatVersion: 4,
    name: nom,
    entities: [
      { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
      { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
    ],
    relationships: [
      { id: "r-president", fromId: "person-alice", toId: "company-atelier", type: "Président" },
      { id: "r-associe", fromId: "person-alice", toId: "company-atelier", type: "Associé" }
    ],
    annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? flux.map(([type, amount], rang) => ({ id: `flux-${rang}`, entityId: "company-atelier", type, label: type, amount })) : [] })) }]
  }
}

async function ouvrir(page: Page, donnees: ReturnType<typeof session>) {
  await page.addInitScript(s => {
    window.localStorage.setItem("simulateur.session", JSON.stringify(s))
    window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "classique" }))
  }, donnees)
  await page.goto("./")
  await expect(page.getByRole("heading", { level: 1, name: donnees.name })).toBeVisible()
}

const table = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" })
const ligne = (page: Page, nom: RegExp) => table(page).getByRole("row", { name: nom })
async function cellules(page: Page, nom: RegExp): Promise<string[]> {
  // Le comparateur calcule après l'affichage de la page : on attend la ligne.
  await expect(ligne(page, nom)).toBeVisible()
  return (await ligne(page, nom).getByRole("cell").allInnerTexts()).map(texte => texte.replace(/\s+/g, " "))
}
/** « -20 405 € » ou « −1 343 € » en nombre. */
const montant = (texte: string) => Number((texte.match(/[-−+]?\d[\d\s]*(?=\s?€)/)?.[0] ?? "NaN").replace(/\s/g, "").replace("−", "-"))

test("une année de perte : la perte restée dans la société est déduite pour comparer, et le portage à découvert n'est pas retenu", async ({ page }) => {
  await ouvrir(page, session("Année de perte", [["ca_services", 10000], ["deductible_expense", 30000]]))

  // Colonnes : SASU, EURL, EI, micro, micro + VL, portage. La SASU n'a rien versé : 0 € de net, 20 000 € de perte.
  const nets = await cellules(page, /^Net dans la poche/)
  expect(nets[0]).toMatch(/^0 € et 20 000 € de perte restée dans la société/)
  expect(nets[1]).toMatch(/^0 € et [\d ]+ € de perte restée dans la société/)
  expect(nets[2]).not.toContain("perte restée")
  expect(montant(nets[2])).toBeLessThan(-20000)
  expect(nets[5]).toMatch(/de perte restée sur le compte d'activité/)

  // Le détail montre sur quoi les colonnes se comparent.
  const compares = (await cellules(page, /^Net, perte restée dans l'activité déduite/)).map(montant)
  expect(compares[0]).toBe(-20000)
  expect(compares[2]).toBe(montant(nets[2]))

  // Les écarts se mesurent sur ces montants : l'EI ne fait pas 20 000 € de moins que la SASU, mais quelques centaines.
  const ecarts = await cellules(page, /^Écart avec votre situation actuelle/)
  expect(ecarts[0]).toBe("—")
  expect(montant(ecarts[2])).toBe(compares[2] - compares[0])
  expect(Math.abs(montant(ecarts[2]))).toBeLessThan(2000)
  expect(ecarts[5]).toContain("non retenue : frais supérieurs au chiffre d'affaires")

  // Le meilleur statut est celui du meilleur net une fois la perte déduite, parmi les colonnes retenues.
  const retenues = compares.slice(0, 5)
  const meilleure = retenues.indexOf(Math.max(...retenues))
  await expect(table(page).getByRole("columnheader").nth(meilleure + 1)).toContainText("meilleur net")
  await expect(table(page).getByRole("columnheader", { name: /^Portage salarial/ })).not.toContainText("meilleur net")
})

/** Le détail de l'alerte sur la rémunération du dirigeant, ouvert dans sa bulle : la limite y est donnée. */
async function detailDeLAlerte(page: Page, carte: Locator): Promise<string> {
  const alerte = carte.getByRole("listitem").filter({ hasText: /^Rémunération du dirigeant supérieure à ce que la société gagne/ })
  await alerte.getByRole("button", { name: "Détail de l'alerte" }).click()
  const detail = await page.getByRole("tooltip").innerText()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("tooltip")).toHaveCount(0)
  return detail
}

test("la grille verse au dirigeant plus que la société ne gagne : l'alerte dit la limite, et la colonne n'est pas désignée", async ({ page }) => {
  await ouvrir(page, session("Rémunération hors de portée", [["ca_services", 60000], ["director_remuneration", 200000]]))

  // Dans les résultats, en tête des alertes de la société, avec la plus haute rémunération possible sans déficit.
  const carte = page.getByRole("article").filter({ hasText: "Atelier" }).first()
  // L'alerte tient en une ligne ; la limite est dans sa bulle.
  const detail = await detailDeLAlerte(page, carte)
  expect(detail).toMatch(/200\s000\s€ nets saisis, pour [\d\s]+€ au plus sans déficit cette année\./)
  const limite = montant(detail.split("pour ")[1])
  expect(limite).toBeGreaterThan(20000)
  expect(limite).toBeLessThan(60000)

  // Le comparateur, selon la grille : la colonne garde les montants saisis, et n'est pas le meilleur statut.
  await page.getByRole("radio", { name: "Selon la grille" }).check({ force: true })
  const sasu = table(page).getByRole("columnheader", { name: /^SASU/ })
  await expect(sasu).toContainText("société déficitaire")
  await expect(sasu).not.toContainText("meilleur net")
  await expect(ligne(page, /^Écart avec votre situation actuelle/)).toContainText("non retenue : rémunération supérieure au bénéfice")
  await expect(ligne(page, /^Net dans la poche/).getByRole("cell").first()).toContainText(/de perte restée dans la société/)

  // « Ma rémunération » : la même somme, choisie dans les réglages, est ramenée à ce que la société peut verser.
  await page.getByRole("radio", { name: "Ma rémunération" }).check({ force: true })
  await page.getByLabel("Rémunération nette annuelle (SASU, EURL)").fill("200000")
  await expect(sasu).toContainText(/rémunération limitée à/)
  await expect(sasu).not.toContainText("société déficitaire")
})

test("la limite annoncée par l'alerte est la bonne : à ce montant, la société n'est plus déficitaire", async ({ page }) => {
  await ouvrir(page, session("Rémunération à la limite", [["ca_services", 60000], ["director_remuneration", 200000]]))
  const carte = page.getByRole("article").filter({ hasText: "Atelier" }).first()
  const limite = montant((await detailDeLAlerte(page, carte)).split("pour ")[1])

  // La même société, avec cette rémunération. La session est déposée avant chaque chargement : le dernier dépôt
  // l'emporte, et la page ne peut pas la réécrire en se fermant.
  const recharger = async (nom: string, remuneration: number) => {
    await page.addInitScript(s => window.localStorage.setItem("simulateur.session", JSON.stringify(s)), session(nom, [["ca_services", 60000], ["director_remuneration", remuneration]]))
    await page.reload()
    await expect(page.getByRole("heading", { level: 1, name: nom })).toBeVisible()
    await expect(carte.getByText(/Versé avant impôt sur le revenu/)).toBeVisible()
  }
  await recharger("À la limite", limite)
  await expect(carte.getByText(/^Rémunération du dirigeant supérieure/)).toHaveCount(0)
  await expect(carte.getByText(/La société est déficitaire/)).toHaveCount(0)

  // Cent euros de plus : l'alerte revient, avec la même limite.
  await recharger("Au-delà de la limite", limite + 100)
  expect(montant((await detailDeLAlerte(page, carte)).split("pour ")[1])).toBe(limite)
})
