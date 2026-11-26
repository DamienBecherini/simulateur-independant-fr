// e2e-web/epargne-retraite.web.ts
// Épargne retraite (PER, ADR 021) dans la démo web, sur la situation type du kinésithérapeute en entreprise
// individuelle (Julien, seul dans son foyer, imposé dans la tranche à 30 %) : un versement saisi dans la grille, le
// plafond de l'avis d'impôt dans la fiche, puis la carte du foyer, le bilan et le rapport Markdown exporté.

import { readFile } from "node:fs/promises"
import { test, expect, type Locator, type Page } from "@playwright/test"
import { auditerAccessibilite } from "../e2e/support/accessibilite"

const foyer = (page: Page) => page.getByRole("article").filter({ hasText: "Foyer fiscal" })
const ligne = (conteneur: Locator, libelle: string) => conteneur.locator("div").filter({ has: conteneur.page().getByText(libelle, { exact: true }) }).last()

async function ouvrir(page: Page) {
  await page.goto("./#situation=kinesitherapeute-ei")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kinésithérapeute conventionné en entreprise individuelle")
}

/** Saisit dans la grille un versement PER de Julien, le même chaque mois de l'année. */
async function verserChaqueMois(page: Page, montant: string) {
  await page.getByRole("button", { name: "Flux de janvier : Julien" }).click()
  const fenetre = page.getByRole("dialog", { name: /^Opérations de janvier \/ Julien$/ })
  await fenetre.getByRole("combobox", { name: "Type de flux" }).last().click()
  await page.getByRole("option", { name: "Versement PER (épargne retraite)" }).click()
  await fenetre.getByLabel("Ajouter à :").selectOption("annee")
  await fenetre.getByLabel("Montant du nouveau flux").fill(montant)
  await fenetre.getByLabel("Montant du nouveau flux").press("Enter")
  await expect(page.getByText("Flux ajouté à ce mois et recopié sur 11 autres mois.")).toBeVisible()
  await fenetre.getByRole("button", { name: "Terminé" }).click()
  await expect(fenetre).toBeHidden()
}

test("un versement PER au-delà du plafond : la part déduite, l'impôt économisé et l'avertissement, puis le plafond de l'avis d'impôt saisi dans la fiche", async ({ page }) => {
  await ouvrir(page)
  await expect(foyer(page)).not.toContainText("épargne retraite")

  // 500 € par mois, 6 000 € dans l'année. Sans plafond saisi, le minimum légal de 2026 : 4 710 € déduits, à 30 %.
  await verserChaqueMois(page, "500")
  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s413\s€/)
  await expect(foyer(page)).toContainText(/Versement PER : 1\s290\s€ dépassent le plafond de 2026 \(4\s710\s€\)\. Ils ne sont pas déduits, et ne le seront pas les années suivantes\./)
  await expect(foyer(page)).toContainText("le plafond de 2026 n'est pas saisi, le minimum légal est retenu")
  // Le net garde le versement : le bilan dit la part d'épargne bloquée.
  await expect(page.locator("#bilan")).toContainText(/dont 6\s000\s€ d'épargne retraite \(PER\), bloqués jusqu'à la retraite/)

  // Le plafond de l'avis d'impôt, 8 000 € : tout est déduit, 30 % de 6 000 €.
  await foyer(page).scrollIntoViewIfNeeded()
  await page.getByRole("button", { name: "Modifier les autres réglages" }).first().click()
  const fiche = page.getByRole("dialog", { name: "Modifier : Julien" })
  await expect(fiche.getByLabel("Plafond épargne retraite 2026")).toHaveAccessibleDescription(/« Plafond pour les cotisations versées en 2026 » de l'avis d'impôt reçu en 2026\. Vide : le minimum légal est retenu \(4\s710\s€\)\./)
  await fiche.getByLabel("Plafond épargne retraite 2026").fill("8000")
  await fiche.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fiche).toBeHidden()

  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s800\s€/)
  await expect(foyer(page)).not.toContainText("dépassent le plafond")
  await expect(foyer(page)).not.toContainText("n'est pas saisi")

  // Le détail de la carte : le bloc « Épargne retraite (PER) ».
  await foyer(page).getByRole("button", { name: /^Afficher le détail/ }).click()
  const bloc = foyer(page).getByRole("region", { name: "Épargne retraite (PER)" })
  await expect(ligne(bloc, "Versé en 2026")).toContainText(/6\s000\s€/)
  await expect(ligne(bloc, "Déduit du revenu")).toContainText(/− 6\s000\s€plafond pour les versements de 2026 : 8\s000\s€, saisi dans la fiche de Julien/)
  await expect(ligne(bloc, "Reste du plafond")).toContainText(/2\s000\s€du plafond saisi ; non reporté sur les années suivantes/)
  await expect(ligne(foyer(page), "Revenu fiscal de référence")).toContainText("versement PER déduit, puis rajouté ; pour le versement libératoire dans deux ans")
  await auditerAccessibilite(page, "cartes des résultats, avec le bloc de l'épargne retraite", "article")
})

test("le rapport Markdown reprend le plafond saisi, les montants du foyer et le bloc de l'épargne retraite", async ({ page }) => {
  await ouvrir(page)
  await verserChaqueMois(page, "500")
  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s413\s€/)

  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: /Rapport complet \(Markdown\)/ }).click()])
  const texte = await readFile(await telechargement.path(), "utf-8")

  expect(texte).toContain("| Versement PER (épargne retraite) | Sortie | 6 000 € |")
  expect(texte).toContain("### Épargne retraite (PER)")
  expect(texte).toContain("| Julien | Versé en 2026 | 6 000 € | — |")
  expect(texte).toContain("| Julien | Déduit du revenu | − 4 710 € | plafond pour les versements de 2026 : 4 710 €, le minimum légal, faute de plafond saisi dans la fiche de Julien |")
  expect(texte).toContain("| Julien | Non déduit | 1 290 € | au-delà du plafond, sans report |")
  expect(texte).toContain("| Julien | Impôt économisé | **1 413 €** | impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif) |")
  expect(texte).toContain("Versement PER : 1 290 € dépassent le plafond de 2026 (4 710 €).")
})
