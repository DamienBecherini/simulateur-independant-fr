// src/ui/components/MonthlyGrid.test.tsx

import { useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { AnneeSimulee, Entity, MonthlyGridData } from "@/types"
import { euros } from "@/backend/logic/format"
import { makeMicro, makePerson } from "@/ui/testing/fixtures"
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

    await user.selectOptions(within(fenetre).getByLabelText("Ajouter à :"), "annee")
    await user.type(within(fenetre).getByLabelText("Libellé du nouveau flux"), "Loyer")
    await user.type(within(fenetre).getByLabelText("Montant du nouveau flux"), "800{Enter}")

    expect(montantsParMois(etat.grille)).toEqual(Array.from({ length: 12 }, () => [800]))
    expect(new Set(etat.grille.map(mois => mois.flows[0].id)).size).toBe(12)
    expect(etat.grille[0].flows[0]).toMatchObject({ label: "Loyer", entityId: "person-alice" })
  })

  it("répartit un montant annuel sur les douze mois, au centime, le reste en décembre", async () => {
    const { user, etat } = afficherLaGrille()
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getByRole("checkbox", { name: "Montant annuel, réparti sur les 12 mois" }))
    await user.type(within(fenetre).getByLabelText("Libellé du nouveau flux"), "Prime")
    await user.type(within(fenetre).getByLabelText("Montant du nouveau flux"), "55000{Enter}")

    expect(montantsParMois(etat.grille)).toEqual([...Array.from({ length: 11 }, () => [4583.33]), [4583.37]])
    expect(etat.grille.every(mois => mois.flows[0].label === "Prime")).toBe(true)
    expect(toast.success).toHaveBeenCalledWith(`Montant annuel de ${euros(55000)} réparti sur les 12 mois.`)
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

  /** La barre qui, après une modification ou un retrait, propose de faire de même dans les autres mois. */
  const barre = () => screen.getByRole("group", { name: /aussi d'autres mois$/ })

  it("modifie le montant de juillet, puis, d'un clic sur la barre, des mois suivants seulement", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    const montant = within(fenetre).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "850{Enter}")
    // D'abord juillet seul ; la barre propose les autres mois.
    expect(montantsParMois(etat.grille)).toEqual([...Array.from({ length: 6 }, () => [800]), [850], ...Array.from({ length: 5 }, () => [800])])
    expect(barre()).toHaveTextContent(/^850.€ en juillet./)
    expect(within(barre()).getAllByRole("button").map(b => b.textContent)).toEqual(["juillet à décembre", "toute l'année", "non, juillet seulement"])

    await user.click(within(barre()).getByRole("button", { name: "juillet à décembre" }))
    expect(montantsParMois(etat.grille)).toEqual([...Array.from({ length: 6 }, () => [800]), ...Array.from({ length: 6 }, () => [850])])
    expect(toast.success).toHaveBeenCalledWith("Modifié aussi sur 5 autres mois.")
    expect(screen.queryByRole("group", { name: /aussi d'autres mois$/ })).not.toBeInTheDocument()
  })

  it("étend aux autres mois un libellé changé puis un montant changé, repérés d'après le flux d'avant", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    const libelle = within(fenetre).getByLabelText("Libellé")
    await user.clear(libelle)
    await user.type(libelle, "Loyer du bureau{Enter}")
    const montant = within(fenetre).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "900{Enter}")
    await user.click(within(barre()).getByRole("button", { name: "toute l'année" }))

    expect(etat.grille.every(mois => mois.flows[0].label === "Loyer du bureau" && mois.flows[0].amount === 900)).toBe(true)
  })

  it("« non, juillet seulement » garde la modification au seul mois ouvert", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const montant = within(screen.getByRole("dialog")).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "850{Enter}")
    await user.click(within(barre()).getByRole("button", { name: "non, juillet seulement" }))

    expect(screen.queryByRole("group", { name: /aussi d'autres mois$/ })).not.toBeInTheDocument()
    expect(montantsParMois(etat.grille).flat()).toEqual([800, 800, 800, 800, 800, 800, 850, 800, 800, 800, 800, 800])
  })

  it("pas de barre pour un flux qui n'existe dans aucun autre mois", async () => {
    const depart = grilleVide()
    depart[2] = { month: 2, flows: [{ id: "cadeau", entityId: "person-alice", type: "expense", label: "Cadeau", amount: 100 }] }
    const { user } = afficherLaGrille(depart)
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const montant = within(screen.getByRole("dialog")).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "150{Enter}")

    expect(screen.queryByRole("group", { name: /aussi d'autres mois$/ })).not.toBeInTheDocument()
  })

  it("retire une charge de mars, puis de toute l'année d'un clic sur la barre", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le flux" }))
    expect(etat.grille.map(mois => mois.flows.length)).toEqual([1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(barre()).toHaveTextContent("Retiré de mars.")
    expect(within(barre()).getAllByRole("button").map(b => b.textContent)).toEqual(["mars à décembre", "toute l'année", "Annuler"])

    await user.click(within(barre()).getByRole("button", { name: "toute l'année" }))
    expect(etat.grille.every(mois => mois.flows.length === 0)).toBe(true)
    expect(toast.success).toHaveBeenCalledWith("Retiré aussi sur 11 autres mois.")
  })

  it("« Annuler » remet le flux retiré à sa place dans le mois", async () => {
    const depart = loyerToutelAnnee()
    depart[2] = { month: 2, flows: [{ id: "eau", entityId: "person-alice", type: "expense", label: "Eau", amount: 30 }, ...depart[2].flows, { id: "gaz", entityId: "person-alice", type: "expense", label: "Gaz", amount: 40 }] }
    const { user, etat } = afficherLaGrille(depart)
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getAllByRole("button", { name: "Supprimer le flux" })[1])
    expect(etat.grille[2].flows.map(f => f.label)).toEqual(["Eau", "Gaz"])
    await user.click(within(barre()).getByRole("button", { name: "Annuler" }))
    expect(etat.grille[2].flows.map(f => f.label)).toEqual(["Eau", "Loyer", "Gaz"])
    expect(etat.grille.map(mois => mois.flows.length)).toEqual([1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  })

  it("un montant ramené à 0 retire le flux, avec la même barre", async () => {
    const { user, etat } = afficherLaGrille(loyerToutelAnnee())
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const montant = within(screen.getByRole("dialog")).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "0{Enter}")

    expect(barre()).toHaveTextContent("Retiré de juillet.")
    await user.click(within(barre()).getByRole("button", { name: "juillet à décembre" }))
    expect(etat.grille.map(mois => mois.flows.length)).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0])
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
  function afficherLesAnnees(depart: AnneeSimulee[], annee = 2026, entites: Entity[] = [makePerson()]) {
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
            entities={entites}
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
    expect(screen.queryByText(/sont recopiés/)).not.toBeInTheDocument()

    await user.click(within(annees).getByRole("checkbox", { name: "2027" }))
    expect(screen.getByText("Les ajouts sont recopiés au même mois en 2027.")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Ajouter à :"), "suivants")
    expect(screen.getByText("Les ajouts sont recopiés sur les autres mois choisis, et aux mêmes mois en 2027.")).toBeInTheDocument()
  })

  it("ne propose pas de raccourcis avec quatre autres années ou moins", async () => {
    const { user } = afficherLesAnnees([2024, 2025, 2026, 2027, 2028].map(annee => ({ annee, monthlyData: grilleVide() })))
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const annees = within(screen.getByRole("dialog")).getByRole("group", { name: "Aussi en :" })

    expect(within(annees).getAllByRole("checkbox")).toHaveLength(4)
    expect(within(annees).queryByRole("button")).not.toBeInTheDocument()
  })

  it("au-delà de quatre autres années, coche toutes les années, aucune, les précédentes ou les suivantes d'un clic", async () => {
    const dixAnnees = Array.from({ length: 10 }, (_, i) => ({ annee: 2024 + i, monthlyData: grilleVide() }))
    const { user } = afficherLesAnnees(dixAnnees, 2027)
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const annees = within(screen.getByRole("dialog")).getByRole("group", { name: "Aussi en :" })
    const cochees = () =>
      within(annees)
        .getAllByRole("checkbox")
        .filter(c => (c as HTMLInputElement).checked)
        .map(c => Number(c.closest("label")?.textContent))

    expect(within(annees).getAllByRole("button").map(b => [b.textContent, b.getAttribute("aria-label")])).toEqual([
      ["Toutes", "Cocher toutes les années"],
      ["Aucune", "Ne cocher aucune année"],
      ["Années précédentes", "Cocher les années précédentes"],
      ["Années suivantes", "Cocher les années suivantes"]
    ])

    await user.click(within(annees).getByRole("button", { name: "Cocher toutes les années" }))
    expect(cochees()).toEqual([2024, 2025, 2026, 2028, 2029, 2030, 2031, 2032, 2033])
    expect(screen.getByText(/sont recopiés au même mois en 2024, 2025, 2026, 2028/)).toBeInTheDocument()

    await user.click(within(annees).getByRole("button", { name: "Cocher les années précédentes" }))
    expect(cochees()).toEqual([2024, 2025, 2026])

    await user.click(within(annees).getByRole("button", { name: "Cocher les années suivantes" }))
    expect(cochees()).toEqual([2028, 2029, 2030, 2031, 2032, 2033])

    // Une case se décoche toujours une à une.
    await user.click(within(annees).getByRole("checkbox", { name: "2030" }))
    expect(cochees()).toEqual([2028, 2029, 2031, 2032, 2033])

    await user.click(within(annees).getByRole("button", { name: "Ne cocher aucune année" }))
    expect(cochees()).toEqual([])
    expect(screen.queryByText(/sont recopiés/)).not.toBeInTheDocument()
  })

  it("désactive « Années précédentes » depuis la plus ancienne année", async () => {
    const sixAnnees = Array.from({ length: 6 }, (_, i) => ({ annee: 2026 + i, monthlyData: grilleVide() }))
    const { user } = afficherLesAnnees(sixAnnees, 2026)
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))

    expect(screen.getByRole("button", { name: "Cocher les années précédentes" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cocher les années suivantes" })).toBeEnabled()
  })

  it("ajoute une charge à tous les mois de 2026 et de 2025 en une étape, annulable d'un coup", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees())
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.selectOptions(within(fenetre).getByLabelText("Ajouter à :"), "annee")
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

  it("dans une année encore vide, propose d'office la nature de la micro-entreprise dans l'année la plus proche", async () => {
    const atelier = makeMicro({ id: "atelier", name: "Atelier" })
    const avec = (type: "ca_micro_services_bic" | "ca_micro_vente") => grilleVide().map((m, index) => (index === 0 ? { ...m, flows: [{ id: type, entityId: "atelier", type, label: "Ventes", amount: 1000 }] } : m))
    const annees: AnneeSimulee[] = [
      { annee: 2024, monthlyData: avec("ca_micro_services_bic") },
      { annee: 2026, monthlyData: grilleVide() },
      { annee: 2027, monthlyData: avec("ca_micro_vente") }
    ]
    const { user } = afficherLesAnnees(annees, 2026, [atelier])
    await user.click(screen.getByRole("button", { name: "Flux de mars : Atelier" }))

    const types = within(screen.getByRole("dialog")).getAllByRole("combobox", { name: "Type de flux" })
    expect(types[types.length - 1]).toHaveTextContent("Vente de marchandises (BIC)")
  })

  /** La barre qui, après une modification ou un retrait, propose de faire de même dans les autres mois et années. */
  const barre = () => screen.getByRole("group", { name: /aussi d'autres mois$/ })

  it("modifie le montant de juillet, puis à partir de juillet dans l'année affichée et les mêmes mois de 2027", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees(loyerChaqueMois))
    await user.click(screen.getByRole("button", { name: "Flux de juillet : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    const montant = within(fenetre).getByLabelText("Montant")
    await user.clear(montant)
    await user.type(montant, "850{Enter}")
    // Les années où le loyer existe sont proposées dans la barre.
    expect(within(barre()).getAllByRole("checkbox").map(c => c.closest("label")?.textContent)).toEqual(["2025", "2027"])
    await user.click(within(barre()).getByRole("checkbox", { name: "2027" }))
    await user.click(within(barre()).getByRole("button", { name: "juillet à décembre" }))

    const depuisJuillet = [...Array.from({ length: 6 }, () => [800]), ...Array.from({ length: 6 }, () => [850])]
    expect(montantsDe(etat, 2026)).toEqual(depuisJuillet)
    expect(montantsDe(etat, 2027)).toEqual(depuisJuillet)
    expect(montantsDe(etat, 2025)).toEqual(Array.from({ length: 12 }, () => [800]))
    // Juillet, puis l'extension : deux étapes d'annulation.
    expect(etat.etapes).toBe(2)
    expect(toast.success).toHaveBeenCalledWith("Modifié aussi sur 5 mois en 2026 et 6 mois en 2027.")
  })

  it("retire une charge du seul même mois dans les autres années cochées", async () => {
    const { user, etat } = afficherLesAnnees(troisAnnees(loyerChaqueMois))
    await user.click(screen.getByRole("button", { name: "Flux de mars : Alice Martin" }))
    const fenetre = screen.getByRole("dialog")

    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le flux" }))
    expect(within(barre()).queryByRole("button", { name: /^mars 20/ })).not.toBeInTheDocument()
    await user.click(within(barre()).getByRole("checkbox", { name: "2025" }))
    await user.click(within(barre()).getByRole("checkbox", { name: "2027" }))
    await user.click(within(barre()).getByRole("button", { name: "mars 2025 et 2027" }))

    for (const annee of [2025, 2026, 2027]) expect(montantsDe(etat, annee).map(m => m.length)).toEqual([1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(etat.etapes).toBe(2)
    expect(toast.success).toHaveBeenCalledWith("Retiré aussi sur 1 mois en 2025 et 1 mois en 2027.")
  })
})

describe("MonthlyGrid, sur un écran tactile", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Grille d'Alice avec une dépense en mars, sur un écran au pointeur grossier ; l'enregistrement de la « grille touchée » exposé. */
  function afficherSurEcranTactile(grilleTouchee?: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query === "(pointer: coarse)", media: query }) as MediaQueryList)
    const depart = grilleVide()
    depart[2] = { month: 2, flows: [{ id: "loyer", entityId: "person-alice", type: "expense", label: "Loyer", amount: 800 }] }
    const onGrilleTouchee = vi.fn()
    render(<MonthlyGrid entities={[makePerson()]} monthlyData={depart} setMonthlyData={() => {}} preferences={{ slotOrder: [], grilleTouchee }} flowTypeToNumberMap={new Map()} onGrilleTouchee={onGrilleTouchee} />)
    return { user: userEvent.setup(), onGrilleTouchee }
  }
  const caseDe = (mois: string) => screen.getByRole("button", { name: `Flux ${mois} : Alice Martin` })

  it("invite à toucher une case vide, sans que rien ne la cache au doigt, et laisse son montant à une case remplie", () => {
    afficherSurEcranTactile()
    const invitation = within(caseDe("de janvier")).getByText("+ Ajouter")
    // Cachée jusqu'au survol pour une souris seulement (et remplacée à l'impression) : au doigt, rien ne la masque.
    const masquages = invitation.className.split(" ").filter(classe => classe.includes("opacity-0") || classe.endsWith("hidden"))
    expect(masquages.length).toBeGreaterThan(0)
    expect(masquages.every(classe => classe.startsWith("pointer-fine:") || classe.startsWith("print:"))).toBe(true)
    expect(within(caseDe("de mars")).queryByText("+ Ajouter")).toBeNull()
    expect(caseDe("de mars")).toHaveTextContent("800")
    // Le nom accessible des cases ne change pas.
    expect(caseDe("de janvier")).toHaveAccessibleName("Flux de janvier : Alice Martin")
  })

  it("dit qu'une case se touche, sur écran tactile seulement, jusqu'à la première case touchée", async () => {
    const { user, onGrilleTouchee } = afficherSurEcranTactile()
    expect(screen.getByText("Touchez une case pour saisir un montant.")).toHaveClass("hidden", "pointer-coarse:block")
    await user.click(caseDe("de janvier"))
    expect(onGrilleTouchee).toHaveBeenCalledTimes(1)
  })

  it("ne redit plus rien une fois une case touchée", () => {
    afficherSurEcranTactile(true)
    expect(screen.queryByText("Touchez une case pour saisir un montant.")).toBeNull()
  })
})

describe("MonthlyGrid, activité créée en cours d'année", () => {
  /** La micro-entreprise « Mon atelier », créée en mars 2026, avec 2 000 € de chiffre d'affaires saisis en janvier et en février. */
  function afficherLAtelier(annee: number | undefined) {
    const grille = grilleVide()
    for (const mois of [0, 1]) grille[mois].flows.push({ id: `ca-${mois}`, label: "Ventes", amount: 2000, entityId: "micro-atelier", type: "ca_micro_services_bnc" })
    render(<MonthlyGrid entities={[makeMicro({ dateDeCreation: "2026-03" })]} monthlyData={grille} setMonthlyData={() => {}} preferences={{ slotOrder: [] }} flowTypeToNumberMap={new Map()} annee={annee} />)
  }

  it("marque les mois avant la création et le mois de création, et signale les montants saisis avant", () => {
    afficherLAtelier(2026)
    expect(screen.getByText("créée en mars 2026")).toBeInTheDocument()
    const janvier = screen.getByRole("button", { name: "Flux de janvier : Mon atelier (avant la création)" })
    expect(janvier).toHaveAttribute("data-avant-la-creation")
    expect(janvier.className).toContain("outline-dashed")
    expect(screen.getByRole("button", { name: "Flux de mars : Mon atelier (mois de création)" })).toHaveAttribute("data-mois-de-creation")
    expect(screen.getByRole("button", { name: /^Flux d.avril : Mon atelier$/ })).not.toHaveAttribute("data-avant-la-creation")
    expect(screen.getByRole("status")).toHaveTextContent("« Mon atelier » est créée en mars 2026 : 4 000 € de chiffre d'affaires saisis avant la création (janvier, février 2026), comptés quand même.")
  })

  it("ne marque rien l'année suivante", () => {
    afficherLAtelier(2027)
    expect(screen.queryByText(/créée en/)).toBeNull()
    expect(screen.getByRole("button", { name: "Flux de janvier : Mon atelier" })).not.toHaveAttribute("data-avant-la-creation")
    expect(screen.queryByRole("status")).toBeNull()
  })
})
