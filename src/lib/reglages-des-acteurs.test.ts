// src/lib/reglages-des-acteurs.test.ts

import { describe, expect, it } from "vitest"
import type { Relationship } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { lignesDesReglages, typeCourt } from "./reglages-des-acteurs"

const espaces = (lignes: string[]) => lignes.map(l => l.replace(/\s/g, " "))

describe("réglages d'un acteur en clair", () => {
  it("donne le type en bref", () => {
    expect(typeCourt(makePerson({ fiscalParts: 1 }))).toBe("Personne · 1 part")
    expect(typeCourt(makePerson({ fiscalParts: 1.5 }))).toBe("Personne · 1,5 parts")
    expect(typeCourt(makeMicro())).toBe("Micro-entreprise")
    expect(typeCourt(makeCompany({ legalStatus: "EI" }))).toBe("EI au réel")
    expect(typeCourt(makeCompany())).toBe("SASU")
  })

  it("imprime les réglages d'une personne : parts, frais, relations, verrou", () => {
    const alice = makePerson({ fiscalParts: 1.5, locked: true, fraisReels: { trajets: [{ libelle: "Bureau", kmParTrajet: 25, joursTravailles: 210, puissanceFiscale: "5", electrique: true, distanceJustifiee: false }], autresFrais: 300 } })
    const sasu = makeCompany()
    const relations: Relationship[] = [{ id: "r1", fromId: alice.id, toId: sasu.id, type: "Président" }]

    expect(espaces(lignesDesReglages(alice, [alice, sasu], relations))).toEqual(["Parts propres : 1,5", "Frais réels comparés à la déduction de 10 % : Bureau 25 km, 210 jours, 5 CV, électrique ; 300 € d'autres frais", "Relations : Président → Ma SASU", "Verrouillé"])
    expect(lignesDesReglages(sasu, [alice, sasu], relations)).toEqual(["Relations : ← Président Alice Martin"])
    expect(lignesDesReglages(makePerson(), [makePerson()], [])).toEqual(["Parts propres : 1", "Frais sur les salaires : déduction de 10 %", "Aucune relation"])
  })

  it("imprime les options d'une micro-entreprise et le capital d'une EURL, avec leurs déplacements", () => {
    const micro = makeMicro({ beneficieACRE: true, opteVFL: false, rfrN2: 38000, deplacementsProfessionnels: { kmParAn: 5000, puissanceFiscale: "4", electrique: false } })
    expect(espaces(lignesDesReglages(micro, [micro], []))).toEqual(["ACRE : oui", "Versement libératoire : non", "RFR N-2 : 38 000 €", "Déplacements professionnels : 5 000 km par an, 4 CV", "Aucune relation"])
    expect(lignesDesReglages(makeMicro(), [], [])).toContain("RFR N-2 : non renseigné")
    expect(espaces(lignesDesReglages(makeCompany({ legalStatus: "EURL", capitalSocial: 1500 }), [], []))).toEqual(["Capital social : 1 500 €", "Aucune relation"])
  })

  it("ignore une relation vers un acteur disparu", () => {
    const alice = makePerson()
    expect(lignesDesReglages(alice, [alice], [{ id: "r", fromId: alice.id, toId: "absent", type: "Président" }])).toContain("Aucune relation")
  })
})
