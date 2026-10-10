// src/lib/export-aligne-ecran.test.ts
// Les exports CSV et Markdown reprennent le détail des cotisations de l'écran : mêmes lignes, mêmes montants (à l'euro,
// méthode du plus fort reste), dont la somme est exactement le total de l'activité.

import { describe, expect, it } from "vitest"
import { reglesPubliees } from "@/backend/logic/regles"
import { runMetaSimulation } from "@/backend/logic/simulation-engine"
import { grilleVide, type ActivityResult, type FinancialFlow, type SimulationAnnuelle } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { detailDesCotisations } from "./detail-des-cotisations"
import { csvResultats } from "./export-csv"
import { rapportMarkdown } from "./export-markdown"

const ACTIVITES = [
  { id: "e1", nom: "Osteo", entite: makeCompany({ id: "e1", name: "Osteo", legalStatus: "EI", profession: "osteopathe" }), relation: "Titulaire" as const, flux: [{ type: "ca_services", amount: 61234 }] },
  { id: "e2", nom: "Atelier", entite: makeCompany({ id: "e2", name: "Atelier", legalStatus: "EI" }), relation: "Titulaire" as const, flux: [{ type: "ca_services", amount: 54321 }] },
  { id: "e3", nom: "Societe", entite: makeCompany({ id: "e3", name: "Societe", legalStatus: "SASU", capitalSocial: 1000 }), relation: "Président" as const, flux: [{ type: "ca_services", amount: 90000 }, { type: "director_remuneration", amount: 36000 }] },
  { id: "e4", nom: "Micro", entite: makeMicro({ id: "e4", name: "Micro" }), relation: "Titulaire" as const, flux: [{ type: "ca_micro_services_bnc", amount: 36789 }] }
]

function session(): SimulationAnnuelle {
  const monthlyData = grilleVide()
  for (const a of ACTIVITES) a.flux.forEach((f, i) => monthlyData[0].flows.push({ id: `${a.id}-${i}`, label: f.type, amount: f.amount, entityId: a.id, type: f.type } as FinancialFlow))
  return {
    name: "Exports",
    annee: 2026,
    entities: [makePerson({ id: "p1", name: "Camille" }), ...ACTIVITES.map(a => a.entite)],
    relationships: ACTIVITES.map(a => ({ id: `r-${a.id}`, fromId: "p1", toId: a.id, type: a.relation })),
    monthlyData
  }
}

const s = session()
const report = runMetaSimulation(s, reglesPubliees(2026))
const nombre = (texte: string) => Number(texte.replace(/[^\d,-]/g, "").replace(",", "."))

/** Les lignes d'une activité dans le tableau du CSV : [cotisation, montant]. */
function lignesCsv(activite: string): [string, number][] {
  const lignes = csvResultats(s, report).split("\r\n")
  const debut = lignes.indexOf("Détail des cotisations;Profession;Cotisation;Montant;Précision")
  const fin = lignes.indexOf("", debut)
  return lignes.slice(debut + 1, fin < 0 ? undefined : fin).map(l => l.split(";")).filter(c => c[0] === activite).map(c => [c[2], nombre(c[3])])
}

/** Les lignes d'une activité dans le tableau du Markdown : [cotisation, montant]. */
function lignesMarkdown(activite: string): [string, number][] {
  const texte = rapportMarkdown({ session: s, report, comparaison: null, date: new Date(2026, 9, 4) })
  const debut = texte.indexOf("### Détail des cotisations")
  const bloc = texte.slice(debut, texte.indexOf("\n\n###", debut + 5) < 0 ? undefined : texte.indexOf("\n\n###", debut + 5))
  return bloc.split("\n").filter(l => l.startsWith(`| ${activite} |`)).map(l => l.split(" | ")).map(c => [c[2], nombre(c[3])])
}

function ecran(activite: ActivityResult): [string, number][] {
  return detailDesCotisations(activite).map(l => [l.libelle.replace(/^dont /, ""), l.montant])
}

describe("exports alignés sur le détail de l'écran", () => {
  it.each(ACTIVITES.map(a => [a.nom] as const))("%s : mêmes lignes et mêmes montants que l'écran, dont la somme est le total", nom => {
    const activite = report.activities.find(a => a.name === nom)
    if (!activite) throw new Error(`activité ${nom} absente`)
    const attendu = ecran(activite)
    expect(attendu.length).toBeGreaterThan(1)
    expect(lignesCsv(nom)).toEqual(attendu)
    expect(lignesMarkdown(nom)).toEqual(attendu)
    expect(lignesCsv(nom).reduce((somme, [, m]) => somme + m, 0)).toBe(Math.round(activite.cotisationsSociales))
    expect(lignesMarkdown(nom).reduce((somme, [, m]) => somme + m, 0)).toBe(Math.round(activite.cotisationsSociales))
  })

  it("l'ostéopathe de la CIPAV garde sa profession dans les deux exports et le détail complet (CSG, IJ, formation)", () => {
    const libelles = lignesCsv("Osteo").map(([libelle]) => libelle)
    expect(libelles).toEqual(expect.arrayContaining(["CSG déductible", "formation professionnelle"]))
    expect(csvResultats(s, report)).toContain("Osteo;Ostéopathe (CIPAV")
  })
})
