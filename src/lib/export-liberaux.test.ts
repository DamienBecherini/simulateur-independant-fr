// src/lib/export-liberaux.test.ts
// Exports CSV et Markdown d'une profession libérale réglementée : profession dans le statut, cotisations par caisse.

import { describe, expect, it } from "vitest"
import { reglesPubliees } from "@/backend/logic/regles"
import { runMetaSimulation } from "@/backend/logic/simulation-engine"
import { grilleVide, type SimulationAnnuelle } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { csvResultats } from "./export-csv"
import { LIMITES, rapportMarkdown } from "./export-markdown"
import { professionDeLaFiche } from "./professions"

function sessionDeKine(): SimulationAnnuelle {
  const monthlyData = grilleVide()
  monthlyData[0].flows.push({ id: "f1", label: "Honoraires", amount: 60000, entityId: "e1", type: "ca_services" })
  return {
    name: "Cabinet",
    annee: 2026,
    entities: [makePerson({ id: "p1", name: "Camille" }), makeCompany({ id: "e1", name: "Cabinet", legalStatus: "EI", profession: "masseur-kinesitherapeute", partConventionnee: 0.8 })],
    relationships: [{ id: "r1", fromId: "p1", toId: "e1", type: "Titulaire" }],
    monthlyData
  }
}

const regles2026 = reglesPubliees(2026)

describe("exports d'une profession libérale réglementée", () => {
  const session = sessionDeKine()
  const report = runMetaSimulation(session, regles2026)

  it("CSV : la profession suit le statut, et les cotisations par caisse ont leur tableau", () => {
    const csv = csvResultats(session, report)
    expect(csv).toContain("EI au réel · Masseur-kinésithérapeute (CARPIMKO)")
    expect(csv).toContain("Cotisations par caisse;Profession;Cotisation;Montant;Précision")
    expect(csv).toMatch(/Cabinet;Masseur-kinésithérapeute \(CARPIMKO\);retraite complémentaire \(CARPIMKO\);3862,80;calculée sur le revenu 2026 \(2025 n'est pas dans la simulation\)/)
    expect(csv).toContain("avantage social vieillesse (ASV)")
  })

  it("Markdown : profession et part conventionnée dans les acteurs, cotisations par caisse, limite des caisses", () => {
    const markdown = rapportMarkdown({ session, report, comparaison: null, date: new Date(2026, 9, 8) })
    expect(markdown).toContain("profession : Masseur-kinésithérapeute (CARPIMKO), part conventionnée 80 %")
    expect(markdown).toContain("### Cotisations par caisse")
    expect(markdown).toMatch(/\| Cabinet \| Masseur-kinésithérapeute \(CARPIMKO\) \| maladie \(Urssaf\) \|/)
    expect(LIMITES.join(" ")).toContain("seules la CIPAV et la CARPIMKO sont calculées")
  })

  it("une activité non réglementée n'a ni profession ni tableau par caisse", () => {
    const sans = { ...session, entities: [session.entities[0], makeCompany({ id: "e1", name: "Cabinet", legalStatus: "EI" })] }
    const csv = csvResultats(sans, runMetaSimulation(sans, regles2026))
    expect(csv).not.toContain("Cotisations par caisse")
    expect(professionDeLaFiche(makeMicro(), regles2026)).toBeNull()
    expect(professionDeLaFiche(makeMicro({ profession: "osteopathe" }), regles2026)).toBe("Ostéopathe (CIPAV)")
  })
})
