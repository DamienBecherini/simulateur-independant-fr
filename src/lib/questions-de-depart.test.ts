// src/lib/questions-de-depart.test.ts

import { describe, expect, it } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { avecLesQuestions } from "./questions-de-depart"

const VIDE = emptySession()
const SIMULATION: SessionState = { ...emptySession(), name: "Ma simulation", entities: [makePerson()] }
const EXEMPLE: SessionState = { ...SIMULATION, name: "Exemple" }
const estLExemple = (session: SessionState) => session.name === "Exemple"

describe("avecLesQuestions : quand s'affiche l'encart « Que voulez-vous savoir ? »", () => {
  it("sur une simulation vide", () => {
    expect(avecLesQuestions(VIDE, undefined, true)).toBe(true)
    expect(avecLesQuestions(VIDE, false, true, estLExemple)).toBe(true)
  })

  it("sur l'exemple du premier lancement de la démo, et sur lui seul parmi les simulations remplies", () => {
    expect(avecLesQuestions(EXEMPLE, undefined, true, estLExemple)).toBe(true)
    expect(avecLesQuestions(SIMULATION, undefined, true, estLExemple)).toBe(false)
    // Sans démo, aucune simulation remplie n'est un exemple.
    expect(avecLesQuestions(EXEMPLE, undefined, true)).toBe(false)
  })

  it("jamais une fois fermé par l'utilisateur", () => {
    expect(avecLesQuestions(VIDE, true, true)).toBe(false)
    expect(avecLesQuestions(EXEMPLE, true, true, estLExemple)).toBe(false)
  })

  it("jamais avant le chargement de la session et des préférences", () => {
    expect(avecLesQuestions(VIDE, undefined, false)).toBe(false)
  })
})
