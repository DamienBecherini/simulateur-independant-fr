// src/lib/entity-factory.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCompany, createMicroEntreprise, createPerson } from "@/lib/entity-factory"
import { CAPITAL_SOCIAL_PAR_DEFAUT, CompanySchema, MicroEntrepriseSchema, PersonSchema } from "@/types"

const MAINTENANT = 1_700_000_000_000

/** Un identifiant attendu : le préfixe lisible suivi d'un UUID. */
function idAvecPrefixe(prefixe: string) {
  return expect.stringMatching(new RegExp(`^${prefixe}-[0-9a-f-]{36}$`))
}

// L'horloge est figée : toutes les entités d'un test sont créées dans la même milliseconde.
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
      id: idAvecPrefixe("person"),
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
      id: idAvecPrefixe("company"),
      type: "company",
      name: "Ma SASU",
      legalStatus: "SASU",
      capitalSocial: 1000,
      avatar: { type: "icon", value: "Briefcase", color: "#b91c1c" },
      locked: false
    })
  })

  it("crée une EURL", () => {
    expect(createCompany("EURL")).toEqual({
      id: idAvecPrefixe("company"),
      type: "company",
      name: "Mon EURL",
      legalStatus: "EURL",
      capitalSocial: 1000,
      avatar: { type: "icon", value: "Building", color: "#16a34a" },
      locked: false
    })
  })

  it("crée une entreprise individuelle, sans capital social", () => {
    expect(createCompany("EI")).toEqual({
      id: idAvecPrefixe("company"),
      type: "company",
      name: "Mon entreprise individuelle",
      legalStatus: "EI",
      capitalSocial: 0,
      avatar: { type: "icon", value: "User", color: "#7e22ce" },
      locked: false
    })
  })

  it("donne aux SASU et EURL le même capital par défaut que le schéma d'un fichier sans capital", () => {
    const sansCapital = { ...createCompany("EURL"), capitalSocial: undefined }
    expect(CompanySchema.parse(sansCapital).capitalSocial).toBe(CAPITAL_SOCIAL_PAR_DEFAUT)
    expect(createCompany("SASU").capitalSocial).toBe(CAPITAL_SOCIAL_PAR_DEFAUT)
    expect(createCompany("EURL").capitalSocial).toBe(CAPITAL_SOCIAL_PAR_DEFAUT)
  })

  it.each(["SASU", "EURL", "EI"] as const)("produit une %s conforme au schéma", statut => {
    const societe = createCompany(statut)

    expect(CompanySchema.parse(societe)).toEqual(societe)
  })
})

describe("createMicroEntreprise", () => {
  it("crée une micro-entreprise sans ACRE ni versement libératoire", () => {
    expect(createMicroEntreprise()).toEqual({
      id: idAvecPrefixe("micro"),
      type: "micro-entreprise",
      name: "Ma Micro-Entreprise",
      beneficieACRE: false,
      opteVFL: false,
      avatar: { type: "icon", value: "Store", color: "#d97706" },
      locked: false
    })
  })

  it("produit une entité conforme au schéma", () => {
    const microEntreprise = createMicroEntreprise()

    expect(MicroEntrepriseSchema.parse(microEntreprise)).toEqual(microEntreprise)
  })
})

describe("identifiants", () => {
  it.each([
    ["personnes", createPerson],
    ["sociétés", () => createCompany("SASU")],
    ["micro-entreprises", createMicroEntreprise]
  ])("garantit des identifiants uniques pour des %s créées dans la même milliseconde", (_type, creer) => {
    const ids = Array.from({ length: 100 }, () => creer().id)

    expect(new Set(ids).size).toBe(100)
  })
})
