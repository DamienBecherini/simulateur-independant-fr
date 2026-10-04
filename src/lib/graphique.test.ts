// src/lib/graphique.test.ts

import { describe, expect, it } from "vitest"
import { echelle, graduations, indiceLePlusProche, montantCourt, positionInfoBulle } from "./graphique"

describe("graduations", () => {
  it("choisit un pas rond qui couvre tout l'intervalle", () => {
    expect(graduations(0, 43300, 5)).toEqual([0, 10000, 20000, 30000, 40000, 50000])
    expect(graduations(73890, 80886, 4)).toEqual([72000, 74000, 76000, 78000, 80000, 82000])
  })

  it("prend des pas de 1, 2 ou 5 fois une puissance de 10", () => {
    expect(graduations(0, 1, 4)).toEqual([0, 0.5, 1])
    expect(graduations(0, 7, 4)).toEqual([0, 2, 4, 6, 8])
  })

  it("renvoie la seule valeur d'un intervalle vide", () => {
    expect(graduations(5, 5)).toEqual([5])
  })
})

describe("echelle", () => {
  it("envoie le domaine sur la plage, y compris inversée", () => {
    const y = echelle([0, 100], [200, 0])
    expect(y(0)).toBe(200)
    expect(y(25)).toBe(150)
    expect(y(100)).toBe(0)
  })

  it("envoie un domaine vide au début de la plage", () => {
    expect(echelle([3, 3], [10, 50])(3)).toBe(10)
  })
})

describe("indiceLePlusProche", () => {
  it("trouve l'élément le plus proche d'une valeur", () => {
    expect(indiceLePlusProche([0, 100, 200, 300], 140)).toBe(1)
    expect(indiceLePlusProche([0, 100, 200, 300], 160)).toBe(2)
    expect(indiceLePlusProche([0, 100], -50)).toBe(0)
    expect(indiceLePlusProche([0, 100], 999)).toBe(1)
  })
})

describe("montantCourt", () => {
  it("abrège les milliers", () => {
    expect(montantCourt(0)).toBe("0 €")
    expect(montantCourt(500)).toBe("500 €")
    expect(montantCourt(20000)).toBe("20 k€")
    expect(montantCourt(1500)).toBe("1,5 k€")
  })
})

describe("positionInfoBulle", () => {
  it("se place à droite du trait quand la place le permet, sinon à gauche", () => {
    expect(positionInfoBulle(100, 800, 200)).toBe(112)
    expect(positionInfoBulle(700, 800, 200)).toBe(488)
  })

  it("reste dans le cadre quand il n'y a la place d'aucun côté", () => {
    expect(positionInfoBulle(150, 300, 200)).toBe(0)
    expect(positionInfoBulle(250, 300, 200)).toBe(38)
  })
})
