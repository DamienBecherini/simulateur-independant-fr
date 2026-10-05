// e2e-web/impression.web.ts
// Mise en page imprimée de la démo web (export PDF, impression du navigateur) : un rapport A4 en couleurs claires,
// sans les commandes de l'écran, sections repliables dépliées, sans débordement horizontal.

import { test, expect, type Page } from "@playwright/test"
import { choisirAvantLeChargement } from "./support/affichage"

/** Largeur d'une feuille A4 en pixels CSS (210 mm à 96 ppp). */
const LARGEUR_A4 = 794

/**
 * Ouvre la démo dans l'affichage demandé (classique par défaut : l'impression de l'affichage « Résumé » a ses propres
 * tests), à la largeur d'une feuille A4, dans le thème demandé, et attend la simulation d'exemple.
 */
async function ouvrir(page: Page, theme: "light" | "dark" = "light", affichage: "classique" | "resume" | "vues" = "classique") {
  await choisirAvantLeChargement(page, affichage)
  await page.setViewportSize({ width: LARGEUR_A4, height: 1123 })
  await page.addInitScript(choix => localStorage.setItem("theme", choix), theme)
  // En « Trois vues », la courbe attendue ci-dessous est dans la vue « Comparer » ; l'impression montre toutes les vues.
  await page.goto(affichage === "vues" ? "./#comparer" : "./")
  // Les résultats sont calculés (en « Trois vues », dans une vue masquée à l'écran, mais imprimée).
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeAttached()
  await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
}

/** Les commandes propres à l'écran, présentes et visibles avant l'impression. */
function commandesDeLEcran(page: Page) {
  return [
    page.getByRole("navigation", { name: "Barre d'outils" }),
    page.getByRole("complementary", { name: "Démo web" }),
    page.getByRole("button", { name: "+ Ajouter une Personne" }),
    page.getByRole("button", { name: "Supprimer", exact: true }).first(),
    page.getByRole("button", { name: /^Supprimer la relation avec/ }).first(),
    page.getByRole("button", { name: /^Déplacer « / }).first(),
    page.getByRole("button", { name: "Relation" }).first(),
    page.getByRole("button", { name: "Gérer les couleurs" }),
    page.getByRole("button", { name: "Appliquer au comparateur" }).first(),
    page.getByText("+ Ajouter", { exact: true }).first(),
    page.getByText("(afficher)").first()
  ]
}

test("à l'impression, les commandes de l'écran disparaissent et les sections repliables se déplient", async ({ page }) => {
  await ouvrir(page)
  const commandes = commandesDeLEcran(page)
  for (const commande of commandes) await expect(commande).toBeVisible()
  const contenusRepliés = [page.getByRole("table", { name: /^Net du foyer selon la rémunération en / }), page.getByRole("table", { name: "Frais de fonctionnement annuels" }), page.getByText(/^Note indicative : la cinquième étoile/)]
  for (const contenu of contenusRepliés) await expect(contenu).toBeHidden()

  await page.emulateMedia({ media: "print" })

  for (const commande of commandes) await expect(commande).toBeHidden()
  for (const contenu of contenusRepliés) await expect(contenu).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByText(/^Document du \d{1,2} \S+ \d{4}$/)).toBeVisible()
})

test("à l'impression, la page reste claire même en thème sombre, et les interrupteurs se lisent Oui ou Non", async ({ page }) => {
  await ouvrir(page, "dark")
  await page.emulateMedia({ media: "print" })

  // Fond blanc, titre presque noir : moyenne de ses composantes rouge, vert et bleu.
  const couleurs = await page.evaluate(() => {
    const composantes = getComputedStyle(document.querySelector("h1")!).color.match(/\d+/g)!.slice(0, 3).map(Number)
    return { fond: getComputedStyle(document.body).backgroundColor, titre: composantes.reduce((somme, valeur) => somme + valeur, 0) / 3 }
  })
  expect(couleurs.fond).toBe("rgb(255, 255, 255)")
  expect(couleurs.titre).toBeLessThan(40)

  const interrupteurs = await page.getByRole("switch").evaluateAll(elements => elements.map(element => [element.getAttribute("aria-checked"), getComputedStyle(element, "::before").content]))
  expect(interrupteurs.length).toBeGreaterThan(0)
  for (const [coche, texte] of interrupteurs) expect(texte).toBe(coche === "true" ? '"Oui"' : '"Non"')
})

test("à l'impression, rien ne déborde de la largeur d'une feuille A4", async ({ page }) => {
  await ouvrir(page)
  await page.emulateMedia({ media: "print" })

  const debordements = await page.evaluate(() => {
    const largeur = document.documentElement.clientWidth
    // La grille et sa légende sont imprimées sur une page paysage : elles ont droit à la largeur d'une feuille paysage.
    const largeurPaysage = (largeur * 297) / 210
    const resultat: string[] = []
    if (document.documentElement.scrollWidth > largeurPaysage + 1) resultat.push(`page : ${document.documentElement.scrollWidth} px`)
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("#contenu *"))) {
      const cadre = element.getBoundingClientRect()
      // Les textes réservés aux lecteurs d'écran (sr-only) mesurent 1 px et masquent leur contenu : ils ne comptent pas.
      if (!element.checkVisibility() || cadre.width <= 1) continue
      // Zones à défilement horizontal (grille, tableaux) : leur contenu doit tenir sans défiler.
      if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== "visible") resultat.push(`${element.tagName} défile : ${element.scrollWidth} > ${element.clientWidth} px`)
      const limite = element.closest(".page-paysage") ? largeurPaysage : largeur
      if (cadre.right > limite + 1) resultat.push(`${element.tagName} « ${element.textContent?.slice(0, 30)} » dépasse : ${Math.round(cadre.right)} px`)
    }
    return resultat
  })
  expect(debordements).toEqual([])
})

test("Chromium produit un PDF de plusieurs pages A4", async ({ page }) => {
  await ouvrir(page, "dark")
  await page.emulateMedia({ media: "print" })

  const pdf = await page.pdf({ format: "A4", printBackground: true })
  const contenu = pdf.toString("latin1")
  expect(contenu.startsWith("%PDF-")).toBe(true)
  expect(pdf.length).toBeGreaterThan(50_000)
  expect(contenu.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
})

for (const affichage of ["classique", "resume", "vues"] as const) {
test(`affichage ${affichage} : la grille annuelle et sa légende sont imprimées sur une page en paysage, le reste en portrait`, async ({ page }) => {
  await ouvrir(page, "light", affichage)
  await page.emulateMedia({ media: "print" })

  // preferCSSPageSize : les tailles de page viennent de la feuille d'impression, comme dans l'application de bureau.
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1")
  const orientations = Array.from(pdf.matchAll(/\/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*\]/g), ([, largeur, hauteur]) => (Number(largeur) > Number(hauteur) ? "paysage" : "portrait"))

  // Une ou deux pages paysage selon les polices du système (la légende peut passer sur la suivante), toujours d'un seul tenant.
  const paysage = orientations.flatMap((orientation, i) => (orientation === "paysage" ? [i] : []))
  expect(paysage.length).toBeGreaterThanOrEqual(1)
  expect(paysage.at(-1)! - paysage[0]).toBe(paysage.length - 1)
  expect(orientations[0]).toBe("portrait")
  expect(orientations.at(-1)).toBe("portrait")
})
}
