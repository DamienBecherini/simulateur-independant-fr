// e2e/annees.e2e.ts
// Plusieurs années dans l'application de bureau : session modifiée à la main (année en double), ajout d'années
// avant et après, annulation et rétablissement, puis conservation sur le disque d'un lancement à l'autre.

import type { Page } from "@playwright/test"
import { ANNEE_COURANTE } from "../src/backend/regles/index"
import type { SessionState } from "../src/types"
import { test, expect, deposerSession, lireFichier } from "./support/fixtures"
import { ATELIER, grilleMensuelle, sessionMicroBnc } from "./support/sessions"

const boutonsDesAnnees = (page: Page) => page.getByRole("group", { name: "Année affichée" }).getByRole("button")
const anneeAffichee = (page: Page) => page.getByRole("group", { name: "Année affichée" }).getByRole("button", { pressed: true })

/** Ajoute une année depuis la fenêtre d'ajout ; `vide` démarre sur une grille vide plutôt que sur une copie. */
async function ajouterUneAnnee(page: Page, annee: number, position: "avant" | "après", vide = false) {
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await page.getByRole("radio", { name: new RegExp(`^${annee}, ${position}`) }).check()
  if (vide) await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
  await page.getByRole("button", { name: `Ajouter ${annee}` }).click()
  await expect(anneeAffichee(page)).toHaveText(String(annee))
}

test("années modifiées à la main, ajoutées, annulées puis rétablies : tout est retrouvé au lancement suivant", async ({ dossierDonnees, lancer }) => {
  // Fichier modifié à la main : 2026 puis 2025, et 2026 une seconde fois avec un flux, qui est écarté.
  const micro = sessionMicroBnc()
  const doublon = grilleMensuelle([{ mois: 0, flux: { id: "flux-doublon", entityId: ATELIER.id, type: "ca_micro_services_bnc", label: "Doublon", amount: 99999 } }])
  await deposerSession(dossierDonnees, { ...micro, annees: [micro.annees[0], { annee: 2025, monthlyData: grilleMensuelle() }, { annee: 2026, monthlyData: doublon }] })

  const premier = await lancer()
  const { page } = premier
  await expect(boutonsDesAnnees(page)).toHaveText(["2025", "2026"])
  await expect(anneeAffichee(page)).toHaveText("2026")
  await expect(page.getByRole("button", { name: "Flux de janvier : Atelier Martin" })).toContainText(/2\s500/)
  const messages = await premier.dialogues()
  expect(messages).toHaveLength(1)
  expect(messages[0].message).toContain("Flux invalides ou orphelins supprimés : 1")

  // 2027, recopiée de 2026, simulée avec ses règles ou, tant qu'elles ne sont pas connues, avec celles de l'année en
  // cours (l'avertissement qui le signale est vérifié dans la démo web, annees.web.ts).
  await ajouterUneAnnee(page, 2027, "après")
  await expect(page.getByText(new RegExp(`année 2027 avec les règles fiscales ${Math.min(2027, ANNEE_COURANTE)}`))).toBeVisible()
  await expect(page.getByRole("button", { name: "Flux de janvier : Atelier Martin" })).toContainText(/2\s500/)

  // Ctrl+Z retire 2027 et revient sur une année existante ; Ctrl+Y la rétablit.
  await page.keyboard.press("Control+z")
  await expect(boutonsDesAnnees(page)).toHaveText(["2025", "2026"])
  await expect(anneeAffichee(page)).toHaveText("2026")
  await page.keyboard.press("Control+y")
  await expect(boutonsDesAnnees(page)).toHaveText(["2025", "2026", "2027"])

  // 2024, vide, avant la plus ancienne : la première année dont les règles sont connues.
  await ajouterUneAnnee(page, 2024, "avant", true)
  await expect(page.getByText(/année 2024 avec les règles fiscales 2024/)).toBeVisible()

  // Une année du milieu ne se supprime pas : les années restent consécutives.
  await boutonsDesAnnees(page).filter({ hasText: "2025" }).click()
  await expect(anneeAffichee(page)).toHaveText("2025")
  await expect(page.getByRole("button", { name: /^Supprimer 20/ })).toHaveCount(0)

  // La sauvegarde automatique écrit les quatre années, chacune avec sa grille.
  await expect
    .poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.annees.map(a => [a.annee, a.monthlyData.reduce((n, mois) => n + mois.flows.length, 0)]))
    .toEqual([
      [2024, 0],
      [2025, 0],
      [2026, 12],
      [2027, 12]
    ])
  await premier.electronApp.close()

  const second = await lancer()
  await expect(boutonsDesAnnees(second.page)).toHaveText(["2024", "2025", "2026", "2027"])
  await expect(anneeAffichee(second.page)).toHaveText("2027")
  expect(await second.dialogues()).toEqual([])
})
