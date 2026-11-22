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

/** Durée de la transition du bloc, telle que la donnerait le CSS : « 0s » quand le système demande moins d'animations. */
let duree = "0.2s"

beforeEach(() => {
  duree = "0.2s"
  vi.stubGlobal("ResizeObserver", ObservateurFactice)
  // 40 px par ligne du contenu.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset.lignes ?? this.firstElementChild?.getAttribute("data-lignes") ?? 0) * 40
  })
  const vrai = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => new Proxy(vrai(element, pseudo), { get: (style, cle) => (cle === "transitionDuration" ? duree : Reflect.get(style, cle)) }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const bloc = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-hauteur-animee]")!

function rendre(lignes: number) {
  const vue = render(
    <HauteurAnimee>
      <p data-lignes={lignes} />
    </HauteurAnimee>
  )
  const passerA = (n: number) => {
    vue.rerender(
      <HauteurAnimee>
        <p data-lignes={n} />
      </HauteurAnimee>
    )
    changer()
  }
  return { bloc: bloc(vue.container), passerA }
}

describe("bloc à hauteur animée", () => {
  it("au repos, a sa hauteur naturelle : rien n'est jamais coupé", () => {
    expect(rendre(2).bloc.style.height).toBe("")
  })

  it("quand le contenu change, même tardivement (un calcul qui arrive), va de l'ancienne hauteur à la nouvelle, puis reprend sa hauteur naturelle", () => {
    const { bloc, passerA } = rendre(2)
    passerA(5)
    expect(bloc.style.height).toBe("200px")
    bloc.dispatchEvent(Object.assign(new Event("transitionend"), { propertyName: "height" }))
    expect(bloc.style.height).toBe("")
  })

  it("sans animation (le système en demande moins), garde sa hauteur naturelle", () => {
    const { bloc, passerA } = rendre(2)
    duree = "0s"
    passerA(5)
    expect(bloc.style.height).toBe("")
  })

  it("anime par une transition, seulement si le système ne demande pas moins d'animations", () => {
    const { bloc } = rendre(1)
    expect(bloc).toHaveClass("motion-safe:transition-[height]")
    expect(bloc.className).not.toMatch(/(^|\s)transition-/)
  })
})
