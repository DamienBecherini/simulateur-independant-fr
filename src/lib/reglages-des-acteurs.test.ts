// src/lib/reglages-des-acteurs.test.ts

import { describe, expect, it } from "vitest"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { typeCourt } from "./reglages-des-acteurs"

describe("type d'un acteur en bref", () => {
  it("donne le type en bref", () => {
    expect(typeCourt(makePerson({ fiscalParts: 1 }))).toBe("Personne · 1 part")
    expect(typeCourt(makePerson({ fiscalParts: 1.5 }))).toBe("Personne · 1,5 parts")
    expect(typeCourt(makeMicro())).toBe("Micro-entreprise")
    expect(typeCourt(makeCompany({ legalStatus: "EI" }))).toBe("EI au réel")
    expect(typeCourt(makeCompany())).toBe("SASU")
  })
})
