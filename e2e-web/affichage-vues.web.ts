// e2e-web/affichage-vues.web.ts
// Affichage « Trois vues » de la démo web (proposition B de l'étude d'allègement de l'écran) : le résumé et le détail
// replié de l'affichage « Résumé », et la page partagée en trois vues, chacune avec son adresse. Onglets à la souris
// et au clavier, retour arrière et rechargement, liens du résumé, lien entre saisie et résumé, accessibilité,
// téléphone, impression et hauteur de chaque vue.

import { test, expect, type Locator, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

type Affichage = "classique" | "resume" | "panneaux" | "vues"

/** Dépose la préférence d'affichage avant le chargement, comme si elle avait été choisie lors d'une visite précédente. */
async function choisirAvantLeChargement(page: Page, affichage: Affichage) {
  await page.addInitScript(choix => window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: choix })), affichage)
}

/** Ouvre la démo (à l'adresse d'une vue, si donnée) et attend la simulation d'exemple et le meilleur statut du résumé. */
async function ouvrirEnVues(page: Page, adresse = "") {
  await choisirAvantLeChargement(page, "vues")
  await page.goto(`./${adresse}`)
  await expect(barre(page).getByRole("link", { name: /^Net/ })).toBeVisible()
  await expect(barre(page).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
}

const barre = (page: Page) => page.getByRole("region", { name: "Résumé de l'année" })
const onglets = (page: Page) => page.getByRole("tablist", { name: "Vues de la page" })
const onglet = (page: Page, nom: RegExp) => onglets(page).getByRole("tab", { name: nom })
const acteurs = (page: Page) => page.getByRole("heading", { name: "Acteurs de la Simulation" })
const resultats = (page: Page) => page.getByRole("heading", { name: "Résultats de simulation" })
const comparateur = (page: Page) => page.getByRole("heading", { name: "Comparateur de statuts" })
const espaces = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ").trim()
const SITUATION = /situation/i
const RESULTATS = /résultats/i
const COMPARER = /comparer/i

/** Vérifie la vue affichée : son onglet choisi, son contenu visible, celui des autres masqué. */
async function attendreLaVue(page: Page, vue: "situation" | "resultats" | "comparer") {
  const contenus: Record<typeof vue, Locator> = { situation: acteurs(page), resultats: resultats(page), comparer: comparateur(page) }
  const noms = { situation: SITUATION, resultats: RESULTATS, comparer: COMPARER }
  await expect(onglet(page, noms[vue])).toHaveAttribute("aria-selected", "true")
  for (const [autre, contenu] of Object.entries(contenus)) {
    if (autre === vue) await expect(contenu).toBeVisible()
    else await expect(contenu).toBeHidden()
  }
}

/** Le haut d'un élément n'est pas caché sous la barre de résumé et les onglets, collés en haut de l'écran. */
async function sousLaBarre(page: Page, cible: Locator) {
  await expect(cible).toBeInViewport()
  const [haut, bas] = await Promise.all([cible.evaluate(e => e.getBoundingClientRect().top), onglets(page).evaluate(e => e.getBoundingClientRect().bottom)])
  expect(haut).toBeGreaterThanOrEqual(bas - 1)
}

test("l'affichage « Trois vues » se choisit dans la barre d'outils et s'ouvre sur « Ma situation »", async ({ page }) => {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
  await page.getByRole("combobox", { name: "Affichage : Classique" }).click()
  await page.getByRole("option", { name: "Trois vues" }).click()

  await expect(barre(page)).toBeVisible()
  await expect(onglets(page).getByRole("tab")).toHaveText(["Ma situation", "Mes résultats", "Comparer et optimiser"], { useInnerText: true })
  await attendreLaVue(page, "situation")
  await expect(page).toHaveTitle("Ma situation — Famille Martin, simulation 2026")
  await expect.poll(() => page.evaluate(() => JSON.parse(window.localStorage.getItem("simulateur.preferences") ?? "{}").affichage)).toBe("vues")
})

test("les onglets, à la souris, changent de vue, d'adresse et de titre, en haut de la page", async ({ page }) => {
  await ouvrirEnVues(page)
  await page.mouse.wheel(0, 600)
  await onglet(page, RESULTATS).click()
  await attendreLaVue(page, "resultats")
  await expect(page).toHaveURL(/#resultats$/)
  await expect(page).toHaveTitle(/^Mes résultats — /)
  await expect(page.getByRole("heading", { level: 2, name: "Mes résultats" })).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await onglet(page, COMPARER).click()
  await attendreLaVue(page, "comparer")
  await expect(page).toHaveURL(/#comparer$/)
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
})

test("au clavier, les flèches, Début et Fin parcourent les onglets ; Tab entre ensuite dans la vue", async ({ page }) => {
  await ouvrirEnVues(page)
  await onglet(page, SITUATION).focus()
  await page.keyboard.press("ArrowRight")
  await expect(onglet(page, RESULTATS)).toBeFocused()
  await attendreLaVue(page, "resultats")
  await page.keyboard.press("End")
  await expect(onglet(page, COMPARER)).toBeFocused()
  await attendreLaVue(page, "comparer")
  await page.keyboard.press("ArrowRight")
  await expect(onglet(page, SITUATION)).toBeFocused()
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("Home")
  await expect(onglet(page, SITUATION)).toBeFocused()
  await attendreLaVue(page, "situation")

  // Un seul onglet dans l'ordre de tabulation : Tab quitte les onglets pour le contenu de la vue.
  await page.keyboard.press("Tab")
  expect(await page.evaluate(() => document.activeElement?.closest("[role=tablist]") === null && document.activeElement?.closest("#vue-situation") !== null)).toBe(true)
})

test("le retour arrière, l'avance et le rechargement retrouvent la vue", async ({ page }) => {
  await ouvrirEnVues(page)
  await onglet(page, RESULTATS).click()
  await onglet(page, COMPARER).click()
  await attendreLaVue(page, "comparer")

  await page.goBack()
  await attendreLaVue(page, "resultats")
  await expect(page.getByRole("heading", { level: 2, name: "Mes résultats" })).toBeFocused()
  await page.goBack()
  await attendreLaVue(page, "situation")
  await page.goForward()
  await attendreLaVue(page, "resultats")

  await page.reload()
  await expect(barre(page).getByRole("link", { name: /^Net/ })).toBeVisible()
  await attendreLaVue(page, "resultats")
  await expect(page).toHaveTitle(/^Mes résultats — /)
})

test("une adresse de vue s'ouvre directement sur cette vue", async ({ page }) => {
  await ouvrirEnVues(page, "#comparer")
  await attendreLaVue(page, "comparer")
})

test("chaque chiffre du résumé mène à son détail, dans sa vue, sous la barre", async ({ page }) => {
  await ouvrirEnVues(page)
  for (const [lien, vue, cible] of [
    [/^Net du foyer/, "resultats", "#bilan"],
    [/^Meilleur/, "comparer", "#comparateur-verdict"],
    [/^Alertes/, "resultats", "#resultats-titre"],
    [/^Prélèvements/, "resultats", "#bilan"]
  ] as const) {
    // Depuis « Ma situation » chaque fois : le lien change de vue.
    await onglet(page, SITUATION).click()
    await barre(page).getByRole("link", { name: lien }).click()
    await attendreLaVue(page, vue)
    await sousLaBarre(page, page.locator(cible))
    await expect(page.locator(cible)).toBeFocused()
  }
  // Le retour arrière ramène à la vue d'où l'on a suivi le lien.
  await page.goBack()
  await attendreLaVue(page, "situation")
})

test("l'année se change depuis la barre de résumé, dans chaque vue", async ({ page }) => {
  await ouvrirEnVues(page)
  await page.getByRole("button", { name: "Ajouter une année" }).click()
  await page.getByRole("radio", { name: /^2025, avant/ }).check()
  await page.getByRole("radio", { name: "Commencer avec une grille vide" }).check()
  await page.getByRole("button", { name: "Ajouter 2025" }).click()

  for (const [nom, vue] of [[RESULTATS, "resultats"], [COMPARER, "comparer"]] as const) {
    await onglet(page, nom).click()
    await attendreLaVue(page, vue)
    const annees = barre(page).getByRole("combobox", { name: "Année affichée" })
    await expect(annees).toBeVisible()
    await annees.click()
    await page.getByRole("option", { name: "2026" }).click()
    await expect(annees).toHaveText("2026")
    await annees.click()
    await page.getByRole("option", { name: "2025" }).click()
    await expect(annees).toHaveText("2025")
  }
})

test("une saisie dans la grille se lit aussitôt dans la barre de résumé, sans quitter « Ma situation »", async ({ page }) => {
  await ouvrirEnVues(page)
  const net = () => barre(page).getByRole("link", { name: /^Net/ }).textContent().then(espaces)
  const avant = await net()

  // Le chiffre d'affaires de mars de l'atelier passe à 9 000 €.
  await page.getByRole("button", { name: "Flux de mars : Atelier de Camille" }).click()
  const fenetre = page.getByRole("dialog", { name: /^Opérations de .* \/ Atelier de Camille$/ })
  const montant = fenetre.getByRole("textbox", { name: "Montant", exact: true }).first()
  await montant.fill("9000")
  await montant.press("Enter")
  await fenetre.getByRole("button", { name: "Terminé" }).click()
  await expect(fenetre).toBeHidden()

  await expect.poll(net).not.toBe(avant)
  await attendreLaVue(page, "situation")
  await expect(barre(page)).toBeInViewport()
})

for (const theme of ["clair", "sombre"] as const) {
  test(`chaque vue ne présente aucune violation WCAG, en thème ${theme}`, async ({ page }) => {
    await ouvrirEnVues(page)
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    for (const [nom, vue] of [[SITUATION, "situation"], [RESULTATS, "resultats"], [COMPARER, "comparer"]] as const) {
      await onglet(page, nom).click()
      await attendreLaVue(page, vue)
      await auditer(page, `trois vues, ${vue}, thème ${theme}`)
    }
  })
}

test("à l'impression, les trois vues s'impriment dans l'ordre, quelle que soit la vue affichée", async ({ page }) => {
  await choisirAvantLeChargement(page, "vues")
  await page.setViewportSize({ width: 794, height: 1123 })
  await page.goto("./#resultats")
  await expect(barre(page).getByRole("link", { name: /^Meilleur/ })).toBeVisible()
  await attendreLaVue(page, "resultats")

  await page.emulateMedia({ media: "print" })

  await expect(barre(page)).toBeHidden()
  await expect(onglets(page)).toBeHidden()
  const titres = [acteurs(page), page.getByRole("heading", { name: "Grille de Saisie Annuelle" }), resultats(page), comparateur(page), page.getByRole("heading", { name: "Rémunération ou dividendes ?" })]
  for (const titre of titres) await expect(titre).toBeVisible()
  // Dans l'ordre de la page : la situation, les résultats, puis le comparateur.
  const hauts = await Promise.all(titres.map(titre => titre.evaluate(e => e.getBoundingClientRect().top + window.scrollY)))
  expect(hauts).toEqual([...hauts].sort((a, b) => a - b))
  // Le détail replié est déplié, comme dans l'affichage « Résumé ».
  await expect(page.getByRole("table", { name: "Comparaison des statuts" }).getByRole("rowheader", { name: "Impôt sur le revenu" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Légende des Flux" })).toBeVisible()

  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1")
  expect(pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
})

for (const largeur of [320, 375]) {
  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 812 }, hasTouch: true, isMobile: true })

    test("les onglets tiennent sur une ligne, à 44 px du doigt, et aucune vue ne déborde en largeur", async ({ page }) => {
      await ouvrirEnVues(page)
      await expect(onglets(page).getByRole("tab")).toHaveText(["Situation", "Résultats", "Comparer"], { useInnerText: true })
      const cadres = await onglets(page).getByRole("tab").evaluateAll(elements => elements.map(e => e.getBoundingClientRect()).map(c => ({ haut: Math.round(c.top), hauteur: c.height, largeur: c.width })))
      expect(new Set(cadres.map(c => c.haut)).size).toBe(1)
      for (const cadre of cadres) expect(Math.min(cadre.hauteur, cadre.largeur)).toBeGreaterThanOrEqual(44)

      for (const [nom, vue] of [[SITUATION, "situation"], [RESULTATS, "resultats"], [COMPARER, "comparer"]] as const) {
        await onglet(page, nom).tap()
        await attendreLaVue(page, vue)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `vue ${vue}`).toBeLessThanOrEqual(largeur)
      }
    })
  })
}

test.describe("sur un téléphone", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test("chaque vue ne présente aucune violation WCAG à 375 px", async ({ page }) => {
    await ouvrirEnVues(page)
    for (const [nom, vue] of [[SITUATION, "situation"], [RESULTATS, "resultats"], [COMPARER, "comparer"]] as const) {
      await onglet(page, nom).tap()
      await attendreLaVue(page, vue)
      await auditer(page, `trois vues, ${vue}, 375 px`)
    }
  })
})

/**
 * Hauteur de la page au chargement, sections repliées ; pour les trois vues, la hauteur de chacune. La page est fermée
 * après la mesure : les pages d'un même contexte partagent leur stockage, et une page restée ouverte pourrait réécrire
 * ses préférences, donc son affichage, pendant que la suivante se charge.
 */
async function hauteurs(page: Page, affichage: Affichage): Promise<number[]> {
  try {
    return await mesurer(page, affichage)
  } finally {
    await page.close()
  }
}

async function mesurer(page: Page, affichage: Affichage): Promise<number[]> {
  await choisirAvantLeChargement(page, affichage)
  if (affichage !== "vues") {
    await page.goto("./")
    await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
    return [await page.evaluate(() => document.documentElement.scrollHeight)]
  }
  const resultat: number[] = []
  await ouvrirEnVues(page)
  for (const [nom, vue] of [[SITUATION, "situation"], [RESULTATS, "resultats"], [COMPARER, "comparer"]] as const) {
    await onglet(page, nom).click()
    await attendreLaVue(page, vue)
    if (vue === "comparer") await expect(page.getByRole("group", { name: /Net du foyer selon la rémunération nette/ })).toBeVisible()
    resultat.push(await page.evaluate(() => document.documentElement.scrollHeight))
  }
  return resultat
}

// Estimation de l'étude (docs/conception/allegement-ecran.md) : environ 1 750 px sur ordinateur et 3 000 px sur
// téléphone pour la vue la plus longue. Chaque vue doit être plus courte que la page de l'affichage « Panneaux », la
// plus courte des pages d'un seul tenant.
for (const [largeur, hauteurEcran] of [
  [1440, 900],
  [375, 812]
] as const) {
  test.describe(`hauteur des vues à ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: hauteurEcran }, hasTouch: largeur < 500, isMobile: largeur < 500 })

    test("chaque vue est plus courte que la page des autres affichages", async ({ page, context }) => {
      const [situation, enResultats, enComparaison] = await hauteurs(page, "vues")
      const [panneaux] = await hauteurs(await context.newPage(), "panneaux")
      const [resume] = await hauteurs(await context.newPage(), "resume")
      const [classique] = await hauteurs(await context.newPage(), "classique")
      const mesure = `${largeur} px : classique ${classique} px, résumé ${resume} px, panneaux ${panneaux} px, trois vues ${situation} / ${enResultats} / ${enComparaison} px`
      test.info().annotations.push({ type: "hauteur", description: mesure })
      console.log(`Hauteur à ${mesure}`)
      for (const vue of [situation, enResultats, enComparaison]) expect(vue).toBeLessThan(panneaux)
      expect(Math.max(situation, enResultats, enComparaison)).toBeLessThan(classique * 0.4)
    })
  })
}
