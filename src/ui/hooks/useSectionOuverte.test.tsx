// src/ui/hooks/useSectionOuverte.test.tsx

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { describe, expect, it } from "vitest"
import type { UserPreferences } from "@/types"
import { MemoireDesSectionsContext, proprietesDeDetails, useMemoireDesSections, useSectionOuverte } from "./useSectionOuverte"
import { Depliable } from "../components/Depliable"
import { deplierPourImpression } from "../impression"

/** Fournit la mémoire des sections, rangée dans de vraies préférences ; `suivre` reçoit les préférences à chaque rendu. */
function AvecPreferences({ initiales, suivre, children }: { initiales: UserPreferences; suivre?: (preferences: UserPreferences) => void; children: ReactNode }) {
  const [preferences, setPreferences] = useState(initiales)
  const memoire = useMemoireDesSections(preferences.sectionsOuvertes, setPreferences)
  suivre?.(preferences)
  return <MemoireDesSectionsContext.Provider value={memoire}>{children}</MemoireDesSectionsContext.Provider>
}

/** Bascule une section comme le ferait le navigateur : l'attribut change, puis l'événement `toggle` est émis. */
function basculer(details: HTMLDetailsElement, ouverte: boolean) {
  act(() => {
    details.open = ouverte
    fireEvent(details, new Event("toggle"))
  })
}

const section = (titre: string) => screen.getByText(titre).closest("details")!

describe("useSectionOuverte", () => {
  it("garde son état pour elle seule hors de tout fournisseur", () => {
    const { result } = renderHook(() => useSectionOuverte("legende", true))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
  })

  it("lit et retient l'état dans les préférences, par identifiant", () => {
    let preferences: UserPreferences = { slotOrder: [] }
    const { result } = renderHook(() => [useSectionOuverte("legende"), useSectionOuverte("detail", true)] as const, {
      wrapper: ({ children }) => (
        <AvecPreferences initiales={{ slotOrder: [], sectionsOuvertes: { legende: true } }} suivre={p => (preferences = p)}>
          {children}
        </AvecPreferences>
      )
    })
    expect(result.current[0][0]).toBe(true)
    expect(result.current[1][0]).toBe(true)

    act(() => result.current[1][1](false))

    expect(result.current[1][0]).toBe(false)
    expect(preferences.sectionsOuvertes).toEqual({ legende: true, detail: false })
  })

  it("pilote un élément <details> et retient la bascule faite par le navigateur", () => {
    function Section() {
      const [ouverte, definir] = useSectionOuverte("pilotee")
      return (
        <details {...proprietesDeDetails(ouverte, definir)}>
          <summary>Pilotée</summary>
        </details>
      )
    }
    let preferences: UserPreferences = { slotOrder: [] }
    render(
      <AvecPreferences initiales={{ slotOrder: [] }} suivre={p => (preferences = p)}>
        <Section />
      </AvecPreferences>
    )
    expect(section("Pilotée").open).toBe(false)

    basculer(section("Pilotée"), true)

    expect(preferences.sectionsOuvertes).toEqual({ pilotee: true })
    expect(section("Pilotée").open).toBe(true)
  })
})

describe("Depliable retenue", () => {
  function Legende({ initiales, suivre }: { initiales: UserPreferences; suivre?: (preferences: UserPreferences) => void }) {
    return (
      <AvecPreferences initiales={initiales} suivre={suivre}>
        <Depliable titre="Légende" id="legende">
          contenu
        </Depliable>
      </AvecPreferences>
    )
  }

  it("ouvre la section retenue ouverte", () => {
    render(<Legende initiales={{ slotOrder: [], sectionsOuvertes: { legende: true } }} />)
    expect(section("Légende").open).toBe(true)
  })

  it("laisse fermée une section sans état retenu", () => {
    render(<Legende initiales={{ slotOrder: [] }} />)
    expect(section("Légende").open).toBe(false)
  })

  it("retient chaque bascule de la section", () => {
    let preferences: UserPreferences = { slotOrder: [] }
    render(<Legende initiales={{ slotOrder: [] }} suivre={p => (preferences = p)} />)

    basculer(section("Légende"), true)
    expect(preferences.sectionsOuvertes).toEqual({ legende: true })

    basculer(section("Légende"), false)
    expect(preferences.sectionsOuvertes).toEqual({ legende: false })
  })

  it("ne retient pas les bascules d'une section imbriquée sans identifiant", () => {
    let preferences: UserPreferences = { slotOrder: [] }
    render(
      <AvecPreferences initiales={{ slotOrder: [] }} suivre={p => (preferences = p)}>
        <Depliable titre="Légende" id="legende">
          <Depliable titre="Imbriquée">contenu</Depliable>
        </Depliable>
      </AvecPreferences>
    )

    basculer(section("Imbriquée"), true)

    expect(preferences.sectionsOuvertes).toBeUndefined()
  })

  it("dépliée pour l'impression, la section retrouve ensuite son état, qui reste celui retenu", () => {
    let preferences: UserPreferences = { slotOrder: [] }
    render(<Legende initiales={{ slotOrder: [], sectionsOuvertes: { legende: false } }} suivre={p => (preferences = p)} />)

    let replier = () => {}
    act(() => {
      replier = deplierPourImpression()
    })
    expect(section("Légende").open).toBe(true)
    act(() => replier())

    expect(section("Légende").open).toBe(false)
    expect(preferences.sectionsOuvertes).toEqual({ legende: false })
  })
})
