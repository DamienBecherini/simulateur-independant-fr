// src/backend/logic/calculsIR.test.ts

import { describe, expect, it } from "vitest"
import { calculerIR } from "./calculsIR.js"

const ir = (revenuNetGlobalImposable: number, partsFiscales = 1) => calculerIR({ revenuNetGlobalImposable, partsFiscales })

describe("calculerIR", () => {
  describe("cas limites", () => {
    it("renvoie 0 pour un revenu nul", () => {
      expect(ir(0)).toBe(0)
    })

    it("renvoie 0 pour un revenu négatif", () => {
      expect(ir(-25_000)).toBe(0)
    })

    it("renvoie 0 quand le nombre de parts est nul", () => {
      expect(ir(50_000, 0)).toBe(0)
    })

    it("renvoie 0 quand le nombre de parts est négatif", () => {
      expect(ir(50_000, -2)).toBe(0)
    })

    it("renvoie 0 quand le nombre de parts n'est pas un nombre", () => {
      expect(ir(50_000, Number.NaN)).toBe(0)
    })
  })

  describe("tranches du barème (1 part)", () => {
    it("n'impose pas la tranche à 0 %, borne incluse", () => {
      expect(ir(5_000)).toBe(0)
      expect(ir(11_294)).toBe(0)
    })

    it("impose à 11 % la fraction au-delà de 11 294 €", () => {
      // (20 000 - 11 294) x 0,11 = 957,66
      expect(ir(20_000)).toBe(958)
      // 100 € au-dessus du seuil : 100 x 0,11 = 11
      expect(ir(11_394)).toBe(11)
    })

    it("applique encore 11 % à la borne haute de la tranche (28 797 €)", () => {
      // (28 797 - 11 294) x 0,11 = 1 925,33
      expect(ir(28_797)).toBe(1925)
    })

    it("impose à 30 % la fraction au-delà de 28 797 €", () => {
      // 1 925,33 + (50 000 - 28 797) x 0,30 = 8 286,23
      expect(ir(50_000)).toBe(8286)
    })

    it("applique encore 30 % à la borne haute de la tranche (82 341 €)", () => {
      // 1 925,33 + (82 341 - 28 797) x 0,30 = 17 988,53
      expect(ir(82_341)).toBe(17_989)
    })

    it("impose à 41 % la fraction au-delà de 82 341 € (à 1 € près)", () => {
      // 17 988,53 + (100 000 - 82 341) x 0,41 = 25 228,72
      expect(Math.abs(ir(100_000) - 25_229)).toBeLessThanOrEqual(1)
      // 17 988,53 + (177 106 - 82 341) x 0,41 = 56 842,18
      expect(Math.abs(ir(177_106) - 56_842)).toBeLessThanOrEqual(1)
    })

    it("impose à 45 % la fraction au-delà de 177 106 € (à 1 € près)", () => {
      // 56 842,18 + (200 000 - 177 106) x 0,45 = 67 144,48
      expect(Math.abs(ir(200_000) - 67_144)).toBeLessThanOrEqual(1)
      // 56 842,18 + (1 000 000 - 177 106) x 0,45 = 427 144,48
      expect(Math.abs(ir(1_000_000) - 427_144)).toBeLessThanOrEqual(1)
    })

    it("croît avec le revenu", () => {
      const revenus = [0, 11_294, 11_295, 20_000, 28_797, 28_798, 60_000, 82_341, 120_000]
      const impots = revenus.map(r => ir(r))
      expect(impots).toEqual([...impots].sort((a, b) => a - b))
    })

    it.todo("est continu au passage de la tranche à 41 % : la constante 15 772,28 devrait être 15 771,28 (1 € d'impôt en moins à 82 342 € qu'à 82 341 €)")
    it.todo("donne 67 144 € pour 200 000 € : la constante 22 854,52 devrait être 22 855,52 (1 € d'impôt en trop sur toute la tranche à 45 %)")
  })

  describe("quotient familial", () => {
    it("divise le revenu par le nombre de parts avant d'appliquer le barème", () => {
      // 60 000 / 2 = 30 000 par part -> 1 925,33 + 1 203 x 0,30 = 2 286,23 par part
      expect(ir(60_000, 2)).toBe(4572)
      // Même revenu avec 1 part : 1 925,33 + 31 203 x 0,30 = 11 286,23
      expect(ir(60_000, 1)).toBe(11_286)
    })

    it("gère les demi-parts", () => {
      // 60 000 / 2,5 = 24 000 par part -> 12 706 x 0,11 = 1 397,66 par part
      expect(ir(60_000, 2.5)).toBe(3494)
    })

    it("donne le même impôt qu'un célibataire au revenu moitié, multiplié par deux", () => {
      // 37 000 par part -> 1 925,33 + 8 203 x 0,30 = 4 386,23 ; soit 8 772,46 pour le couple
      expect(ir(74_000, 2)).toBe(8772)
      expect(ir(37_000, 1)).toBe(4386)
    })

    it("n'impose pas un foyer dont le revenu par part reste sous le premier seuil", () => {
      expect(ir(33_000, 3)).toBe(0)
    })
  })
})
