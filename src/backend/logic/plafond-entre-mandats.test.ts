// src/backend/logic/plafond-entre-mandats.test.ts

import { describe, expect, it } from "vitest"
import { brutPourUnNet } from "./cotisationsSalarie.js"
import { avecUnePartDuPlafond, partsDuPlafond } from "./plafond-entre-mandats.js"
import { REGLES_DES_CAS } from "./testing/cas-de-reference.js"

const regles = REGLES_DES_CAS.regimeGeneral

describe("partsDuPlafond", () => {
  it("laisse le plafond entier à un seul mandat rémunéré", () => {
    expect(partsDuPlafond([40000], regles)).toEqual([1])
    expect(partsDuPlafond([40000, 0], regles)).toEqual([1, 1])
  })

  it("répartit le plafond à parts égales entre deux rémunérations égales", () => {
    expect(partsDuPlafond([40000, 40000], regles)).toEqual([0.5, 0.5])
  })

  it("répartit le plafond au prorata des bruts, eux-mêmes calculés avec leur part du plafond", () => {
    const parts = partsDuPlafond([60000, 20000], regles)
    expect(parts[0] + parts[1]).toBeCloseTo(1, 10)
    const bruts = [60000, 20000].map((net, rang) => brutPourUnNet(net, "president", avecUnePartDuPlafond(regles, parts[rang])))
    expect(parts[0]).toBeCloseTo(bruts[0] / (bruts[0] + bruts[1]), 4)
    expect(parts[0]).toBeGreaterThan(0.74)
    expect(parts[0]).toBeLessThan(0.76)
  })

  it("ne change pas les règles d'un plafond entier", () => {
    expect(avecUnePartDuPlafond(regles, 1)).toBe(regles)
    expect(avecUnePartDuPlafond(regles, 0.25).plafondSecuriteSociale).toBe(regles.plafondSecuriteSociale / 4)
  })
})
