// src/ui/components/SyntheseDuComparateur.test.tsx
// Cartes des statuts (affichage « Résumé » sur téléphone) : les mentions de chaque statut.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ComparaisonResult, ScenarioStatut, StatutCompare } from "@/types"
import { CartesDesStatuts } from "./SyntheseDuComparateur"

function scenario(statut: StatutCompare, libelle: string, net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, fraisFonctionnement: 0, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: "" }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...autres }
}

describe("cartes des statuts", () => {
  it("disent qu'une colonne micro est hors plafond, ou plus accessible après la sortie du régime micro", () => {
    const sortie = { depuis: 2028, depassements: [2026, 2027] as [number, number] }
    const result: ComparaisonResult = {
      scenarios: [scenario("EI", "EI au réel", 30000, { actuel: true }), scenario("micro", "Micro-entreprise", 32000, { horsPlafond: true, regimeMicroFerme: sortie }), scenario("micro-vfl", "Micro + versement libératoire", 31000, { horsPlafond: true })],
      meilleur: "EI",
      couples: [],
      warnings: []
    }
    render(<CartesDesStatuts result={result} />)

    const cartes = within(screen.getByRole("list", { name: "Net dans la poche selon le statut" })).getAllByRole("listitem")
    expect(cartes[0]).toHaveTextContent(/^Micro-entrepriseplus accessible ·/)
    expect(cartes[1]).toHaveTextContent(/^Micro \+ versement libératoirehors plafond ·/)
    expect(cartes[2]).toHaveTextContent(/^EI au réelactuel · meilleur net ·/)
  })
})
