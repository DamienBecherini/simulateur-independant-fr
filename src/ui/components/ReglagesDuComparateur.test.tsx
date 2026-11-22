// src/ui/components/ReglagesDuComparateur.test.tsx

import { fireEvent, render, screen, within } from "@testing-library/react"
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

    await userEvent.click(screen.getByRole("checkbox", { name: "en EURL" }))
    expect(phrase()).toHaveTextContent(/^Chaque société verse la rémunération qui donne le meilleur net, le reste en dividendes ; en SASU, parmi celles qui valident 4 trimestres de retraite\.$/)
    await userEvent.click(screen.getByRole("checkbox", { name: "en SASU" }))
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
  it("va de 0 au plus haut des plafonds sans déficit, et dit sous le curseur celui de chaque société", async () => {
    avecPlafonds()
    await enMode("Ma rémunération")
    const poignee = await curseur()
    expect(poignee).toHaveAttribute("aria-valuemin", "0")
    await vi.waitFor(() => expect(poignee).toHaveAttribute("aria-valuemax", "52800"))
    expect(poignee).toHaveAccessibleDescription(/^jusqu'à 41\s300\s€ en SASU, 52\s800\s€ en EURL sans déficit$/)
    expect(champ()).toHaveAccessibleDescription(/^jusqu'à 41\s300\s€ en SASU, 52\s800\s€ en EURL sans déficit$/)

    // La société étudiée plus bas (« Approfondir une société ») ne change plus rien au curseur.
    await userEvent.click(within(screen.getByRole("group", { name: "Société étudiée" })).getByRole("button", { name: "EURL" }))
    await vi.waitFor(() => expect(within(screen.getByRole("group", { name: "Société étudiée" })).getByRole("button", { name: "EURL" })).toHaveAttribute("aria-pressed", "true"))
    expect(screen.getByRole("slider", { name: "Régler la rémunération nette annuelle" })).toHaveAttribute("aria-valuemax", "52800")
    expect(document.getElementById("comparateur-remuneration-plafond")).toHaveTextContent(`jusqu'à ${money(41300)} en SASU, ${money(52800)} en EURL sans déficit`)
  })

  it("au-delà du plafond d'une société, dit ce que sa colonne retient", async () => {
    avecPlafonds()
    await enMode("Ma rémunération")
    await curseur()
    await userEvent.clear(champ())
    await userEvent.type(champ(), "45000")
    expect(await screen.findByRole("status")).toHaveTextContent(`Une société ne verse pas plus qu'elle ne gagne : en SASU, le comparateur retient ${money(41300)}, le plus qu'elle peut verser.`)
    await userEvent.clear(champ())
    await userEvent.type(champ(), "60000")
    expect(screen.getByRole("status")).toHaveTextContent(`en SASU, le comparateur retient ${money(41300)}, le plus qu'elle peut verser ; en EURL, le comparateur retient ${money(52800)}, le plus qu'elle peut verser.`)
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
    expect(champ()).toHaveValue(52800)
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
    await vi.waitFor(() => expect(poignee).toHaveAttribute("aria-valuenow", "52800"))
    expect(poignee.getAttribute("aria-valuetext")).toMatch(/^60\s000\s€ de rémunération nette, au-delà des 52\s800\s€ possibles sans déficit$/)
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 60000 }), 2026))
  })

  it("se règle en le faisant glisser : le champ suit le pointeur, le comparateur ne reçoit la valeur qu'au relâchement", async () => {
    avecPlafonds()
    const enregistre = await enMode("Ma rémunération")
    const poignee = await curseur()
    await vi.waitFor(() => expect(poignee).toHaveAttribute("aria-valuemax", "52800"))
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 44, right: 1000, bottom: 44, x: 0, y: 0, toJSON: () => ({}) })
    enregistre.mockClear()

    const piste = poignee.parentElement!
    fireEvent.pointerDown(piste, { button: 0, clientX: 500, pointerId: 1 })
    expect(poignee).toHaveFocus()
    // La moitié de 52 800 €, au pas de 100 €.
    expect(champ()).toHaveValue(26400)
    fireEvent.pointerMove(piste, { clientX: 250, pointerId: 1 })
    expect(champ()).toHaveValue(13200)
    expect(poignee).toHaveAttribute("aria-valuenow", "13200")
    expect(enregistre).not.toHaveBeenCalled()

    fireEvent.pointerUp(piste, { clientX: 250, pointerId: 1 })
    expect(enregistre).toHaveBeenCalledTimes(1)
    expect(enregistre).toHaveBeenLastCalledWith(expect.objectContaining({ reglagesParActivite: { "company-sasu": expect.objectContaining({ remunerationParAnnee: { "2026": 13200 } }) } }))
    expect(champ()).toHaveValue(13200)
  })

  it("sans bénéfice, n'a pas de curseur et le dit", async () => {
    avecPlafonds({ SASU: 0, EURL: 0 })
    await enMode("Ma rémunération")
    expect(await screen.findByText("En SASU et en EURL, l'activité ne dégage pas de bénéfice : aucune rémunération possible sans déficit.")).toBeInTheDocument()
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

describe("conditions de la société de portage", () => {
  /** Les conditions du portage enregistrées en dernier pour l'activité comparée. */
  const conditionsEnregistrees = (enregistre: ReturnType<typeof vi.fn>) => {
    const comparateur = enregistre.mock.lastCall?.[0] as { activiteComparee: string; reglagesParActivite: Record<string, { portage?: unknown }> }
    return comparateur.reglagesParActivite[comparateur.activiteComparee].portage
  }

  it("sont repliées, annoncent des valeurs typiques et enregistrent seulement les conditions changées", async () => {
    const enregistre = vi.fn()
    render(<ComparateurDeTest annee={2026} session={session()} onComparateur={enregistre} />)
    const titre = await screen.findByText("Conditions de la société de portage")
    expect(titre.closest("details")).not.toHaveAttribute("open")
    await userEvent.click(titre)
    expect(screen.getByText(/Les valeurs par défaut sont typiques, sans source officielle/)).toBeInTheDocument()

    const frais = screen.getByLabelText("Frais de gestion (% du chiffre d'affaires HT)")
    expect(frais).toHaveValue(7)
    expect(frais).toHaveAccessibleDescription("valeur typique")
    fireEvent.change(frais, { target: { value: "5.5" } })
    expect(conditionsEnregistrees(enregistre)).toEqual({ tauxFraisDeGestion: 0.055 })
    expect(screen.getByLabelText("Frais de gestion (% du chiffre d'affaires HT)")).not.toHaveAccessibleDescription("valeur typique")

    await userEvent.click(screen.getByRole("checkbox", { name: "La société reverse la réduction générale des cotisations" }))
    expect(conditionsEnregistrees(enregistre)).toEqual({ tauxFraisDeGestion: 0.055, reductionGeneraleReversee: true })

    // Bornes du fichier : 30 % au plus ; un champ vidé reprend sa valeur typique.
    fireEvent.change(screen.getByLabelText("Frais de gestion (% du chiffre d'affaires HT)"), { target: { value: "45" } })
    expect(conditionsEnregistrees(enregistre)).toMatchObject({ tauxFraisDeGestion: 0.3 })
    fireEvent.change(screen.getByLabelText("Frais de gestion (% du chiffre d'affaires HT)"), { target: { value: "" } })
    expect(conditionsEnregistrees(enregistre)).toEqual({ reductionGeneraleReversee: true })

    await userEvent.click(screen.getByRole("button", { name: "Revenir aux valeurs typiques" }))
    expect(conditionsEnregistrees(enregistre)).toBeUndefined()
  })

  it("signalent un plancher au-dessus du plafond, qui fait écarter les deux", async () => {
    render(<ComparateurDeTest annee={2026} session={session()} />)
    await userEvent.click(await screen.findByText("Conditions de la société de portage"))
    fireEvent.change(screen.getByLabelText("Plafond mensuel des frais de gestion (€)"), { target: { value: "300" } })
    expect(screen.queryByText(/Le plancher dépasse le plafond/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Plancher mensuel des frais de gestion (€)"), { target: { value: "500" } })
    expect(screen.getByText("Le plancher dépasse le plafond : ni l'un ni l'autre n'est retenu.")).toBeInTheDocument()
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
