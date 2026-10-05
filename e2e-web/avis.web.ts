// e2e-web/avis.web.ts
// « Donner mon avis » dans la démo web : la fenêtre s'ouvre depuis la barre d'outils, l'aperçu montre le texte envoyé,
// le ticket GitHub s'ouvre dans un nouvel onglet détaché et l'e-mail dans la messagerie (window.open remplacé pour
// relever les adresses), la copie remplit le presse-papiers, et le tout reste accessible, en clair, en sombre et sur
// téléphone.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"

const ADRESSE_NOUVEAU_TICKET = "https://github.com/DamienBecherini/simulateur-independant-fr/issues/new"
const ADRESSE_E_MAIL = "simulateur-independant@damien.becherini.fr"

/** Remplace window.open avant le chargement : les adresses demandées sont relevées, rien ne s'ouvre. */
async function releverLesOuvertures(page: Page) {
  await page.addInitScript(() => {
    const ouvertures: { adresse: string; cible: string; options: string }[] = []
    Object.assign(window, { __ouvertures: ouvertures })
    window.open = (adresse?: string | URL, cible?: string, options?: string) => {
      ouvertures.push({ adresse: String(adresse), cible: cible ?? "", options: options ?? "" })
      return null
    }
  })
}

const ouvertures = (page: Page) => page.evaluate(() => (window as unknown as { __ouvertures: { adresse: string; cible: string; options: string }[] }).__ouvertures)

async function ouvrir(page: Page) {
  await releverLesOuvertures(page)
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
}

const fenetre = (page: Page) => page.getByRole("dialog", { name: "Donner mon avis" })
const bouton = (page: Page) => page.getByRole("button", { name: "Donner mon avis" })
const envoyerSurGitHub = (page: Page) => fenetre(page).getByRole("button", { name: "Envoyer sur GitHub (compte requis, message public)" })
const envoyerParEMail = (page: Page) => fenetre(page).getByRole("button", { name: "Envoyer par e-mail" })

async function ouvrirLaFenetre(page: Page) {
  await bouton(page).click()
  await expect(fenetre(page)).toBeVisible()
}

/** Une note, l'affichage préféré, un type, un message et le diagnostic. */
async function remplir(page: Page) {
  await fenetre(page).getByText("4", { exact: true }).click()
  await fenetre(page).getByRole("group", { name: "Affichage préféré" }).getByText("Résumé").click()
  await fenetre(page).getByText("Idée", { exact: true }).click()
  await fenetre(page).getByRole("textbox", { name: "Message" }).fill("Un export vers un tableur, s'il vous plaît.")
  await fenetre(page).getByRole("checkbox", { name: "Joindre un diagnostic" }).check()
}

test("le retour s'écrit dans la fenêtre, l'aperçu montre le texte, et le ticket GitHub s'ouvre prérempli", async ({ page }) => {
  await ouvrir(page)
  await expect(bouton(page)).toHaveAttribute("title", "Donner mon avis")
  await ouvrirLaFenetre(page)
  await expect(envoyerSurGitHub(page)).toBeDisabled()
  await expect(fenetre(page).getByText("Donnez au moins une note")).toBeVisible()

  await remplir(page)
  const apercu = fenetre(page).getByLabel("Texte envoyé")
  await expect(apercu).toContainText("Note : ★★★★☆ 4/5")
  await expect(apercu).toContainText("Affichage préféré : Résumé")
  await expect(apercu).toContainText("Type de retour : Idée")
  await expect(apercu).toContainText(/Version : \d+\.\d+\.\d+/)
  await expect(apercu).toContainText(/Environnement : démo web · \S+ · Chrome \d+/)
  await expect(apercu).toContainText("Années simulées : 1")
  // La simulation d'exemple a des montants et des noms : aucun n'est envoyé.
  await expect(apercu).not.toContainText("€")
  await expect(apercu).not.toContainText("Camille")

  await envoyerSurGitHub(page).click()
  await expect(fenetre(page).getByRole("status")).toContainText("Le formulaire GitHub s'ouvre")
  const [ticket] = await ouvertures(page)
  expect(ticket.cible).toBe("_blank")
  expect(ticket.options).toBe("noopener,noreferrer")
  expect(ticket.adresse.startsWith(`${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&`)).toBe(true)
  const champs = Object.fromEntries(new URL(ticket.adresse).searchParams)
  expect(champs).toMatchObject({ labels: "retour", note: "★★★★☆ 4/5", affichage: "Résumé", type: "Idée", message: "Un export vers un tableur, s'il vous plaît." })
  expect(champs.version).toMatch(/^\d+\.\d+\.\d+/)
  expect(champs.diagnostic).toContain("Acteurs : ")
  expect(ticket.adresse.length).toBeLessThanOrEqual(8000)

  // Échap ferme la fenêtre et rend le focus au bouton de la barre d'outils.
  await page.keyboard.press("Escape")
  await expect(fenetre(page)).toBeHidden()
  await expect(bouton(page)).toBeFocused()
})

test("l'e-mail s'ouvre prérempli dans la messagerie, et la copie remplit le presse-papiers", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await ouvrir(page)
  await ouvrirLaFenetre(page)
  await fenetre(page).getByText("Bug", { exact: true }).click()
  await fenetre(page).getByRole("textbox", { name: "Message" }).fill("Ligne 1\nLigne 2")

  await envoyerParEMail(page).click()
  await expect(fenetre(page).getByRole("status")).toContainText("Votre messagerie s'ouvre")
  const [eMail] = await ouvertures(page)
  expect(eMail.cible).toBe("_self")
  expect(eMail.adresse.startsWith(`mailto:${ADRESSE_E_MAIL}?subject=Retour%20sur%20le%20simulateur%20%E2%80%94%20v`)).toBe(true)
  expect(eMail.adresse).toContain("Ligne%201%0D%0ALigne%202")
  expect(eMail.adresse.length).toBeLessThanOrEqual(1800)

  await fenetre(page).getByRole("button", { name: "Copier le message" }).click()
  await expect(fenetre(page).getByRole("status")).toContainText("Adresse et message copiés")
  // Le presse-papiers de Windows rend les retours à la ligne en « \r\n ».
  const copie = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")
  expect(copie).toMatch(new RegExp(`^À : ${ADRESSE_E_MAIL.replace(/\./g, "\\.")}\\nSujet : Retour sur le simulateur — v`))
  expect(copie).toContain("Type de retour : Bug\n\nMessage :\nLigne 1\nLigne 2")
})

test("la fenêtre se remplit au clavier", async ({ page }) => {
  await ouvrir(page)
  await bouton(page).focus()
  await page.keyboard.press("Enter")
  await expect(fenetre(page)).toBeVisible()
  // Le premier choix de la note, puis les flèches : la note suit.
  await fenetre(page).getByRole("radio", { name: "1 sur 5" }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(fenetre(page).getByRole("radio", { name: "2 sur 5" })).toBeChecked()
  await expect(envoyerSurGitHub(page)).toBeEnabled()
})

for (const theme of ["clair", "sombre"] as const) {
  test(`la fenêtre ne présente aucune violation WCAG, thème ${theme}`, async ({ page }) => {
    await ouvrir(page)
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await ouvrirLaFenetre(page)
    await auditer(page, `avis vide, thème ${theme}`, "[role=dialog]")
    await remplir(page)
    await auditer(page, `avis rempli, thème ${theme}`, "[role=dialog]")
  })
}

for (const largeur of [320, 375]) {
  test(`à ${largeur} px, avec une souris, tous les boutons de la barre d'outils tiennent dans la largeur`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 740 })
    await ouvrir(page)
    for (const nom of ["Paramètres", "Donner mon avis"]) expect((await page.getByRole("button", { name: nom }).boundingBox())!.x).toBeGreaterThanOrEqual(0)
    const theme = (await page.getByRole("switch", { name: "Changer de thème" }).boundingBox())!
    expect(theme.x + theme.width).toBeLessThanOrEqual(largeur)
  })

  test.describe(`sur un téléphone de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 740 }, hasTouch: true, isMobile: true })

    test("le bouton tient dans la barre d'outils, la fenêtre dans la largeur, et tout reste accessible", async ({ page }) => {
      await ouvrir(page)
      const boite = await bouton(page).boundingBox()
      expect(boite!.x + boite!.width).toBeLessThanOrEqual(largeur)
      expect(Math.min(boite!.width, boite!.height)).toBeGreaterThanOrEqual(24)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)

      await ouvrirLaFenetre(page)
      await remplir(page)
      const largeurs = await fenetre(page).evaluate(element => ({ contenu: element.scrollWidth, visible: element.clientWidth }))
      expect(largeurs.contenu).toBeLessThanOrEqual(largeurs.visible)
      // Cibles au doigt : 44 px au moins.
      const etoiles = fenetre(page).locator("label", { has: page.getByRole("radio", { name: "5 sur 5" }) })
      for (const cible of [etoiles, envoyerSurGitHub(page), fenetre(page).getByRole("button", { name: "Copier le message" })]) {
        expect((await cible.boundingBox())!.height).toBeGreaterThanOrEqual(43.5)
      }
      await auditer(page, `avis, ${largeur} px`, "[role=dialog]")
    })
  })
}
