// src/lib/regles-affichees.test.ts

import { describe, expect, it } from "vitest"
import { ANNEE_COURANTE, reglesPubliees } from "@/backend/logic/regles"
import { reglesDeLAnneeAffichee } from "./regles-affichees"

describe("règles d'une année affichée", () => {
  it("celles de l'année, les dernières connues au-delà, les premières connues avant", () => {
    expect(reglesDeLAnneeAffichee(2025)).toBe(reglesPubliees(2025))
    expect(reglesDeLAnneeAffichee(ANNEE_COURANTE + 14)).toBe(reglesPubliees(ANNEE_COURANTE))
    expect(reglesDeLAnneeAffichee(2010)).toBe(reglesPubliees(2024))
  })
})
