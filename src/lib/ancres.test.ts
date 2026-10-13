// src/lib/ancres.test.ts

import { describe, expect, it } from "vitest"
import { ANCRES, estUneAncre, lienVers } from "./ancres"
import { VUES } from "./vues"

describe("registre des ancres de la page", () => {
  it("garde les adresses déjà publiées, chacune une seule fois", () => {
    expect(Object.values(ANCRES).sort()).toEqual(["bilan", "comparaison-du-couple", "comparateur-titre", "comparateur-verdict", "contenu", "optimisation-titre", "resultats-titre"])
    expect(new Set(Object.values(ANCRES)).size).toBe(Object.values(ANCRES).length)
  })

  it("ne prend le nom d'aucune vue : l'adresse d'une vue reste celle de la vue", () => {
    for (const { valeur } of VUES) expect(estUneAncre(valeur)).toBe(false)
  })

  it("écrit le lien d'une ancre", () => {
    expect(lienVers(ANCRES.bilan)).toBe("#bilan")
  })

  it("reconnaît les ancres du registre, et seulement elles", () => {
    expect(estUneAncre("resultats-titre")).toBe(true)
    expect(estUneAncre("resultat-titre")).toBe(false)
    expect(estUneAncre("toString")).toBe(false)
    expect(estUneAncre("")).toBe(false)
  })
})
