// src/ui/components/BandeDesMois.test.tsx
// Bande des mois de la grille mensuelle. jsdom ne met rien en page : la géométrie d'une grille de téléphone est
// simulée (première colonne fixe de 96 px, janvier à 200 px, mois de 150 px, contenu de 2 000 px).

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { grilleVide, type MonthlyGridData } from "@/types"
import { makeCompany, makeFlow, makePerson } from "@/ui/testing/fixtures"
import MonthlyGrid from "./MonthlyGrid"

const COLONNE_FIXE = 96
const DEBUT_DE_JANVIER = 200
const LARGEUR_DU_MOIS = 150
const LARGEUR_TOTALE = 2000
/** Défilement qui place un mois juste après la première colonne. */
const surLeMois = (index: number) => DEBUT_DE_JANVIER + index * LARGEUR_DU_MOIS - COLONNE_FIXE

const ecran = { largeurVisible: 240, defilement: 0 }
const estLaZone = (element: Element) => element.classList.contains("overflow-x-auto")
const indexDuMois = (cellule: Element) => Array.from(cellule.parentElement?.querySelectorAll("[data-mois]") ?? []).indexOf(cellule)

beforeEach(() => {
  ecran.largeurVisible = 240
  ecran.defilement = 0
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-mois") ? DEBUT_DE_JANVIER + indexDuMois(this) * LARGEUR_DU_MOIS : 0
  })
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-mois")) return LARGEUR_DU_MOIS
    return this.hasAttribute("data-colonne-fixe") ? COLONNE_FIXE : 0
  })
  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? ecran.largeurVisible : 0
  })
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? LARGEUR_TOTALE : 0
  })
  vi.spyOn(Element.prototype, "scrollLeft", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? ecran.defilement : 0
  })
})

/** Espionne les défilements demandés et les applique, comme le ferait le navigateur. */
function espionnerLeDefilement() {
  return vi.spyOn(Element.prototype, "scrollTo").mockImplementation(function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options === "object" && options.left !== undefined) defiler(this, options.left)
  })
}

/** Défilement de la zone par l'utilisateur. */
function defiler(zone: Element, gauche: number) {
  ecran.defilement = gauche
  act(() => {
    zone.dispatchEvent(new Event("scroll"))
  })
}

const zoneDeLaGrille = () => document.querySelector(".overflow-x-auto") as HTMLElement

function afficher(grille: MonthlyGridData = grilleVide()) {
  const props = { entities: [makePerson(), makeCompany()], setMonthlyData: () => {}, preferences: { slotOrder: [] }, flowTypeToNumberMap: new Map<string, number>() }
  const rendu = render(<MonthlyGrid {...props} monthlyData={grille} annee={2026} />)
  return { user: userEvent.setup(), changerDeGrille: (autre: MonthlyGridData, annee = 2026) => rendu.rerender(<MonthlyGrid {...props} monthlyData={autre} annee={annee} />) }
}

const bande = () => screen.getByRole("toolbar", { name: "Mois de la grille" })
const moisCourants = () => within(bande()).queryAllByRole("button").filter(b => b.getAttribute("aria-current") === "true").map(b => b.getAttribute("aria-label"))

describe("bande des mois de la grille", () => {
  it("n'apparaît pas quand la grille tient dans sa zone, sans défilement", () => {
    ecran.largeurVisible = LARGEUR_TOTALE
    afficher()
    expect(screen.queryByRole("toolbar", { name: "Mois de la grille" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Mois suivant" })).not.toBeInTheDocument()
    expect(document.querySelector("[data-fondu]")).toBeNull()
  })

  it("apparaît quand la grille déborde : douze mois nommés, et un point sous ceux qui ont des flux", () => {
    const grille = grilleVide()
    grille[2].flows = [makeFlow({ id: "a" }), makeFlow({ id: "b", entityId: "company-sasu" }), makeFlow({ id: "c" })]
    grille[6].flows = [makeFlow({ id: "d" })]
    // Flux d'un acteur supprimé : la grille ne le montre pas, la bande non plus.
    grille[8].flows = [makeFlow({ id: "e", entityId: "disparu" })]
    afficher(grille)

    const mois = within(bande()).getAllByRole("button")
    expect(mois).toHaveLength(12)
    expect(mois[0]).toHaveAccessibleName("Aller à janvier")
    expect(mois[2]).toHaveAccessibleName("Aller à mars, 3 flux")
    expect(mois[6]).toHaveAccessibleName("Aller à juillet, 1 flux")
    expect(mois[8]).toHaveAccessibleName("Aller à septembre")
    expect(mois.map(m => m.querySelector("[data-point]") !== null)).toEqual([false, false, true, false, false, false, true, false, false, false, false, false])
    expect(mois[2]).toHaveTextContent("M")
  })

  it("un toucher sur un mois l'amène juste après la première colonne, en douceur", async () => {
    const defilement = espionnerLeDefilement()
    const { user } = afficher()
    await user.click(screen.getByRole("button", { name: "Aller à juillet" }))
    expect(defilement).toHaveBeenLastCalledWith({ left: surLeMois(6), behavior: "smooth" })
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à juillet"]))
  })

  it("sans animation quand l'utilisateur a demandé de réduire les animations", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query }) as MediaQueryList)
    const defilement = espionnerLeDefilement()
    const { user } = afficher()
    await user.click(screen.getByRole("button", { name: "Aller à mars" }))
    expect(defilement).toHaveBeenLastCalledWith({ left: surLeMois(2), behavior: "instant" })
  })

  it("les mois visibles suivent le défilement de la grille", async () => {
    afficher()
    // Au début, le total annuel occupe presque toute la place : janvier, à peine entamé, marque seul la position.
    expect(moisCourants()).toEqual(["Aller à janvier"])
    ecran.largeurVisible = 400
    defiler(zoneDeLaGrille(), surLeMois(3) + 10)
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à avril", "Aller à mai"]))
  })

  it("les flèches avancent d'un mois, et sont inactives au bout de la grille, sans perdre le focus", async () => {
    espionnerLeDefilement()
    const { user } = afficher()
    const precedent = screen.getByRole("button", { name: "Mois précédent" })
    const suivant = screen.getByRole("button", { name: "Mois suivant" })
    expect(precedent).toHaveAttribute("aria-disabled", "true")
    expect(suivant).not.toHaveAttribute("aria-disabled")

    await user.click(suivant)
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à janvier"]))
    await user.click(suivant)
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à février"]))
    expect(precedent).not.toHaveAttribute("aria-disabled")
    await user.click(precedent)
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à janvier"]))

    // Décembre tient dans la zone sans aller tout au bout : la flèche reste active jusqu'au bout de la grille.
    await user.click(screen.getByRole("button", { name: "Aller à décembre" }))
    expect(suivant).not.toHaveAttribute("aria-disabled")
    await user.click(suivant)
    await waitFor(() => expect(suivant).toHaveAttribute("aria-disabled", "true"))
    suivant.focus()
    await user.click(suivant)
    expect(ecran.defilement).toBe(LARGEUR_TOTALE - 240)
    expect(suivant).toHaveFocus()
  })

  it("fondus aux bords : à droite tant qu'il reste des mois, à gauche une fois la grille défilée", async () => {
    afficher()
    const fondu = (cote: string) => document.querySelector(`[data-fondu="${cote}"]`)
    expect(fondu("gauche")).toHaveClass("opacity-0")
    expect(fondu("droite")).toHaveClass("opacity-100")
    expect(fondu("gauche")).toHaveAttribute("aria-hidden", "true")
    defiler(zoneDeLaGrille(), LARGEUR_TOTALE - 240)
    await waitFor(() => expect(fondu("gauche")).toHaveClass("opacity-100"))
    expect(fondu("droite")).toHaveClass("opacity-0")
    expect(fondu("gauche")).toHaveStyle({ left: `${COLONNE_FIXE}px` })
  })

  it("au clavier : un seul mois dans l'ordre de tabulation, les flèches passent aux autres", async () => {
    const { user } = afficher()
    const mois = within(bande()).getAllByRole("button")
    expect(mois.filter(m => m.tabIndex === 0)).toHaveLength(1)
    mois[0].focus()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(mois[2]).toHaveFocus()
    expect(mois[2]).toHaveAttribute("tabindex", "0")
    await user.keyboard("{End}")
    expect(mois[11]).toHaveFocus()
    await user.keyboard("{ArrowRight}{Home}{ArrowLeft}")
    expect(mois[0]).toHaveFocus()
    await user.keyboard("a")
    expect(mois[0]).toHaveFocus()
  })

  it("glisser le long de la bande fait défiler la grille, sans toucher le mois où le doigt se relève", () => {
    const defilement = espionnerLeDefilement()
    afficher()
    const barre = bande()
    vi.spyOn(barre, "getBoundingClientRect").mockReturnValue({ left: 50, width: 240, top: 0, height: 44, right: 290, bottom: 44, x: 50, y: 0, toJSON: () => ({}) })
    fireEvent.pointerDown(barre, { button: 0, clientX: 60, pointerId: 1 })
    // Un petit mouvement reste un toucher.
    fireEvent.pointerMove(barre, { clientX: 62, pointerId: 1 })
    expect(defilement).not.toHaveBeenCalled()
    fireEvent.pointerMove(barre, { clientX: 170, pointerId: 1 })
    expect(defilement).toHaveBeenLastCalledWith({ left: surLeMois(6), behavior: "instant" })
    fireEvent.pointerUp(barre, { clientX: 170, pointerId: 1 })
    fireEvent.click(within(barre).getByRole("button", { name: "Aller à juillet" }))
    expect(defilement).toHaveBeenCalledTimes(1)
    // Le toucher suivant mène de nouveau au mois touché.
    fireEvent.pointerDown(barre, { button: 0, clientX: 60, pointerId: 2 })
    fireEvent.pointerUp(barre, { clientX: 60, pointerId: 2 })
    fireEvent.click(within(barre).getByRole("button", { name: "Aller à janvier" }))
    expect(defilement).toHaveBeenLastCalledWith({ left: surLeMois(0), behavior: "smooth" })
  })

  it("en changeant d'année, les points suivent les flux de la grille affichée", () => {
    const grille = grilleVide()
    grille[0].flows = [makeFlow()]
    const { changerDeGrille } = afficher(grille)
    expect(screen.getByRole("button", { name: "Aller à janvier, 1 flux" })).toBeInTheDocument()
    const autre = grilleVide()
    autre[4].flows = [makeFlow(), makeFlow({ id: "flow-2" })]
    changerDeGrille(autre)
    expect(screen.getByRole("button", { name: "Aller à janvier" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Aller à mai, 2 flux" })).toBeInTheDocument()
  })

  it("en changeant d'année, la grille revient sur le premier mois qui se voyait, malgré des colonnes de largeur différente", async () => {
    const defilement = espionnerLeDefilement()
    const { user, changerDeGrille } = afficher()
    await user.click(screen.getByRole("button", { name: "Aller à juillet" }))
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à juillet"]))
    changerDeGrille(grilleVide(), 2027)
    expect(defilement).toHaveBeenLastCalledWith({ left: surLeMois(6), behavior: "instant" })
    // Au début de la grille, sur le total annuel, rien ne bouge au changement d'année.
    defiler(zoneDeLaGrille(), 0)
    await waitFor(() => expect(moisCourants()).toEqual(["Aller à janvier"]))
    changerDeGrille(grilleVide(), 2028)
    expect(defilement).toHaveBeenCalledTimes(2)
  })
})
