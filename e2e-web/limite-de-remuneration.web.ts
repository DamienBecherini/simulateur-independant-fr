// e2e-web/limite-de-remuneration.web.ts
// La limite de la rémunération du dirigeant se lit dès la saisie, dans la fenêtre des flux, avant d'être dépassée ;
// l'alerte des résultats dit quand des réserves couvrent le déficit ; et le comparateur écrit sous le net le bénéfice
// qu'une société garde, sans le compter dans le classement (ADR 019).

import { test, expect, type Locator, type Page } from "@playwright/test"

type Flux = [type: string, montant: number]

/** Une SASU présidée par son associée, avec ces flux sur janvier. */
function session(nom: string, flux: Flux[], societe: Record<string, unknown> = {}) {
  return {
    formatVersion: 4,
    name: nom,
    entities: [
      { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
      { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false, ...societe }
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

const carteDeLaSociete = (page: Page) => page.getByRole("article").filter({ hasText: "Atelier" }).first()
/** « 44 900 € » en nombre : le premier montant du texte. */
const montant = (texte: string) => Number((texte.match(/[-−+]?\d[\d\s]*(?=\s?€)/)?.[0] ?? "NaN").replace(/\s/g, "").replace("−", "-"))
const rappel = (fenetre: Locator) => fenetre.locator("[data-limite-de-remuneration]")

/** L'alerte de la rémunération du dirigeant tient en une ligne : son détail, ouvert dans sa bulle, puis refermé. */
async function detailDeLAlerte(page: Page): Promise<string> {
  const alerte = carteDeLaSociete(page).getByRole("listitem").filter({ hasText: /^Rémunération du dirigeant supérieure à ce que la société gagne/ })
  await alerte.getByRole("button", { name: "Détail de l'alerte" }).click()
  const detail = await page.getByRole("tooltip").innerText()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("tooltip")).toHaveCount(0)
  return detail
}

async function ouvrirLeMois(page: Page, mois: string): Promise<Locator> {
  await page.getByRole("button", { name: `Flux ${mois} : Atelier` }).click()
  const fenetre = page.getByRole("dialog", { name: /^Opérations de .* \/ Atelier$/ })
  await expect(fenetre).toBeVisible()
  return fenetre
}

test("la fenêtre de saisie donne la limite de la rémunération du dirigeant dès que le type est choisi, puis situe la saisie", async ({ page }) => {
  await ouvrir(page, session("Limite à la saisie", [["ca_services", 60000]]))
  // Les résultats de l'année donnent la limite : on attend qu'ils soient calculés.
  await expect(carteDeLaSociete(page).getByText(/Versé avant impôt sur le revenu/)).toBeVisible()

  const fenetre = await ouvrirLeMois(page, "de février")
  await expect(rappel(fenetre)).toHaveCount(0)

  // Le type choisi sur la ligne d'ajout suffit : la limite se lit avant le premier montant.
  await fenetre.getByRole("combobox", { name: "Type de flux" }).last().click()
  await page.getByRole("option", { name: "Rémunération de dirigeant" }).click()
  await expect(rappel(fenetre)).toContainText(/^Rémunération du dirigeant\. Cette année, la société peut verser au plus [\d\s]+€ nets sans déficit\.$/)
  const limite = montant((await rappel(fenetre).innerText()).split("au plus ")[1])
  expect(limite).toBeGreaterThan(20000)
  expect(limite).toBeLessThan(60000)

  // Sous la limite : la saisie de l'année est située, sans mise en garde.
  await fenetre.getByLabel("Montant du nouveau flux").fill("2000")
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(rappel(fenetre)).toContainText(/2\s000\s€ nets saisis sur l'année, pour [\d\s]+€ au plus sans déficit de la société\./)
  await expect(rappel(fenetre)).toHaveAttribute("data-limite-de-remuneration", "tenue")
  expect(montant((await rappel(fenetre).innerText()).split("pour ")[1])).toBe(limite)

  // Au-delà : le rappel devient une mise en garde, avec la même limite, celle que donne ensuite l'alerte des résultats.
  const saisi = fenetre.getByRole("textbox", { name: "Montant", exact: true }).last()
  await saisi.fill("200000")
  await saisi.press("Enter")
  await expect(rappel(fenetre)).toHaveAttribute("data-limite-de-remuneration", "depassee")
  await expect(rappel(fenetre)).toContainText(/200\s000\s€ nets saisis sur l'année : c'est plus que les [\d\s]+€ que la société peut verser sans déficit\./)
  expect(montant((await rappel(fenetre).innerText()).split("plus que les ")[1])).toBe(limite)

  await fenetre.getByRole("button", { name: "Terminé" }).click()
  await expect(carteDeLaSociete(page).getByText(/^Rémunération du dirigeant supérieure à ce que la société gagne/)).toBeVisible()
  expect(montant((await detailDeLAlerte(page)).split("pour ")[1])).toBe(limite)
})

test("une rémunération déjà saisie dans l'année est rappelée dans la fenêtre d'un autre mois, sans choisir le type", async ({ page }) => {
  await ouvrir(page, session("Rémunération déjà saisie", [["ca_services", 60000], ["director_remuneration", 24000]]))
  await expect(carteDeLaSociete(page).getByText(/Versé avant impôt sur le revenu/)).toBeVisible()
  const fenetre = await ouvrirLeMois(page, "de mars")
  await expect(rappel(fenetre)).toContainText(/24\s000\s€ nets saisis sur l'année, pour [\d\s]+€ au plus sans déficit de la société\./)
})

test("l'alerte des résultats dit quand les réserves des années précédentes couvrent le déficit de l'année", async ({ page }) => {
  await ouvrir(page, session("Réserves", [["ca_services", 60000], ["director_remuneration", 80000]], { reservesInitiales: 300000 }))
  expect(await detailDeLAlerte(page)).toMatch(/au plus sans déficit cette année\. Les réserves des années précédentes \(300\s000\s€\) couvrent le déficit de l'année\./)
})

test("le comparateur écrit sous le net le bénéfice gardé dans la société, sans le compter dans les écarts", async ({ page }) => {
  // 20 000 € de rémunération, aucun dividende : la société garde le reste de son bénéfice.
  await ouvrir(page, session("Bénéfice gardé", [["ca_services", 60000], ["director_remuneration", 20000]]))
  await page.getByRole("radio", { name: "Selon la grille" }).check({ force: true })

  const table = page.getByRole("table", { name: "Comparaison des statuts" })
  const cellules = async (nom: RegExp) => (await table.getByRole("row", { name: nom }).getByRole("cell").allInnerTexts()).map(texte => texte.replace(/\s+/g, " "))
  await expect(table.getByRole("row", { name: /^Net dans la poche/ })).toContainText(/gardés dans la société/)
  const nets = await cellules(/^Net dans la poche/)
  // Colonnes : SASU, EURL, EI… La SASU et l'EURL gardent un bénéfice ; l'entreprise individuelle, jamais.
  expect(nets[0]).toMatch(/^[\d ]+ € et [\d ]+ € gardés dans la société/)
  expect(nets[2]).not.toContain("gardés")
  const garde = montant(nets[0].split(" et ")[1])
  expect(garde).toBeGreaterThan(5000)

  // L'écart de l'EI est celui des nets : le bénéfice gardé par la SASU n'y entre pas.
  const ecarts = await cellules(/^Écart avec votre situation actuelle/)
  expect(montant(ecarts[2])).toBe(montant(nets[2]) - montant(nets[0]))
  await expect(table.getByRole("row", { name: /^Net, perte restée dans l'activité déduite/ })).toHaveCount(0)

  // Sous le tableau, pourquoi il n'est pas compté.
  await expect(page.getByText(/^Un bénéfice gardé dans la société n'est pas compté dans le net ni dans le classement/)).toBeVisible()
})
