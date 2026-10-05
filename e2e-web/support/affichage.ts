// e2e-web/support/affichage.ts
// Affichage de la page dans les tests de la démo web : « Résumé » par défaut, les autres choisis avant le chargement.

import { expect, type Page } from "@playwright/test"
import type { Affichage } from "../../src/types"

/** Dépose la préférence d'affichage avant le chargement, comme si elle avait été choisie lors d'une visite précédente. */
export async function choisirAvantLeChargement(page: Page, affichage: Affichage) {
  await page.addInitScript(choix => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: choix })), affichage)
}

/**
 * Affichage « Résumé » : le tableau du comparateur est réduit à ses lignes clés (et remplacé par des cartes sur
 * téléphone) ; « Voir le détail » le déplie en entier.
 */
export async function deplierLeTableauDuComparateur(page: Page) {
  await page.getByRole("button", { name: /^Voir le détail : taux/ }).click()
  await expect(page.getByRole("button", { name: "Masquer le détail", exact: true })).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
}
