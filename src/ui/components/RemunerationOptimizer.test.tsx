// src/ui/components/RemunerationOptimizer.test.tsx

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ComparaisonOptions, OptimisationRemuneration, PointRemuneration } from "@/types"
import { emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { ComparatorPanel } from "./ComparatorPanel"
import { RemunerationOptimizer } from "./RemunerationOptimizer"

// toHaveTextContent ramène les espaces insécables à des espaces simples : on fait de même.
const money = (n: number) => `${n.toLocaleString("fr-FR")} €`.replace(/\s/g, " ")

function point(remunerationNette: number, netApresImpots: number, trimestres: number): PointRemuneration {
  return { remunerationNette, dividendes: 30000 - remunerationNette, netApresImpots, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres }
}

function optimisation(overrides: Partial<OptimisationRemuneration> = {}): OptimisationRemuneration {
  const points = [point(0, 50000, 0), point(5000, 49500, 3), point(5700, 49400, 4), point(10000, 48000, 4)]
  return { statut: "SASU", remunerationMaximale: 10000, points, meilleur: points[0], meilleurAvecRetraite: points[2], warnings: [], ...overrides }
}

const options: ComparaisonOptions = { activityId: "micro-atelier", remunerationNette: 0, distribuerToutLeBenefice: true, partBncPrestations: 1 }
const session = { ...emptySession(), entities: [makePerson(), makeMicro()] }

function afficher(onAppliquer = vi.fn()) {
  render(<RemunerationOptimizer session={session} options={options} activityName="Mon atelier" statutInitial="SASU" onAppliquer={onAppliquer} />)
  return onAppliquer
}

describe("RemunerationOptimizer", () => {
  it("présente le meilleur net, et le meilleur net qui valide 4 trimestres avec ce qu'il coûte", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    afficher()

    const meilleur = await screen.findByText(/^Meilleur net :/)
    expect(meilleur.closest("li")).toHaveTextContent(`${money(50000)} dans la poche du foyer, avec ${money(0)} de rémunération nette`)
    const retraite = screen.getByText(/^Meilleur net avec 4 trimestres/).closest("li")!
    expect(retraite).toHaveTextContent(`${money(5700)} de rémunération nette`)
    expect(retraite).toHaveTextContent(`Soit ${money(600)} de moins par an`)
  })

  it("reporte une rémunération dans le comparateur, sauf celle qui y est déjà", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    const onAppliquer = afficher()

    const retraite = (await screen.findByText(/^Meilleur net avec 4 trimestres/)).closest("li")!
    await userEvent.click(within(retraite).getByRole("button", { name: "Appliquer au comparateur" }))
    expect(onAppliquer).toHaveBeenCalledWith(5700)
    expect(within(screen.getByText(/^Meilleur net :/).closest("li")!).getByRole("button", { name: "Appliquée" })).toBeDisabled()
  })

  it("ne présente qu'une ligne quand le meilleur net valide déjà 4 trimestres", async () => {
    const points = [point(0, 40000, 4), point(10000, 45000, 4)]
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation({ statut: "SASU", points, meilleur: points[1], meilleurAvecRetraite: points[1] }))
    afficher()

    expect(await screen.findByText(/^Meilleur net, 4 trimestres validés/)).toBeInTheDocument()
    expect(screen.queryByText(/^Meilleur net avec 4 trimestres/)).not.toBeInTheDocument()
  })

  it("dit quand aucune rémunération ne valide 4 trimestres", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation({ meilleurAvecRetraite: null }))
    afficher()
    expect(await screen.findByText("Aucune rémunération possible en SASU ne valide 4 trimestres de retraite.")).toBeInTheDocument()
  })

  it("recalcule en EURL quand on change de statut", async () => {
    afficher()
    await userEvent.click(screen.getByRole("button", { name: "EURL" }))

    expect(screen.getByRole("button", { name: "EURL" })).toHaveAttribute("aria-pressed", "true")
    await vi.waitFor(() => expect(window.api.optimiserRemuneration).toHaveBeenLastCalledWith(session, expect.objectContaining({ activityId: "micro-atelier" }), "EURL"))
  })

  it("affiche l'avertissement quand il n'y a rien à optimiser", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation({ points: [], meilleur: null, meilleurAvecRetraite: null, warnings: ["Aucun bénéfice à partager."] }))
    afficher()
    expect(await screen.findByText("Aucun bénéfice à partager.")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: /Net du foyer/ })).not.toBeInTheDocument()
  })

  it("se parcourt au clavier : chaque point affiche le net, la rémunération, les dividendes et les trimestres", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    afficher()

    const courbe = await screen.findByRole("group", { name: /Net du foyer selon la rémunération nette en SASU/ })
    courbe.focus()
    await userEvent.keyboard("{ArrowRight}")
    const infobulle = screen.getByRole("status")
    expect(infobulle).toHaveTextContent(money(49500))
    expect(infobulle).toHaveTextContent(`Rémunération${money(5000)}`)
    expect(infobulle).toHaveTextContent("3 trim.")
    await userEvent.keyboard("{End}")
    expect(screen.getByRole("status")).toHaveTextContent(money(48000))
  })

  it("redessine la courbe à la largeur de la feuille le temps d'une impression", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    afficher()
    const courbe = await screen.findByRole("group", { name: /Net du foyer selon la rémunération nette en SASU/ })
    const dessin = () => courbe.querySelector("svg")!
    const largeurEcran = dessin().getAttribute("width")

    act(() => {
      window.dispatchEvent(new Event("beforeprint"))
    })
    expect(dessin()).toHaveAttribute("width", "660")
    expect(dessin()).toHaveAttribute("viewBox", "0 0 660 260")

    act(() => {
      window.dispatchEvent(new Event("afterprint"))
    })
    expect(dessin()).toHaveAttribute("width", largeurEcran)
  })

  it("donne les valeurs de la courbe dans un tableau", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    afficher()

    const tableau = await screen.findByRole("table", { name: "Net du foyer selon la rémunération en SASU" })
    expect(within(tableau).getAllByRole("row")).toHaveLength(5)
  })

  it("dans le comparateur, la rémunération appliquée est celle des colonnes SASU et EURL", async () => {
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation())
    render(<ComparatorPanel session={session} />)

    const retraite = (await screen.findByText(/^Meilleur net avec 4 trimestres/)).closest("li")!
    await userEvent.click(within(retraite).getByRole("button", { name: "Appliquer au comparateur" }))

    expect(screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")).toHaveValue(5700)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 5700, distribuerToutLeBenefice: true })))
  })
})
