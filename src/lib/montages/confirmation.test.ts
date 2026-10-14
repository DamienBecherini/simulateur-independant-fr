// src/lib/montages/confirmation.test.ts
// La règle commune aux entrées qui chargent une situation type : confirmer seulement ce qui serait perdu.

import { describe, expect, it } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { confirmationDuMontageNecessaire } from "./confirmation"

const EXEMPLE: SessionState = { ...emptySession(), name: "Exemple", entities: [makePerson({ name: "Camille" })] }
const BROUILLON: SessionState = { ...emptySession(), name: "Mon brouillon", entities: [makePerson({ name: "Bob" })] }
const estLExemple = (session: SessionState) => session.name === EXEMPLE.name

describe("confirmationDuMontageNecessaire", () => {
  it("ne demande rien quand aucune modification n'est à perdre (simulation vide comprise)", () => {
    expect(confirmationDuMontageNecessaire(emptySession(), false)).toBe(false)
    expect(confirmationDuMontageNecessaire(BROUILLON, false, estLExemple)).toBe(false)
  })

  it("demande confirmation pour une simulation non enregistrée, avec ou sans exemple de démo connu", () => {
    expect(confirmationDuMontageNecessaire(BROUILLON, true)).toBe(true)
    expect(confirmationDuMontageNecessaire(BROUILLON, true, estLExemple)).toBe(true)
  })

  it("ne demande rien sur l'exemple de la démo resté tel quel, mais demande dès qu'il est modifié", () => {
    expect(confirmationDuMontageNecessaire(EXEMPLE, true, estLExemple)).toBe(false)
    expect(confirmationDuMontageNecessaire({ ...EXEMPLE, name: "Exemple modifié" }, true, estLExemple)).toBe(true)
  })
})
