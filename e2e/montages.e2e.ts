// e2e/montages.e2e.ts
// Montages types dans l'application de bureau : chargés depuis une simulation vide, puis enregistrés comme session.

import type { SessionState } from "../src/types"
import { test, expect, lireFichier } from "./support/fixtures"

test("depuis une simulation vide, charger un montage type le calcule et l'enregistre comme session en cours", async ({ dossierDonnees, lancer }) => {
  const { page, erreursConsole } = await lancer()
  await expect(page.getByText("Aucune entité. Commencez par en ajouter une !")).toBeVisible()

  await page.getByRole("button", { name: "Partir d'un montage type..." }).click()
  const montages = page.getByRole("dialog", { name: "Partir d'un montage type" })
  await montages.getByRole("button", { name: "Charger le montage « Micro-entreprise seule (BNC) »" }).click()

  // Rien n'était à perdre : pas de confirmation, la session prend le nom du montage.
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Micro-entreprise seule (BNC)")
  // 36 000 € de chiffre d'affaires : 25 992 € nets pour le foyer (montages.reference.test.ts).
  await expect(page.getByText(/^25\s992\s€$/).first()).toBeVisible()
  await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.name).toBe("Micro-entreprise seule (BNC)")

  expect(erreursConsole).toEqual([])
})
