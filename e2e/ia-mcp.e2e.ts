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
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)
  await fenetre.getByRole("button", { name: "Refuser" }).click()
  await expect(fenetre).toBeHidden()
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)

  // Décocher la pastille y met fin, et l'enregistre.
  // Un clic, pas uncheck() : la case disparaît avec la pastille, Playwright ne pourrait pas vérifier son état.
  await pastille.click()
  await expect(pastille).toBeHidden()
  await expect.poll(async () => (await lireFichier<{ iaModifieDirectement?: boolean }>(dossierDonnees, "userPreferences.json"))?.iaModifieDirectement).toBeUndefined()
  expect(erreursConsole).toEqual([])
})

// Constat du 13 octobre 2026 : un nouvel utilisateur ouvre l'application sans rien modifier, et le serveur MCP ne
// trouvait aucune simulation. La session vierge est désormais enregistrée dès le premier lancement.
test("au tout premier lancement, sans aucune modification, le serveur MCP trouve la simulation", async ({ dossierDonnees, lancer }) => {
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
