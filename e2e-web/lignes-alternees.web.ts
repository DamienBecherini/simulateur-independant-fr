// e2e-web/lignes-alternees.web.ts
// Lignes alternées du tableau du comparateur et de la grille mensuelle : deux lignes consécutives n'ont pas le même
// fond, et la cellule fixe de gauche prend le fond de sa ligne (sinon la bande se couperait au défilement en largeur).

import { test, expect, type Page } from "@playwright/test"
import { deplierLeTableauDuComparateur } from "./support/affichage"

/** Fond d'une case : sa couleur et l'image (la teinte de la bande) posée par-dessus. */
interface Fond {
  couleur: string
  image: string
}

interface LigneDuTableau {
  /** La cellule fixe de gauche (en-tête de ligne). */
  entete: Fond & { position: string }
  /** Les autres cases de la ligne. */
  cases: Fond[]
}

/** Lignes visibles du corps du tableau du comparateur, dans l'ordre affiché. */
async function lignesDuComparateur(page: Page): Promise<LigneDuTableau[]> {
  return page.getByRole("table", { name: "Comparaison des statuts" }).evaluate(table => {
    const fond = (el: Element) => {
      const style = getComputedStyle(el)
      return { couleur: style.backgroundColor, image: style.backgroundImage }
    }
    return Array.from(table.querySelectorAll("tbody > tr"))
      .filter(tr => tr.getClientRects().length > 0)
      .map(tr => {
        const [entete, ...cases] = Array.from(tr.children)
        return { entete: { ...fond(entete), position: getComputedStyle(entete).position }, cases: cases.map(fond) }
      })
  })
}

function verifierLesLignes(lignes: LigneDuTableau[]) {
  expect(lignes.length).toBeGreaterThanOrEqual(3)
  for (const [i, ligne] of lignes.entries()) {
    // La cellule fixe est opaque et porte la même teinte que les autres cases de sa ligne.
    expect(ligne.entete.position).toBe("sticky")
    expect(ligne.entete.couleur).not.toBe("rgba(0, 0, 0, 0)")
    for (const c of ligne.cases) expect(c.image, `ligne ${i + 1}`).toBe(ligne.entete.image)
    if (i > 0) expect(ligne.entete.image, `lignes ${i} et ${i + 1}`).not.toBe(lignes[i - 1].entete.image)
  }
}

test("le tableau du comparateur alterne le fond de ses lignes, cellule fixe comprise, en clair et en sombre", async ({ page }) => {
  await page.goto("./")
  // Affichage « Résumé » : l'écart et la protection sociale remontent sous la première ligne.
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  verifierLesLignes(await lignesDuComparateur(page))

  await deplierLeTableauDuComparateur(page)
  verifierLesLignes(await lignesDuComparateur(page))

  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  verifierLesLignes(await lignesDuComparateur(page))
})

test("la grille mensuelle alterne le fond de ses lignes, nom de l'acteur compris, et le survol reste visible", async ({ page }) => {
  await page.goto("./")
  const totaux = page.getByRole("group", { name: /^Total annuel : / })
  await expect(totaux.first()).toBeVisible()
  // Chaque ligne : le nom (colonne fixe), le total annuel, puis les douze mois.
  const lignes = await totaux.evaluateAll(groupes =>
    groupes.map(total => {
      const nom = total.previousElementSibling!
      const mois = Array.from({ length: 12 }, (_, i) => total.parentElement!.children[Array.from(total.parentElement!.children).indexOf(total) + 1 + i])
      const style = (el: Element) => getComputedStyle(el)
      return {
        nom: { couleur: style(nom).backgroundColor, image: style(nom).backgroundImage, position: style(nom).position },
        total: style(total).backgroundImage,
        mois: mois.map(m => ({ couleur: style(m).backgroundColor, image: style(m).backgroundImage }))
      }
    })
  )
  expect(lignes.length).toBeGreaterThanOrEqual(2)
  for (const [i, ligne] of lignes.entries()) {
    expect(ligne.nom.position).toBe("sticky")
    expect(ligne.total).toBe(ligne.nom.image)
    for (const m of ligne.mois) expect(m).toEqual({ couleur: ligne.nom.couleur, image: ligne.nom.image })
    if (i > 0) expect(ligne.nom.image, `lignes ${i} et ${i + 1}`).not.toBe(lignes[i - 1].nom.image)
  }

  // Le survol d'une case de la ligne en bande change sa couleur, sous la teinte de la bande.
  const nomDeLaDeuxieme = await totaux.nth(1).getAttribute("aria-label")
  const caseDeJanvier = page.getByRole("button", { name: `Flux de janvier : ${nomDeLaDeuxieme!.replace("Total annuel : ", "")}` })
  const avant = await caseDeJanvier.evaluate(el => getComputedStyle(el).backgroundColor)
  await caseDeJanvier.hover()
  await expect.poll(() => caseDeJanvier.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(avant)
})
