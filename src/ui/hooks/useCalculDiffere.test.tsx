// src/ui/hooks/useCalculDiffere.test.tsx

import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DELAI_DU_CALCUL, useCalculDiffere } from "./useCalculDiffere"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Avance l'horloge et laisse se résoudre la promesse du calcul. */
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

interface Props {
  calcul: () => Promise<number>
  actif?: boolean
  effacerEnCasDEchec?: boolean
}

function monter(props: Props) {
  return renderHook(({ calcul, actif, effacerEnCasDEchec }: Props) => useCalculDiffere(calcul, { echec: "Le calcul a échoué.", actif, effacerEnCasDEchec }), { initialProps: props })
}

describe("useCalculDiffere", () => {
  it("calcule une fois le délai écoulé, pas avant", async () => {
    const calcul = vi.fn(async () => 42)
    const { result } = monter({ calcul })
    expect(result.current).toEqual({ resultat: null, erreur: null })

    await avancer(DELAI_DU_CALCUL - 1)
    expect(calcul).not.toHaveBeenCalled()
    await avancer(1)
    expect(calcul).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ resultat: 42, erreur: null })
  })

  it("d'une rafale de changements, ne lance que le dernier calcul", async () => {
    const premier = vi.fn(async () => 1)
    const dernier = vi.fn(async () => 2)
    const { result, rerender } = monter({ calcul: premier })
    await avancer(DELAI_DU_CALCUL / 2)
    rerender({ calcul: dernier })
    await avancer(DELAI_DU_CALCUL)

    expect(premier).not.toHaveBeenCalled()
    expect(dernier).toHaveBeenCalledTimes(1)
    expect(result.current.resultat).toBe(2)
  })

  it("ignore le résultat d'un calcul dépassé par un changement survenu pendant qu'il tournait", async () => {
    let terminer: (valeur: number) => void = () => {}
    const lent = () => new Promise<number>(resolve => (terminer = resolve))
    const { result, rerender } = monter({ calcul: lent })
    await avancer(DELAI_DU_CALCUL)
    rerender({ calcul: async () => 2 })
    await act(async () => terminer(1))
    expect(result.current.resultat).toBeNull()

    await avancer(DELAI_DU_CALCUL)
    expect(result.current.resultat).toBe(2)
  })

  it("en cas d'échec, garde par défaut le dernier résultat avec le message de l'erreur", async () => {
    const { result, rerender } = monter({ calcul: async () => 1 })
    await avancer(DELAI_DU_CALCUL)
    rerender({ calcul: () => Promise.reject(new Error("Session invalide")) })
    await avancer(DELAI_DU_CALCUL)
    expect(result.current).toEqual({ resultat: 1, erreur: "Session invalide" })

    // Un calcul réussi efface l'erreur.
    rerender({ calcul: async () => 3 })
    await avancer(DELAI_DU_CALCUL)
    expect(result.current).toEqual({ resultat: 3, erreur: null })
  })

  it("efface aussi le dernier résultat quand on le demande, et nomme l'échec d'une valeur qui n'est pas une erreur", async () => {
    const { result, rerender } = monter({ calcul: async () => 1, effacerEnCasDEchec: true })
    await avancer(DELAI_DU_CALCUL)
    rerender({ calcul: () => Promise.reject("panne"), effacerEnCasDEchec: true })
    await avancer(DELAI_DU_CALCUL)
    expect(result.current).toEqual({ resultat: null, erreur: "Le calcul a échoué." })
  })

  it("inactif, ne calcule rien et garde le dernier résultat ; réactivé, recalcule", async () => {
    const calcul = vi.fn(async () => 5)
    const { result, rerender } = monter({ calcul, actif: false })
    await avancer(DELAI_DU_CALCUL * 2)
    expect(calcul).not.toHaveBeenCalled()
    expect(result.current.resultat).toBeNull()

    rerender({ calcul, actif: true })
    await avancer(DELAI_DU_CALCUL)
    expect(result.current.resultat).toBe(5)
    rerender({ calcul: async () => 6, actif: false })
    await avancer(DELAI_DU_CALCUL)
    expect(result.current.resultat).toBe(5)
  })

  it("démonté, n'appelle pas le calcul en attente", async () => {
    const calcul = vi.fn(async () => 1)
    const { unmount } = monter({ calcul })
    unmount()
    await avancer(DELAI_DU_CALCUL)
    expect(calcul).not.toHaveBeenCalled()
  })
})
