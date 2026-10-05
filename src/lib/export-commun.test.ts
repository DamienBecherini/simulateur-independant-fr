// src/lib/export-commun.test.ts

import { describe, expect, it } from "vitest"
import type { Company, FinancialFlow, MicroEntreprise, Person, SimulationAnnuelle } from "@/types"
import { fluxParActeur, natureActeur, nomDeFichier, nomDeLActeur, slugifier } from "./export-commun"

const avatar = { type: "initials" as const, value: "A", color: "#000000" }
const alice: Person = { id: "p1", type: "person", name: "Alice", fiscalParts: 1, avatar, locked: false }
const sasu: Company = { id: "c1", type: "company", name: "Ma SASU", legalStatus: "SASU", capitalSocial: 1000, avatar, locked: false }
const ei: Company = { ...sasu, id: "c2", name: "Mon EI", legalStatus: "EI" }
const micro: MicroEntreprise = { id: "m1", type: "micro-entreprise", name: "Atelier", beneficieACRE: false, opteVFL: false, avatar, locked: false }

const flux = (entityId: string, type: FinancialFlow["type"], amount: number, id = `${entityId}-${type}-${amount}`): FinancialFlow => ({ id, entityId, type, label: "", amount })

function session(fluxParMois: Record<number, FinancialFlow[]>, entities = [alice, sasu]): SimulationAnnuelle {
  return { name: "Test", annee: 2026, entities, relationships: [], monthlyData: Array.from({ length: 12 }, (_, month) => ({ month, flows: fluxParMois[month] ?? [] })) }
}

describe("slugifier", () => {
  it("retire les accents, met en minuscules et remplace le reste par des tirets", () => {
    expect(slugifier("Famille Martin, simulation 2026 !")).toBe("famille-martin-simulation-2026")
    expect(slugifier("  Été à Noël  ")).toBe("ete-a-noel")
    expect(slugifier("«»")).toBe("")
  })

  it("limite la longueur sans finir par un tiret", () => {
    const slug = slugifier(`${"a".repeat(59)} b`)
    expect(slug).toBe("a".repeat(59))
  })
})

describe("nomDeFichier", () => {
  it("assemble le nom de la simulation, le contenu et l'année", () => {
    expect(nomDeFichier("Nouvelle Simulation", "grille", "csv", 2026)).toBe("nouvelle-simulation-grille-2026.csv")
    expect(nomDeFichier("Nouvelle Simulation", "rapport", "md")).toBe("nouvelle-simulation-rapport.md")
  })

  it("n'ajoute pas l'année quand le nom la contient déjà, et se rabat sur « simulation » sans nom utilisable", () => {
    expect(nomDeFichier("Famille Martin, simulation 2026", "grille", "csv", 2026)).toBe("famille-martin-simulation-2026-grille.csv")
    expect(nomDeFichier("???", "grille", "csv", 2026)).toBe("simulation-grille-2026.csv")
  })
})

describe("natureActeur", () => {
  it("nomme chaque nature d'acteur comme l'application", () => {
    expect(natureActeur(alice)).toBe("Personne")
    expect(natureActeur(sasu)).toBe("SASU")
    expect(natureActeur({ ...sasu, legalStatus: "EURL" })).toBe("EURL")
    expect(natureActeur(ei)).toBe("EI au réel")
    expect(natureActeur(micro)).toBe("Micro-entreprise")
  })
})

describe("fluxParActeur", () => {
  it("additionne les flux d'un même type, mois par mois, dans l'ordre des acteurs et des types", () => {
    const s = session({
      0: [flux("c1", "ca_services", 1000), flux("c1", "ca_services", 500, "autre"), flux("p1", "salary", 2000)],
      5: [flux("c1", "deductible_expense", 100)]
    })
    const resultat = fluxParActeur(s)

    expect(resultat.map(a => a.entity.name)).toEqual(["Alice", "Ma SASU"])
    expect(resultat[0].lignes).toEqual([{ type: "salary", libelle: "Salaire (emploi tiers)", sortie: false, mois: [2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], total: 2000 }])
    expect(resultat[1].lignes.map(l => [l.type, l.total, l.sortie])).toEqual([
      ["ca_services", 1500, false],
      ["deductible_expense", 100, true]
    ])
    expect(resultat[1].lignes[1].mois[5]).toBe(100)
  })

  it("garde un type saisi à zéro, omet les acteurs sans flux et ignore les flux d'un acteur supprimé", () => {
    const s = session({ 2: [flux("p1", "are", 0), flux("disparu", "salary", 10)] })
    const resultat = fluxParActeur(s)
    expect(resultat).toHaveLength(1)
    expect(resultat[0].lignes[0]).toMatchObject({ type: "are", total: 0 })
  })

  it("tolère une grille dont un mois manque", () => {
    const s: SimulationAnnuelle = { ...session({}), monthlyData: [{ month: 3, flows: [flux("p1", "salary", 10)] }] as SimulationAnnuelle["monthlyData"] }
    expect(fluxParActeur(s)[0].lignes[0].mois).toEqual([0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0])
  })
})

describe("nomDeLActeur", () => {
  it("renvoie le nom, ou l'identifiant d'un acteur qui n'existe plus", () => {
    expect(nomDeLActeur(session({}), "p1")).toBe("Alice")
    expect(nomDeLActeur(session({}), "x")).toBe("x")
  })
})
