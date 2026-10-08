// src/ui/components/SurToutesLesAnnees.test.tsx

import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { grilleVide, type ResultatDUneStrategie, type SessionState, type StrategiesDeDistribution } from "@/types"
import { emptySession } from "@/ui/testing/fixtures"
import { SurToutesLesAnnees } from "./SurToutesLesAnnees"

const money = (n: number) => `${n.toLocaleString("fr-FR")} €`.replace(/\s/g, " ")

const deuxAnnees = (): SessionState => ({ ...emptySession(), annees: [2025, 2026].map(annee => ({ annee, monthlyData: grilleVide() })) })

const strategie = (strategie: ResultatDUneStrategie["strategie"], libelle: string, netCumule: number, dividendes: [number, number], warnings: string[] = []): ResultatDUneStrategie => ({
  strategie,
  libelle,
  netCumule,
  prelevementsCumules: 20000,
  reservesALaFin: 0,
  annees: [
    { annee: 2025, dividendes: dividendes[0], netApresImpots: 0, totalPrelevements: 0, reservesALaFin: 0 },
    { annee: 2026, dividendes: dividendes[1], netApresImpots: 0, totalPrelevements: 0, reservesALaFin: 0 }
  ],
  warnings
})

const resultat: StrategiesDeDistribution = {
  annees: [2025, 2026],
  partMiseEnReserve: 0.5,
  statuts: [
    { statut: "SASU", meilleure: "garderPuisDistribuer", strategies: [strategie("toutDistribuer", "Tout distribuer chaque année", 39343, [49250, 0]), strategie("garderPuisDistribuer", "Garder 50 % et distribuer la dernière année", 40435, [24625, 24625]), strategie("lisser", "Lisser les dividendes", 40435, [24625, 24625])] },
    { statut: "EURL", meilleure: null, strategies: [strategie("toutDistribuer", "Tout distribuer chaque année", 30000, [0, 0], ["2026 : Dividendes saisis supérieurs."]), strategie("garderPuisDistribuer", "Garder 50 % et distribuer la dernière année", 30000, [0, 0]), strategie("lisser", "Lisser les dividendes", 30000, [0, 0])] }
  ],
  notes: ["À partir de 2027, les années reprennent les règles de 2026."]
}

function afficher(session: SessionState, onPart = vi.fn()) {
  render(<SurToutesLesAnnees session={session} activityId="s1" activityName="Ma SASU" partMiseEnReserve={0.5} onPartMiseEnReserve={onPart} />)
  return onPart
}

describe("SurToutesLesAnnees", () => {
  it("n'apparaît pas pour une session d'une année, et ne calcule rien", async () => {
    const { container } = render(<SurToutesLesAnnees session={emptySession()} activityId="s1" activityName="Ma SASU" partMiseEnReserve={0.5} onPartMiseEnReserve={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
    await new Promise(resolve => setTimeout(resolve, 350))
    expect(window.api.comparerStrategies).not.toHaveBeenCalled()
  })

  it("compare les stratégies sur toutes les années et désigne la meilleure, en toutes lettres", async () => {
    vi.mocked(window.api.comparerStrategies).mockResolvedValue(resultat)
    const session = deuxAnnees()
    afficher(session)

    const sasu = await screen.findByRole("table", { name: /en SASU/ })
    expect(window.api.comparerStrategies).toHaveBeenCalledWith(session, "s1")
    expect(screen.getByRole("heading", { name: "Sur toutes les années" })).toBeInTheDocument()
    expect(screen.getByText(/comparées sur le net de tous les foyers cumulé de 2025 à 2026/)).toBeInTheDocument()
    expect(screen.getByText(/^En SASU, la meilleure/)).toHaveTextContent(`En SASU, la meilleure : « Garder 50 % et distribuer la dernière année », ${money(1092)} de plus que de tout distribuer chaque année.`)
    const meilleure = within(sasu).getByRole("row", { name: /Garder 50 %/ })
    expect(meilleure).toHaveTextContent("Meilleur net")
    expect(meilleure).toHaveTextContent(`Dividendes 2025 : ${money(24625)} ; 2026 : ${money(24625)}`)
    expect(meilleure).toHaveTextContent(`${money(40435)}${money(20000)}${money(0)}`)
    expect(within(sasu).getByRole("row", { name: /Lisser/ })).not.toHaveTextContent("Meilleur net")

    expect(screen.getByText("En EURL, les stratégies se valent à l'euro près.")).toBeInTheDocument()
    expect(screen.getByText("2026 : Dividendes saisis supérieurs.")).toBeInTheDocument()
    expect(screen.getByText("À partir de 2027, les années reprennent les règles de 2026.")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Stratégies de distribution en EURL" })).toHaveAttribute("tabindex", "0")
  })

  it("règle la part gardée chaque année, en pourcentage", async () => {
    const onPart = afficher(deuxAnnees())

    const champ = screen.getByLabelText("Part gardée chaque année (%)")
    expect(champ).toHaveValue(50)
    fireEvent.change(champ, { target: { value: "30" } })
    expect(onPart).toHaveBeenLastCalledWith(0.3)
    fireEvent.change(champ, { target: { value: "250" } })
    expect(onPart).toHaveBeenLastCalledWith(1)
  })

  it("dit quand le calcul échoue", async () => {
    vi.mocked(window.api.comparerStrategies).mockRejectedValue(new Error("Session invalide."))
    afficher(deuxAnnees())

    expect(await screen.findByText("Session invalide.")).toBeInTheDocument()
  })
})
