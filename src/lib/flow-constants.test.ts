// src/lib/flow-constants.test.ts

import { describe, expect, it } from "vitest"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { flowTypeLabels } from "@/lib/flow-constants"
import { cn } from "@/lib/utils"
import { FinancialFlowSchema } from "@/types"

const typesDeFlux = FinancialFlowSchema.shape.type.options

describe("constantes des types de flux", () => {
  it("fournit un libellé non vide pour chaque type de flux du schéma, et aucun autre", () => {
    expect(Object.keys(flowTypeLabels).sort()).toEqual([...typesDeFlux].sort())
    expect(Object.values(flowTypeLabels).every(libelle => libelle.trim().length > 0)).toBe(true)
  })

  it("donne un libellé distinct à chaque type de flux", () => {
    const libelles = Object.values(flowTypeLabels)

    expect(new Set(libelles).size).toBe(libelles.length)
  })

  it("fournit une couleur hexadécimale pour chaque type de flux du schéma, et aucun autre", () => {
    expect(Object.keys(DEFAULT_FLOW_COLORS).sort()).toEqual([...typesDeFlux].sort())
    for (const couleur of Object.values(DEFAULT_FLOW_COLORS)) {
      expect(couleur).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("donne une couleur distincte à chaque type de flux", () => {
    const couleurs = Object.values(DEFAULT_FLOW_COLORS)

    expect(new Set(couleurs).size).toBe(couleurs.length)
  })
})

describe("cn", () => {
  it("assemble les classes en ignorant les valeurs fausses", () => {
    expect(cn("flex", false, undefined, "gap-2", { hidden: false, "font-bold": true })).toBe("flex gap-2 font-bold")
  })

  it("résout les conflits Tailwind au profit de la dernière classe", () => {
    expect(cn("p-2 text-sm", "p-4")).toBe("text-sm p-4")
  })
})
