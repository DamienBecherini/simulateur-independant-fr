// src/ui/components/MonthlyGrid.test.tsx

import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { MonthlyGridData } from "@/types"
import { makePerson } from "@/ui/testing/fixtures"
import MonthlyGrid from "./MonthlyGrid"

const grilleVide = (): MonthlyGridData => Array.from({ length: 12 }, (_, month) => ({ month, flows: [] }))

/** Grille d'Alice, avec l'état des flux exposé pour vérifier ce qui a été enregistré mois par mois. */
function afficherLaGrille(depart: MonthlyGridData = grilleVide()) {
  const etat = { grille: depart }
  function Harness() {
    const [grille, setGrille] = useState(depart)
    etat.grille = grille
    return <MonthlyGrid entities={[makePerson()]} monthlyData={grille} setMonthlyData={setGrille} preferences={{ slotOrder: [] }} flowTypeToNumberMap={new Map()} />
  }
  render(<Harness />)
  return { user: userEvent.setup(), etat }
}

const montantsParMois = (grille: MonthlyGridData) => grille.map(mois => mois.flows.map(f => f.amount))

describe("MonthlyGrid, flux qui reviennent chaque mois", () => {
  it("ajoute un flux à tous les mois de l'année en une saisie", async () => {
    const { user, etat } = afficherLaGrille()
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Appliquer à :"), "annee")
    await user.type(within(fenetre).getByLabelText("Libellé du nouveau flux"), "Loyer")
    await user.type(within(fenetre).getByLabelText("Montant du nouveau flux"), "800{Enter}")

    expect(montantsParMois(etat.grille)).toEqual(Array.from({ length: 12 }, () => [800]))
    expect(new Set(etat.grille.map(mois => mois.flows[0].id)).size).toBe(12)
    expect(etat.grille[0].flows[0]).toMatchObject({ label: "Loyer", entityId: "person-alice" })
  })

  it("par défaut, n'ajoute le flux qu'au mois ouvert", async () => {
    const { user, etat } = afficherLaGrille()
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Montant du nouveau flux"), "50{Enter}")

    expect(montantsParMois(etat.grille).map(montants => montants.length)).toEqual([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it("recopie un flux existant sur les mois suivants, sans doublon à la seconde recopie", async () => {
    const depart = grilleVide()
    depart[9] = { month: 9, flows: [{ id: "abonnement", entityId: "person-alice", type: "expense", label: "Abonnement", amount: 30 }] }
    depart[11] = { month: 11, flows: [{ id: "deja", entityId: "person-alice", type: "expense", label: "Abonnement", amount: 30 }] }
    const { user, etat } = afficherLaGrille(depart)

    await user.click(screen.getByRole("button", { name: "Flux d’octobre : Alice Martin" }))
    const recopier = within(screen.getByRole("dialog")).getByRole("button", { name: "Recopier ce flux jusqu'en décembre" })
    await user.click(recopier)
    expect(montantsParMois(etat.grille).slice(9)).toEqual([[30], [30], [30]])

    await user.click(recopier)
    expect(montantsParMois(etat.grille).slice(9)).toEqual([[30], [30], [30]])
  })

  it("ne propose pas de recopie en décembre, faute de mois suivant", async () => {
    const depart = grilleVide()
    depart[11] = { month: 11, flows: [{ id: "f", entityId: "person-alice", type: "expense", label: "Cadeau", amount: 100 }] }
    const { user } = afficherLaGrille(depart)

    await user.click(screen.getByRole("button", { name: "Flux de décembre : Alice Martin" }))
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /Recopier/ })).not.toBeInTheDocument()
  })

  /** Loyer de 800 € à chaque mois d'Alice. */
  const loyerToutelAnnee = (): MonthlyGridData => Array.from({ length: 12 }, (_, month) => ({ month, flows: [{ id: `loyer-${month}`, entityId: "person-alice", type: "expense" as const, label: "Loyer", amount: 800 }] }))

  it("modifie le montant à partir de juillet, sur les mois suivants seulement", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Appliquer à :"), "suivants")
    const montant = within(fenetre).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "850{Enter}")

    expect(montantsParMois(etat.grille)).toEqual([...Array.from({ length: 6 }, () => [800]), ...Array.from({ length: 6 }, () => [850])])
  })

  it("supprime une charge de toute l'année en une fois", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Appliquer à :"), "annee")
    expect(within(fenetre).getByText(/s'appliquent aussi aux autres mois choisis/)).toBeInTheDocument()
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le flux" }))

    expect(etat.grille.every(mois => mois.flows.length === 0)).toBe(true)
  })
})
