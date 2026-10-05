// src/lib/resume.test.ts

import { describe, expect, it } from "vitest"
import type { ComparaisonResult, ScenarioStatut, SimulationReport, StatutCompare } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { coutsDesQuatreTrimestres, ecartSigne, libelleDuCoutDesTrimestres, meilleurStatut, nombreDAlertes, phraseDuVerdict, tauxDePrelevement } from "./resume"

const espaces = (texte: string | null) => texte?.replace(/\s/g, " ") ?? null

function scenario(statut: StatutCompare, libelle: string, net: number, actuel = false): ScenarioStatut {
  return { statut, libelle, actuel, fraisFonctionnement: 0, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 2, trimestres: 4, resume: "" }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [] }
}

function comparaison(meilleur: StatutCompare): ComparaisonResult {
  return { scenarios: [scenario("SASU", "SASU", 30000), scenario("micro", "Micro-entreprise", 32000, true), scenario("micro-vfl", "Micro + versement libératoire", 31000)], meilleur, couples: [], warnings: [] }
}

describe("barre de résumé", () => {
  it("compte les alertes de l'année, des foyers et des activités", () => {
    const report: SimulationReport = { ...emptyReport(), avertissements: ["Règles 2026 reprises pour 2027."] }
    expect(nombreDAlertes(null)).toBe(0)
    expect(nombreDAlertes(report)).toBe(1)
    const foyer = { warnings: ["a", "b"] } as SimulationReport["foyers"][number]
    const activite = { warnings: ["c"] } as SimulationReport["activities"][number]
    expect(nombreDAlertes({ ...report, foyers: [foyer], activities: [activite] })).toBe(4)
  })

  it("calcule le taux global de prélèvement comme le bilan, sans revenus aucun taux", () => {
    const report = emptyReport()
    expect(tauxDePrelevement(report)).toBeNull()
    expect(espaces(tauxDePrelevement({ ...report, bilan: { ...report.bilan, revenusAvantPrelevements: 1000, totalPrelevements: 326 } }))).toBe("32,6 %")
  })

  it("nomme le meilleur statut, et son écart avec le statut actuel quand ce n'est pas lui", () => {
    expect(meilleurStatut(null)).toBeNull()
    expect(meilleurStatut(comparaison("micro"))).toBe("Micro-entreprise (actuel)")
    expect(espaces(meilleurStatut({ ...comparaison("SASU"), scenarios: comparaison("SASU").scenarios.map(s => (s.statut === "SASU" ? { ...s, netApresImpots: 33500 } : s)) }))).toBe("SASU, +1 500 €")
    expect(meilleurStatut({ ...comparaison("SASU"), scenarios: [scenario("SASU", "SASU", 30000)] })).toBe("SASU")
  })

  it("signe les écarts", () => {
    expect(espaces(ecartSigne(1234))).toBe("+1 234 €")
    expect(espaces(ecartSigne(-850))).toBe("−850 €")
    expect(ecartSigne(0)).toBe("0 €")
  })
})

describe("verdict du comparateur", () => {
  it("quand le statut actuel est le meilleur, nomme le suivant et son écart", () => {
    expect(espaces(phraseDuVerdict(comparaison("micro"), "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €. Juste derrière : Micro + versement libératoire, −1 000 €.")
  })

  it("quand un autre statut est meilleur, donne son gain par rapport au statut actuel", () => {
    const result = { ...comparaison("SASU"), scenarios: comparaison("SASU").scenarios.map(s => (s.statut === "SASU" ? { ...s, netApresImpots: 34000 } : s)) }
    expect(espaces(phraseDuVerdict(result, "Atelier"))).toBe("Pour « Atelier », SASU donnerait le meilleur net : 34 000 €, soit +2 000 € par rapport au statut actuel, Micro-entreprise.")
  })

  it("ne conclut pas sans meilleur statut ou sans statut actuel", () => {
    expect(phraseDuVerdict({ ...comparaison("micro"), meilleur: null }, "Atelier")).toBeNull()
    expect(phraseDuVerdict({ ...comparaison("SASU"), scenarios: [scenario("SASU", "SASU", 30000)] }, "Atelier")).toBeNull()
  })

  it("ne cite pas derrière le statut actuel une colonne micro qui n'est plus accessible", () => {
    const result = { ...comparaison("micro"), scenarios: comparaison("micro").scenarios.map(s => (s.statut === "micro-vfl" ? { ...s, regimeMicroFerme: { depuis: 2028, depassements: [2026, 2027] as [number, number] } } : s)) }
    expect(espaces(phraseDuVerdict(result, "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €. Juste derrière : SASU, −2 000 €.")
  })

  it("seul en tête, le statut actuel n'a personne derrière lui", () => {
    expect(espaces(phraseDuVerdict({ ...comparaison("micro"), scenarios: [scenario("micro", "Micro-entreprise", 32000, true)] }, "Atelier"))).toBe("Pour « Atelier », le statut actuel, Micro-entreprise, donne le meilleur net : 32 000 €.")
  })
})

describe("coût des 4 trimestres de retraite", () => {
  it("donne les colonnes où les exiger coûte du net, avec ce coût", () => {
    const colonne = (libelle: string, coutDesQuatreTrimestres?: number) => ({ libelle, remunerationOptimale: { remunerationNette: 0, avecRetraite: true, retraiteHorsDAtteinte: false, ...(coutDesQuatreTrimestres ? { coutDesQuatreTrimestres } : {}) } }) as ScenarioStatut
    expect(coutsDesQuatreTrimestres([colonne("SASU", 1234), colonne("EURL"), { libelle: "EI au réel" } as ScenarioStatut])).toEqual([{ libelle: "SASU", cout: 1234 }])
    expect(libelleDuCoutDesTrimestres(1234).replace(/\s/g, " ")).toBe("4 trimestres : −1 234 € de net")
  })
})
