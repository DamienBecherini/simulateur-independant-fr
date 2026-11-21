// e2e-web/plusieurs-micro-entreprises.web.ts
// Une personne titulaire de deux micro-entreprises n'a, en droit, qu'une entreprise individuelle : la carte de chacune
// le dit, et les plafonds du régime micro et de la franchise de TVA se jugent sur leur chiffre d'affaires réuni.

import { test, expect, type Page } from "@playwright/test"

/** Alice, titulaire de deux micro-entreprises : 50 000 € et 40 000 € de prestations, chacune sous le plafond des services. */
function session(nom: string, titulaireDeLaSeconde: string) {
  const personne = (id: string, name: string, value: string) => ({ id, type: "person", name, fiscalParts: 1, avatar: { type: "initials", value, color: "#3b82f6" }, locked: false })
  const micro = (id: string, name: string) => ({ id, type: "micro-entreprise", name, beneficieACRE: false, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false })
  const flux = (id: string, entityId: string, type: string, amount: number) => ({ id, entityId, type, label: "Prestations", amount })
  return {
    formatVersion: 4,
    name: nom,
    entities: [personne("person-alice", "Alice Martin", "AM"), personne("person-bob", "Bob Martin", "BM"), micro("micro-conseil", "Conseil"), micro("micro-formation", "Formation")],
    relationships: [
      { id: "r-conseil", fromId: "person-alice", toId: "micro-conseil", type: "Titulaire" },
      { id: "r-formation", fromId: titulaireDeLaSeconde, toId: "micro-formation", type: "Titulaire" }
    ],
    annees: [{ annee: 2026, monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? [flux("f1", "micro-conseil", "ca_micro_services_bnc", 50000), flux("f2", "micro-formation", "ca_micro_services_bnc", 40000)] : [] })) }]
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

const carte = (page: Page, nom: string) => page.getByRole("article").filter({ has: page.getByText(nom, { exact: true }) }).first()

test("deux micro-entreprises d'une même personne : la carte de chacune le dit, et le plafond se juge sur leur total", async ({ page }) => {
  await ouvrir(page, session("Deux micro-entreprises", "person-alice"))

  for (const nom of ["Conseil", "Formation"]) {
    const alertes = carte(page, nom)
    // Chaque alerte tient en une ligne ; le reste est dans sa bulle.
    const titulaire = alertes.getByRole("listitem").filter({ hasText: "« Alice Martin » : une seule entreprise individuelle par personne" })
    await expect(titulaire).toBeVisible()
    await titulaire.getByRole("button", { name: "Détail de l'alerte" }).click()
    await expect(page.getByRole("tooltip")).toContainText(/^« Alice Martin » est titulaire de plusieurs entreprises en nom propre \(« Conseil », « Formation »\) : une personne n'a qu'une entreprise individuelle/)
    await page.keyboard.press("Escape")
    // 90 000 € de prestations réunies, pour un plafond de 83 600 € en 2026 : aucune des deux ne le dépasse seule.
    const plafond = alertes.getByRole("listitem").filter({ hasText: /^Plafond du régime micro dépassé \(prestations de services 90\s000\s€ pour un plafond de [\d\s]+€\)/ })
    await expect(plafond).toBeVisible()
    await plafond.getByRole("button", { name: "Détail de l'alerte" }).click()
    await expect(page.getByRole("tooltip")).toContainText("Chiffre d'affaires réuni de « Conseil » et « Formation », micro-entreprises du même titulaire.")
    await page.keyboard.press("Escape")
  }

  // Le comparateur ne désigne pas une colonne micro : la micro-entreprise comparée dépasse le plafond avec l'autre.
  const table = page.getByRole("table", { name: "Comparaison des statuts" })
  await expect(table.getByRole("row", { name: /^Écart avec votre situation actuelle/ })).toContainText("non retenue : plafond dépassé")
  await expect(table.getByRole("columnheader", { name: /^Micro-entreprise/ })).not.toContainText("meilleur net")
})

test("deux micro-entreprises de deux personnes : rien n'est réuni", async ({ page }) => {
  await ouvrir(page, session("Deux titulaires", "person-bob"))
  await expect(carte(page, "Conseil").getByText(/Versé avant impôt sur le revenu|Net encaissé|Cotisations/).first()).toBeVisible()
  await expect(page.getByText(/est titulaire de plusieurs entreprises en nom propre/)).toHaveCount(0)
  await expect(page.getByText(/Plafond du régime micro dépassé/)).toHaveCount(0)
})
