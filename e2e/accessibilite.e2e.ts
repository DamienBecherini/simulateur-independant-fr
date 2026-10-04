// e2e/accessibilite.e2e.ts
// Audit axe-core (WCAG 2.2 AA) de l'application de bureau : la démo web est auditée plus en détail
// (e2e-web/accessibilite.web.ts), on vérifie ici que la fenêtre Electron donne le même résultat.

import { test, expect, deposerSession } from "./support/fixtures"
import { auditerAccessibilite } from "./support/accessibilite"
import { sessionMicroBnc } from "./support/sessions"

test("l'application de bureau ne présente aucune violation WCAG, page et fenêtre des paramètres", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  const { page, erreursConsole } = await lancer()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()

  await auditerAccessibilite(page, "application de bureau")

  await page.getByRole("button", { name: "Paramètres" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await auditerAccessibilite(page, "paramètres, application de bureau", "[role=dialog]")

  expect(erreursConsole).toEqual([])
})
