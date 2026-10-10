// e2e-web/support/annees.ts
// L'année en cours de la démo (la dernière dont les règles sont connues) et l'année de la simulation d'exemple, tirées du
// code plutôt qu'écrites en dur : ajouter le fichier de règles d'une année ne demande pas de revoir ces tests.

import { expect, type Page } from "@playwright/test"
import { ANNEE_COURANTE } from "../../src/backend/regles/index"
import { ANNEE_DE_L_EXEMPLE } from "../../src/web/session-exemple"

export { ANNEE_COURANTE, ANNEE_DE_L_EXEMPLE }

/** La première année dont les règles ne sont pas connues : elle est simulée avec celles de l'année en cours. */
export const PREMIERE_ANNEE_FUTURE = ANNEE_COURANTE + 1

/** La ligne qui annonce l'année affichée et ses règles : les siennes, ou les dernières connues pour une année plus récente. */
export const ligneDeLAnnee = (annee: number) => new RegExp(`année ${annee} avec les règles fiscales ${Math.min(annee, ANNEE_COURANTE)}`)

/**
 * Ajoute à la simulation d'exemple, une à une et en recopiant les flux, les années qui la mènent jusqu'à `derniere`
 * (la fenêtre « Ajouter une année » propose d'abord l'année qui suit la plus récente).
 */
export async function ajouterLesAnneesJusqua(page: Page, derniere: number) {
  for (let annee = ANNEE_DE_L_EXEMPLE + 1; annee <= derniere; annee++) {
    await page.getByRole("button", { name: "Ajouter une année" }).click()
    await page.getByRole("button", { name: `Ajouter ${annee}` }).click()
    await expect(page.getByText(ligneDeLAnnee(annee))).toBeVisible()
  }
}
