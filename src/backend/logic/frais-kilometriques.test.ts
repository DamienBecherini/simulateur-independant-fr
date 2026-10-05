// src/backend/logic/frais-kilometriques.test.ts

import { describe, expect, it } from "vitest"
import { distanceDomicileTravail, montantBaremeKilometrique } from "./frais-kilometriques.js"
import { reglesDeTest } from "./testing/regles-de-test.js"

const bareme = reglesDeTest.baremeKilometrique
const thermique3 = { puissanceFiscale: "3", electrique: false } as const
const thermique5 = { puissanceFiscale: "5", electrique: false } as const

describe("montantBaremeKilometrique", () => {
  it("applique la première tranche jusqu'à 5 000 km compris", () => {
    expect(montantBaremeKilometrique(1000, thermique3, bareme)).toBeCloseTo(500, 6)
    expect(montantBaremeKilometrique(5000, thermique3, bareme)).toBeCloseTo(2500, 6)
  })

  it("applique la deuxième tranche, avec son forfait, de 5 001 à 20 000 km", () => {
    expect(montantBaremeKilometrique(5001, thermique3, bareme)).toBeCloseTo(5001 * 0.3 + 1000, 6)
    expect(montantBaremeKilometrique(10000, thermique3, bareme)).toBeCloseTo(4000, 6)
    expect(montantBaremeKilometrique(20000, thermique3, bareme)).toBeCloseTo(7000, 6)
  })

  it("applique la dernière tranche au-delà de 20 000 km", () => {
    expect(montantBaremeKilometrique(20001, thermique3, bareme)).toBeCloseTo(20001 * 0.35, 6)
    expect(montantBaremeKilometrique(30000, thermique3, bareme)).toBeCloseTo(10500, 6)
  })

  it("lit la ligne de la puissance fiscale", () => {
    expect(montantBaremeKilometrique(10000, thermique5, bareme)).toBeCloseTo(5000, 6)
  })

  it("majore de 20 % le montant d'un véhicule électrique", () => {
    expect(montantBaremeKilometrique(10000, { ...thermique5, electrique: true }, bareme)).toBeCloseTo(6000, 6)
  })

  it("vaut zéro sans distance, ou pour une distance négative ou invalide", () => {
    expect(montantBaremeKilometrique(0, thermique3, bareme)).toBe(0)
    expect(montantBaremeKilometrique(-100, thermique3, bareme)).toBe(0)
    expect(montantBaremeKilometrique(Number.NaN, thermique3, bareme)).toBe(0)
  })
})

describe("distanceDomicileTravail", () => {
  const regles = bareme.domicileTravail

  it("compte un aller-retour par jour travaillé", () => {
    expect(distanceDomicileTravail({ kmParTrajet: 20, joursTravailles: 200, distanceJustifiee: false }, regles)).toBe(8000)
  })

  it("limite chaque trajet à 40 km, sauf distance justifiée", () => {
    expect(distanceDomicileTravail({ kmParTrajet: 60, joursTravailles: 100, distanceJustifiee: false }, regles)).toBe(8000)
    expect(distanceDomicileTravail({ kmParTrajet: 60, joursTravailles: 100, distanceJustifiee: true }, regles)).toBe(12000)
    expect(distanceDomicileTravail({ kmParTrajet: 40, joursTravailles: 100, distanceJustifiee: false }, regles)).toBe(8000)
  })

  it("ignore les valeurs négatives", () => {
    expect(distanceDomicileTravail({ kmParTrajet: -5, joursTravailles: 100, distanceJustifiee: false }, regles)).toBe(0)
    expect(distanceDomicileTravail({ kmParTrajet: 5, joursTravailles: -1, distanceJustifiee: false }, regles)).toBe(0)
  })
})
