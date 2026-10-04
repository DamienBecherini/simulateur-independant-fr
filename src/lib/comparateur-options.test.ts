// src/lib/comparateur-options.test.ts

import { describe, expect, it } from "vitest"
import { comparableActivities, defaultComparisonOptions, defaultFraisFonctionnement } from "@/lib/comparateur-options"
import { createCompany, createMicroEntreprise, createPerson } from "@/lib/entity-factory"
import type { FinancialFlow, SessionState } from "@/types"

function session(flows: Omit<FinancialFlow, "id" | "label">[] = []): SessionState {
  const monthlyData = Array.from({ length: 12 }, (_, month) => ({ month, flows: [] as FinancialFlow[] }))
  flows.forEach((flow, i) => monthlyData[i % 12].flows.push({ id: `f${i}`, label: flow.type, ...flow }))
  return { name: "Test", entities: [], relationships: [], monthlyData }
}

describe("comparableActivities", () => {
  it("ne retient que les activités, dans l'ordre de la session", () => {
    const sasu = createCompany("SASU")
    const micro = createMicroEntreprise()

    expect(comparableActivities({ ...session(), entities: [createPerson(), sasu, micro] })).toEqual([sasu, micro])
  })
})

describe("defaultFraisFonctionnement", () => {
  it("prévoit des frais pour chaque statut, expert-comptable compris en société", () => {
    const frais = defaultFraisFonctionnement()

    expect(Object.keys(frais)).toEqual(["SASU", "EURL", "EI", "micro"])
    expect(frais.SASU.expertComptable).toBeGreaterThan(frais.EI.expertComptable)
    expect(frais.micro.expertComptable).toBe(0)
    expect(frais.micro.assurance).toBeGreaterThan(0)
  })

  it("renvoie une copie à chaque appel", () => {
    const frais = defaultFraisFonctionnement()
    frais.SASU.expertComptable = 0

    expect(defaultFraisFonctionnement().SASU.expertComptable).toBeGreaterThan(0)
  })
})

describe("defaultComparisonOptions", () => {
  it("reprend la rémunération annuelle saisie et garde les dividendes saisis", () => {
    const donnees = session([
      { entityId: "s1", type: "director_remuneration", amount: 2000 },
      { entityId: "s1", type: "director_remuneration", amount: 2000 },
      { entityId: "s1", type: "dividends_payment", amount: 5000 },
      { entityId: "autre", type: "director_remuneration", amount: 9000 }
    ])

    expect(defaultComparisonOptions(donnees, "s1")).toEqual({ activityId: "s1", remunerationNette: 4000, distribuerToutLeBenefice: false, partBncPrestations: 1, fraisFonctionnement: defaultFraisFonctionnement() })
  })

  it("distribue tout le bénéfice quand aucun dividende n'est saisi", () => {
    expect(defaultComparisonOptions(session([{ entityId: "m1", type: "ca_micro_vente", amount: 1000 }]), "m1")).toEqual({ activityId: "m1", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1, fraisFonctionnement: defaultFraisFonctionnement() })
  })
})
