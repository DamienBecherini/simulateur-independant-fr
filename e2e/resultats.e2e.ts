// e2e/resultats.e2e.ts
// Résultats d'un scénario préparé : les montants affichés sont ceux du moteur de calcul, et cohérents entre eux.
// Les barèmes eux-mêmes sont vérifiés par les tests unitaires du moteur : ici, on ne les recopie pas.

import { test, expect, deposerSession } from "./support/fixtures"
import { euros, montant, netDansLaPoche, valeurDeLigne } from "./support/interface"
import { ATELIER, sessionMicroBnc } from "./support/sessions"

test("une micro-entreprise BNC à 30 000 € de chiffre d'affaires affiche les montants calculés par le moteur", async ({ dossierDonnees, lancer }) => {
  const session = sessionMicroBnc()
  await deposerSession(dossierDonnees, session)
  const { page, erreursConsole } = await lancer()

  // Référence : la même session simulée par le process principal, via l'API exposée par le preload.
  const rapport = await page.evaluate(s => window.api.runMetaSimulation(s), session)
  const activite = rapport.activities.find(a => a.entityId === ATELIER.id)!
  const foyer = rapport.foyers[0]

  // Carte de l'activité.
  const carteActivite = page.getByRole("article").filter({ hasText: ATELIER.name })
  await expect(carteActivite.getByText("Micro-entreprise", { exact: true })).toBeVisible()
  await expect(valeurDeLigne(carteActivite, "Chiffre d'affaires")).toHaveText(/^30\s000\s€$/)
  await expect(valeurDeLigne(carteActivite, "Cotisations sociales")).toHaveText(`− ${euros(activite.cotisationsSociales)}`)
  await expect(valeurDeLigne(carteActivite, "Versé avant impôt sur le revenu")).toContainText(euros(activite.revenuVerse))
  await expect(carteActivite).toContainText("Versement libératoire (non appliqué)")

  // Carte du foyer fiscal d'Alice, une part.
  const carteFoyer = page.getByRole("article").filter({ hasText: "Foyer fiscal" })
  await expect(carteFoyer.getByText("Foyer fiscal · 1 part")).toBeVisible()
  await expect(valeurDeLigne(carteFoyer, "Impôt sur le revenu")).toContainText(`− ${euros(foyer.impotSurLeRevenu)}`)
  await expect(valeurDeLigne(carteFoyer, "Net après impôts")).toHaveText(euros(foyer.netApresImpots))

  // Bilan : sans charges, le net est le chiffre d'affaires moins les cotisations et l'impôt (à l'arrondi près).
  const net = await netDansLaPoche(page)
  expect(net).toBe(Math.round(rapport.totalNetApresImpots))
  const cotisations = -montant(await valeurDeLigne(carteActivite, "Cotisations sociales").innerText())
  const impot = -montant(await valeurDeLigne(carteFoyer, "Impôt sur le revenu").innerText())
  expect(cotisations).toBeGreaterThan(0)
  expect(Math.abs(30_000 - cotisations - impot - net)).toBeLessThanOrEqual(2)

  expect(erreursConsole).toEqual([])
})
