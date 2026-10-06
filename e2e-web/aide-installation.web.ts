// e2e-web/aide-installation.web.ts
// Aide à l'installation de la démo (src/web/AideALInstallation.tsx) et fenêtre « Utiliser avec une IA (MCP) » de la
// démo : la ligne du bandeau, la fenêtre selon le navigateur (Chromium, Firefox imité), « Installer maintenant » avec
// l'invitation du navigateur imitée, la démo déjà installée, l'accessibilité en thèmes clair et sombre, et la largeur
// d'un téléphone avec les deux polices.

import { test, expect, type Page } from "@playwright/test"
import { auditerAccessibilite as auditer } from "../e2e/support/accessibilite"
import { choisirLaPolice, POLICES } from "./support/police"

const TITRE = "Installer le simulateur"
const LIGNE = "Installer le simulateur sur votre ordinateur : il fonctionne hors ligne, sans compte."
const TITRE_IA = "Utiliser avec une IA (MCP)"
const TELECHARGEMENT = "https://github.com/DamienBecherini/simulateur-independant-fr/releases/latest"
const GUIDE = "https://github.com/DamienBecherini/simulateur-independant-fr/blob/main/documentation/installation.md"
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
}

const bandeau = (page: Page) => page.getByRole("complementary", { name: "Démo web" })
const fenetre = (page: Page, nom = TITRE) => page.getByRole("dialog", { name: nom })

/** Ouvre l'aide depuis le bandeau et attend la fin de l'animation d'ouverture. */
async function ouvrirLAide(page: Page) {
  await bandeau(page).getByRole("button", { name: "Comment faire ?" }).click()
  await expect(fenetre(page)).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
}

/** Ouvre la fenêtre « Utiliser avec une IA (MCP) » depuis les paramètres. */
async function ouvrirLaFenetreIA(page: Page) {
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: TITRE_IA }).click()
  await expect(fenetre(page, TITRE_IA)).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
}

/** L'événement que Chrome et Edge envoient quand le site est installable, imité ; `prompt` laisse une trace. */
async function imiterLInvitation(page: Page) {
  await page.evaluate(() => {
    const invitation = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => document.body.setAttribute("data-installation-demandee", "oui"),
      userChoice: Promise.resolve({ outcome: "accepted" })
    })
    window.dispatchEvent(invitation)
  })
}

test("le bandeau invite à installer, sans rien ouvrir de lui-même ; « Comment faire ? » ouvre l'aide d'Edge et Chrome, en images", async ({ page }) => {
  await ouvrir(page)
  await expect(bandeau(page)).toContainText(LIGNE)
  await expect(page.getByRole("dialog")).toHaveCount(0)

  await ouvrirLAide(page)
  const aide = fenetre(page)
  await expect(aide.getByRole("listitem").filter({ hasText: "Vos données restent sur votre ordinateur." })).toBeVisible()
  // Sans invitation du navigateur (Chromium sous Playwright n'en envoie pas), pas de bouton, mais une explication.
  await expect(aide.getByRole("button", { name: "Installer maintenant" })).toHaveCount(0)
  await expect(aide).toContainText("n'apparaît que lorsque le navigateur propose l'installation")

  const images = aide.getByRole("region", { name: "Ou bien, à la main" }).getByRole("img")
  await expect(images).toHaveCount(2)
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(400)
  }

  // Le focus revient sur « Comment faire ? » à la fermeture.
  await page.keyboard.press("Escape")
  await expect(aide).toBeHidden()
  await expect(bandeau(page).getByRole("button", { name: "Comment faire ?" })).toBeFocused()
})

test("avec l'invitation du navigateur, « Installer maintenant » ouvre son installation, depuis le bandeau comme depuis les paramètres", async ({ page }) => {
  await ouvrir(page)
  await imiterLInvitation(page)
  await ouvrirLAide(page)
  await fenetre(page).getByRole("button", { name: "Installer maintenant" }).click()
  await expect(page.locator("body")).toHaveAttribute("data-installation-demandee", "oui")
  await expect(fenetre(page).getByRole("status")).toHaveText("Le simulateur est installé : ouvrez-le depuis son icône, sur le bureau ou dans le menu Démarrer.")
  await expect(fenetre(page).getByRole("status")).toBeFocused()
  await page.keyboard.press("Escape")

  // Une nouvelle invitation : le bouton des paramètres ouvre la même aide.
  await page.evaluate(() => document.body.removeAttribute("data-installation-demandee"))
  await imiterLInvitation(page)
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: TITRE }).click()
  await fenetre(page).getByRole("button", { name: "Installer maintenant" }).click()
  await expect(page.locator("body")).toHaveAttribute("data-installation-demandee", "oui")
})

test("une fois la démo installée, ni la ligne du bandeau ni le bouton des paramètres n'apparaissent", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window)
    window.matchMedia = requete => (requete === "(display-mode: standalone)" ? ({ ...original(requete), matches: true, media: requete } as MediaQueryList) : original(requete))
  })
  await ouvrir(page)
  await expect(bandeau(page).getByRole("button", { name: "Recommencer avec l'exemple" })).toBeVisible()
  await expect(bandeau(page)).not.toContainText("Installer le simulateur")
  await page.getByRole("button", { name: "Paramètres" }).click()
  await expect(page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: TITRE_IA })).toBeVisible()
  await expect(page.getByRole("button", { name: TITRE })).toHaveCount(0)
})

test.describe("dans Firefox", () => {
  test.use({ userAgent: FIREFOX })

  test("l'aide propose Edge ou Chrome, ou l'application de bureau", async ({ page }) => {
    // Firefox n'a pas navigator.userAgentData, qui trahirait Chromium.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined }))
    await ouvrir(page)
    await ouvrirLAide(page)
    const aide = fenetre(page)
    await expect(aide).toContainText("n'installe pas un site comme une application")
    await expect(aide).toContainText("Microsoft Edge ou Google Chrome")
    await expect(aide.locator("img")).toHaveCount(0)
    await expect(aide.getByRole("link", { name: /Télécharger l'application/ })).toHaveAttribute("href", TELECHARGEMENT)
    await expect(aide.getByRole("link", { name: /Guide d'installation/ })).toHaveAttribute("href", GUIDE)
    await auditer(page, "aide à l'installation, Firefox", "[role=dialog]")
  })
})

test("« Utiliser avec une IA (MCP) » renvoie vers l'application de bureau, avec ses liens", async ({ page }) => {
  await ouvrir(page)
  await ouvrirLaFenetreIA(page)
  const ia = fenetre(page, TITRE_IA)
  await expect(ia.getByRole("note")).toContainText("Seulement dans l'application de bureau")
  await expect(ia.getByRole("link", { name: /Télécharger l'application/ })).toHaveAttribute("href", TELECHARGEMENT)
  await expect(ia.getByRole("link", { name: /Guide d'installation/ })).toHaveAttribute("href", GUIDE)
  await expect(ia.getByRole("link", { name: /Télécharger l'application/ })).toHaveAttribute("target", "_blank")
  await expect(ia).toContainText("Bientôt sur le Microsoft Store.")
  await expect(ia.getByLabel("Configuration à copier")).toHaveCount(0)
  // Le focus revient sur le bouton des paramètres à la fermeture.
  await page.keyboard.press("Escape")
  await expect(ia).toBeHidden()
  await expect(page.getByRole("dialog", { name: "Configuration" }).getByRole("button", { name: TITRE_IA })).toBeFocused()
})

for (const theme of ["clair", "sombre"] as const) {
  test(`le bandeau, l'aide à l'installation et la fenêtre de l'IA ne présentent aucune violation WCAG, thème ${theme}`, async ({ page }) => {
    await ouvrir(page)
    if (theme === "sombre") {
      await page.getByRole("switch", { name: "Changer de thème" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    await auditer(page, `bandeau, thème ${theme}`, "aside[aria-label='Démo web']")
    await imiterLInvitation(page)
    await ouvrirLAide(page)
    await auditer(page, `aide à l'installation, thème ${theme}`, "[role=dialog]")
    await page.keyboard.press("Escape")
    await ouvrirLaFenetreIA(page)
    await auditer(page, `fenêtre de l'IA, thème ${theme}`, "[role=dialog]")
  })
}

for (const largeur of [320, 375]) {
  test.describe(`sur un écran de ${largeur} px`, () => {
    test.use({ viewport: { width: largeur, height: 700 } })

    for (const police of POLICES) {
      test(`le bandeau et les fenêtres tiennent dans la largeur, ${police}`, async ({ page, context }) => {
        await choisirLaPolice(context, police)
        await ouvrir(page)
        const tient = async (element: ReturnType<typeof fenetre>) => {
          const debordements = await element.evaluate(racine => [racine, ...Array.from(racine.querySelectorAll("*"))].filter(e => !e.classList.contains("sr-only") && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== "visible").map(e => e.outerHTML.slice(0, 80)))
          expect(debordements).toEqual([])
          const boite = await element.boundingBox()
          expect(boite && boite.x >= 0 && boite.x + boite.width <= largeur).toBe(true)
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(largeur)
        }
        await tient(bandeau(page))
        await imiterLInvitation(page)
        await ouvrirLAide(page)
        await tient(fenetre(page))
        for (const image of await fenetre(page).getByRole("img").all()) {
          const boite = await image.boundingBox()
          expect(boite && boite.x >= 0 && boite.x + boite.width <= largeur).toBe(true)
        }
        await page.keyboard.press("Escape")
        await ouvrirLaFenetreIA(page)
        await tient(fenetre(page, TITRE_IA))
      })
    }
  })
}
