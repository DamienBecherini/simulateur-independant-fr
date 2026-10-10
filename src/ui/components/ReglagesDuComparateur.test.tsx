// src/ui/components/ReglagesDuComparateur.test.tsx

import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { OptimisationRemuneration, SessionState, StatutSociete } from "@/types"
import { emptySession, makeCompany, makePerson } from "@/ui/testing/fixtures"
import { ComparateurDeTest } from "@/ui/testing/comparateur"
import { MemoireDesSectionsContext } from "../hooks/useSectionOuverte"

// toHaveTextContent ramène les espaces insécables à des espaces simples : on fait de même.
const money = (n: number) => `${n.toLocaleString("fr-FR")} €`.replace(/\s/g, " ")

const session = (): SessionState => ({ ...emptySession(), entities: [makePerson(), makeCompany()] })

/** Arbitrage de chaque statut : 41 300 € de rémunération au plus sans déficit en SASU, 52 800 € en EURL. */
function avecPlafonds(plafonds: Record<StatutSociete, number> = { SASU: 41300, EURL: 52800 }) {
  vi.mocked(window.api.optimiserRemuneration).mockImplementation(async (_session, _options, statut): Promise<OptimisationRemuneration> => ({ statut, remunerationMaximale: plafonds[statut], points: [], meilleur: null, meilleurAvecRetraite: null, warnings: [] }))
}

const champ = () => screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")
const curseur = () => screen.findByRole("slider", { name: "Régler la rémunération nette annuelle" })

async function enMode(nom: string, enregistre = vi.fn()) {
  render(<ComparateurDeTest annee={2026} session={session()} onComparateur={enregistre} />)
  await userEvent.click(await screen.findByRole("radio", { name: nom }))
  return enregistre
}

afterEach(() => vi.restoreAllMocks())

describe("modes de partage du bénéfice", () => {
  it("décrit sous les boutons le seul mode choisi, et chaque bouton par sa phrase", async () => {
    render(<ComparateurDeTest annee={2026} session={session()} />)
    const phrase = () => document.getElementById("comparateur-mode-choisi")
    expect(await screen.findByRole("radio", { name: "Meilleur net" })).toBeChecked()
    expect(phrase()).toHaveTextContent("Chaque société verse la rémunération qui donne le meilleur net parmi celles qui valident 4 trimestres de retraite, le reste en dividendes.")

    await userEvent.click(screen.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" }))
    expect(phrase()).toHaveTextContent(/^Chaque société verse la rémunération qui donne le meilleur net, le reste en dividendes\.$/)

    await userEvent.click(screen.getByRole("radio", { name: "Ma rémunération" }))
    expect(phrase()).toHaveTextContent(/^La rémunération que vous saisissez, tout le reste du bénéfice en dividendes\.$/)
    await userEvent.click(screen.getByRole("radio", { name: "Sur mesure" }))
    expect(phrase()).toHaveTextContent(/^Vous réglez la rémunération et la part du bénéfice distribuée/)

    expect(screen.getByRole("radio", { name: "Tout en rémunération" })).toHaveAccessibleDescription("La rémunération la plus haute que la société peut verser, sans dividendes.")
    expect(screen.getByRole("radio", { name: "Selon la grille" })).toHaveAccessibleDescription("Les rémunérations et dividendes saisis dans la grille.")
    expect(screen.getByRole("radio", { name: "Selon la grille" }).closest("label")).toHaveAttribute("title", "Les rémunérations et dividendes saisis dans la grille.")
  })
})

describe("curseur de la rémunération saisie", () => {
  it("va de 0 à la rémunération maximale sans déficit du statut étudié, dite sous le curseur", async () => {
    avecPlafonds()
    await enMode("Ma rémunération")
    const poignee = await curseur()
    expect(poignee).toHaveAttribute("aria-valuemin", "0")
    expect(poignee).toHaveAttribute("aria-valuemax", "41300")
    expect(poignee).toHaveAccessibleDescription(/^jusqu'à 41\s300\s€ en SASU sans déficit$/)
    expect(champ()).toHaveAccessibleDescription(/^jusqu'à 41\s300\s€ en SASU sans déficit$/)

    // Le statut étudié dans « Rémunération ou dividendes ? » change le plafond.
    await userEvent.click(screen.getAllByRole("button", { name: "EURL", pressed: false })[0])
    await vi.waitFor(() => expect(screen.getByRole("slider", { name: "Régler la rémunération nette annuelle" })).toHaveAttribute("aria-valuemax", "52800"))
    expect(document.getElementById("comparateur-remuneration-plafond")).toHaveTextContent(`jusqu'à ${money(52800)} en EURL sans déficit`)
  })

  it("suit le champ, et le champ le suit au clavier, par pas de 100 € et de 1 000 €", async () => {
    avecPlafonds()
    const enregistre = await enMode("Sur mesure")
    const poignee = await curseur()
    await userEvent.clear(champ())
    await userEvent.type(champ(), "20000")
    expect(poignee).toHaveAttribute("aria-valuenow", "20000")
    expect(poignee.getAttribute("aria-valuetext")).toMatch(/^20\s000\s€ de rémunération nette$/)

    poignee.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(champ()).toHaveValue(20100)
    await userEvent.keyboard("{PageDown}")
    expect(champ()).toHaveValue(19100)
    await userEvent.keyboard("{End}")
    expect(champ()).toHaveValue(41300)
    await userEvent.keyboard("{Home}")
    expect(champ()).toHaveValue(0)
    expect(enregistre).toHaveBeenLastCalledWith(expect.objectContaining({ reglagesParActivite: { "company-sasu": expect.objectContaining({ remunerationParAnnee: { "2026": 0 } }) } }))
  })

  it("accepte une rémunération saisie au-delà du maximum : la poignée reste en bout de piste", async () => {
    avecPlafonds()
    await enMode("Ma rémunération")
    const poignee = await curseur()
    await userEvent.clear(champ())
    await userEvent.type(champ(), "60000")
    expect(champ()).toHaveValue(60000)
    expect(poignee).toHaveAttribute("aria-valuenow", "41300")
    expect(poignee.getAttribute("aria-valuetext")).toMatch(/^60\s000\s€ de rémunération nette, au-delà des 41\s300\s€ possibles sans déficit$/)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 60000 }), 2026))
  })

  it("se règle en le faisant glisser : le champ suit le pointeur, le comparateur ne reçoit la valeur qu'au relâchement", async () => {
    avecPlafonds()
    const enregistre = await enMode("Ma rémunération")
    const poignee = await curseur()
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 44, right: 1000, bottom: 44, x: 0, y: 0, toJSON: () => ({}) })
    enregistre.mockClear()

    const piste = poignee.parentElement!
    fireEvent.pointerDown(piste, { button: 0, clientX: 500, pointerId: 1 })
    expect(poignee).toHaveFocus()
    // La moitié de 41 300 €, au pas de 100 €.
    expect(champ()).toHaveValue(20700)
    fireEvent.pointerMove(piste, { clientX: 250, pointerId: 1 })
    expect(champ()).toHaveValue(10300)
    expect(poignee).toHaveAttribute("aria-valuenow", "10300")
    expect(enregistre).not.toHaveBeenCalled()

    fireEvent.pointerUp(piste, { clientX: 250, pointerId: 1 })
    expect(enregistre).toHaveBeenCalledTimes(1)
    expect(enregistre).toHaveBeenLastCalledWith(expect.objectContaining({ reglagesParActivite: { "company-sasu": expect.objectContaining({ remunerationParAnnee: { "2026": 10300 } }) } }))
    expect(champ()).toHaveValue(10300)
  })

  it("sans bénéfice, n'a pas de curseur et le dit", async () => {
    avecPlafonds({ SASU: 0, EURL: 0 })
    await enMode("Ma rémunération")
    expect(await screen.findByText("En SASU, l'activité ne dégage pas de bénéfice : aucune rémunération possible sans déficit.")).toBeInTheDocument()
    expect(screen.queryByRole("slider", { name: "Régler la rémunération nette annuelle" })).not.toBeInTheDocument()
    expect(champ()).toBeInTheDocument()
  })

  it.each(["Meilleur net", "Tout en rémunération", "Selon la grille"])("n'apparaît pas en mode « %s »", async nom => {
    avecPlafonds()
    render(<ComparateurDeTest annee={2026} session={session()} />)
    await userEvent.click(await screen.findByRole("radio", { name: "Ma rémunération" }))
    await curseur()
    await userEvent.click(screen.getByRole("radio", { name: nom }))
    expect(screen.queryByRole("slider", { name: "Régler la rémunération nette annuelle" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Rémunération nette annuelle (SASU, EURL)")).not.toBeInTheDocument()
  })
})

describe("section des frais de fonctionnement", () => {
  const avecMemoire = (sectionsOuvertes: Record<string, boolean>, retenir = vi.fn()) => (
    <MemoireDesSectionsContext.Provider value={{ sectionsOuvertes, retenir }}>
      <ComparateurDeTest annee={2026} session={session()} />
    </MemoireDesSectionsContext.Provider>
  )
  const section = () => screen.getByRole("table", { name: "Frais de fonctionnement annuels" }).closest("details")!

  it("s'ouvre d'un seul clic, et retient son état", async () => {
    const retenir = vi.fn()
    render(avecMemoire({}, retenir))
    await screen.findByLabelText("Activité comparée")
    expect(section()).not.toHaveAttribute("open")
    await userEvent.click(screen.getByText("Frais de fonctionnement"))
    expect(retenir).toHaveBeenCalledWith("comparateur-plus-de-reglages", true)
  })

  it("reprend l'état de l'ancien tableau des frais tant que la section n'a pas le sien", async () => {
    const { unmount } = render(avecMemoire({ "comparateur-frais": true }))
    await screen.findByLabelText("Activité comparée")
    expect(section()).toHaveAttribute("open")
    unmount()

    render(avecMemoire({ "comparateur-frais": true, "comparateur-plus-de-reglages": false }))
    await screen.findByLabelText("Activité comparée")
    expect(section()).not.toHaveAttribute("open")
  })
})
