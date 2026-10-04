// src/lib/zoom.test.ts

import { describe, expect, it } from "vitest"
import { LARGEUR_MINIMALE, LARGEUR_MINIMALE_LARGE, bornerZoom, zoomMaximalPour } from "./zoom"

describe("zoom de l'interface", () => {
  it("une grande fenêtre permet le zoom maximal de 200 %", () => {
    expect(zoomMaximalPour(1440)).toBe(2)
    expect(zoomMaximalPour(LARGEUR_MINIMALE_LARGE * 2)).toBe(2)
  })

  it("une fenêtre étroite limite le zoom pour garder la largeur minimale de la mise en page", () => {
    // 450 px / 360 px = 125 % : au-delà, la largeur effective tomberait sous 360 px.
    expect(zoomMaximalPour(450)).toBe(1.25)
    expect(450 / zoomMaximalPour(450)).toBeGreaterThanOrEqual(LARGEUR_MINIMALE)
  })

  it("dès 640 px, la mise en page large s'affiche malgré le zoom : elle demande plus de place", () => {
    // 720 px / 460 px = 156 %, et non 200 % comme le permettrait la mise en page compacte (720 / 360).
    expect(zoomMaximalPour(720)).toBe(1.56)
    expect(720 / zoomMaximalPour(720)).toBeGreaterThanOrEqual(LARGEUR_MINIMALE_LARGE)
    expect(zoomMaximalPour(639)).toBe(1.77)
    expect(zoomMaximalPour(640)).toBe(1.39)
  })

  it("une fenêtre plus étroite que la mise en page dézoome, jusqu'à 50 % au plus", () => {
    expect(zoomMaximalPour(320)).toBe(0.88)
    expect(zoomMaximalPour(100)).toBe(0.5)
  })

  it("borne le zoom demandé, et le réduit quand la fenêtre rétrécit", () => {
    expect(bornerZoom(1.3, 1440)).toBe(1.3)
    expect(bornerZoom(2.1, 1440)).toBe(2)
    expect(bornerZoom(0.4, 1440)).toBe(0.5)
    expect(bornerZoom(2, 540)).toBe(1.5)
    expect(bornerZoom(2, 800)).toBe(1.73)
  })

  it("la largeur effective ne passe jamais sous la largeur minimale, de 320 à 2 000 px", () => {
    for (let largeur = 320; largeur <= 2000; largeur++) {
      const minimum = largeur >= 640 ? LARGEUR_MINIMALE_LARGE : LARGEUR_MINIMALE
      expect(largeur / zoomMaximalPour(largeur)).toBeGreaterThanOrEqual(Math.min(minimum, largeur / 0.5) - 1e-9)
    }
  })

  it("arrondit au centième pour que les pas de 10 % ne dérivent pas", () => {
    expect(bornerZoom(1 + 0.1 + 0.1 + 0.1, 1440)).toBe(1.3)
  })
})
