// src/backend/logic/calculsEURL.test.ts

import { describe, expect, it } from "vitest"
import { simulerEURL } from "./calculsEURL.js"

/*
 * Rappel des paramètres de config.json utilisés ici :
 * - cotisations TNS : 45 % de la rémunération nette
 * - IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà
 * - dividendes : jusqu'à 10 % du capital -> PFU (17,2 % + 12,8 %) ou barème (abattement 40 %) ;
 *   au-delà -> cotisations TNS (45 %) puis barème de l'IR
 */
describe("simulerEURL", () => {
  it("renvoie le statut et le chiffre d'affaires saisis", () => {
    const resultat = simulerEURL({ chiffreAffaires: 80_000 })
    expect(resultat.statut).toBe("EURL (IS)")
    expect(resultat.chiffreAffaires).toBe(80_000)
  })

  it("renvoie un net nul quand aucune donnée n'est fournie", () => {
    expect(simulerEURL({})).toEqual({ statut: "EURL (IS)", chiffreAffaires: 0, netDansLaPoche: 0 })
  })

  it("cas nominal sans capital : tous les dividendes supportent les cotisations TNS", () => {
    // Coût de la rémunération : 30 000 x 1,45 = 43 500
    // Bénéfice avant IS : 100 000 - 10 000 - 43 500 = 46 500
    // IS : 42 500 x 15 % + 4 000 x 25 % = 7 375 -> dividendes bruts 39 125
    // Cotisations TNS sur dividendes : 39 125 x 45 % = 17 606,25 -> dividendes nets 21 518,75
    // IR sur 30 000 + 21 518,75 = 51 518,75 € : 8 741,86 -> 8 742
    // Net : 30 000 + 21 518,75 - 8 742 = 42 776,75
    const resultat = simulerEURL({ chiffreAffaires: 100_000, chargesDeductibles: 10_000, remunerationNetteVisee: 30_000 })
    expect(resultat.netDansLaPoche).toBe(42_777)
  })

  it("applique le PFU à la part des dividendes inférieure à 10 % du capital", () => {
    // Dividendes bruts 39 125 (voir cas nominal), seuil : 10 % de 100 000 = 10 000
    // Part TNS : 29 125 - 45 % = 16 018,75 nets
    // Part PFU : 10 000 x 70 % = 7 000 (barème : 10 000 - 1 720 - 1 800 = 6 480)
    // IR sur 30 000 + 16 018,75 = 46 018,75 € : 7 091,86 -> 7 092
    // Net : 30 000 + 16 018,75 + 7 000 - 7 092 = 45 926,75
    const resultat = simulerEURL({ chiffreAffaires: 100_000, chargesDeductibles: 10_000, remunerationNetteVisee: 30_000, capitalSocial: 100_000 })
    expect(resultat.netDansLaPoche).toBe(45_927)
  })

  it("retient l'option barème quand elle est plus favorable que le PFU", () => {
    // IS : 10 000 x 15 % = 1 500 -> dividendes bruts 8 500, entièrement sous le seuil de 100 000 €
    //   PFU    : 8 500 x 70 % = 5 950
    //   Barème : base imposable 5 100 € (non imposable), PS 1 462 -> 7 038
    const resultat = simulerEURL({ chiffreAffaires: 10_000, capitalSocial: 1_000_000 })
    expect(resultat.netDansLaPoche).toBe(7038)
  })

  it("applique le taux normal d'IS au-delà de 42 500 € de bénéfice", () => {
    // IS : 6 375 + 157 500 x 25 % = 45 750 -> dividendes bruts 154 250
    // Seuil de 2 000 000 € : tout au PFU -> 154 250 x 70 % = 107 975
    const resultat = simulerEURL({ chiffreAffaires: 200_000, capitalSocial: 20_000_000 })
    expect(resultat.netDansLaPoche).toBe(107_975)
  })

  it("ne distribue aucun dividende quand la rémunération absorbe tout le bénéfice", () => {
    // 30 000 x 1,45 = 43 500 = CA -> net = rémunération - IR (2 286)
    const resultat = simulerEURL({ chiffreAffaires: 43_500, remunerationNetteVisee: 30_000 })
    expect(resultat.netDansLaPoche).toBe(27_714)
  })

  it("ne calcule ni IS ni dividendes sur un bénéfice négatif", () => {
    // Net = 20 000 - IR (958)
    const resultat = simulerEURL({ chiffreAffaires: 0, remunerationNetteVisee: 20_000, capitalSocial: 50_000 })
    expect(resultat.netDansLaPoche).toBe(19_042)
  })

  it("ne compte que le surcoût d'IR lié à l'activité quand le foyer a d'autres revenus", () => {
    // IR sur 50 000 € : 8 286 ; IR sur les 20 000 € d'autres revenus : 958 -> surcoût 7 328
    const resultat = simulerEURL({ chiffreAffaires: 43_500, remunerationNetteVisee: 30_000, autresRevenusImposablesFoyer: 20_000 })
    expect(resultat.netDansLaPoche).toBe(22_672)
  })

  it("tient compte du nombre de parts fiscales", () => {
    // 15 000 € par part -> 407,66 par part, soit 815 € d'IR
    const resultat = simulerEURL({ chiffreAffaires: 43_500, remunerationNetteVisee: 30_000, partsFiscales: 2 })
    expect(resultat.netDansLaPoche).toBe(29_185)
  })
})
