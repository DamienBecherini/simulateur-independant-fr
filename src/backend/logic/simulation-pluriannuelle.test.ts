// src/backend/logic/simulation-pluriannuelle.test.ts

import { describe, expect, it } from "vitest"
import { grilleVide, type SessionState } from "../../types.js"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "./simulation-pluriannuelle.js"
import { micro, personne, relation, societe } from "./testing/session-de-test.js"

/** Une grille dont janvier porte un chiffre d'affaires pour l'activité. */
function grilleAvecCA(entityId: string, type: "ca_micro_services_bnc" | "ca_services", montant: number) {
  const grille = grilleVide()
  grille[0].flows.push({ id: `${entityId}-${montant}`, label: "CA", amount: montant, entityId, type })
  return grille
}

/** Alice, titulaire d'une micro-entreprise : 20 000 € de CA en 2025, 30 000 € en 2026. */
function sessionMicro(): SessionState {
  return {
    name: "Deux années",
    entities: [personne("alice"), micro("m1")],
    relationships: [relation("alice", "m1", "Titulaire")],
    annees: [
      { annee: 2025, monthlyData: grilleAvecCA("m1", "ca_micro_services_bnc", 20000) },
      { annee: 2026, monthlyData: grilleAvecCA("m1", "ca_micro_services_bnc", 30000) }
    ]
  }
}

describe("simulerLesAnnees", () => {
  it("simule chaque année avec sa propre grille", () => {
    const { annees } = simulerLesAnnees(sessionMicro())

    expect(annees.map(a => a.annee)).toEqual([2025, 2026])
    expect(annees.map(a => a.report?.activities[0].chiffreAffaires)).toEqual([20000, 30000])
    expect(annees.every(a => a.erreur === null)).toBe(true)
  })
})

describe("comparateur et optimiseur sur une année", () => {
  const sasu: SessionState = {
    name: "SASU",
    entities: [personne("alice"), societe("s1")],
    relationships: [relation("alice", "s1", "Président")],
    annees: [
      { annee: 2025, monthlyData: grilleAvecCA("s1", "ca_services", 50000) },
      { annee: 2026, monthlyData: grilleAvecCA("s1", "ca_services", 90000) }
    ]
  }
  const options = { activityId: "s1", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }

  it("compare les statuts sur la grille de l'année demandée", () => {
    const en2025 = comparerStatutsDeLAnnee(sasu, options, 2025)
    const en2026 = comparerStatutsDeLAnnee(sasu, options, 2026)

    expect(en2025.scenarios.find(s => s.statut === "SASU")!.revenusAvantPrelevements).toBe(50000)
    expect(en2026.scenarios.find(s => s.statut === "SASU")!.revenusAvantPrelevements).toBe(90000)
  })

  it("prend la plus récente pour une année absente de la session", () => {
    expect(comparerStatutsDeLAnnee(sasu, options, 2030)).toEqual(comparerStatutsDeLAnnee(sasu, options, 2026))
  })

  it("arbitre rémunération et dividendes sur l'année demandée", () => {
    const en2025 = optimiserRemunerationDeLAnnee(sasu, options, "SASU", 2025)
    const en2026 = optimiserRemunerationDeLAnnee(sasu, options, "SASU", 2026)

    expect(en2025.remunerationMaximale).toBeLessThan(en2026.remunerationMaximale)
  })
})
