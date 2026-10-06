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
import { valeurDeLigne } from "./support/interface"
import { ATELIER, sessionMicroBnc } from "./support/sessions"

const mission = { annee: 2026, acteurId: ATELIER.id, typeFlux: "ca_micro_services_bnc", libelle: "Mission ponctuelle", montant: 6000, mois: [6] }

/** Le contenu d'un fichier de la boîte aux propositions, tel que le dépose le serveur MCP. */
const fichierDeProposition = (proposition: unknown) => JSON.stringify({ format: "simulateur-independant-fr/proposition", version: 1, creeeLe: "2026-10-06T08:30:00.000Z", proposition })

test("une proposition envoyée par le serveur MCP s'applique dans l'application en une étape, et s'annule", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, sessionMicroBnc())
  await deposerAffichage(dossierDonnees, "classique")
  const { page, erreursConsole } = await lancer()
  const chiffreDAffaires = valeurDeLigne(page.getByRole("article").filter({ hasText: ATELIER.name }), "Chiffre d'affaires")
  await expect(chiffreDAffaires).toHaveText(/^30\s000\s€$/)

  // La configuration que l'application donne à copier, et rien d'autre.
  const infos = (await page.evaluate(() => window.api.infosDuServeurMcp()))!
  expect(infos.donnees).toBe(dossierDonnees)
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))
  const client = new Client({ name: "client-e2e", version: "1.0.0" })
  await client.connect(new StdioClientTransport({ command: infos.executable, args: [infos.script, "--donnees", infos.donnees], env: { ...env, ELECTRON_RUN_AS_NODE: "1" }, stderr: "ignore" }))
  try {
    expect((await client.listTools()).tools).toHaveLength(15)
    const proposee = (await client.callTool({ name: "proposer_flux", arguments: { flux: [mission] } })) as CallToolResult
    expect(proposee.isError).toBeFalsy()
    const { proposition } = proposee.structuredContent as { proposition: unknown }
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
