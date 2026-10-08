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
    expect(ligne("dont maladie (Urssaf)")).toBe("dont maladie (Urssaf)44 €2 451 € pris en charge par l'Assurance maladie")
    expect(ligne("dont retraite de base (CNAVPL)")).toContain("4 706 €")
    expect(ligne("dont retraite complémentaire (CARPIMKO)")).toBe("dont retraite complémentaire (CARPIMKO)3 863 €calculée sur le revenu 2025")
    expect(ligne("dont invalidité-décès (CARPIMKO)")).toContain("1 022 €")
    expect(ligne("dont avantage social vieillesse (ASV)")).toBe("dont avantage social vieillesse (ASV)295 €calculée sur le revenu 2025 ; 554 € pris en charge par l'Assurance maladie")
    expect(ligne("dont CURPS")).toContain("44 €")
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
