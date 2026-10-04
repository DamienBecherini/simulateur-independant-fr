// src/lib/entity-factory.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCompany, createMicroEntreprise, createPerson } from "@/lib/entity-factory"
import { CompanySchema, MicroEntrepriseSchema, PersonSchema } from "@/types"

const MAINTENANT = 1_700_000_000_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(MAINTENANT)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createPerson", () => {
  it("crée une personne avec une part fiscale et un avatar à initiales", () => {
    expect(createPerson()).toEqual({
      id: `person-${MAINTENANT}`,
      type: "person",
      name: "Nouvelle Personne",
      fiscalParts: 1,
      avatar: { type: "initials", value: "NP", color: "#3b82f6" },
      locked: false
    })
  })

  it("produit une entité conforme au schéma", () => {
    const personne = createPerson()

    expect(PersonSchema.parse(personne)).toEqual(personne)
  })
})

describe("createCompany", () => {
  it("crée une SASU", () => {
    expect(createCompany("SASU")).toEqual({
      id: `company-${MAINTENANT}`,
      type: "company",
      name: "Ma SASU",
      legalStatus: "SASU",
      avatar: { type: "icon", value: "Briefcase", color: "#ef4444" },
      locked: false
    })
  })

  it("crée une EURL", () => {
    expect(createCompany("EURL")).toEqual({
      id: `company-${MAINTENANT}`,
      type: "company",
      name: "Mon EURL",
      legalStatus: "EURL",
      avatar: { type: "icon", value: "Building", color: "#22c55e" },
      locked: false
    })
  })

  it.each(["SASU", "EURL"] as const)("produit une %s conforme au schéma", statut => {
    const societe = createCompany(statut)

    expect(CompanySchema.parse(societe)).toEqual(societe)
  })
})

describe("createMicroEntreprise", () => {
  it("crée une micro-entreprise sans ACRE ni versement libératoire", () => {
    expect(createMicroEntreprise()).toEqual({
      id: `micro-${MAINTENANT}`,
      type: "micro-entreprise",
      name: "Ma Micro-Entreprise",
      beneficieACRE: false,
      opteVFL: false,
      avatar: { type: "icon", value: "Store", color: "#f97316" },
      locked: false
    })
  })

  it("produit une entité conforme au schéma", () => {
    const microEntreprise = createMicroEntreprise()

    expect(MicroEntrepriseSchema.parse(microEntreprise)).toEqual(microEntreprise)
  })
})

describe("identifiants", () => {
  it.todo("garantit des identifiants uniques : deux entités du même type créées dans la même milliseconde reçoivent le même id (Date.now())")
})
