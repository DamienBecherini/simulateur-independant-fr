// e2e-web/comparateur-alignement.web.ts
// Tableau du comparateur : dans une ligne, les montants de toutes les colonnes restent à la même hauteur, que la note à
// déplier d'une colonne (écart de frais de gestion) soit présente, absente, repliée ou dépliée.

import { test, expect, type Page } from "@playwright/test"
import { deplierLeTableauDuComparateur } from "./support/affichage"

const ligneDuNet = (page: Page) => page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("row", { name: /^Net dans la poche/ })

/** Haut du premier texte de chaque case de la ligne, libellé compris : le montant, pour les cases de colonne. */
function hautsDesMontants(page: Page): Promise<number[]> {
  return ligneDuNet(page).evaluate(ligne =>
    Array.from(ligne.children).map(caseDeLaLigne => {
      const texte = Array.from(caseDeLaLigne.childNodes).find(noeud => noeud.nodeType === Node.TEXT_NODE && noeud.textContent!.trim() !== "")!
      const plage = document.createRange()
      plage.selectNodeContents(texte)
      return plage.getBoundingClientRect().top
    })
  )
}

function verifierLAlignement(hauts: number[]) {
  expect(hauts.length).toBeGreaterThanOrEqual(4)
  for (const haut of hauts) expect(Math.abs(haut - hauts[0]), `hauts : ${hauts.join(", ")}`).toBeLessThanOrEqual(2)
}

test("les montants du net sont sur la même ligne dans toutes les colonnes, note de frais repliée ou dépliée", async ({ page }) => {
  await page.goto("./")
  await deplierLeTableauDuComparateur(page)
  // Certaines colonnes ont une note de frais à déplier sous leur net, d'autres non.
  const notes = ligneDuNet(page).locator("details")
  await expect(notes.first()).toBeVisible()
  expect(await notes.count()).toBeLessThan(await ligneDuNet(page).getByRole("cell").count())
  verifierLAlignement(await hautsDesMontants(page))

  await notes.first().locator("summary").click()
  await expect(notes.first()).toHaveAttribute("open", "")
  verifierLAlignement(await hautsDesMontants(page))
})
