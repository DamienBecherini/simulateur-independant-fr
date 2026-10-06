// e2e/mentions-legales.e2e.ts
// « Mentions légales et confidentialité » dans l'application de bureau : le lien du pied de page ouvre la fenêtre,
// l'e-mail de contact et les liens externes partent vers la messagerie et le navigateur du système, sans quitter
// l'application. L'ouverture est remplacée (neutraliser-dialogues.cjs) : rien ne s'ouvre.

import { test, expect, adressesOuvertes } from "./support/fixtures"

const NOM = "Mentions légales et confidentialité"

test("le lien du pied de page ouvre les mentions légales ; leurs liens s'ouvrent hors de l'application", async ({ lancer }) => {
  const { electronApp, page, erreursConsole } = await lancer()
  const bouton = page.getByRole("contentinfo").getByRole("button", { name: NOM })
  await bouton.click()
  const fenetre = page.getByRole("dialog", { name: NOM })
  await expect(fenetre.getByRole("heading", { level: 3, name: "Données personnelles et confidentialité" })).toBeVisible()

  await fenetre.getByRole("link", { name: "simulateur-independant@damien.becherini.fr" }).first().click()
  await fenetre.getByRole("link", { name: /^licence MIT/ }).click()
  await expect.poll(() => adressesOuvertes(electronApp)).toEqual(["mailto:simulateur-independant@damien.becherini.fr", "https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/LICENSE"])
  // La page de l'application est toujours là.
  await expect(fenetre).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(fenetre).toBeHidden()
  await expect(bouton).toBeFocused()
  expect(erreursConsole).toEqual([])
})
