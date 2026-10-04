// e2e-web/curseurs.web.ts
// Le curseur signale ce qui se clique : une main sur les boutons, interrupteurs, listes déroulantes, sections
// repliables et cases de la grille, une interdiction sur un bouton désactivé, une main fermée sur les poignées.

import { test, expect, type Locator } from "@playwright/test"

const curseur = (element: Locator) => element.evaluate(e => getComputedStyle(e).cursor)

test("les éléments cliquables affichent le curseur main", async ({ page }) => {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()

  const cliquables: [string, Locator][] = [
    ["bouton", page.getByRole("button", { name: "+ Ajouter une Personne" })],
    ["bouton icône", page.getByRole("button", { name: "Paramètres" })],
    ["interrupteur", page.getByRole("switch", { name: "Changer de thème" })],
    ["liste déroulante", page.getByRole("combobox", { name: "Activité comparée" })],
    ["section repliable", page.locator("summary").first()],
    ["case de la grille", page.getByRole("button", { name: /^Flux de janvier/ }).first()],
    ["étiquette d'interrupteur", page.locator("label").filter({ has: page.getByRole("switch") }).first()],
    ["lien", page.getByRole("link", { name: "Code source et application de bureau" })]
  ]
  for (const [nature, element] of cliquables) expect(await curseur(element), nature).toBe("pointer")

  // Au chargement, rien n'est encore à annuler.
  expect(await curseur(page.getByRole("button", { name: "Annuler" })), "bouton désactivé").toBe("not-allowed")
  expect(await curseur(page.getByRole("button", { name: /^Déplacer/ }).first()), "poignée de glisser-déposer").toBe("grab")

  await page.getByRole("combobox", { name: "Activité comparée" }).click()
  expect(await curseur(page.getByRole("option").first()), "option de liste déroulante").toBe("pointer")
})
