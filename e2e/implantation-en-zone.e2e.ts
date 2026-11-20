// e2e/implantation-en-zone.e2e.ts
// Exonération d'impôt sur les bénéfices en zone (ADR 017), dans l'application de bureau : la case cochée dans la fiche
// d'une SASU créée en janvier 2024 est enregistrée dans le fichier de la session, retrouvée au lancement suivant, et
// change le calcul (80 000 € de bénéfice : 50 000 € exonérés, 4 500 € d'impôt sur les sociétés au lieu de 15 750 €).

import type { Company, SessionState } from "../src/types"
import { test, expect, deposerSession, lireFichier } from "./support/fixtures"
import { auditerAccessibilite } from "./support/accessibilite"
import { valeurDeLigne } from "./support/interface"
import { ALICE, grilleMensuelle } from "./support/sessions"

const ATELIER: Company = { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, dateDeCreation: "2024-01", avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }

function sessionSasu(): SessionState {
  return {
    name: "Atelier en zone franche",
    entities: [ALICE, ATELIER],
    relationships: [{ id: "rel-president", fromId: ALICE.id, toId: ATELIER.id, type: "Président" }],
    annees: [{ annee: 2026, monthlyData: grilleMensuelle([{ mois: 0, flux: { id: "flow-ca", entityId: ATELIER.id, type: "ca_services", label: "Prestations", amount: 80000 } }]) }]
  }
}

const CASE = "Activité implantée en zone franche urbaine (ZFU-TE) ou en quartier prioritaire (QPV)"

test("la case « implantée en zone » s'enregistre avec la session, se retrouve au lancement suivant et exonère le bénéfice", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionSasu())
  const premier = await lancer()
  const page = premier.page
  const carte = page.getByRole("article").filter({ has: page.getByText("Atelier", { exact: true }) }).first()
  await carte.getByRole("button", { name: "Afficher le détail" }).click()
  await expect(valeurDeLigne(carte, "Impôt sur les sociétés")).toHaveText(/− 15\s750\s€/)

  // La fiche de la société : la section est repliée ; on la déplie et on coche la case.
  await page.getByRole("button", { name: "Modifier les autres réglages" }).last().click()
  const fenetre = page.getByRole("dialog", { name: "Modifier : Atelier" })
  const section = fenetre.locator("details").filter({ hasText: "Aides liées au lieu d'implantation" })
  await expect(section).not.toHaveAttribute("open")
  await section.locator("summary").click()
  await fenetre.getByRole("switch", { name: CASE }).click()
  await expect(fenetre.getByRole("status")).toContainText("Créée en janvier 2024 : régime ZFU-TE.")
  // Une seule hypothèse pour une SASU : celle des cotisations de l'entreprise individuelle ne la concerne pas.
  await expect(fenetre.getByRole("list", { name: "Ce que ce calcul suppose" }).getByRole("listitem")).toHaveCount(1)
  await auditerAccessibilite(page, "fiche d'une société, aides liées au lieu d'implantation", "[role='dialog']")
  await fenetre.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fenetre).toBeHidden()

  // Le calcul change, et la carte dit pourquoi.
  await expect(carte.getByRole("list", { name: "Dispositifs de l'année" })).toContainText(/ZFU-TE : bénéfice exonéré d'impôt à 100\s% en 2026, soit 50\s000\s€ : plafond de 50\s000\s€ atteint\./)
  await expect(valeurDeLigne(carte, "Bénéfice exonéré d'impôt")).toHaveText(/50\s000\s€\s*ZFU-TE, exonéré à 100\s%, plafond atteint/)
  await expect(valeurDeLigne(carte, "Impôt sur les sociétés")).toHaveText(/− 4\s500\s€/)

  // La sauvegarde automatique écrit la case dans le fichier de la session, sans le régime ni le taux, qui se déduisent.
  await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.entities.find(e => e.id === ATELIER.id)).toMatchObject({ implantationEnZone: {}, dateDeCreation: "2024-01" })
  await premier.electronApp.close()

  // Au lancement suivant, l'exonération est toujours là, et la section de la fiche s'ouvre d'elle-même, case cochée.
  const second = await lancer()
  const carteRetrouvee = second.page.getByRole("article").filter({ has: second.page.getByText("Atelier", { exact: true }) }).first()
  await expect(carteRetrouvee.getByRole("list", { name: "Dispositifs de l'année" })).toContainText("ZFU-TE : bénéfice exonéré d'impôt")
  await second.page.getByRole("button", { name: "Modifier les autres réglages" }).last().click()
  const fenetreRetrouvee = second.page.getByRole("dialog", { name: "Modifier : Atelier" })
  await expect(fenetreRetrouvee.locator("details").filter({ hasText: "Aides liées au lieu d'implantation" })).toHaveAttribute("open", "")
  await expect(fenetreRetrouvee.getByRole("switch", { name: CASE })).toBeChecked()
  expect(second.erreursConsole).toEqual([])
})
