// src/ui/components/RepartitionBenefice.test.tsx

import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ComparaisonOptions, ModeRepartition, OptimisationRemuneration, PartageDuBenefice, PointRemuneration, ReservesDeLaSociete, ScenarioStatut } from "@/types"
import { emptySession, makePerson, makeMicro } from "@/ui/testing/fixtures"
import { ComparateurDeTest } from "@/ui/testing/comparateur"
import { RepartitionDuBenefice } from "./RepartitionBenefice"

// toHaveTextContent ramène les espaces insécables à des espaces simples : on fait de même.
const money = (n: number) => `${n.toLocaleString("fr-FR")} €`.replace(/\s/g, " ")

/** 40 000 € de bénéfice : 10 000 € nets coûtent 17 000 €, 3 450 € d'IS, 19 550 € distribuables. */
const partage = (changements: Partial<PartageDuBenefice> = {}): PartageDuBenefice => ({ beneficeAvantRemuneration: 40000, remunerationNette: 10000, cotisationsRemuneration: 7000, impotSocietes: 3450, dividendesNets: 19550, cotisationsSurDividendes: 0, resultatConserve: 0, ...changements })

const scenario = (p: PartageDuBenefice | undefined, reserves?: ReservesDeLaSociete): ScenarioStatut => ({ statut: "SASU", libelle: "SASU", actuel: false, fraisFonctionnement: 0, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: "" }, netApresImpots: 0, revenusAvantPrelevements: 0, totalPrelevements: 0, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...(p ? { partage: p } : {}), ...(reserves ? { reserves } : {}) })

const point = (remunerationNette: number, trimestres: number): PointRemuneration => ({ remunerationNette, dividendes: 0, netApresImpots: 30000, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, trimestres })
const optimisation = (changements: Partial<OptimisationRemuneration> = {}): OptimisationRemuneration => ({ statut: "SASU", remunerationMaximale: 23000, points: [], meilleur: point(4000, 0), meilleurAvecRetraite: point(5700, 4), warnings: [], ...changements })

const options = (mode: ModeRepartition, partDistribuee = 1): ComparaisonOptions => ({ activityId: "s1", remunerationNette: 10000, repartition: { mode, partDistribuee }, partBncPrestations: 1 })

function afficher({ mode = "personnalisee" as ModeRepartition, part = 1, p = partage(), opt = optimisation(), reserves = undefined as ReservesDeLaSociete | undefined } = {}) {
  const onChange = vi.fn()
  const onStatut = vi.fn()
  render(<RepartitionDuBenefice activityName="Ma SASU" statut="SASU" onStatut={onStatut} scenario={scenario(p, reserves)} optimisation={opt} options={options(mode, part)} onChange={onChange} />)
  return { onChange, onStatut }
}

afterEach(() => vi.restoreAllMocks())

describe("RepartitionDuBenefice", () => {
  it("au meilleur net, montre en lecture seule le partage à la rémunération optimale du statut choisi", () => {
    afficher({ mode: "meilleurNet" })

    expect(screen.getByText(/^Au meilleur net : la rémunération optimale en SASU, tout le reste en dividendes\./)).toBeInTheDocument()
    expect(screen.getByText(/de rémunération nette,/)).toHaveTextContent(`${money(10000)} de rémunération nette, ${money(19550)} de dividendes`)
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Répartitions toutes faites" })).not.toBeInTheDocument()
  })

  it("détaille le bénéfice poste par poste dans un tableau, sans poignées hors répartition personnalisée", () => {
    afficher({ mode: "dividendes" })
    const tableau = screen.getByRole("table", { name: "Partage du bénéfice en SASU" })
    expect(within(tableau).getByRole("row", { name: /Rémunération nette/ })).toHaveTextContent(`${money(10000)}25 %`)
    expect(within(tableau).getByRole("row", { name: /Impôt sur les sociétés/ })).toHaveTextContent(money(3450))
    expect(within(tableau).getByRole("row", { name: /Bénéfice avant rémunération/ })).toHaveTextContent(`${money(40000)}100 %`)
    // Pas de cotisations sur dividendes en SASU : la ligne est omise.
    expect(within(tableau).queryByRole("row", { name: /Cotisations sur les dividendes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tout en dividendes" })).not.toBeInTheDocument()
    expect(screen.getByText(/de dividendes, .* ajoutés aux réserves/)).toHaveTextContent(`${money(10000)} de rémunération nette, ${money(19550)} de dividendes`)
  })

  it("donne les réserves au 31 décembre, et des dividendes pris sur les réserves sans parler de déficit", () => {
    // Grille : 25 000 € de dividendes, dont 5 450 € pris sur les 8 000 € de réserves du 1er janvier.
    const reserves: ReservesDeLaSociete = { auDebut: { reserves: 8000, reserveLegale: 100, deficitReportable: 0 }, aLaFin: { reserves: 2550, reserveLegale: 100, deficitReportable: 0 }, deficitImpute: 0, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: 19550, distribuable: 27550, dividendesPrisSurLesReserves: 5450 }
    afficher({ mode: "grille", p: partage({ dividendesNets: 25000, resultatConserve: -5450 }), reserves })

    expect(screen.getByText(/^Réserves de la société au 31 décembre/)).toHaveTextContent(`Réserves de la société au 31 décembre : ${money(2550)} (au 1er janvier : ${money(8000)}, après ${money(5450)} de dividendes pris sur les réserves des années précédentes).`)
    expect(screen.queryByText(/déficitaire/)).not.toBeInTheDocument()
    expect(within(screen.getByRole("table")).getByRole("row", { name: /Dividendes/ })).toHaveTextContent(money(25000))
    expect(within(screen.getByRole("table")).getByRole("row", { name: /^Pris sur les réserves/ })).toHaveTextContent(`-${money(5450)}`)
  })

  it("ne parle pas de réserves quand la société n'en a pas", () => {
    const reserves: ReservesDeLaSociete = { auDebut: { reserves: 0, reserveLegale: 100, deficitReportable: 0 }, aLaFin: { reserves: 0, reserveLegale: 100, deficitReportable: 0 }, deficitImpute: 0, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: 19550, distribuable: 19550, dividendesPrisSurLesReserves: 0 }
    afficher({ mode: "dividendes", reserves })

    expect(screen.queryByText(/^Réserves de la société/)).not.toBeInTheDocument()
  })

  it("présente deux curseurs accessibles en répartition personnalisée", () => {
    afficher({ part: 1 })
    const remuneration = screen.getByRole("slider", { name: "Rémunération nette du dirigeant" })
    expect(remuneration).toHaveAttribute("aria-valuemax", "23000")
    expect(remuneration).toHaveAttribute("aria-valuenow", "10000")
    expect(remuneration.getAttribute("aria-valuetext")).toMatch(/^10\s000\s€ de rémunération nette$/)
    const part = screen.getByRole("slider", { name: "Part du bénéfice distribuable versée en dividendes" })
    expect(part).toHaveAttribute("aria-valuenow", "100")
    expect(part.getAttribute("aria-valuetext")).toMatch(/^100\s% du bénéfice distribuable en dividendes, 0\s% ajoutés aux réserves$/)
  })

  it("règle la rémunération au clavier : flèches, pages, début et fin", async () => {
    const { onChange } = afficher()
    const remuneration = screen.getByRole("slider", { name: "Rémunération nette du dirigeant" })
    remuneration.focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 10100 }))
    await userEvent.keyboard("{PageDown}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 9000 }))
    await userEvent.keyboard("{End}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 23000 }))
    await userEvent.keyboard("{Home}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 0 }))
    onChange.mockClear()
    await userEvent.keyboard("a")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("règle la part distribuée au clavier, par pas de 5 %", async () => {
    const { onChange } = afficher({ part: 1 })
    screen.getByRole("slider", { name: "Part du bénéfice distribuable versée en dividendes" }).focus()
    await userEvent.keyboard("{ArrowLeft}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ repartition: { mode: "personnalisee", partDistribuee: 0.95 } }))
    await userEvent.keyboard("{Home}")
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ repartition: { mode: "personnalisee", partDistribuee: 0 } }))
  })

  it("se règle en faisant glisser une poignée : aperçu pendant le glissement, comparateur au relâchement", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000, top: 0, height: 44, right: 1000, bottom: 44, x: 0, y: 0, toJSON: () => ({}) })
    const { onChange } = afficher({ part: 1 })
    const part = screen.getByRole("slider", { name: "Part du bénéfice distribuable versée en dividendes" })
    // Le bénéfice distribuable va de 20 450 € à 40 000 € : 30 225 €, c'est la moitié.
    fireEvent.pointerDown(part, { button: 0, clientX: 1000, pointerId: 1 })
    fireEvent.pointerMove(part, { clientX: 755.6, pointerId: 1 })
    expect(part).toHaveAttribute("aria-valuenow", "50")
    expect(screen.getByRole("table", { name: /estimation en attendant le calcul/ })).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(part, { clientX: 755.6, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ repartition: { mode: "personnalisee", partDistribuee: 0.5 } }))

    // Un appui sur la barre, près de la poignée de rémunération, la déplace : 8 500 € de coût, soit 5 000 € nets.
    const remuneration = screen.getByRole("slider", { name: "Rémunération nette du dirigeant" })
    fireEvent.pointerDown(remuneration.parentElement!, { button: 0, clientX: 212.5, pointerId: 2 })
    expect(remuneration).toHaveFocus()
    fireEvent.pointerUp(remuneration.parentElement!, { pointerId: 2 })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 5000 }))
  })

  it("ignore un glissement annulé et un autre bouton que le principal", () => {
    const { onChange } = afficher()
    const remuneration = screen.getByRole("slider", { name: "Rémunération nette du dirigeant" })
    fireEvent.pointerDown(remuneration, { button: 2, clientX: 0 })
    fireEvent.pointerUp(remuneration)
    fireEvent.pointerDown(remuneration, { button: 0, clientX: 0, pointerId: 3 })
    fireEvent.pointerCancel(remuneration, { pointerId: 3 })
    fireEvent.pointerUp(remuneration, { pointerId: 3 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("propose des répartitions toutes faites, reprises de l'arbitrage", async () => {
    const { onChange } = afficher()
    await userEvent.click(screen.getByRole("button", { name: "Tout en dividendes" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 0, repartition: { mode: "personnalisee", partDistribuee: 1 } }))
    await userEvent.click(screen.getByRole("button", { name: "Tout en rémunération" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 23000, repartition: { mode: "personnalisee", partDistribuee: 0 } }))
    await userEvent.click(screen.getByRole("button", { name: "Meilleur net" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 4000, repartition: { mode: "personnalisee", partDistribuee: 1 } }))
    await userEvent.click(screen.getByRole("button", { name: "Meilleur net avec 4 trimestres" }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ remunerationNette: 5700 }))
  })

  it("désactive les meilleurs nets que l'arbitrage n'a pas trouvés, et n'a pas de poignées sans arbitrage du statut", () => {
    afficher({ opt: optimisation({ meilleur: null, meilleurAvecRetraite: null }) })
    expect(screen.getByRole("button", { name: "Meilleur net" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Meilleur net avec 4 trimestres" })).toBeDisabled()
  })

  it("sans arbitrage de ce statut, montre le partage sans poignées", () => {
    afficher({ opt: optimisation({ statut: "EURL" }) })
    expect(screen.queryByRole("slider")).not.toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Partage du bénéfice en SASU" })).toBeInTheDocument()
  })

  it("signale une société déficitaire, une activité sans bénéfice et un calcul en cours", () => {
    const { unmount } = render(<RepartitionDuBenefice activityName="Ma SASU" statut="SASU" onStatut={vi.fn()} scenario={scenario(partage({ remunerationNette: 30000, cotisationsRemuneration: 20000, impotSocietes: 0, dividendesNets: 0, resultatConserve: -10000 }))} optimisation={null} options={options("dividendes")} onChange={vi.fn()} />)
    expect(screen.getByText(/dépasse le bénéfice de 10.000 € : la société est déficitaire/)).toBeInTheDocument()
    unmount()

    afficher({ p: partage({ beneficeAvantRemuneration: 0, remunerationNette: 0, cotisationsRemuneration: 0, impotSocietes: 0, dividendesNets: 0 }) })
    expect(screen.getByText(/ne dégage aucun bénéfice en SASU/)).toBeInTheDocument()
  })

  it("attend le calcul du comparateur", () => {
    render(<RepartitionDuBenefice activityName="Ma SASU" statut="SASU" onStatut={vi.fn()} scenario={undefined} optimisation={null} options={options("dividendes")} onChange={vi.fn()} />)
    expect(screen.getByText("Calcul en cours…")).toBeInTheDocument()
  })

  it("change le statut étudié", async () => {
    const { onStatut } = afficher()
    await userEvent.click(screen.getByRole("button", { name: "EURL" }))
    expect(onStatut).toHaveBeenCalledWith("EURL")
  })
})

describe("partage du bénéfice dans le comparateur", () => {
  const session = { ...emptySession(), entities: [makePerson(), makeMicro()] }

  it("passe d'un mode à l'autre, et ne demande pas de rémunération quand tout part en rémunération", async () => {
    render(<ComparateurDeTest annee={2026} session={session} />)
    const groupe = await screen.findByRole("group", { name: "Bénéfice de la société (SASU, EURL)" })
    expect(within(groupe).getByRole("radio", { name: "Meilleur net" })).toBeChecked()
    expect(screen.queryByLabelText("Rémunération nette annuelle (SASU, EURL)")).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Avec 4 trimestres de retraite" })).toBeChecked()

    await userEvent.click(within(groupe).getByRole("radio", { name: "Tout en rémunération" }))
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ repartition: { mode: "remuneration", partDistribuee: 1 } }), 2026))
    expect(screen.queryByLabelText("Rémunération nette annuelle (SASU, EURL)")).not.toBeInTheDocument()

    await userEvent.click(within(groupe).getByRole("radio", { name: "Sur mesure" }))
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ repartition: { mode: "personnalisee", partDistribuee: 1 } }), 2026))
    expect(screen.getByLabelText("Rémunération nette annuelle (SASU, EURL)")).toBeInTheDocument()
  })

  it("règle la colonne SASU depuis la barre, et l'arbitrage applique sa rémunération en restant en répartition personnalisée", async () => {
    vi.mocked(window.api.compareStatuts).mockResolvedValue({ scenarios: [scenario(partage())], meilleur: "SASU", couples: [], warnings: [] })
    vi.mocked(window.api.optimiserRemuneration).mockResolvedValue(optimisation({ points: [point(4000, 0), point(5700, 4)] }))
    render(<ComparateurDeTest annee={2026} session={session} />)
    await userEvent.click(await screen.findByRole("radio", { name: "Sur mesure" }))

    const remuneration = await screen.findByRole("slider", { name: "Rémunération nette du dirigeant" })
    remuneration.focus()
    await userEvent.keyboard("{PageUp}")
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 1000, repartition: { mode: "personnalisee", partDistribuee: 1 } }), 2026))

    const meilleur = (await screen.findByText(/^Meilleur net avec 4 trimestres :/)).closest("li")!
    await userEvent.click(within(meilleur).getByRole("button", { name: "Appliquer au comparateur" }))
    await vi.waitFor(() => expect(window.api.compareStatuts).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ remunerationNette: 5700, repartition: { mode: "personnalisee", partDistribuee: 1 } }), 2026))
  })
})
