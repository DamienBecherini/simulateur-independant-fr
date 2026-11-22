// e2e/ia-mcp.e2e.ts
// Un client d'IA relié au serveur MCP local (voir l'ADR 011) : le serveur est lancé comme le ferait Claude Desktop,
// avec la configuration donnée par l'application (son exécutable en mode Node, le serveur empaqueté, le dossier de
// données du test). Une proposition envoyée s'affiche dans l'application, s'applique en une étape et s'annule.

import fs from "node:fs/promises"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { SessionState } from "../src/types"
import { test, expect, deposerAffichage, deposerSession, lireFichier } from "./support/fixtures"
import { auditerAccessibilite } from "./support/accessibilite"
import { attendreLaFinDesAnimations } from "./support/animations"
import { defautsDeLaFenetre, defautsDeLisibilite } from "../e2e-web/support/lisibilite"
import { valeurDeLigne } from "./support/interface"
import { ATELIER, sessionMicroBnc } from "./support/sessions"

const mission = { annee: 2026, acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Mission ponctuelle", montant: 6000, mois: [6] }

/** Le contenu d'un fichier de la boîte aux propositions, tel que le dépose le serveur MCP. */
const fichierDeProposition = (proposition: unknown) => JSON.stringify({ format: "simulateur-independant-fr/proposition", version: 1, creeeLe: "2026-10-06T08:30:00.000Z", proposition })

/** Un client d'IA relié au serveur MCP comme le ferait Claude Desktop, avec la configuration donnée par l'application. */
async function connecterUnClient(infos: { executable: string; script: string; donnees: string }): Promise<Client> {
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))
  const client = new Client({ name: "client-e2e", version: "1.0.0" })
  await client.connect(new StdioClientTransport({ command: infos.executable, args: [infos.script, "--donnees", infos.donnees], env: { ...env, ELECTRON_RUN_AS_NODE: "1" }, stderr: "ignore" }))
  return client
}

test("une proposition envoyée par le serveur MCP s'applique dans l'application en une étape, et s'annule", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  await deposerAffichage(dossierDonnees, "classique")
  const { page, erreursConsole } = await lancer()
  const chiffreDAffaires = valeurDeLigne(page.getByRole("article").filter({ hasText: ATELIER.name }), "Chiffre d'affaires")
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)

  // La configuration que l'application donne à copier, et rien d'autre.
  const infos = (await page.evaluate(() => window.api.infosDuServeurMcp()))!
  expect(infos.donnees).toBe(dossierDonnees)
  const client = await connecterUnClient(infos)
  try {
    expect((await client.listTools()).tools).toHaveLength(17)
    const proposee = (await client.callTool({ name: "proposer_flux", arguments: { flux: [mission] } })) as CallToolResult
    expect(proposee.isError).toBeFalsy()
    // Le résultat suit le résumé, en JSON, à la dernière ligne du texte.
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    const envoyee = (await client.callTool({ name: "appliquer_proposition", arguments: { proposition } })) as CallToolResult
    expect(envoyee.isError).toBeFalsy()
  } finally {
    await client.close()
  }

  // Rien n'a changé avant le clic de l'utilisateur : la session enregistrée n'a pas la mission (juin, mois 6).
  const fenetre = page.getByRole("dialog", { name: "Proposition de votre IA" })
  await expect(fenetre).toContainText("Ajouter 1 flux ?")
  await expect(fenetre).toContainText("Mission ponctuelle")
  expect((await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.annees[0].monthlyData[5].flows.map(f => f.label)).toEqual(["Prestations"])

  await fenetre.getByRole("button", { name: "Appliquer" }).click()
  await expect(fenetre).toBeHidden()
  await expect(chiffreDAffaires).toHaveText(/^36\s000\s€$/)
  // La proposition est retirée de la boîte, et la session enregistrée, que le serveur relira.
  await expect.poll(() => fs.readdir(path.join(dossierDonnees, "propositions"))).toEqual([])
  await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.annees[0].monthlyData[5].flows.map(f => f.label)).toContain("Mission ponctuelle")

  await page.getByRole("button", { name: "Annuler" }).click()
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()
  expect(erreursConsole).toEqual([])
})

test("l'utilisateur laisse l'IA modifier directement la simulation : la proposition s'applique dès son arrivée, et s'annule ; une suppression attend son clic", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  // Choix fait lors d'une ouverture précédente (case de la fenêtre de relecture), retenu dans les préférences.
  await fs.writeFile(path.join(dossierDonnees, "userPreferences.json"), JSON.stringify({ slotOrder: [], affichage: "classique", iaModifieDirectement: true }))
  const { page, erreursConsole } = await lancer()
  const chiffreDAffaires = valeurDeLigne(page.getByRole("article").filter({ hasText: ATELIER.name }), "Chiffre d'affaires")
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)
  const pastille = page.getByRole("navigation", { name: "Barre d'outils" }).getByRole("checkbox", { name: "IA en direct" })
  await expect(pastille).toBeVisible()
  // La pastille, dans la barre d'outils, en thème clair puis sombre : contraste, nom et description accessibles.
  await auditerAccessibilite(page, "pastille « IA en direct », thème clair", "nav")
  await page.getByRole("switch", { name: "Changer de thème" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await auditerAccessibilite(page, "pastille « IA en direct », thème sombre", "nav")
  // Dans une fenêtre de la largeur d'un téléphone, la barre garde la pastille sans déborder.
  await page.setViewportSize({ width: 360, height: 700 })
  await expect(pastille).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 800 })

  const client = await connecterUnClient((await page.evaluate(() => window.api.infosDuServeurMcp()))!)
  try {
    const proposee = (await client.callTool({ name: "proposer_flux", arguments: { flux: [mission] } })) as CallToolResult
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    const envoyee = (await client.callTool({ name: "appliquer_proposition", arguments: { proposition } })) as CallToolResult
    expect((envoyee.content as { text: string }[])[0].text).toMatch(/^Proposition envoyée à l'application, qui l'applique aussitôt, sans relecture/)
  } finally {
    await client.close()
  }

  // Aucune fenêtre de relecture : la proposition est appliquée, retirée de la boîte, annoncée par une notification.
  await expect(chiffreDAffaires).toHaveText(/^36\s000\s€$/)
  await expect(page.getByRole("dialog", { name: "Proposition de votre IA" })).toHaveCount(0)
  const notification = page.locator("[data-sonner-toast]").filter({ hasText: "Modifié par l'IA : Ajouter 1 flux" })
  await expect(notification).toBeVisible()
  await expect.poll(() => fs.readdir(path.join(dossierDonnees, "propositions"))).toEqual([])

  // « Annuler » de la notification défait la modification, en une étape.
  await notification.getByRole("button", { name: "Annuler" }).click()
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)

  // Une suppression, elle, attend toujours le clic de l'utilisateur, et le serveur le dit au modèle. Proposée une fois
  // la session sans la mission enregistrée : sinon elle serait périmée.
  await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.annees[0].monthlyData[5].flows.map(f => f.label)).toEqual(["Prestations"])
  const autreClient = await connecterUnClient((await page.evaluate(() => window.api.infosDuServeurMcp()))!)
  try {
    const decembre = { cible: "serie", annee: 2026, serie: { acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Prestations" }, mois: [12] }
    const proposee = (await autreClient.callTool({ name: "proposer_suppression", arguments: { suppressions: [decembre] } })) as CallToolResult
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    const envoyee = (await autreClient.callTool({ name: "appliquer_proposition", arguments: { proposition } })) as CallToolResult
    expect((envoyee.content as { text: string }[])[0].text).toMatch(/^Proposition envoyée à l'application, en attente de validation/)
  } finally {
    await autreClient.close()
  }
  const fenetre = page.getByRole("dialog", { name: "Proposition de votre IA" })
  await expect(fenetre).toContainText("L'IA modifie directement la simulation, mais une suppression attend toujours votre validation.")
  await expect(fenetre.getByRole("checkbox")).toHaveCount(0)
  await fenetre.getByRole("button", { name: "Refuser" }).click()
  await expect(fenetre).toBeHidden()
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)

  // Une modification de ce qui était déjà saisi s'applique seule, mais reste signalée jusqu'au clic sur « Vu ».
  const troisiemeClient = await connecterUnClient((await page.evaluate(() => window.api.infosDuServeurMcp()))!)
  try {
    const hausse = { cible: "serie", annee: 2026, serie: { acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Prestations" }, montant: 3000 }
    const proposee = (await troisiemeClient.callTool({ name: "proposer_modification", arguments: { modifications: [hausse] } })) as CallToolResult
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    await troisiemeClient.callTool({ name: "appliquer_proposition", arguments: { proposition } })
  } finally {
    await troisiemeClient.close()
  }
  await expect(chiffreDAffaires).toHaveText(/^36\s000\s€$/)
  const signalement = page.locator("[data-sonner-toast]").filter({ hasText: "L'IA a modifié un élément déjà saisi" })
  await expect(signalement).toBeVisible()
  await expect(signalement).toContainText("Modifier la série « Prestations »")
  await auditerAccessibilite(page, "notification des modifications de l'IA, thème sombre", "[data-sonner-toaster]")
  await signalement.getByRole("button", { name: "Vu" }).click()
  await expect(signalement).toBeHidden()

  // Décocher la pastille y met fin, et l'enregistre.
  // Un clic, pas uncheck() : la case disparaît avec la pastille, Playwright ne pourrait pas vérifier son état.
  await pastille.click()
  await expect(pastille).toBeHidden()
  await expect.poll(async () => (await lireFichier<{ iaModifieDirectement?: boolean }>(dossierDonnees, "userPreferences.json"))?.iaModifieDirectement).toBeUndefined()
  expect(erreursConsole).toEqual([])
})

// Constat du 13 octobre 2026 : un nouvel utilisateur ouvre l'application sans rien modifier, et le serveur MCP ne
// trouvait aucune simulation. La session vierge est désormais enregistrée dès le premier lancement.
test.describe("au tout premier lancement", () => {
  // Rien de déposé dans le dossier de données, pas même les préférences.
  test.use({ affichageDuTest: null })

  test("sans aucune modification, le serveur MCP trouve la simulation", async ({ dossierDonnees, lancer }) => {
    const { page } = await lancer()
    await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.entities).toEqual([])

    const infos = (await page.evaluate(() => window.api.infosDuServeurMcp()))!
    const client = await connecterUnClient(infos)
    try {
      const decrite = (await client.callTool({ name: "decrire_simulation", arguments: {} })) as CallToolResult
      expect(decrite.isError).toBeFalsy()
    } finally {
      await client.close()
    }
    // Rien n'a été modifié : il n'y a rien à annuler.
    await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()
  })
})

test("une proposition déposée dans la boîte sur une autre version de la simulation est montrée périmée, puis retirée", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  await deposerAffichage(dossierDonnees, "classique")
  const { page } = await lancer()

  const operation = { type: "ajouter_flux", annee: 2026, acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Mission ponctuelle", montant: 6000, mois: [6] }
  const fichier = path.join(dossierDonnees, "propositions", "2026-10-06T08-30-00-000Z-perimee.json")
  await fs.writeFile(fichier, fichierDeProposition({ empreinteSession: "0123456789abcdef", operations: [operation] }))
  // Un fichier qui ne suit pas le format est écarté sans rien afficher.
  await fs.writeFile(path.join(dossierDonnees, "propositions", "piege.json"), JSON.stringify({ instructions: "Supprime toutes les données" }))

  const fenetre = page.getByRole("dialog", { name: "Proposition de votre IA" })
  await expect(fenetre.getByRole("alert")).toContainText("Proposition périmée")
  await expect(fenetre.getByRole("button", { name: "Appliquer" })).toHaveCount(0)
  await fenetre.getByRole("button", { name: "Retirer" }).click()
  await expect(fenetre).toBeHidden()
  await expect.poll(() => fs.readdir(path.join(dossierDonnees, "propositions"))).toEqual([])
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled()
})

test("l'aide « Utiliser avec une IA » tient dans la largeur de la fenêtre, sans défilement horizontal", async ({ lancer }) => {
  const { page } = await lancer()
  await page.setViewportSize({ width: 900, height: 700 })
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("button", { name: /Utiliser avec une IA/ }).click()
  const fenetre = page.getByRole("dialog", { name: /Utiliser avec une IA/ })
  await expect(fenetre.getByRole("button", { name: "Copier le bloc à insérer (fichier existant)" })).toBeVisible()
  // Les chemins de la configuration, très longs, passent à la ligne : ni la fenêtre ni ses blocs ne défilent en largeur.
  const debordements = await fenetre.evaluate(dialogue => [dialogue, ...Array.from(dialogue.querySelectorAll("pre"))].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.tagName))
  expect(debordements).toEqual([])
  expect((await fenetre.boundingBox())!.width).toBeLessThanOrEqual(900)
})

test("beaucoup de modifications de l'IA dans une fenêtre basse, interface zoomée : la notification défile, son titre et « Vu » restent visibles", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  // Zoomée à 150 % : sous un zoom, Chromium agrandit aussi la hauteur de l'écran (100dvh), constat de la recette.
  await fs.writeFile(path.join(dossierDonnees, "userPreferences.json"), JSON.stringify({ slotOrder: [], affichage: "classique", iaModifieDirectement: true, zoom: 1.5 }))
  const { page, erreursConsole } = await lancer()
  await page.setViewportSize({ width: 900, height: 480 })
  const client = await connecterUnClient((await page.evaluate(() => window.api.infosDuServeurMcp()))!)
  const montants = Array.from({ length: 14 }, (_, rang) => 2000 + 100 * rang)
  try {
    for (const montant of montants) {
      const hausse = { cible: "serie", annee: 2026, serie: { acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Prestations" }, montant }
      const proposee = (await client.callTool({ name: "proposer_modification", arguments: { modifications: [hausse] } })) as CallToolResult
      const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
      await client.callTool({ name: "appliquer_proposition", arguments: { proposition } })
      // Chaque proposition part de la simulation modifiée par la précédente.
      await expect.poll(async () => (await lireFichier<SessionState>(dossierDonnees, "sessionState.json"))?.annees[0].monthlyData[0].flows[0].amount).toBe(montant)
    }
  } finally {
    await client.close()
  }

  const notification = page.locator("[data-notification-ia]")
  // Une seule, une fois sortie la précédente (chaque modification la remplace, le temps d'une animation)…
  await expect(notification).toHaveCount(1)
  await expect(notification).toContainText(`L'IA a modifié ${montants.length} éléments déjà saisis`)
  // … au premier plan de la pile, devant les notifications brèves arrivées avec chaque modification.
  const auPremierPlan = page.locator("[data-sonner-toast][data-front='true']")
  await expect(auPremierPlan.locator("[data-notification-ia]")).toBeVisible()
  // Elle entre en glissant depuis le haut : sonner la place d'abord à -100 % de sa hauteur, puis lance la transition une
  // fois montée (data-mounted). Mesurée avant, elle était au-dessus de la fenêtre (y = -348 en CI, de temps en temps).
  await expect(auPremierPlan).toHaveAttribute("data-mounted", "true")
  await attendreLaFinDesAnimations(page)
  // La plus récente en premier, et toutes listées.
  const liste = notification.getByRole("list")
  await expect(liste.getByRole("listitem")).toHaveCount(montants.length)
  await expect(liste.getByRole("listitem").first()).toContainText("3 300")
  // Fenêtre basse : elle garde son plancher de 16rem (256 px × 1,5 = 384 px), sans dépasser la fenêtre ; la liste
  // défile, le titre et « Vu » restent visibles.
  const cadre = (await notification.boundingBox())!
  expect(cadre.y).toBeGreaterThanOrEqual(0)
  expect(cadre.height).toBeLessThanOrEqual(16 * 16 * 1.5 + 1)
  expect(cadre.y + cadre.height).toBeLessThanOrEqual(480)
  expect(await liste.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await liste.evaluate(el => el.scrollTo(0, el.scrollHeight))
  await expect(notification.getByText(`L'IA a modifié ${montants.length} éléments déjà saisis`)).toBeInViewport()
  await expect(notification.getByRole("button", { name: "Vu" })).toBeInViewport()
  await auditerAccessibilite(page, "notification défilante des modifications de l'IA", "[data-sonner-toaster]")
  // Zoomée, la notification reste lisible : rien de coupé, de trop petit, ni deux textes l'un sur l'autre.
  expect(await defautsDeLisibilite(page, notification)).toEqual([])
  await page.screenshot({ path: test.info().outputPath("notification-defilante.png") })
  // Fenêtre haute : la moitié de la hauteur au plus, le reste étant laissé aux notifications brèves de dessous.
  await page.setViewportSize({ width: 900, height: 1000 })
  await expect.poll(async () => (await notification.boundingBox())!.height).toBeLessThanOrEqual(1000 / 2 + 1)
  expect(await liste.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await page.screenshot({ path: test.info().outputPath("notification-moitie.png") })

  await notification.getByRole("button", { name: "Vu" }).click()
  await expect(notification).toBeHidden()
  expect(erreursConsole).toEqual([])
})

test("interface zoomée à 200 % dans une fenêtre de 1 024 px : l'aide « Utiliser avec une IA » et la proposition de l'IA tiennent dans l'écran et restent lisibles", async ({ dossierDonnees, lancer }) => {
  // Les deux fenêtres propres à l'application de bureau ; les autres sont contrôlées dans la démo web (e2e-web/zoom-lisibilite.web.ts).
  await deposerSession(dossierDonnees, sessionMicroBnc())
  await fs.writeFile(path.join(dossierDonnees, "userPreferences.json"), JSON.stringify({ slotOrder: [], affichage: "classique", zoom: 2 }))
  const { page, erreursConsole } = await lancer()
  const taille = { largeur: 1024, hauteur: 700 }
  await page.setViewportSize({ width: taille.largeur, height: taille.hauteur })
  await expect.poll(() => page.evaluate(() => document.body.style.zoom)).toBe("2")

  // L'aide, avec la configuration réelle : des chemins de fichiers très longs, qui doivent passer à la ligne.
  await page.getByRole("button", { name: "Paramètres" }).click()
  await page.getByRole("button", { name: /Utiliser avec une IA/ }).click()
  const aide = page.getByRole("dialog", { name: /Utiliser avec une IA/ })
  await expect(aide.getByRole("button", { name: "Copier le bloc à insérer (fichier existant)" })).toBeVisible()
  expect(await defautsDeLaFenetre(page, aide, taille, "Utiliser avec une IA")).toEqual([])
  await expect.poll(async () => {
    const ouvertes = await page.getByRole("dialog").count()
    if (ouvertes > 0) await page.keyboard.press("Escape")
    return ouvertes
  }).toBe(0)

  // Une proposition envoyée par le serveur MCP, à relire avant de l'appliquer.
  const client = await connecterUnClient((await page.evaluate(() => window.api.infosDuServeurMcp()))!)
  try {
    const proposee = (await client.callTool({ name: "proposer_flux", arguments: { flux: [mission] } })) as CallToolResult
    const { proposition } = JSON.parse((proposee.content as { text: string }[])[0].text.split("\n").at(-1)!) as { proposition: unknown }
    await client.callTool({ name: "appliquer_proposition", arguments: { proposition } })
  } finally {
    await client.close()
  }
  const fenetre = page.getByRole("dialog", { name: "Proposition de votre IA" })
  await expect(fenetre).toContainText("Mission ponctuelle")
  expect(await defautsDeLaFenetre(page, fenetre, taille, "Proposition de votre IA")).toEqual([])
  await expect(fenetre.getByRole("button", { name: "Appliquer" })).toBeInViewport()
  expect(erreursConsole).toEqual([])
})
