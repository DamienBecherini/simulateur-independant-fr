// src/ui/hooks/useListeAnimee.test.tsx

import { render } from "@testing-library/react"
import type { DragEndEvent } from "@dnd-kit/core"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useListeAnimee } from "./useListeAnimee"

const controleur = { enable: vi.fn(), disable: vi.fn(), destroy: vi.fn() }
const autoAnimate = vi.fn((element: Element, options: object) => (element && options ? controleur : controleur))
vi.mock("@formkit/auto-animate", () => ({ default: (element: Element, options: object) => autoAnimate(element, options) }))

const finDuTri = vi.fn()
const rappels: { glisser?: ReturnType<typeof useListeAnimee>[1] } = {}

function Liste({ elements }: { elements: string[] }) {
  const [ref, glisser] = useListeAnimee(finDuTri)
  useEffect(() => {
    rappels.glisser = glisser
  })
  return (
    <div ref={ref}>
      {elements.map(element => (
        <p key={element}>{element}</p>
      ))}
    </div>
  )
}

const animate = HTMLElement.prototype.animate

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("requestAnimationFrame", (rappel: FrameRequestCallback) => {
    rappel(0)
    return 0
  })
})

afterEach(() => {
  // jsdom n'a pas d'animations Web : on retire celle posée par le test.
  if (animate) HTMLElement.prototype.animate = animate
  else Reflect.deleteProperty(HTMLElement.prototype, "animate")
  vi.unstubAllGlobals()
})

describe("liste animée", () => {
  it("anime les enfants du conteneur (arrivée, départ, déplacement), puis s'arrête quand la liste disparaît", () => {
    HTMLElement.prototype.animate = vi.fn()
    const { container, unmount } = render(<Liste elements={["a", "b"]} />)
    expect(autoAnimate).toHaveBeenCalledWith(container.firstElementChild, { duration: 200, easing: "ease-out" })
    unmount()
    expect(controleur.destroy).toHaveBeenCalled()
  })

  it("s'efface pendant un glisser-déposer (dnd-kit anime l'élément déplacé) et reprend une fois le nouvel ordre posé", () => {
    HTMLElement.prototype.animate = vi.fn()
    render(<Liste elements={["a", "b"]} />)
    rappels.glisser!.onDragStart()
    expect(controleur.disable).toHaveBeenCalled()
    const evenement = { active: { id: "a" }, over: { id: "b" } } as unknown as DragEndEvent
    rappels.glisser!.onDragEnd(evenement)
    expect(finDuTri).toHaveBeenCalledWith(evenement)
    expect(controleur.enable).toHaveBeenCalled()
  })

  it("reste sans animation là où les animations Web manquent (jsdom, très vieux navigateur)", () => {
    expect(typeof document.createElement("div").animate).toBe("undefined")
    render(<Liste elements={["a"]} />)
    expect(autoAnimate).not.toHaveBeenCalled()
  })
})
