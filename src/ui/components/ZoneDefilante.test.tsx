// src/ui/components/ZoneDefilante.test.tsx
// Zone d'un tableau qui défile en largeur. jsdom ne met rien en page : la géométrie est simulée (zone de 400 px,
// contenu de 1 000 px, première colonne fixe de 120 px).

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ZoneDefilante } from "./ZoneDefilante"

const ecran = { largeurVisible: 400, largeurTotale: 1000, defilement: 0 }
const estLaZone = (element: Element) => element.getAttribute("role") === "region"

beforeEach(() => {
  Object.assign(ecran, { largeurVisible: 400, largeurTotale: 1000, defilement: 0 })
  vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? ecran.largeurVisible : 0
  })
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? ecran.largeurTotale : 0
  })
  vi.spyOn(Element.prototype, "scrollLeft", "get").mockImplementation(function (this: Element) {
    return estLaZone(this) ? ecran.defilement : 0
  })
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.tagName === "TH" ? 120 : 0
  })
})

/** Espionne les défilements demandés et les applique, comme le ferait le navigateur. */
function espionnerLeDefilement() {
  return vi.spyOn(Element.prototype, "scrollTo").mockImplementation(function (this: Element, options?: ScrollToOptions | number) {
    if (typeof options !== "object" || options.left === undefined) return
    ecran.defilement = options.left
    act(() => {
      this.dispatchEvent(new Event("scroll"))
    })
  })
}

function afficher(colonneFixe = true) {
  render(
    <ZoneDefilante libelle="Tableau d'essai" className="rounded-lg border">
      <table>
        <thead>
          <tr>
            <th style={colonneFixe ? { position: "sticky" } : undefined}>Indicateur</th>
            <th>SASU</th>
          </tr>
        </thead>
      </table>
    </ZoneDefilante>
  )
  return { user: userEvent.setup(), zone: screen.getByRole("region", { name: "Tableau d'essai" }) }
}

const ombre = (cote: string) => document.querySelector(`[data-ombre="${cote}"]`)
const fleche = (cote: "gauche" | "droite") => screen.queryByRole("button", { name: `Voir les colonnes de ${cote}`, hidden: true })

describe("zone d'un tableau qui défile", () => {
  it("est une région nommée qui prend le focus, habillée par son cadre", () => {
    const { zone } = afficher()
    expect(zone).toHaveAttribute("tabindex", "0")
    expect(zone.parentElement).toHaveClass("relative", "rounded-lg", "border")
  })

  it("n'a ni ombre ni flèche quand le tableau tient dans sa zone", () => {
    ecran.largeurTotale = 400
    afficher()
    expect(document.querySelector("[data-ombre]")).toBeNull()
    expect(fleche("droite")).not.toBeInTheDocument()
  })

  it("au début, montre l'ombre et la flèche de droite seulement", () => {
    afficher()
    expect(ombre("droite")).toHaveClass("opacity-100")
    expect(ombre("gauche")).toHaveClass("opacity-0")
    expect(fleche("droite")).not.toHaveClass("invisible")
    expect(fleche("gauche")).toHaveClass("invisible")
  })

  it("commence l'ombre de gauche après la première colonne quand elle est fixe, au bord sinon", () => {
    afficher()
    expect(ombre("gauche")).toHaveStyle({ left: "120px" })
    expect(ombre("gauche")).toHaveAttribute("aria-hidden", "true")
  })

  it("commence l'ombre de gauche au bord quand la première colonne défile avec les autres", () => {
    afficher(false)
    expect(ombre("gauche")).toHaveStyle({ left: "0px" })
  })

  it("fait défiler d'un clic sur une flèche, jusqu'au bout, où la flèche disparaît", async () => {
    const defilement = espionnerLeDefilement()
    const { user } = afficher()
    // Quatre cinquièmes de ce qui se voit à côté de la colonne fixe : (400 - 120) × 0,8.
    await user.click(fleche("droite")!)
    expect(defilement).toHaveBeenLastCalledWith({ left: 224, behavior: "smooth" })
    // L'état est mesuré une fois par image.
    await waitFor(() => expect(fleche("gauche")).not.toHaveClass("invisible"))
    expect(ombre("gauche")).toHaveClass("opacity-100")

    await user.click(fleche("droite")!)
    await user.click(fleche("droite")!)
    expect(ecran.defilement).toBe(600)
    await waitFor(() => expect(fleche("droite")).toHaveClass("invisible"))
    expect(ombre("droite")).toHaveClass("opacity-0")

    await user.click(fleche("gauche")!)
    expect(ecran.defilement).toBe(376)
  })

  it("laisse les flèches hors de l'ordre de tabulation : la zone défile au clavier", () => {
    afficher()
    expect(fleche("droite")).toHaveAttribute("tabindex", "-1")
    expect(fleche("gauche")).toHaveAttribute("tabindex", "-1")
  })

  it("suit le défilement fait à la main", () => {
    const { zone } = afficher()
    ecran.defilement = 300
    act(() => {
      zone.dispatchEvent(new Event("scroll"))
    })
    return waitFor(() => expect(fleche("gauche")).not.toHaveClass("invisible"))
  })
})
