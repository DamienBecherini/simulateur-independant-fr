// e2e-web/cotisations-et-limites.web.ts
// « Mes cotisations sont-elles justes ? » : le détail complet des cotisations d'un ostéopathe au réel, les hypothèses
// et limites sous le titre des résultats, et l'explication de l'ACRE et du versement libératoire sur la carte d'une
// micro-entreprise (constats P-06, P-07 et P-12 du rapport de parcours).

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const SESSION = {
  formatVersion: 3,
  name: "Cabinet de Camille",
  entities: [
    { id: "person-camille", type: "person", name: "Camille", fiscalParts: 1, avatar: { type: "initials", value: "CA", color: "#3b82f6" }, locked: false },
    { id: "ei-cabinet", type: "company", name: "Cabinet", legalStatus: "EI", capitalSocial: 0, profession: "osteopathe", avatar: { type: "icon", value: "User", color: "#7e22ce" }, locked: false },
    { id: "micro-atelier", type: "micro-entreprise", name: "Atelier", beneficieACRE: false, opteVFL: false, avatar: { type: "icon", value: "Store", color: "#f97316" }, locked: false }
  ],
  relationships: [
    { id: "r-cabinet", fromId: "person-camille", toId: "ei-cabinet", type: "Titulaire" },
    { id: "r-atelier", fromId: "person-camille", toId: "micro-atelier", type: "Titulaire" }
  ],
  annees: [
    {
      annee: 2026,
      monthlyData: Array.from({ length: 12 }, (_, month) => ({
        month,
        flows: [
          { id: `ca-${month}`, entityId: "ei-cabinet", type: "ca_services", label: "Honoraires", amount: 4500 },
          { id: `micro-${month}`, entityId: "micro-atelier", type: "ca_micro_services_bic", label: "Ateliers", amount: 500 }
        ]
      }))
    }
  ],
  comparateur: { activiteComparee: "ei-cabinet", reglagesParActivite: {} }
}

async function ouvrir(page: Page) {
  await page.addInitScript(session => window.localStorage.setItem("simulateur.session", JSON.stringify(session)), SESSION)
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
}

const carteDuCabinet = (page: Page) => page.getByRole("article").filter({ has: page.getByText("Cabinet", { exact: true }) }).first()

test("ostéopathe au réel : le détail des cotisations donne toutes les lignes, dont la somme est le total", async ({ page }) => {
  await ouvrir(page)
  const carte = carteDuCabinet(page)
  await carte.getByRole("button", { name: /^Afficher le détail/ }).click()

  await expect(carte).toContainText(/Cotisations sociales\s*−\s*15\s008\s€\s*assiette de 39\s960\s€/)
  // 2 061 + 120 + 4 236 + 4 395 + 200 + 2 717 + 1 159 + 120 = 15 008 €.
  for (const [libelle, montant] of [
    ["dont maladie (Urssaf)", "2\\s061"],
    ["dont indemnités journalières", "120"],
    ["dont retraite de base (CNAVPL)", "4\\s236"],
    ["dont retraite complémentaire (CIPAV)", "4\\s395"],
    ["dont invalidité-décès (CIPAV)", "200"],
    ["dont CSG déductible", "2\\s717"],
    ["dont CSG non déductible et CRDS", "1\\s159"],
    ["dont formation professionnelle", "120"]
  ]) {
    await expect(carte.locator("div").filter({ has: page.getByText(libelle, { exact: true }) }).last()).toContainText(new RegExp(`${montant}\\s€`))
  }
  await auditer(page, "détail des cotisations d'un ostéopathe")
})

test("les hypothèses et limites se déplient sous le titre des résultats", async ({ page }) => {
  await ouvrir(page)
  const resume = page.locator("summary", { hasText: "Hypothèses et limites" })
  await expect(page.getByText(/acomptes provisionnels que l.Urssaf appelle d.abord/)).toBeHidden()
  await resume.click()
  await expect(page.getByText(/acomptes provisionnels que l'Urssaf appelle d'abord/)).toBeVisible()
  await expect(page.getByText(/Non modélisés : prévoyance et mutuelle, réductions et crédits d'impôt/)).toBeVisible()
  await auditer(page, "hypothèses et limites dépliées")
})

test("le bouton « ? » de l'ACRE et du versement libératoire ouvre une explication tirée des règles de l'année", async ({ page }) => {
  await ouvrir(page)
  const bouton = page.getByRole("button", { name: "Qu'est-ce que l'ACRE ?" })
  await bouton.click()
  const acre = page.getByRole("dialog", { name: "ACRE (aide à la création ou à la reprise d'entreprise)" })
  await expect(acre).toContainText("réduites de 50 % pour une création depuis janvier 2020, 25 % depuis juillet 2026")
  await expect(acre.getByRole("link", { name: "Conditions de l'ACRE (service-public.fr)" })).toBeVisible()
  await auditer(page, "explication de l'ACRE", "[role=dialog]")
  await page.keyboard.press("Escape")
  await expect(acre).toBeHidden()
  await expect(bouton).toBeFocused()

  await page.getByRole("button", { name: "Qu'est-ce que le versement libératoire ?" }).click()
  const vl = page.getByRole("dialog", { name: "Versement libératoire de l'impôt sur le revenu" })
  await expect(vl).toContainText(/revenu fiscal de référence 2024 du foyer d'au plus 29\s315\s€ par part/)
})
