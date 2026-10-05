// src/ui/components/MonthlyGrid.test.tsx

import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { AnneeSimulee, MonthlyGridData } from "@/types"
import { makePerson } from "@/ui/testing/fixtures"
import MonthlyGrid from "./MonthlyGrid"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn() } }))

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

  it("ne propose pas d'autre année quand la session n'en a qu'une", async () => {
    const { user } = afficherLaGrille()
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    expect(within(screen.getByRole("dialog")).queryByRole("group", { name: "Aussi en :" })).not.toBeInTheDocument()
  })
})

describe("MonthlyGrid, sur plusieurs années", () => {
  beforeEach(() => vi.mocked(toast.success).mockClear())

  /**
   * Grille de 2026 d'une session de plusieurs années, comme dans App : les opérations sur plusieurs années
   * remplacent toutes les années d'un coup. Chaque modification ajoute une étape à un historique minimal, que
   * le bouton « Annuler » remonte d'un cran.
   */
  function afficherLesAnnees(depart: AnneeSimulee[], annee = 2026) {
    const etat = { annees: depart, etapes: 0 }
    function Harness() {
      const [historique, setHistorique] = useState([depart])
      const annees = historique[historique.length - 1]
      etat.annees = annees
      etat.etapes = historique.length - 1
      const enregistrer = (suivantes: AnneeSimulee[]) => setHistorique(h => [...h, suivantes])
      const grille = annees.find(a => a.annee === annee)?.monthlyData ?? grilleVide()
      return (
        <>
          <MonthlyGrid
            entities={[makePerson()]}
            monthlyData={grille}
            setMonthlyData={maj => enregistrer(annees.map(a => (a.annee === annee ? { ...a, monthlyData: typeof maj === "function" ? maj(a.monthlyData) : maj } : a)))}
            preferences={{ slotOrder: [] }}
            flowTypeToNumberMap={new Map()}
            annee={annee}
            annees={annees}
            setAnnees={enregistrer}
          />
          <button type="button" onClick={() => setHistorique(h => (h.length > 1 ? h.slice(0, -1) : h))}>
            Annuler
          </button>
        </>
      )
    }
    render(<Harness />)
    return { user: userEvent.setup(), etat }
  }

  const troisAnnees = (grille: () => MonthlyGridData = grilleVide): AnneeSimulee[] => [2025, 2026, 2027].map(annee => ({ annee, monthlyData: grille() }))
  /** Loyer de 800 € chaque mois, dans chaque année. */
  const loyerChaqueMois = (): MonthlyGridData => Array.from({ length: 12 }, (_, month) => ({ month, flows: [{ id: `loyer-${month}-${Math.random()}`, entityId: "person-alice", type: "expense" as const, label: "Loyer", amount: 800 }] }))
  const montantsDe = (etat: { annees: AnneeSimulee[] }, annee: number) => montantsParMois(etat.annees.find(a => a.annee === annee)?.monthlyData ?? [])

  it("propose les autres années, décochées, et avertit de celles qui sont cochées", async () => {
    const { user } = afficherLesAnnees(troisAnnees())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const annees = within(screen.getByRole("dialog")).getByRole("group", { name: "Aussi en :" })

    expect(within(annees).getAllByRole("checkbox").map(c => c.closest("label")?.textContent)).toEqual(["2025", "2027"])
    expect(within(annees).getByRole("checkbox", { name: "2025" })).not.toBeChecked()
    expect(screen.queryByText(/s'appliquent aussi/)).not.toBeInTheDocument()

    await user.click(within(annees).getByRole("checkbox", { name: "2027" }))
    expect(screen.getByText("Les ajouts, modifications et suppressions s'appliquent aussi au même mois en 2027.")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Appliquer à :"), "suivants")
    expect(screen.getByText("Les ajouts, modifications et suppressions s'appliquent aussi aux autres mois choisis, et aux mêmes mois en 2027.")).toBeInTheDocument()
  })

  it("ajoute une charge à tous les mois de 2026 et de 2025 en une étape, annulable d'un coup", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Appliquer à :"), "annee")
    await user.click(within(fenetre).getByRole("checkbox", { name: "2025" }))
    await user.type(within(fenetre).getByLabelText("Libellé du nouveau flux"), "Loyer")
    await user.type(within(fenetre).getByLabelText("Montant du nouveau flux"), "800{Enter}")

    const chaqueMois = Array.from({ length: 12 }, () => [800])
    expect(montantsDe(etat, 2025)).toEqual(chaqueMois)
    expect(montantsDe(etat, 2026)).toEqual(chaqueMois)
    expect(montantsDe(etat, 2027)).toEqual(Array.from({ length: 12 }, () => []))
    expect(etat.etapes).toBe(1)
    expect(toast.success).toHaveBeenCalledWith("Flux ajouté à ce mois et recopié sur 12 mois en 2025 et 11 mois en 2026.")

    await user.click(screen.getByRole("button", { name: "Terminé" }))
    await user.click(screen.getByRole("button", { name: "Annuler" }))
    expect(etat.etapes).toBe(0)
    expect(montantsDe(etat, 2025)).toEqual(Array.from({ length: 12 }, () => []))
  })

  it("modifie le montant à partir de juillet dans l'année affichée et les mêmes mois de 2027", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees(loyerChaqueMois))
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Appliquer à :"), "suivants")
    await user.click(within(fenetre).getByRole("checkbox", { name: "2027" }))
    const montant = within(fenetre).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "850{Enter}")

    const depuisJuillet = [...Array.from({ length: 6 }, () => [800]), ...Array.from({ length: 6 }, () => [850])]
    expect(montantsDe(etat, 2026)).toEqual(depuisJuillet)
    expect(montantsDe(etat, 2027)).toEqual(depuisJuillet)
    expect(montantsDe(etat, 2025)).toEqual(Array.from({ length: 12 }, () => [800]))
    expect(etat.etapes).toBe(1)
    expect(toast.success).toHaveBeenCalledWith("Modifié aussi sur 5 mois en 2026 et 6 mois en 2027.")
  })

  it("supprime une charge du même mois dans les autres années, et décoche les années à la réouverture", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees(loyerChaqueMois))
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getByRole("checkbox", { name: "2025" }))
    await user.click(within(fenetre).getByRole("checkbox", { name: "2027" }))
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le flux" }))

    for (const annee of [2025, 2026, 2027]) expect(montantsDe(etat, annee).map(m => m.length)).toEqual([1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(etat.etapes).toBe(1)
    expect(toast.success).toHaveBeenCalledWith("Supprimé aussi sur 1 mois en 2025 et 1 mois en 2027.")

    await user.click(screen.getByRole("button", { name: "Terminé" }))
    await user.click(screen.getByRole("button", { name: "Flux d’avril : Alice Martin" }))
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "2025" })).not.toBeChecked()
  })
})
