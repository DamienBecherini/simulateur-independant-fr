// src/ui/components/HauteurAnimee.test.tsx

import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HauteurAnimee } from "./HauteurAnimee"

/** Observateur de taille factice : le test déclenche lui-même le changement de taille. */
let changer: () => void = () => {}
class ObservateurFactice {
  constructor(rappel: () => void) {
    changer = rappel
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ObservateurFactice)
  // 40 px par ligne du contenu.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset.lignes ?? this.firstElementChild?.getAttribute("data-lignes") ?? 0) * 40
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const bloc = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-hauteur-animee]")!

describe("bloc à hauteur animée", () => {
  it("prend la hauteur de son contenu, puis la suit à chaque changement, même tardif (un calcul qui arrive)", () => {
    const { container, rerender } = render(
      <HauteurAnimee>
        <p data-lignes="2" />
      </HauteurAnimee>
    )
    expect(bloc(container).style.height).toBe("80px")
    rerender(
      <HauteurAnimee>
        <p data-lignes="5" />
      </HauteurAnimee>
    )
    changer()
    expect(bloc(container).style.height).toBe("200px")
  })

  it("anime par une transition, seulement si le système ne demande pas moins d'animations", () => {
    const { container } = render(
      <HauteurAnimee>
        <p data-lignes="1" />
      </HauteurAnimee>
    )
    expect(bloc(container)).toHaveClass("motion-safe:transition-[height]")
    expect(bloc(container).className).not.toMatch(/(^|\s)transition-/)
  })
})
