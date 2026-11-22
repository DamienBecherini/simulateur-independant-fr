// src/lib/defilement.test.ts

import { describe, expect, it } from "vitest"
import { defilementDUnPas, defilementPourMontrer, etatDuDefilement, memeDefilement, type GeometrieDeLaZone } from "./defilement"

const zone = (extrait: Partial<GeometrieDeLaZone> = {}): GeometrieDeLaZone => ({ defilement: 0, largeurVisible: 500, largeurTotale: 1200, colonneFixe: 100, ...extrait })

describe("état du défilement d'un tableau", () => {
  it("ne déborde pas quand le contenu tient dans la zone, au pixel près", () => {
    expect(etatDuDefilement(zone({ largeurTotale: 500 }))).toEqual({ deborde: false, auDebut: true, aLaFin: true, colonneFixe: 100 })
    expect(etatDuDefilement(zone({ largeurTotale: 501 })).deborde).toBe(false)
    expect(etatDuDefilement(zone({ largeurTotale: 502 })).deborde).toBe(true)
  })

  it("au début, seules les colonnes de droite sont cachées ; à la fin, seules celles de gauche ; au milieu, les deux", () => {
    expect(etatDuDefilement(zone())).toMatchObject({ deborde: true, auDebut: true, aLaFin: false })
    expect(etatDuDefilement(zone({ defilement: 300 }))).toMatchObject({ auDebut: false, aLaFin: false })
    expect(etatDuDefilement(zone({ defilement: 700 }))).toMatchObject({ auDebut: false, aLaFin: true })
    // Un défilement fractionnaire, à moins d'un pixel du bout, est au bout.
    expect(etatDuDefilement(zone({ defilement: 699.4 })).aLaFin).toBe(true)
    expect(etatDuDefilement(zone({ defilement: 0.6 })).auDebut).toBe(true)
  })

  it("compare deux états", () => {
    expect(memeDefilement(etatDuDefilement(zone()), etatDuDefilement(zone({ defilement: 0.5 })))).toBe(true)
    expect(memeDefilement(etatDuDefilement(zone()), etatDuDefilement(zone({ defilement: 300 })))).toBe(false)
    expect(memeDefilement(etatDuDefilement(zone()), etatDuDefilement(zone({ colonneFixe: 120 })))).toBe(false)
  })
})

describe("pas d'un clic sur une flèche", () => {
  it("avance des quatre cinquièmes de ce qui se voit à côté de la colonne fixe", () => {
    expect(defilementDUnPas(zone(), 1)).toBe(320)
    expect(defilementDUnPas(zone({ defilement: 400 }), -1)).toBe(80)
  })

  it("s'arrête aux deux bouts", () => {
    expect(defilementDUnPas(zone({ defilement: 600 }), 1)).toBe(700)
    expect(defilementDUnPas(zone({ defilement: 100 }), -1)).toBe(0)
  })

  it("avance d'au moins 96 px quand presque rien ne se voit à côté de la colonne fixe", () => {
    expect(defilementDUnPas(zone({ largeurVisible: 160 }), 1)).toBe(96)
  })
})

describe("défilement qui montre une colonne", () => {
  it("ne bouge pas quand la colonne est déjà entièrement visible, à droite de la colonne fixe", () => {
    expect(defilementPourMontrer(zone(), { gauche: 100, droite: 300 })).toBeNull()
    expect(defilementPourMontrer(zone({ defilement: 200 }), { gauche: 300, droite: 700 })).toBeNull()
  })

  it("amène une colonne cachée à droite juste après la colonne fixe", () => {
    expect(defilementPourMontrer(zone(), { gauche: 700, droite: 850 })).toBe(600)
    // En partie cachée : elle aussi.
    expect(defilementPourMontrer(zone(), { gauche: 400, droite: 560 })).toBe(300)
  })

  it("ramène une colonne passée sous la colonne fixe", () => {
    expect(defilementPourMontrer(zone({ defilement: 500 }), { gauche: 200, droite: 350 })).toBe(100)
  })

  it("ne dépasse pas la fin du tableau", () => {
    expect(defilementPourMontrer(zone(), { gauche: 1050, droite: 1200 })).toBe(700)
  })
})
