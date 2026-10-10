// src/lib/flow-constants.test.ts

import { describe, expect, it } from "vitest"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { estLibelleParDefaut, flowTypeLabels, flowTypeShortLabels, flowTypesByEntityType, getFlowTypesForEntity, isExpenseFlowType, isOutgoingFlowType, libelleDuType } from "@/lib/flow-constants"
import { createCompany, createMicroEntreprise, createPerson } from "@/lib/entity-factory"
import { cn } from "@/lib/utils"
import { FinancialFlowSchema } from "@/types"

const typesDeFlux = FinancialFlowSchema.shape.type.options

describe("constantes des types de flux", () => {
  it("fournit un libellé non vide pour chaque type de flux du schéma, et aucun autre", () => {
    expect(Object.keys(flowTypeLabels).sort()).toEqual([...typesDeFlux].sort())
    expect(Object.values(flowTypeLabels).every(libelle => libelle.trim().length > 0)).toBe(true)
  })

  it("donne un libellé distinct à chaque type de flux", () => {
    const libelles = Object.values(flowTypeLabels)

    expect(new Set(libelles).size).toBe(libelles.length)
  })

  it("fournit une couleur hexadécimale pour chaque type de flux du schéma, et aucun autre", () => {
    expect(Object.keys(DEFAULT_FLOW_COLORS).sort()).toEqual([...typesDeFlux].sort())
    for (const couleur of Object.values(DEFAULT_FLOW_COLORS)) {
      expect(couleur).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("donne une couleur distincte à chaque type de flux", () => {
    const couleurs = Object.values(DEFAULT_FLOW_COLORS)

    expect(new Set(couleurs).size).toBe(couleurs.length)
  })
})

describe("cn", () => {
  it("assemble les classes en ignorant les valeurs fausses", () => {
    expect(cn("flex", false, undefined, "gap-2", { hidden: false, "font-bold": true })).toBe("flex gap-2 font-bold")
  })

  it("résout les conflits Tailwind au profit de la dernière classe", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4")
  })
})

describe("classement des types de flux", () => {
  it("fournit un libellé court pour chaque type de flux du schéma", () => {
    expect(Object.keys(flowTypeShortLabels).sort()).toEqual([...typesDeFlux].sort())
  })

  it("distingue les dépenses des autres sorties d'argent", () => {
    expect(isExpenseFlowType("deductible_expense")).toBe(true)
    expect(isExpenseFlowType("director_remuneration")).toBe(false)
    expect(isOutgoingFlowType("director_remuneration")).toBe(true)
    expect(isOutgoingFlowType("dividends_payment")).toBe(true)
    expect(isOutgoingFlowType("salary")).toBe(false)
  })

  it("ne propose à chaque type d'entité que des types de flux du schéma, sans doublon", () => {
    for (const types of Object.values(flowTypesByEntityType)) {
      expect(types.length).toBeGreaterThan(0)
      expect(new Set(types).size).toBe(types.length)
      expect(types.every(type => typesDeFlux.includes(type))).toBe(true)
    }
  })

  it("ne propose ni rémunération de dirigeant ni dividendes à une entreprise individuelle", () => {
    expect(getFlowTypesForEntity(createCompany("EI"))).toEqual(["ca_services", "ca_vente", "deductible_expense"])
    expect(getFlowTypesForEntity(createCompany("SASU"))).toBe(flowTypesByEntityType.company)
    expect(getFlowTypesForEntity(createMicroEntreprise())).toBe(flowTypesByEntityType["micro-entreprise"])
    expect(getFlowTypesForEntity(createPerson())).toBe(flowTypesByEntityType.person)
  })

  it("réserve les charges déductibles aux sociétés", () => {
    expect(flowTypesByEntityType.company).toContain("deductible_expense")
    expect(flowTypesByEntityType.person).not.toContain("deductible_expense")
    expect(flowTypesByEntityType["micro-entreprise"]).not.toContain("deductible_expense")
  })
})

describe("libellés qui dépendent de l'acteur", () => {
  it("distingue la dépense personnelle de la charge d'une micro-entreprise", () => {
    expect(libelleDuType("expense", "person")).toBe("Dépense personnelle")
    expect(libelleDuType("expense", "micro-entreprise")).toBe("Charge de l'activité (non déductible en micro)")
    expect(libelleDuType("expense")).toBe("Dépense (non déductible)")
    expect(libelleDuType("salary", "person")).toBe("Salaire (emploi tiers)")
  })

  it("reconnaît comme libellé par défaut le libellé de l'acteur et l'ancien libellé générique", () => {
    expect(estLibelleParDefaut({ type: "expense", label: "Charge de l'activité (non déductible en micro)" }, "micro-entreprise")).toBe(true)
    expect(estLibelleParDefaut({ type: "expense", label: "Dépense (non déductible)" }, "micro-entreprise")).toBe(true)
    expect(estLibelleParDefaut({ type: "expense", label: "Loyer" }, "person")).toBe(false)
  })

  it("nomme en entier la nature du chiffre d'affaires d'une micro-entreprise", () => {
    expect(libelleDuType("ca_micro_services_bnc", "micro-entreprise")).toBe("Prestations libérales (BNC)")
    expect(libelleDuType("ca_micro_services_bic", "micro-entreprise")).toBe("Prestations artisanales ou commerciales (BIC)")
    expect(libelleDuType("ca_micro_vente", "micro-entreprise")).toBe("Vente de marchandises (BIC)")
  })

  it("reconnaît encore les anciens libellés par défaut de la micro-entreprise (sauvegardes antérieures), pas ceux d'un autre type", () => {
    expect(estLibelleParDefaut({ type: "ca_micro_services_bic", label: "CA Micro - Services (BIC)" }, "micro-entreprise")).toBe(true)
    expect(estLibelleParDefaut({ type: "ca_micro_services_bnc", label: "CA Micro - Services (BNC)" }, "micro-entreprise")).toBe(true)
    expect(estLibelleParDefaut({ type: "ca_micro_vente", label: "CA Micro - Vente" }, "micro-entreprise")).toBe(true)
    expect(estLibelleParDefaut({ type: "ca_micro_vente", label: "CA Micro - Services (BNC)" }, "micro-entreprise")).toBe(false)
  })

  it("propose les prestations libérales en tête des types d'une micro-entreprise", () => {
    expect(flowTypesByEntityType["micro-entreprise"][0]).toBe("ca_micro_services_bnc")
  })
})
