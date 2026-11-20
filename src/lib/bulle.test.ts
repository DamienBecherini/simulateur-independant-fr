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

  it("passe au-dessus quand la place manque dessous, sauf si elle manque aussi dessus", () => {
    expect(placerLaBulle(pastille(900, 700), bulle, ecran).top).toBe(700 - 6 - 120)
    expect(placerLaBulle(pastille(900, 60), bulle, { largeur: 1280, hauteur: 150 }).top).toBe(90)
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
