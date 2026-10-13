// src/ui/hooks/useEncartDesQuestions.test.tsx

import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ANCRES } from "@/lib/ancres"
import type { SessionState, UserPreferences } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { PLATEFORME_DE_BUREAU, PlateformeContext, type Plateforme } from "../plateforme"
import { useEncartDesQuestions } from "./useEncartDesQuestions"
import type { Vues } from "./useVues"

const PREFERENCES: UserPreferences = { slotOrder: [] }

function monter(session: SessionState, { vues = null, plateforme = PLATEFORME_DE_BUREAU, preferences = PREFERENCES }: { vues?: Vues | null; plateforme?: Plateforme; preferences?: UserPreferences } = {}) {
  const actions = { setPreferences: vi.fn(), reinitialiser: vi.fn() }
  const avecLaPlateforme = ({ children }: { children: ReactNode }) => <PlateformeContext value={plateforme}>{children}</PlateformeContext>
  const { result } = renderHook(() => useEncartDesQuestions({ session, sessionChargee: true, preferences, vues, ...actions }), { wrapper: avecLaPlateforme })
  return { encart: result.current, ...actions }
}

describe("useEncartDesQuestions", () => {
  it("affiche l'encart sur une simulation vide, ou sur l'exemple que reconnaît la plateforme, tant qu'il n'est pas fermé", () => {
    const remplie = { ...emptySession(), name: "Exemple", entities: [makePerson()] }
    expect(monter(emptySession()).encart.affiche).toBe(true)
    expect(monter(remplie).encart.affiche).toBe(false)
    expect(monter(remplie, { plateforme: { ...PLATEFORME_DE_BUREAU, estLaSessionDExemple: s => s.name === "Exemple" } }).encart.affiche).toBe(true)
    expect(monter(emptySession(), { preferences: { ...PREFERENCES, questionsFermees: true } }).encart.affiche).toBe(false)
  })

  it("« Partir de zéro » vide une simulation remplie, et seulement elle, puis affiche la saisie dans sa vue", () => {
    const vues: Vues = { vue: "comparer", choisir: vi.fn() }
    const vide = monter(emptySession(), { vues })
    vide.encart.partirDeZero()
    expect(vide.reinitialiser).not.toHaveBeenCalled()
    expect(vues.choisir).toHaveBeenCalledWith("situation", true)

    const remplie = monter({ ...emptySession(), entities: [makePerson()] })
    remplie.encart.partirDeZero()
    expect(remplie.reinitialiser).toHaveBeenCalledTimes(1)
  })

  it("la fermeture est retenue dans les préférences, et le focus passe au contenu", () => {
    const contenu = document.createElement("main")
    contenu.id = ANCRES.contenu
    contenu.tabIndex = -1
    document.body.append(contenu)
    const { encart, setPreferences } = monter(emptySession())

    encart.fermer()
    const miseAJour = setPreferences.mock.lastCall![0] as (prefs: UserPreferences) => UserPreferences
    expect(miseAJour(PREFERENCES)).toEqual({ ...PREFERENCES, questionsFermees: true })
    expect(contenu).toHaveFocus()
    contenu.remove()
  })
})
