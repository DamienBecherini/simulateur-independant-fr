// e2e-web/reserves.web.ts
// Bénéfice mis en réserve puis distribué (voir l'ADR 014) : la SASU d'Alice facture 60 000 € en 2025, en distribue la
// moitié et garde le reste, qu'elle distribue en 2026. Réserves dans la carte de l'activité et la synthèse des années,
// stratégies de distribution du comparateur « Sur toutes les années », dans les trois affichages, sur téléphone et en
// thème sombre. Les chiffres sont ceux des cas de référence (src/backend/logic/references/reserves.reference.test.ts).

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"
import { choisirLaPolice, POLICES } from "./support/police"

function grille(flux: { type: string; amount: number }[]) {
  return Array.from({ length: 12 }, (_, month) => ({ month, flows: month === 0 ? flux.map((f, i) => ({ id: `f-${i}`, entityId: "company-conseil", label: f.type, ...f })) : [] }))
}

const sansFrais = { expertComptable: 0, banque: 0, logiciel: 0, assurance: 0, cfe: 0 }

const SESSION = {
  formatVersion: 3,
  name: "Conseil, deux années",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "company-conseil", type: "company", name: "Conseil", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Briefcase", color: "#b91c1c" }, locked: false }
  ],
  relationships: [{ id: "r-president", fromId: "person-alice", toId: "company-conseil", type: "Président" }],
  annees: [
    {
      annee: 2025,
      monthlyData: grille([
        { type: "ca_services", amount: 60000 },
        { type: "dividends_payment", amount: 24625 }
      ])
    },
    { annee: 2026, monthlyData: grille([{ type: "dividends_payment", amount: 24625 }]) }
  ],
  // Sans frais de fonctionnement, les stratégies retrouvent les chiffres des cas de référence.
  comparateur: { activiteComparee: "company-conseil", reglagesParActivite: { "company-conseil": { fraisFonctionnement: { SASU: sansFrais, EURL: sansFrais, EI: sansFrais, micro: sansFrais } } } }
}

async function ouvrir(page: Page) {
  await page.addInitScript(session => window.localStorage.setItem("simulateur.session", JSON.stringify(session)), SESSION)
  await page.goto("./")
  await expect(page.getByText(/année 2026 avec les règles fiscales 2026/)).toBeVisible()
}

const carteConseil = (page: Page) => page.getByRole("article").filter({ has: page.getByText("Conseil", { exact: true }) }).first()
const annee = (page: Page, valeur: string) => page.getByRole("group", { name: "Année affichée" }).getByRole("button", { name: valeur, exact: true })
const surToutesLesAnnees = (page: Page) => page.getByRole("region", { name: "Sur toutes les années" })

test("les réserves de 2025 sont distribuées en 2026, et « Sur toutes les années » désigne la meilleure stratégie", async ({ page }) => {
  await ouvrir(page)

  // 2026 : les dividendes viennent des réserves gardées en 2025.
  await expect(carteConseil(page)).toContainText(/Réserves au 31 décembre\s*0\s€\s*plus 100\s€ de réserve légale/)
  const synthese = page.getByRole("table", { name: /réserves des sociétés/ })
  await expect(synthese.getByRole("columnheader", { name: "Réserves des sociétés au 31 décembre" })).toBeVisible()
  await expect(synthese.getByRole("row", { name: /^2025/ })).toContainText(/24\s625\s€$/)

  await annee(page, "2025").click()
  await expect(page.getByText(/année 2025 avec les règles fiscales 2025/)).toBeVisible()
  await expect(carteConseil(page)).toContainText(/Réserves au 31 décembre\s*24\s625\s€/)

  // Garder la moitié en 2025 et la distribuer en 2026 rapporte 1 092 € de plus que de tout distribuer en 2025.
  const section = surToutesLesAnnees(page)
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByText(/^En SASU, la meilleure/)).toHaveText(/^En SASU, la meilleure : « Garder 50\s% et distribuer la dernière année », 1\s092\s€ de plus que de tout distribuer chaque année\.$/)
  const sasu = section.getByRole("table", { name: /en SASU/ })
  await expect(sasu.getByRole("row", { name: /Garder 50\s%/ })).toContainText("Meilleur net")
  await expect(sasu.getByRole("row", { name: /Garder 50\s%/ })).toContainText(/40\s435\s€/)
  await expect(sasu.getByRole("row", { name: /Tout distribuer/ })).toContainText(/39\s343\s€/)
  await expect(sasu.getByText("Meilleur net")).toHaveCount(1)
  await auditer(page, "réserves et stratégies de distribution")

  // La part gardée se règle, et la stratégie suit.
  await section.getByLabel("Part gardée chaque année (%)").fill("30")
  await expect(sasu.getByRole("row", { name: /^Garder 30\s% et distribuer la dernière année/ })).toBeVisible()

  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "réserves et stratégies de distribution, thème sombre")
})

test("« Sur toutes les années » dans l'affichage classique et dans la vue « Comparer »", async ({ page }) => {
  await choisirAvantLeChargement(page, "classique")
  await ouvrir(page)
  await expect(surToutesLesAnnees(page).getByRole("table", { name: /en EURL/ })).toBeVisible()

  await choisirAvantLeChargement(page, "vues")
  await page.reload()
  await page.getByRole("tablist", { name: "Vues de la page" }).getByRole("tab", { name: /comparer/i }).click()
  await expect(surToutesLesAnnees(page).getByRole("table", { name: /en SASU/ })).toBeVisible()
})

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 812 }, hasTouch: true, isMobile: true })

    for (const police of POLICES) {
      test(`les réserves et les stratégies tiennent en largeur, ${police}`, async ({ page, context }) => {
        await choisirLaPolice(context, police)
        await ouvrir(page)
        await expect(carteConseil(page)).toContainText("Réserves au 31 décembre")
        const section = surToutesLesAnnees(page)
        await section.scrollIntoViewIfNeeded()
        await expect(section.getByRole("table", { name: /en SASU/ })).toBeAttached()
        await expect(section.getByText("Meilleur net").first()).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
        if (largeur === 375 && police === "police du système") await auditer(page, "375 px, réserves et stratégies")
      })
    }
  })
}
