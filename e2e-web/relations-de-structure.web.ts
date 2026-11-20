// e2e-web/relations-de-structure.web.ts
// Les règles de structure (ADR 018) dans la démo : Julien préside la SASU de l'exemple et en est l'associé. La saisie ne
// propose pas un second président ni un second titulaire, explique chaque relation proposée, et le président qui n'est
// plus associé garde sa rémunération mais ne reçoit plus les dividendes, ce que la carte de la société signale.

import { test, expect, type Locator, type Page } from "@playwright/test"
import { choisirAvantLeChargement } from "./support/affichage"

const SASU = "Conseil SASU"

/** La carte d'un acteur, dans la liste des personnes et des activités : celle qui porte sa poignée de tri. */
function ligne(page: Page, nom: string): Locator {
  return page.locator('[data-impression="bloc"]').filter({ has: page.getByLabel(`Déplacer « ${nom} »`, { exact: true }) })
}

test("la saisie ne propose ni second président ni second titulaire, et dit ce que veut dire chaque relation", async ({ page }) => {
  await choisirAvantLeChargement(page, "classique")
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()

  // Julien porte les deux relations de qui exerce seul sa SASU.
  const julien = ligne(page, "Julien Martin")
  await expect(julien.getByRole("button", { name: `Supprimer la relation « Président » avec ${SASU}` })).toBeVisible()
  await expect(julien.getByRole("button", { name: `Supprimer la relation « Associé » avec ${SASU}` })).toBeVisible()

  // Camille peut devenir associée ou salariée de la SASU, pas sa présidente : elle en a déjà un.
  const camille = ligne(page, "Camille Martin")
  await camille.getByRole("button", { name: "Relation", exact: true }).click()
  await camille.getByRole("combobox", { name: "Avec qui" }).click()
  await page.getByRole("option", { name: SASU }).click()
  await expect(camille.getByText(/^Associé : reçoit sa part des dividendes\./)).toBeVisible()
  await expect(camille.getByText(/^Président : /)).toHaveCount(0)
  await camille.getByRole("combobox", { name: "Type de relation" }).click()
  await expect(page.getByRole("option")).toHaveText(["Associé", "Salarié"])
  await page.keyboard.press("Escape")
  await camille.getByRole("button", { name: "Annuler l'ajout de relation" }).click()

  // Julien ne peut pas devenir le second titulaire de la micro-entreprise de Camille : elle n'est pas dans sa liste.
  await julien.getByRole("button", { name: "Relation", exact: true }).click()
  await julien.getByRole("combobox", { name: "Avec qui" }).click()
  await expect(page.getByRole("option", { name: "Atelier de Camille" })).toHaveCount(0)
  await expect(page.getByRole("option").first()).toBeVisible()
})

test("le président qui n'est plus associé garde sa rémunération, pas les dividendes : la carte de la société le dit", async ({ page }) => {
  await choisirAvantLeChargement(page, "classique")
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  const carte = page.getByRole("article").filter({ hasText: SASU }).first()
  await expect(carte).not.toContainText("Dividendes versés sans associé")

  await ligne(page, "Julien Martin").getByRole("button", { name: `Supprimer la relation « Associé » avec ${SASU}` }).click()
  await expect(carte).toContainText("Dividendes versés sans associé : non routés vers un foyer. Reliez une personne à la société par « Associé » ; son président n'en reçoit que s'il est aussi associé.")

  // Annuler rétablit la relation, et l'alerte disparaît.
  await page.getByRole("button", { name: "Annuler", exact: true }).click()
  await expect(carte).not.toContainText("Dividendes versés sans associé")
  await expect(ligne(page, "Julien Martin").getByRole("button", { name: `Supprimer la relation « Associé » avec ${SASU}` })).toBeVisible()
})
