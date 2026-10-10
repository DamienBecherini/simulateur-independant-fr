// src/ui/components/ResultsPanel.liberaux.test.tsx
// Carte d'une activité de profession libérale réglementée : profession et caisse sous le nom, cotisations par caisse.

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { grilleVide, type Entity, type SessionState } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ResultsPanel } from "./ResultsPanel"

const normaliser = (texte: string | null) => (texte ?? "").replace(/\s+/g, " ")

/** Une session d'une ou deux années, l'activité « a1 » facturant `montant` en janvier de chaque année. */
function session(activite: Entity, type: "ca_services" | "ca_micro_services_bnc", annees: number[], montant: number): SessionState {
  const personne = makePerson({ id: "p1", name: "Camille" })
  return {
    name: "Libéral",
    entities: [personne, activite],
    relationships: [{ id: "r1", fromId: "p1", toId: "a1", type: "Titulaire" }],
    annees: annees.map(annee => {
      const monthlyData = grilleVide()
      monthlyData[0].flows.push({ id: `f-${annee}`, label: "Honoraires", amount: montant, entityId: "a1", type })
      return { annee, monthlyData }
    })
  }
}

function afficher(donnees: SessionState) {
  const { annees } = simulerLesAnnees(donnees)
  const report = annees[annees.length - 1].report
  render(<ResultsPanel report={report} error={null} />)
}

/** Le texte de la ligne dont le libellé est donné (libellé, montant et précision). */
const ligne = (libelle: string) => normaliser(screen.getByText(libelle).closest("div")!.textContent)

describe("carte d'une activité de profession libérale réglementée", () => {
  it("kinésithérapeute en EI sur 2025 et 2026 : caisse sous le nom, lignes par caisse, prise en charge, revenu 2025 de la complémentaire", () => {
    afficher(session(makeCompany({ id: "a1", name: "Cabinet", legalStatus: "EI", profession: "masseur-kinesitherapeute" }), "ca_services", [2025, 2026], 60000))

    expect(screen.getByText("EI au réel · Masseur-kinésithérapeute (CARPIMKO)")).toBeInTheDocument()
    // 44,4 € avant arrondi : l'euro qui manque à la somme des lignes arrondies va à la plus forte partie décimale.
    expect(ligne("dont maladie (Urssaf)")).toBe("dont maladie (Urssaf)45 €0,1 % de l'assiette ; 2 451 € pris en charge par l'Assurance maladie")
    expect(ligne("dont retraite de base (CNAVPL)")).toContain("4 706 €")
    expect(ligne("dont retraite complémentaire (CARPIMKO)")).toBe("dont retraite complémentaire (CARPIMKO)3 863 €calculée sur le revenu 2025")
    expect(ligne("dont invalidité-décès (CARPIMKO)")).toContain("1 022 €")
    expect(ligne("dont avantage social vieillesse (ASV)")).toBe("dont avantage social vieillesse (ASV)295 €calculée sur le revenu 2025 ; 554 € pris en charge par l'Assurance maladie")
    expect(ligne("dont CURPS")).toContain("44 €")
  })

  it("ostéopathe en EI, 54 000 € en 2026 : toutes les lignes, dont la somme est le total des cotisations (P-06)", () => {
    afficher(session(makeCompany({ id: "a1", name: "Cabinet", legalStatus: "EI", profession: "osteopathe" }), "ca_services", [2026], 54000))

    expect(ligne("Cotisations sociales")).toBe("Cotisations sociales− 15 008 €assiette de 39 960 € (54 000 € de revenu avant cotisations, après l'abattement forfaitaire) ; montant définitif de l'année, que l'Urssaf appelle d'abord en acomptes provisionnels puis régularise")
    // Avant arrondi : 2 060,86 + 119,88 + 4 235,76 + 4 395,60 + 199,80 + 2 717,28 + 1 158,84 + 120,15 = 15 008,17 €.
    expect(ligne("dont maladie (Urssaf)")).toBe("dont maladie (Urssaf)2 061 €5,16 % de l'assiette")
    expect(ligne("dont indemnités journalières")).toBe("dont indemnités journalières120 €0,3 % de l'assiette")
    expect(ligne("dont retraite de base (CNAVPL)")).toBe("dont retraite de base (CNAVPL)4 236 €10,6 % de l'assiette")
    expect(ligne("dont retraite complémentaire (CIPAV)")).toBe("dont retraite complémentaire (CIPAV)4 395 €11 % de l'assiette")
    expect(ligne("dont invalidité-décès (CIPAV)")).toBe("dont invalidité-décès (CIPAV)200 €0,5 % de l'assiette")
    expect(ligne("dont CSG déductible")).toBe("dont CSG déductible2 717 €6,8 % de l'assiette")
    expect(ligne("dont CSG non déductible et CRDS")).toBe("dont CSG non déductible et CRDS1 159 €2,9 % de l'assiette")
    expect(ligne("dont formation professionnelle")).toBe("dont formation professionnelle120 €forfait annuel, dû même sans revenu")
    expect(screen.queryByText("dont allocations familiales")).not.toBeInTheDocument()
  })

  it("sans l'année précédente dans la simulation, la ligne le dit", () => {
    afficher(session(makeCompany({ id: "a1", name: "Cabinet", legalStatus: "EI", profession: "infirmier" }), "ca_services", [2026], 60000))
    expect(ligne("dont retraite complémentaire (CARPIMKO)")).toContain("calculée sur le revenu 2026 (2025 n'est pas dans la simulation)")
  })

  it("ostéopathe en micro-entreprise : taux de la CIPAV sous le nom, pas de lignes du réel", () => {
    afficher(session(makeMicro({ id: "a1", name: "Cabinet", profession: "osteopathe" }), "ca_micro_services_bnc", [2026], 40000))
    expect(screen.getByText("Micro-entreprise · Ostéopathe (CIPAV, 23,2 % du chiffre d'affaires)")).toBeInTheDocument()
    expect(screen.queryByText("dont retraite de base (CNAVPL)")).not.toBeInTheDocument()
  })

  it("« Autre profession réglementée » : caisse non prise en compte, sous le nom et dans les avertissements", () => {
    afficher(session(makeCompany({ id: "a1", name: "Cabinet", legalStatus: "EI", profession: "autre-reglementee" }), "ca_services", [2026], 60000))
    expect(screen.getByText("EI au réel · Autre profession réglementée (caisse non prise en compte)")).toBeInTheDocument()
    expect(screen.getByText(/la caisse de cette profession n'est pas encore prise en compte/)).toBeInTheDocument()
  })
})
