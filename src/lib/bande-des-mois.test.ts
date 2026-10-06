// src/lib/bande-des-mois.test.ts

import { describe, expect, it } from "vitest"
import { aLaFin, auDebut, deborde, defilementMaximal, defilementPourLaPosition, defilementPourLeMois, defilementVoisin, moisVisibles, nomDuMoisDeLaBande, type GeometrieDeLaGrille } from "./bande-des-mois"

// Grille d'un téléphone de 320 px : première colonne fixe de 96 px, total annuel de 104 px, douze mois de 150 px
// (janvier commence à 200 px), dans une zone de 240 px de large.
const COLONNE_FIXE = 96
const DEBUT_DE_JANVIER = 200
const LARGEUR_DU_MOIS = 150
const mois = Array.from({ length: 12 }, (_, index) => ({ gauche: DEBUT_DE_JANVIER + index * LARGEUR_DU_MOIS, largeur: LARGEUR_DU_MOIS }))
const LARGEUR_TOTALE = DEBUT_DE_JANVIER + 12 * LARGEUR_DU_MOIS

const grille = (defilement: number, largeurVisible = 240): GeometrieDeLaGrille => ({ defilement, largeurVisible, largeurTotale: LARGEUR_TOTALE, colonneFixe: COLONNE_FIXE, mois })
/** Défilement qui place le bord gauche d'un mois juste après la colonne fixe. */
const surLeMois = (index: number) => mois[index].gauche - COLONNE_FIXE

describe("bande des mois : mois visibles", () => {
  it("au début, le total annuel occupe la place : janvier, à peine entamé, marque seul la position", () => {
    // Zone de 96 à 240 px : le total annuel (96-200) puis 40 px de janvier, moins de la moitié de sa colonne.
    // Sans aucun mois en vue, rien n'est marqué.
    expect(moisVisibles(grille(0))).toEqual([0])
    expect(moisVisibles({ ...grille(0), largeurVisible: 190 })).toEqual([])
  })

  it("un mois aligné sur la colonne fixe est visible, le suivant aussi s'il se voit à moitié", () => {
    expect(moisVisibles(grille(surLeMois(6)))).toEqual([6])
    // Zone plus large (375 px) : juillet en entier, puis 129 px d'août sur 150.
    expect(moisVisibles(grille(surLeMois(6), 375))).toEqual([6, 7])
  })

  it("un mois coupé par le bord reste visible tant que la moitié de sa colonne se voit", () => {
    expect(moisVisibles(grille(surLeMois(2) + 70, 400))).toEqual([2, 3])
    expect(moisVisibles(grille(surLeMois(2) + 80, 400))).toEqual([3, 4])
  })

  it("une colonne plus large que la zone est visible dès qu'elle occupe la moitié de la place", () => {
    const etroite = grille(surLeMois(4) + 100, 160)
    // Place de 64 px après la colonne fixe, entièrement occupée par mai.
    expect(moisVisibles(etroite)).toEqual([4])
  })

  it("sur un grand écran, plusieurs mois se voient en même temps", () => {
    expect(moisVisibles({ ...grille(0, 1168) })).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe("bande des mois : défilement", () => {
  it("la grille déborde quand son contenu dépasse la zone", () => {
    expect(deborde(grille(0))).toBe(true)
    expect(deborde({ largeurVisible: 500, largeurTotale: 500.5 })).toBe(false)
  })

  it("un mois vient juste après la colonne fixe, dans les limites du défilement", () => {
    expect(defilementPourLeMois(grille(0), 6)).toBe(surLeMois(6))
    expect(defilementPourLeMois(grille(0), 0)).toBe(surLeMois(0))
    // Décembre ne peut pas venir contre la colonne fixe : la zone s'arrête au bout de la grille.
    expect(defilementPourLeMois(grille(0, 400), 11)).toBe(defilementMaximal(grille(0, 400)))
    expect(defilementPourLeMois(grille(0, 400), 42)).toBe(defilementMaximal(grille(0, 400)))
    // Colonne fixe plus large que l'écart avant janvier : pas de défilement négatif.
    expect(defilementPourLeMois({ ...grille(0), colonneFixe: 300 }, -1)).toBe(0)
  })

  it("début et fin de la zone, à un pixel près", () => {
    expect(auDebut(grille(0.5))).toBe(true)
    expect(auDebut(grille(2))).toBe(false)
    const max = defilementMaximal(grille(0))
    expect(aLaFin(grille(max - 0.5))).toBe(true)
    expect(aLaFin(grille(max - 2))).toBe(false)
    expect(defilementMaximal({ ...grille(0), largeurTotale: 100 })).toBe(0)
  })

  it("mois suivant : du total annuel à janvier, puis de mois en mois", () => {
    expect(defilementVoisin(grille(0), 1)).toBe(surLeMois(0))
    expect(defilementVoisin(grille(surLeMois(0)), 1)).toBe(surLeMois(1))
    // Au milieu de mars, le mois suivant est avril.
    expect(defilementVoisin(grille(surLeMois(2) + 70), 1)).toBe(surLeMois(3))
    // Décembre aligné avant le bout de la grille : le mois suivant mène au bout.
    expect(defilementVoisin(grille(surLeMois(11)), 1)).toBe(defilementMaximal(grille(0)))
  })

  it("mois précédent : un mois coupé est d'abord montré en entier, puis le précédent ; avant janvier, le début", () => {
    expect(defilementVoisin(grille(surLeMois(3)), -1)).toBe(surLeMois(2))
    expect(defilementVoisin(grille(surLeMois(2) + 70), -1)).toBe(surLeMois(2))
    expect(defilementVoisin(grille(surLeMois(0)), -1)).toBe(0)
    expect(defilementVoisin(grille(surLeMois(0) - 50), -1)).toBe(0)
    expect(defilementVoisin(grille(surLeMois(0) + 50), -1)).toBe(surLeMois(0))
  })

  it("le long de la bande, une position désigne un point de la grille", () => {
    expect(defilementPourLaPosition(grille(0), 0)).toBe(surLeMois(0))
    expect(defilementPourLaPosition(grille(0), 0.5)).toBe(surLeMois(6))
    // Au quart de mars (position 2,25 mois sur 12).
    expect(defilementPourLaPosition(grille(0), 2.25 / 12)).toBe(surLeMois(2) + LARGEUR_DU_MOIS / 4)
    expect(defilementPourLaPosition(grille(0), 1)).toBe(defilementMaximal(grille(0)))
    expect(defilementPourLaPosition(grille(0), -3)).toBe(surLeMois(0))
    expect(defilementPourLaPosition({ ...grille(0), colonneFixe: 300 }, 0)).toBe(0)
  })
})

describe("bande des mois : noms des mois", () => {
  it("le nom dit où mène le bouton, et combien de flux compte le mois", () => {
    expect(nomDuMoisDeLaBande("Mars", 0)).toBe("Aller à mars")
    expect(nomDuMoisDeLaBande("Juillet", 3)).toBe("Aller à juillet, 3 flux")
    expect(nomDuMoisDeLaBande("Août", 1)).toBe("Aller à août, 1 flux")
  })
})
