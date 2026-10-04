// captures/readme.captures.ts
// Génère les captures d'écran du README (docs/captures/) à partir d'une simulation fictive :
// une indépendante en micro-entreprise mixte, en couple avec un salarié, avec un enfant.

import path from "node:path"
import type { Company, FinancialFlow, MicroEntreprise, Person, Relationship, SessionState } from "../src/types"
import { test, expect, deposerSession } from "../e2e/support/fixtures"
import { grilleMensuelle } from "../e2e/support/sessions"

const DOSSIER = path.resolve("docs/captures")

const personne = (id: string, name: string, initiales: string, color: string): Person => ({ id, type: "person", name, fiscalParts: 1, avatar: { type: "initials", value: initiales, color }, locked: false })

const camille = personne("person-camille", "Camille Martin", "CM", "#3b82f6")
const julien = personne("person-julien", "Julien Martin", "JM", "#22c55e")
const lea = personne("person-lea", "Léa Martin", "LM", "#f59e0b")

const atelier: MicroEntreprise = { id: "micro-atelier", type: "micro-entreprise", name: "Atelier de Camille", beneficieACRE: false, opteVFL: true, rfrN2: 38000, avatar: { type: "icon", value: "Store", color: "#f97316" }, locked: false }
const conseil: Company = { id: "company-conseil", type: "company", name: "Conseil SASU", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Briefcase", color: "#ef4444" }, locked: false }

const relations: Relationship[] = [
  { id: "rel-1", fromId: camille.id, toId: atelier.id, type: "Titulaire" },
  { id: "rel-2", fromId: julien.id, toId: conseil.id, type: "Président" },
  { id: "rel-3", fromId: camille.id, toId: julien.id, type: "PACSé(e)" },
  { id: "rel-4", fromId: camille.id, toId: lea.id, type: "Enfant" }
]

function flux(mois: number, entityId: string, type: FinancialFlow["type"], amount: number, label: string) {
  return { mois, flux: { id: `${entityId}-${type}-${mois}`, label, amount, entityId, type } }
}

function session(): SessionState {
  const mensuel = Array.from({ length: 12 }, (_, mois) => [
    flux(mois, atelier.id, "ca_micro_services_bnc", 3200 + (mois % 3) * 400, "Prestations"),
    flux(mois, atelier.id, "ca_micro_vente", mois % 4 === 0 ? 900 : 300, "Ventes"),
    flux(mois, conseil.id, "ca_services", 6500, "Facturation"),
    flux(mois, conseil.id, "director_remuneration", 2500, "Rémunération")
  ]).flat()
  return {
    name: "Famille Martin, simulation 2026",
    entities: [camille, julien, lea, atelier, conseil],
    relationships: relations,
    monthlyData: grilleMensuelle([...mensuel, flux(11, conseil.id, "dividends_payment", 12000, "Dividendes")])
  }
}

test("captures du README", async ({ dossierDonnees, lancer }) => {
  await deposerSession(dossierDonnees, session())
  const { page, electronApp } = await lancer()
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 900))

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Martin, simulation 2026")
  await page.screenshot({ path: path.join(DOSSIER, "acteurs-et-grille.png") })

  // La barre du haut est fixe : on fait défiler pour que la section commence juste en dessous.
  await page.getByRole("heading", { name: "Résultats de simulation" }).evaluate(titre => window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 110))
  await page.screenshot({ path: path.join(DOSSIER, "resultats.png") })

  const comparateur = page.getByRole("region", { name: "Comparateur de statuts" })
  await expect(comparateur.getByRole("table", { name: "Comparaison des statuts" })).toBeVisible()
  await comparateur.scrollIntoViewIfNeeded()
  await comparateur.screenshot({ path: path.join(DOSSIER, "comparateur.png") })
})
