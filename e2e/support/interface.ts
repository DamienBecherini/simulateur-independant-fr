// e2e/support/interface.ts
// Lecture des montants affichés par l'interface.

import type { Locator, Page } from "@playwright/test"

/**
 * Premier montant d'un texte affiché (« 30 000 € », « − 1 234 € »), en nombre. Le reste du texte
 * (pourcentage, précision) est ignoré. Les séparateurs de milliers du français sont des espaces insécables.
 */
export function montant(texte: string): number {
  const trouve = texte.match(/(−\s*)?\d[\d\s]*€/)
  if (!trouve) throw new Error(`Aucun montant dans « ${texte} »`)
  const valeur = Number(trouve[0].replace(/\D/g, ""))
  return trouve[1] ? -valeur : valeur
}

/** Valeur d'une ligne « libellé — montant » d'une carte de résultats (liste de définitions). */
export function valeurDeLigne(conteneur: Page | Locator, libelle: string): Locator {
  return conteneur.getByRole("term").filter({ hasText: new RegExp(`^${libelle}$`) }).locator("xpath=following-sibling::dd[1]")
}

/** Montant « Net dans la poche » du bilan de la simulation. */
export async function netDansLaPoche(page: Page): Promise<number> {
  const titre = page.getByText("Net dans la poche", { exact: true }).first()
  return montant(await titre.locator("xpath=following-sibling::p[1]").innerText())
}

/** Montant mis en forme comme dans l'interface (« 30 000 € »), pour comparer avec un résultat du moteur. */
export function euros(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}
