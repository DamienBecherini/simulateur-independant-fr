// e2e-web/affichage-resume.web.ts
// Affichage « Résumé » de la démo web (proposition A de l'étude d'allègement de l'écran) : choix dans la barre
// d'outils, retenu au rechargement, barre de résumé fidèle au détail, liens, accessibilité, téléphone, clavier,
// impression, et hauteur de la page comparée à l'affichage classique.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirAvantLeChargement } from "./support/affichage"

/** Ouvre la démo et attend la simulation d'exemple, le comparateur et la courbe de l'arbitrage. */
async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
}

async function ouvrirEnResume(page: Page) {
  await choisirAvantLeChargement(page, "resume")
  await ouvrir(page)
  await expect(barre(page).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
}

const barre = (page: Page) => page.getByRole("region", { name: "Résumé de l'année" })
const espaces = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim()

test("l'affichage « Résumé » s'ouvre par défaut ; un autre se choisit dans la barre d'outils et reste choisi au rechargement", async ({ page }) => {
  await ouvrir(page)
  await expect(barre(page)).toBeVisible()
  await expect(page.getByRole("button", { name: /Voir le détail/ })).toBeVisible()

  await page.getByRole("combobox", { name: "Affichage : Résumé" }).click()
  await expect(page.getByText("Bêta : dites-nous quel affichage vous préférez.")).toBeVisible()
  await expect(page.getByRole("option")).toHaveText(["Résumé", "Classique", "Trois vues"])
  await expect(page.locator("[role=option][aria-disabled=true]")).toHaveCount(0)
  await page.getByRole("option", { name: "Classique" }).click()
  await expect(barre(page)).toHaveCount(0)

  // La préférence est enregistrée peu après le choix, dans le stockage du navigateur, à part de la simulation.
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}").affichage)).toBe("classique")
  expect(await page.evaluate(() => window.localStorage.getItem("simulateur.session"))).not.toContain("affichage")

  await page.reload()
  await expect(page.getByRole("combobox", { name: "Affichage : Classique" })).toBeVisible()
  await expect(barre(page)).toHaveCount(0)
})

test("un affichage retiré après la bêta (« Panneaux ») laisse place au « Résumé », sans perdre les autres préférences", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], zoom: 1.2, affichage: "panneaux" })))
  await ouvrir(page)
  await expect(page.getByRole("combobox", { name: "Affichage : Résumé" })).toBeVisible()
  await expect(barre(page)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("1.2")
})

test("la barre de résumé reprend les chiffres du bilan et du comparateur", async ({ page }) => {
  await ouvrirEnResume(page)
  const bilan = page.locator("#bilan")
  const net = espaces(await bilan.locator("p.text-2xl").first().textContent()).match(/^[\d ]+ €/)?.[0] ?? "introuvable"
  const taux = espaces(await bilan.locator("p.text-2xl").nth(1).textContent())

  expect(espaces(await barre(page).getByRole("link", { name: /^Net du foyer/ }).textContent())).toContain(net)
  expect(espaces(await barre(page).getByRole("link", { name: /^Prélèvements/ }).textContent())).toContain(taux)

  // Le meilleur statut est celui que le tableau du comparateur met en évidence.
  const enTeteDuMeilleur = page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("columnheader", { name: /meilleur net/ })
  const libelle = espaces(await enTeteDuMeilleur.evaluate(th => th.firstChild?.textContent ?? ""))
  expect(espaces(await barre(page).getByRole("link", { name: /^Meilleur/ }).textContent())).toContain(libelle)
  await expect(page.locator("#comparateur-verdict")).toContainText(libelle)

  // Recalculée en direct : un changement de la simulation se lit aussitôt dans la barre.
  await page.getByRole("switch", { name: "Versement libératoire" }).click()
  await expect.poll(async () => espaces(await barre(page).getByRole("link", { name: /^Net du foyer/ }).textContent())).not.toContain(net)
})

test("chaque chiffre de la barre mène à son détail, sans qu'il passe sous la barre", async ({ page }) => {
  await ouvrirEnResume(page)
  for (const [lien, cible] of [[/^Meilleur/, "#comparateur-verdict"], [/^Net du foyer/, "#bilan"], [/^Alertes/, "#resultats-titre"]] as const) {
    await barre(page).getByRole("link", { name: lien }).click()
    await expect(page.locator(cible)).toBeInViewport()
    const [hautDeLaCible, basDeLaBarre] = await Promise.all([page.locator(cible).evaluate(e => e.getBoundingClientRect().top), barre(page).evaluate(e => e.getBoundingClientRect().bottom)])
    expect(hautDeLaCible).toBeGreaterThanOrEqual(basDeLaBarre - 1)
  }
  // La barre reste collée sous la barre d'outils pendant le défilement.
  const [basDesOutils, hautDeLaBarre] = await Promise.all([page.getByRole("navigation", { name: "Barre d'outils" }).evaluate(e => e.getBoundingClientRect().bottom), barre(page).evaluate(e => e.getBoundingClientRect().top)])
  expect(Math.abs(hautDeLaBarre - basDesOutils)).toBeLessThanOrEqual(1)
})

test("le tableau réduit montre le reste des lignes à la demande", async ({ page }) => {
  await ouvrirEnResume(page)
  const tableau = page.getByRole("table", { name: "Comparaison des statuts" })
  await expect(tableau.getByRole("rowheader", { name: "Net dans la poche" })).toBeVisible()
  await expect(tableau.getByRole("rowheader", { name: "Écart avec le statut actuel" })).toBeVisible()
  await expect(tableau.getByRole("rowheader", { name: "Impôt sur le revenu" })).toBeHidden()

  await page.getByRole("button", { name: /Voir le détail/ }).click()
  await expect(tableau.getByRole("rowheader", { name: "Impôt sur le revenu" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Masquer le détail" })).toHaveAttribute("aria-expanded", "true")
  // Les deux nets du foyer : la colonne actuelle compte des frais supposés, et la page le dit.
  await expect(tableau.getByRole("columnheader", { name: /actuel/ })).toContainText("frais supposés compris")
  await expect(page.getByText(/^Les nets du comparateur comptent les frais de fonctionnement supposés/)).toBeVisible()
})

/** Ouvre toutes les sections repliables et le détail du tableau. */
async function toutDeplier(page: Page) {
  const sommaires = page.locator("details:not([open]) > summary")
  while ((await sommaires.count()) > 0) await sommaires.first().click()
  await page.getByRole("button", { name: /Voir le détail/ }).click()
}

test("l'affichage « Résumé » ne présente aucune violation WCAG, replié puis déplié", async ({ page }) => {
  await ouvrirEnResume(page)
  await auditer(page, "résumé, premier affichage")
  await toutDeplier(page)
  await auditer(page, "résumé, tout déplié")
})

test("l'affichage « Résumé » ne présente aucune violation WCAG en thème sombre", async ({ page }) => {
  await ouvrirEnResume(page)
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditer(page, "résumé, thème sombre")
  await toutDeplier(page)
  await auditer(page, "résumé, thème sombre, tout déplié")
})

test("le choix de l'affichage ouvert ne présente aucune violation WCAG", async ({ page }) => {
  await ouvrir(page)
  await page.getByRole("combobox", { name: "Affichage : Résumé" }).click()
  await expect(page.getByRole("listbox")).toBeVisible()
  // Radix masque le reste de la page aux lecteurs d'écran tant que la liste est ouverte : seule la liste est auditée.
  await auditer(page, "choix de l'affichage", "[role=listbox]")
})

test("au clavier : choisir l'affichage, puis parcourir le résumé avec un focus visible", async ({ page }) => {
  await choisirAvantLeChargement(page, "classique")
  await ouvrir(page)
  const choix = page.getByRole("combobox", { name: "Affichage : Classique" })
  await choix.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("option", { name: "Classique" })).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(page.getByRole("option", { name: "Résumé" })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(barre(page)).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Affichage : Résumé" })).toBeFocused()

  // Tab, depuis le choix de l'affichage, atteint les liens de la barre, puis le reste de la page ; chacun montre son focus.
  const arrets: { nom: string; indicateur: boolean }[] = []
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press("Tab")
    const arret = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const style = getComputedStyle(element)
      const contour = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 && !/rgba\(.*, 0\)$/.test(style.outlineColor)
      return { nom: `<${element.tagName.toLowerCase()}> « ${(element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 50)} »`, indicateur: contour || style.boxShadow !== "none" }
    })
    if (!arret || arret.nom.includes("Aller au contenu")) break
    arrets.push(arret)
  }
  expect(arrets.filter(a => !a.indicateur).map(a => a.nom), "Éléments sans indicateur de focus visible").toEqual([])
  const position = (motif: RegExp) => arrets.findIndex(a => motif.test(a.nom))
  const reperes = [/« Net du foyer/, /« Alertes/, /« \+ Ajouter une Personne »/, /« Flux de janvier/, /« Détail du calcul/, /« Voir le détail/, /« Valeurs de la courbe/]
  const positions = reperes.map(position)
  expect(positions.every(p => p >= 0), `Repères introuvables : ${reperes.filter((_, i) => positions[i] < 0).join(", ")}`).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))

  // Le détail du tableau s'ouvre au clavier.
  const detail = page.getByRole("button", { name: /Voir le détail/ })
  await detail.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("button", { name: "Masquer le détail" })).toHaveAttribute("aria-expanded", "true")
})

test("à l'impression, l'affichage « Résumé » déplie tout et masque la barre de résumé", async ({ page }) => {
  await choisirAvantLeChargement(page, "resume")
  await page.setViewportSize({ width: 794, height: 1123 })
  await ouvrir(page)
  const tableau = page.getByRole("table", { name: "Comparaison des statuts" })
  const replies = [tableau.getByRole("rowheader", { name: "Impôt sur le revenu" }), page.getByText("Cotisations sociales des activités"), page.getByRole("table", { name: "Frais de fonctionnement annuels" }), page.getByRole("heading", { name: "Légende des Flux" }), page.locator("#repartition-titre")]
  for (const contenu of replies) await expect(contenu.first()).toBeHidden()
  await expect(barre(page)).toBeVisible()

  await page.emulateMedia({ media: "print" })

  for (const contenu of replies) await expect(contenu.first()).toBeVisible()
  await expect(barre(page)).toBeHidden()
  await expect(page.getByRole("button", { name: /Voir le détail/ })).toBeHidden()
  await expect(page.getByRole("list", { name: "Net dans la poche selon le statut" })).toBeHidden()
  await expect(page.getByText("(afficher)").first()).toBeHidden()
})

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 812 }, hasTouch: true, isMobile: true })

    test("rien ne déborde en largeur, et le comparateur se lit en cartes", async ({ page }) => {
      await ouvrirEnResume(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
      await expect(page.getByRole("list", { name: "Net dans la poche selon le statut" })).toBeVisible()
      await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeHidden()
      await page.getByRole("button", { name: /Voir le détail/ }).click()
      await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
    })
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test("l'affichage « Résumé » ne présente aucune violation WCAG à 375 px", async ({ page }) => {
    await ouvrirEnResume(page)
    await auditer(page, "résumé, 375 px")
    await toutDeplier(page)
    await auditer(page, "résumé, 375 px, tout déplié")
  })
})

/** Hauteur de la page au chargement, sections repliées. */
async function hauteur(page: Page, affichage: "classique" | "resume") {
  await choisirAvantLeChargement(page, affichage)
  await ouvrir(page)
  return page.evaluate(() => document.documentElement.scrollHeight)
}

// Objectifs de l'étude (docs/conception/allegement-ecran.md) : environ 3 700 px sur ordinateur, 5 900 px sur
// téléphone, au plus 3 800 et 6 000 px.
for (const [largeur, hauteurEcran, plafond] of [
  [1440, 900, 3800],
  [375, 812, 6000]
] as const) {
  test.describe(`hauteur de la page à ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: hauteurEcran }, hasTouch: largeur < 500, isMobile: largeur < 500 })

    test("l'affichage « Résumé » est bien plus court que l'affichage classique", async ({ page, context }) => {
      const resume = await hauteur(page, "resume")
      const classique = await hauteur(await context.newPage(), "classique")
      test.info().annotations.push({ type: "hauteur", description: `${largeur} px : classique ${classique} px, résumé ${resume} px` })
      console.log(`Hauteur à ${largeur} px : classique ${classique} px, résumé ${resume} px`)
      expect(resume).toBeLessThanOrEqual(plafond)
      expect(resume).toBeLessThan(classique * 0.7)
    })
  })
}
