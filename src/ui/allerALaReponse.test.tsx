// src/ui/allerALaReponse.test.tsx (dans le navigateur simulé, comme les tests de l'interface)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { allerALaReponse } from "./allerALaReponse"

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ""
  window.history.replaceState(null, "", "/")
})
afterEach(() => vi.useRealTimers())

describe("allerALaReponse", () => {
  it("attend que la zone soit affichée, ouvre les sections repliées qui la contiennent, y porte le focus et la signale un instant", () => {
    allerALaReponse("comparateur-titre")
    vi.advanceTimersByTime(300)
    document.body.innerHTML = `<details id="replie"><summary>Comparer</summary><section id="cadre"><h2 id="comparateur-titre">Comparateur</h2></section></details>`

    vi.advanceTimersByTime(500)
    expect((document.getElementById("replie") as HTMLDetailsElement).open).toBe(true)
    expect(document.getElementById("comparateur-titre")).toHaveFocus()
    expect(document.getElementById("comparateur-titre")).toHaveAttribute("tabindex", "-1")
    expect(document.getElementById("cadre")).toHaveAttribute("data-reperee")

    vi.advanceTimersByTime(2500)
    expect(document.getElementById("cadre")).not.toHaveAttribute("data-reperee")
  })

  it("dans l'affichage « Trois vues », passe par l'adresse, qui ouvre la vue de la zone", () => {
    document.body.innerHTML = `<section data-vue="comparer"><h2 id="comparateur-titre">Comparateur</h2></section>`
    allerALaReponse("comparateur-titre")
    vi.advanceTimersByTime(500)
    expect(window.location.hash).toBe("#comparateur-titre")
  })

  it("renonce sans rien faire quand la zone n'arrive pas dans les cinq secondes", () => {
    allerALaReponse("comparaison-du-couple")
    vi.advanceTimersByTime(5200)
    document.body.innerHTML = `<section id="comparaison-du-couple"></section>`
    vi.advanceTimersByTime(1000)
    expect(document.getElementById("comparaison-du-couple")).not.toHaveFocus()
    expect(document.querySelector("[data-reperee]")).toBeNull()
  })

  it("un nouvel appel remplace le précédent", () => {
    allerALaReponse("comparaison-du-couple")
    allerALaReponse("bilan")
    document.body.innerHTML = `<div id="bilan"></div><section id="comparaison-du-couple"></section>`
    vi.advanceTimersByTime(600)
    expect(document.getElementById("bilan")).toHaveFocus()
    expect(document.querySelectorAll("[data-reperee]")).toHaveLength(1)
  })
})
