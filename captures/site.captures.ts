// captures/site.captures.ts
// Captures d'écran du site damien.becherini.fr (page de l'outil et étude de cas), à partir de la simulation fictive de la
// démo web, dans l'affichage par défaut (« Trois vues »). Elles ne sont pas versionnées ici : elles sont écrites dans
// reports/captures-du-site/, puis converties et rangées dans le dépôt du site. Lancées avec les captures du README :
// « npm run captures » (application compilée au préalable).

import fs from "node:fs/promises"
import path from "node:path"
import type { ElectronApplication, Page } from "@playwright/test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { test, expect, deposerSession } from "../e2e/support/fixtures"
import { attendreLaFinDesAnimations } from "../e2e/support/animations"
import { sessionExemple } from "../src/web/session-exemple"

const DOSSIER = path.resolve("reports/captures-du-site")
const LARGEUR = 1280
// Assez haute pour que la vue la plus longue tienne entière : une zone plus haute que la page serait capturée décalée.
const HAUTEUR = 3200
const MARGE = 20

// La barre du haut (fixe) et la barre de résumé (collante) sont masquées quand elles recouvriraient la zone capturée.
const SANS_BARRE = "nav, [data-barre-collante] { visibility: hidden !important; }"

// L'affichage d'un nouvel utilisateur : aucune préférence déposée.
test.use({ affichageDuTest: null })

test.beforeAll(async () => {
  await fs.mkdir(DOSSIER, { recursive: true })
})

/** Impose à la page sa taille et son facteur d'échelle : des captures identiques quel que soit l'écran du poste. */
async function dimensionner(electronApp: ElectronApplication, page: Page, hauteur: number, facteur = 1) {
  const cdp = await electronApp.context().newCDPSession(page)
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: LARGEUR, height: hauteur, deviceScaleFactor: facteur, mobile: false })
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([LARGEUR, hauteur])
}

/** Capture la page sur toute sa largeur, entre deux ordonnées. */
async function capturerLaBande(page: Page, nom: string, haut: number, bas: number, style?: string) {
  const largeur = await page.evaluate(() => document.documentElement.clientWidth)
  await page.screenshot({ path: path.join(DOSSIER, nom), scale: "css", style, clip: { x: 0, y: Math.max(0, haut), width: largeur, height: bas - Math.max(0, haut) } })
}

const haut = (page: Page, selecteur: string) => page.locator(selecteur).first().evaluate(element => element.getBoundingClientRect().top)
const bas = (page: Page, selecteur: string) => page.locator(selecteur).first().evaluate(element => element.getBoundingClientRect().bottom)

test("captures du site : les trois vues, sur la simulation d'exemple", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionExemple())
  const { page, electronApp } = await lancer()
  await dimensionner(electronApp, page, HAUTEUR)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  const onglets = page.getByRole("tablist", { name: "Vues de la page" })

  // « Ma situation » : la barre d'outils, la barre de résumé, les personnes et activités, puis la grille de saisie.
  await attendreLaFinDesAnimations(page)
  const legende = page.locator("summary", { hasText: "Légende des flux" })
  await capturerLaBande(page, "situation.png", 0, (await legende.evaluate(element => element.getBoundingClientRect().top)) - 8)

  // « Mes résultats » : de la barre de résumé aux cartes des foyers et des activités, le détail du net déplié.
  await onglets.getByRole("tab", { name: "Mes résultats" }).click()
  await page.locator("summary", { hasText: "Détail du calcul" }).click()
  await attendreLaFinDesAnimations(page)
  await capturerLaBande(page, "resultats.png", (await haut(page, "[data-barre-collante]")) - 8, (await bas(page, "#vue-resultats")) + MARGE, "nav { visibility: hidden !important; }")

  // « Comparer et optimiser » : le verdict, l'activité comparée et le tableau des statuts.
  await onglets.getByRole("tab", { name: /Comparer/ }).click()
  const comparateur = page.getByRole("region", { name: "Comparateur de statuts" })
  const tableau = comparateur.getByRole("table", { name: "Comparaison des statuts" })
  await expect(tableau).toBeVisible()
  const optimisation = page.getByRole("region", { name: "Rémunération ou dividendes ?" })
  await expect(optimisation.getByRole("group", { name: /Net du foyer selon la rémunération/ })).toBeVisible()
  await attendreLaFinDesAnimations(page)
  const titre = page.getByRole("heading", { name: "Comparateur de statuts" })
  await capturerLaBande(
    page,
    "comparateur.png",
    (await titre.evaluate(element => element.getBoundingClientRect().top)) - MARGE,
    (await tableau.evaluate(element => element.getBoundingClientRect().bottom)) + 10,
    SANS_BARRE
  )

  // « Rémunération ou dividendes ? » : les deux cartes et la courbe.
  await optimisation.screenshot({ path: path.join(DOSSIER, "remuneration-ou-dividendes.png"), scale: "css", style: SANS_BARRE })

  // Le partage du bénéfice de la SASU, sur sa barre réglable.
  const partage = page.locator("details", { has: page.locator("summary", { hasText: "Partage du bénéfice en SASU" }) }).last()
  await partage.locator("summary").first().click()
  await attendreLaFinDesAnimations(page)
  await partage.screenshot({ path: path.join(DOSSIER, "partage-du-benefice.png"), scale: "css", style: SANS_BARRE })

  // Le calcul à l'envers : le chiffre d'affaires qu'il faut, dans chaque statut, pour un net visé.
  const netVise = page.locator("section[aria-labelledby=combien-facturer-titre]")
  await netVise.getByText("Quel chiffre d'affaires pour un net visé ?").click()
  await netVise.getByLabel("Net visé du foyer (€ par an)").fill("90000")
  await expect(netVise.getByRole("table")).toBeVisible()
  await attendreLaFinDesAnimations(page)
  await netVise.screenshot({ path: path.join(DOSSIER, "net-vise.png"), scale: "css", style: SANS_BARRE })
})

test("capture du site : le couple en union libre", async ({ dossierDonnees, lancer }) => {
  // La simulation de la démo, Camille et Julien en union libre au lieu d'être pacsés : le comparateur montre alors ce que
  // changerait un mariage ou un PACS.
  const exemple = sessionExemple()
  const enUnionLibre = { ...exemple, relationships: exemple.relationships.map(relation => (relation.type === "PACSé(e)" ? { ...relation, type: "En couple" as const } : relation)) }
  await deposerSession(dossierDonnees, enUnionLibre)
  const { page, electronApp } = await lancer()
  await dimensionner(electronApp, page, HAUTEUR)
  await page.getByRole("tablist", { name: "Vues de la page" }).getByRole("tab", { name: /Comparer/ }).click()

  const carte = page.getByRole("region", { name: "Et si vous étiez mariés ou pacsés ?" })
  await expect(carte).toBeVisible()
  await attendreLaFinDesAnimations(page)
  await carte.screenshot({ path: path.join(DOSSIER, "mariage-ou-pacs.png"), scale: "css", style: SANS_BARRE })
})

test("capture du site : « Par où commencer ? » au premier lancement", async ({ lancer }) => {
  // Aucune simulation déposée : l'application s'ouvre sur les questions, comme la première fois.
  const { page, electronApp } = await lancer()
  await dimensionner(electronApp, page, 900)
  const bloc = page.getByRole("region", { name: "Par où commencer ?" })
  await expect(bloc.getByRole("tab", { name: /^Questions/ })).toHaveAttribute("aria-selected", "true")
  await attendreLaFinDesAnimations(page)
  const cadre = (await bloc.boundingBox())!
  await page.screenshot({
    path: path.join(DOSSIER, "par-ou-commencer.png"),
    scale: "css",
    clip: { x: cadre.x - MARGE, y: cadre.y - MARGE, width: cadre.width + 2 * MARGE, height: cadre.height + 2 * MARGE }
  })
})

test("capture du site : une proposition de l'IA, envoyée par le serveur MCP", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionExemple())
  const { page, electronApp } = await lancer()
  // En 2× : la fenêtre est petite, et le site l'affiche à sa taille réelle. Assez haute pour qu'elle tienne sans défiler.
  await dimensionner(electronApp, page, 1300, 2)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")

  // Le serveur est lancé comme le ferait Claude Desktop, avec la configuration que donne l'application (voir e2e/ia-mcp.e2e.ts).
  const infos = (await page.evaluate(() => window.api.infosDuServeurMcp()))!
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))
  const client = new Client({ name: "captures-du-site", version: "1.0.0" })
  await client.connect(new StdioClientTransport({ command: infos.executable, args: [infos.script, "--donnees", infos.donnees], env: { ...env, ELECTRON_RUN_AS_NODE: "1" }, stderr: "ignore" }))
  try {
    // Ce qu'une IA tirerait de deux factures : la mission fait passer la micro-entreprise au-delà de la franchise en base
    // de TVA, ce que le simulateur signale dans la fenêtre.
    const flux = [{ annee: 2026, acteurId: "micro-atelier", typeFlux: "ca_micro_services_bnc", libelle: "Mission Lemoine", montant: 3700, mois: [10, 11] }]
    const proposee = (await client.callTool({ name: "proposer_flux", arguments: { flux } })) as CallToolResult
    expect(proposee.isError).toBeFalsy()
    // Le résultat suit le résumé, en JSON, à la dernière ligne du texte.
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    const envoyee = (await client.callTool({ name: "appliquer_proposition", arguments: { proposition } })) as CallToolResult
    expect(envoyee.isError).toBeFalsy()
  } finally {
    await client.close()
  }

  const fenetre = page.getByRole("dialog", { name: "Proposition de votre IA" })
  await expect(fenetre).toContainText("Ajouter 2 flux ?")
  await attendreLaFinDesAnimations(page)
  const cadre = (await fenetre.boundingBox())!
  await page.screenshot({
    path: path.join(DOSSIER, "proposition-de-l-ia.png"),
    scale: "device",
    // Sans le contour de focus du contenu de la fenêtre, posé à l'ouverture pour le clavier.
    style: "[role=dialog] *:focus-visible { outline: none !important; box-shadow: none !important; }",
    clip: { x: cadre.x - MARGE, y: cadre.y - MARGE, width: cadre.width + 2 * MARGE, height: cadre.height + 2 * MARGE }
  })
})
