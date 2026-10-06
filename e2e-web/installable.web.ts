// e2e-web/installable.web.ts
// La démo installable et utilisable hors ligne (voir l'ADR 012) : manifeste, icônes, service worker, ouverture et
// calcul sans réseau. L'aide à l'installation (bandeau, fenêtre, « Installer maintenant ») est testée dans
// aide-installation.web.ts. Seul fichier où le service worker n'est pas bloqué (playwright.web.config.ts).

import { test, expect, type Page } from "@playwright/test"

const NOM_EXEMPLE = "Famille Martin, simulation 2026"
const BASE = "/simulateur-independant-fr/"

async function ouvrir(page: Page) {
  await page.goto("./")
  await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
}

/** La simulation d'exemple est affichée et calculée : nom, résultat et comparateur des statuts. */
async function attendreLaSimulationDExemple(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NOM_EXEMPLE)
  await expect(page.getByText("Net dans la poche", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await expect(page.getByRole("table", { name: "Comparaison des statuts" })).toContainText(/\d\s?\d{3}\s€/)
}

test("le manifeste décrit la démo, en français, avec ses icônes", async ({ page, request }) => {
  await ouvrir(page)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", `${BASE}manifest.webmanifest`)
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2)

  const reponse = await request.get("manifest.webmanifest")
  expect(reponse.ok()).toBe(true)
  expect(reponse.headers()["content-type"]).toMatch(/^application\/manifest\+json/)
  const manifeste = await reponse.json()
  expect(manifeste).toMatchObject({ name: "Simulateur indépendant FR", lang: "fr", start_url: BASE, scope: BASE, display: "standalone" })
  expect(manifeste.short_name.length).toBeLessThanOrEqual(12)
  expect(manifeste.description).toMatch(/indépendants/)

  const icones: { src: string; sizes: string; type: string; purpose: string }[] = manifeste.icons
  for (const attendue of ["192x192 any", "512x512 any", "192x192 maskable", "512x512 maskable"]) expect(icones.map(icone => `${icone.sizes} ${icone.purpose}`)).toContain(attendue)
  for (const icone of icones) {
    const image = await request.get(icone.src)
    expect(image.ok(), icone.src).toBe(true)
    expect(image.headers()["content-type"]).toBe("image/png")
  }
})

test.describe("avec le service worker", () => {
  test.use({ serviceWorkers: "allow" })

  test("la démo est installable : Chromium ne relève aucune erreur de manifeste ni d'installabilité", async ({ page, context }) => {
    await ouvrir(page)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    const cdp = await context.newCDPSession(page)
    const { errors } = await cdp.send("Page.getAppManifest")
    expect(errors).toEqual([])
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors")
    expect(installabilityErrors).toEqual([])
  })

  test("une fois la démo ouverte, elle se rouvre et calcule sans réseau", async ({ page, context }) => {
    const erreurs: string[] = []
    page.on("pageerror", erreur => erreurs.push(erreur.message))
    await ouvrir(page)
    await attendreLaSimulationDExemple(page)
    // Le service worker a tout mis en cache et sert la page (dès la première visite).
    expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL)).toMatch(/\/simulateur-independant-fr\/sw\.js$/)
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText(/avec les règles fiscales \d{4}/)).toBeVisible()
    await attendreLaSimulationDExemple(page)

    // Toute adresse de la démo s'ouvre sur l'application, y compris avec des paramètres.
    await page.goto("./?source=pwa")
    await attendreLaSimulationDExemple(page)

    // Les calculs se refont hors ligne : une personne ajoutée apparaît aussitôt.
    const noms = page.getByRole("textbox", { name: "Nom" })
    const avant = await noms.count()
    await page.getByRole("button", { name: "+ Ajouter une Personne" }).click()
    await expect(noms).toHaveCount(avant + 1)

    expect(erreurs).toEqual([])
    await context.setOffline(false)
  })
})
