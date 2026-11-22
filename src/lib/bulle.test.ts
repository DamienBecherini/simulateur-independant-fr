// src/lib/bulle.test.ts

import { describe, expect, it } from "vitest"
import { placerLaBulle } from "./bulle"

const ecran = { largeur: 1280, hauteur: 800 }
const bulle = { largeur: 320, hauteur: 120 }
/** Une pastille de 24 px dont le coin haut gauche est à cet endroit de l'écran. */
const pastille = (left: number, top: number) => ({ left, right: left + 24, top, bottom: top + 24 })

describe("place de la bulle d'une note", () => {
  it("s'ouvre sous la pastille, alignée sur son bord droit", () => {
    expect(placerLaBulle(pastille(900, 200), bulle, ecran)).toEqual({ left: 604, top: 230, cote: "dessous" })
  })

  it("reste dans l'écran : ramenée à droite du bord gauche, ou à gauche du bord droit", () => {
    expect(placerLaBulle(pastille(100, 200), bulle, ecran).left).toBe(8)
    // Une pastille en partie hors de l'écran à droite (tableau qui défile) : la bulle ne la suit pas dehors.
    expect(placerLaBulle(pastille(1270, 200), bulle, ecran).left).toBe(1280 - 320 - 8)
  })

  it("passe au-dessus quand la place manque dessous ; sans place d'aucun côté, remonte dans l'écran sur sa pastille", () => {
    expect(placerLaBulle(pastille(900, 700), bulle, ecran).top).toBe(700 - 6 - 120)
    // Écran de 150 px : ni dessous (90 + 120 > 142) ni dessus ; ramenée à 150 - 8 - 120 = 22 px, elle tient entière.
    expect(placerLaBulle(pastille(900, 60), bulle, { largeur: 1280, hauteur: 150 }).top).toBe(22)
    // Plus haute que l'écran : elle commence en haut, sous la marge.
    expect(placerLaBulle(pastille(900, 60), { largeur: 320, hauteur: 400 }, { largeur: 1280, hauteur: 150 }).top).toBe(8)
  })

  it("ne passe pas au-dessus si elle y serait sous les barres collées en haut de l'écran : elle reste dessous", () => {
    // Pastille à 700 px, bulle de 120 px : au-dessus, elle irait de 574 à 694 px, en partie sous des barres qui finissent à 600 px.
    // Ni dessous (730 + 120 > 792) : ramenée dans la partie libre, de 672 à 792 px.
    expect(placerLaBulle(pastille(900, 700), bulle, { ...ecran, haut: 600 })).toEqual({ left: 604, top: 672, cote: "ramenee" })
    // Plus haute que la partie libre : elle commence juste sous les barres, jamais dessous.
    expect(placerLaBulle(pastille(900, 700), { largeur: 320, hauteur: 300 }, { ...ecran, haut: 600 }).top).toBe(608)
    // Des barres moins hautes laissent la place au-dessus.
    expect(placerLaBulle(pastille(900, 700), bulle, { ...ecran, haut: 400 })).toMatchObject({ top: 574, cote: "dessus" })
  })

  it("sous un zoom, donne des coordonnées de la page : celles de l'écran divisées par le zoom", () => {
    // À 200 %, la bulle de 320 px de la page en occupe 640 à l'écran.
    expect(placerLaBulle(pastille(900, 200), { largeur: 640, hauteur: 240 }, ecran, 2)).toEqual({ left: 142, top: 115, cote: "dessous" })
  })

  it("replacée, garde le côté déjà retenu, même si la place a changé entre-temps", () => {
    const enBas = pastille(900, 700)
    expect(placerLaBulle(enBas, bulle, ecran).cote).toBe("dessus")
    // Le tableau a défilé de côté pendant que la page descendait : la bulle reste sous sa pastille.
    expect(placerLaBulle(enBas, bulle, ecran, 1, "dessous")).toEqual({ left: 604, top: 730, cote: "dessous" })
    expect(placerLaBulle(pastille(900, 200), bulle, ecran, 1, "dessus").top).toBe(200 - 6 - 120)
  })
})
