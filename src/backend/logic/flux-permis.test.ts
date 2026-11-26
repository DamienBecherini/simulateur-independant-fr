// src/backend/logic/flux-permis.test.ts

import { describe, expect, it } from "vitest"
import { FinancialFlowSchema } from "../../types.js"
import { FLUX_PERMIS, fluxPermis, genreDe } from "./flux-permis.js"
import { TYPES_DE_FLUX } from "./outils/commun.js"
import { micro, personne, portage, societe } from "./testing/session-de-test.js"

const typesDuSchema = FinancialFlowSchema.shape.type.options

describe("types de flux permis à chaque genre d'acteur", () => {
  it("dit le genre d'un acteur : une personne, ou une activité et sa forme", () => {
    expect([personne("p"), societe("s", "SASU"), societe("e", "EURL"), societe("i", "EI"), micro("m"), portage("po")].map(genreDe)).toEqual(["personne", "SASU", "EURL", "EI", "micro-entreprise", "portage"])
  })

  it("chaque genre a ses types, sans doublon", () => {
    for (const types of Object.values(FLUX_PERMIS)) {
      expect(types.length).toBeGreaterThan(0)
      expect(new Set(types).size).toBe(types.length)
    }
  })

  it("chaque type du schéma est porté par un genre au moins, sauf « income », réservé aux tests", () => {
    const portes = new Set<string>(Object.values(FLUX_PERMIS).flat())
    expect([...portes].sort()).toEqual(typesDuSchema.filter(type => type !== "income").sort())
  })

  it("les outils pour les IA écrivent exactement ces types", () => {
    expect([...TYPES_DE_FLUX].sort()).toEqual([...new Set(Object.values(FLUX_PERMIS).flat())].sort())
  })

  it("ni rémunération de dirigeant ni dividendes hors d'une société à l'impôt sur les sociétés", () => {
    expect(fluxPermis(societe("i", "EI"))).toEqual(["ca_services", "ca_vente", "deductible_expense"])
    expect(fluxPermis(societe("s", "SASU"))).toEqual(["ca_services", "ca_vente", "deductible_expense", "director_remuneration", "dividends_payment"])
    expect(fluxPermis(societe("e", "EURL"))).toBe(fluxPermis(societe("s", "SASU")))
    expect(fluxPermis(portage("po"))).toEqual(["ca_services", "deductible_expense"])
  })

  it("les charges déductibles sont celles d'une activité au réel : ni une personne ni une micro-entreprise n'en a", () => {
    expect(fluxPermis(personne("p"))).not.toContain("deductible_expense")
    expect(fluxPermis(micro("m"))).not.toContain("deductible_expense")
    expect(fluxPermis(micro("m"))).toContain("expense")
  })

  it("les prestations libérales viennent en tête des types d'une micro-entreprise : c'est la nature proposée d'office", () => {
    expect(fluxPermis(micro("m"))[0]).toBe("ca_micro_services_bnc")
  })
})
