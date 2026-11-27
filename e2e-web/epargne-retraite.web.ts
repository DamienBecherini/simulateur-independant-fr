// e2e-web/epargne-retraite.web.ts
// Épargne retraite (PER, ADR 021) dans la démo web, sur la situation type du kinésithérapeute en entreprise
// individuelle (Julien, seul dans son foyer, imposé dans la tranche à 30 %) : un versement saisi dans la grille, le
// plafond de l'avis d'impôt dans la fiche, puis les cartes du foyer et de l'activité, le bilan et le rapport Markdown
// exporté. Au-delà du plafond du revenu global, le versement se déduit du bénéfice de l'entreprise individuelle.

import { readFile } from "node:fs/promises"
import { test, expect, type Locator, type Page } from "@playwright/test"
import { auditerAccessibilite } from "../e2e/support/accessibilite"

const foyer = (page: Page) => page.getByRole("article").filter({ hasText: "Foyer fiscal" })
const activite = (page: Page) => page.getByRole("article").filter({ hasText: "Cabinet de kinésithérapie de Julien" })
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

test("un versement PER au-delà du plafond : le revenu global d'abord, puis le bénéfice de l'entreprise individuelle ; ensuite le plafond de l'avis d'impôt saisi dans la fiche", async ({ page }) => {
  await ouvrir(page)
  await expect(foyer(page)).not.toContainText("épargne retraite")

  // 500 € par mois, 6 000 € dans l'année. Sans plafond saisi, le minimum légal de 2026 : 4 710 € déduits du revenu
  // global ; les 1 290 € au-delà, du bénéfice (maquette 5). Tranche à 30 % : 30 % de 6 000 € économisés.
  await verserChaqueMois(page, "500")
  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s800\s€/)
  await expect(foyer(page)).toContainText("le plafond de 2026 n'est pas saisi, le minimum légal est retenu")
  await expect(foyer(page)).not.toContainText("dépassent")
  // Le net garde le versement : le bilan dit la part d'épargne bloquée.
  await expect(page.locator("#bilan")).toContainText(/dont 6\s000\s€ d'épargne retraite \(PER\), bloqués jusqu'à la retraite/)

  // Le détail des cartes : les deux déductions dans le bloc du foyer ; celle du bénéfice sur la carte de l'activité.
  await foyer(page).getByRole("button", { name: /^Afficher le détail/ }).click()
  const bloc = foyer(page).getByRole("region", { name: "Épargne retraite (PER)" })
  await expect(ligne(bloc, "Versé en 2026")).toContainText(/6\s000\s€/)
  await expect(ligne(bloc, "Déduit du revenu global")).toContainText(/− 4\s710\s€plafond pour les versements de 2026 : 4\s710\s€, le minimum légal/)
  // Son bénéfice est sous le plafond de la sécurité sociale, et 10 % sous le minimum : la limite est le minimum, 4 806 €.
  await expect(ligne(bloc, "Déduit du bénéfice")).toContainText(/− 1\s290\s€sous sa limite de 4\s806\s€/)
  await expect(ligne(activite(page), "Versement PER déduit du bénéfice")).toContainText(/1\s290\s€au-delà du plafond du revenu global ; limite de 4\s806\s€ : le minimum, 10\s% du plafond de la sécurité sociale\./)
  await expect(ligne(foyer(page), "Revenu fiscal de référence")).toContainText("versement PER déduit du revenu global, puis rajouté ; versement PER déduit du bénéfice, non rajouté")
  await auditerAccessibilite(page, "cartes des résultats, avec les deux déductions de l'épargne retraite", "article")

  // Le plafond de l'avis d'impôt, 8 137 € (un montant à l'euro près s'enregistre) : tout tient dans le revenu global.
  await foyer(page).scrollIntoViewIfNeeded()
  await page.getByRole("button", { name: "Modifier les autres réglages" }).first().click()
  const fiche = page.getByRole("dialog", { name: "Modifier : Julien" })
  await expect(fiche.getByLabel("Plafond épargne retraite 2026")).toHaveAccessibleDescription(/« Plafond pour les cotisations versées en 2026 » de l'avis d'impôt reçu en 2026\. Vide : le minimum légal est retenu \(4\s710\s€\)\./)
  await fiche.getByLabel("Plafond épargne retraite 2026").fill("8137")
  await fiche.getByRole("button", { name: "Enregistrer" }).click()
  await expect(fiche).toBeHidden()

  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s800\s€/)
  await expect(foyer(page)).not.toContainText("n'est pas saisi")
  await expect(activite(page)).not.toContainText("Versement PER déduit")
  await expect(ligne(bloc, "Déduit du revenu")).toContainText(/− 6\s000\s€plafond pour les versements de 2026 : 8\s137\s€, saisi dans la fiche de Julien/)
  await expect(ligne(bloc, "Reste du plafond")).toContainText(/2\s137\s€du plafond saisi ; non reporté sur les années suivantes/)
  await expect(ligne(foyer(page), "Revenu fiscal de référence")).toContainText("versement PER déduit, puis rajouté ; pour le versement libératoire dans deux ans")
})

test("le rapport Markdown reprend les montants du foyer et les deux déductions du bloc de l'épargne retraite", async ({ page }) => {
  await ouvrir(page)
  await verserChaqueMois(page, "500")
  await expect(ligne(foyer(page), "Impôt économisé (versement PER)")).toContainText(/1\s800\s€/)

  await page.getByRole("button", { name: "Exporter", exact: true }).click()
  const [telechargement] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog", { name: "Exporter" }).getByRole("button", { name: /Rapport complet \(Markdown\)/ }).click()])
  const texte = await readFile(await telechargement.path(), "utf-8")

  expect(texte).toContain("| Versement PER (épargne retraite) | Sortie | 6 000 € |")
  expect(texte).toContain("### Épargne retraite (PER)")
  expect(texte).toContain("| Julien | Versé en 2026 | 6 000 € | — |")
  expect(texte).toContain("| Julien | Déduit du revenu global | − 4 710 € | plafond pour les versements de 2026 : 4 710 €, le minimum légal, faute de plafond saisi dans la fiche de Julien |")
  expect(texte).toContain("| Julien | Déduit du bénéfice | − 1 290 € | sous sa limite de 4 806 € |")
  expect(texte).toContain("| Julien | Impôt économisé | **1 800 €** | impôt recalculé sans le versement ; tranche marginale : 30 % (indicatif) |")
  expect(texte).not.toContain("Non déduit")
})
