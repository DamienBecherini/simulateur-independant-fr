// src/backend/logic/calculsSASU.test.ts

import { describe, expect, it } from "vitest"
import { simulerSASU } from "./calculsSASU.js"

/*
 * Rappel des paramètres de config.json utilisés ici :
 * - coût total d'une rémunération = net x 1,8
 * - IS : 15 % jusqu'à 42 500 € de bénéfice, 25 % au-delà
 * - dividendes : PFU = 17,2 % de prélèvements sociaux + 12,8 % d'IR, ou barème avec abattement de 40 %
 */
describe("simulerSASU", () => {
  it("renvoie le statut et le chiffre d'affaires saisis", () => {
    const resultat = simulerSASU({ chiffreAffaires: 100_000 })
    expect(resultat.statut).toBe("SASU (IS)")
    expect(resultat.chiffreAffaires).toBe(100_000)
  })

  it("renvoie un net nul quand aucune donnée n'est fournie", () => {
    expect(simulerSASU({})).toEqual({ statut: "SASU (IS)", chiffreAffaires: 0, netDansLaPoche: 0 })
  })

  it("cas nominal : rémunération + dividendes au PFU", () => {
    // Coût de la rémunération : 30 000 x 1,8 = 54 000
    // Bénéfice avant IS : 100 000 - 10 000 - 54 000 = 36 000 -> IS : 36 000 x 15 % = 5 400
    // Dividendes bruts : 30 600
    //   PFU    : 30 600 x 70 % = 21 420
    //   Barème : PS 5 263,20 + surcoût d'IR (7 794 - 2 286 = 5 508) -> 19 828,80
    // IR sur la rémunération seule (30 000 €) : 2 286
    // Net : 30 000 + 21 420 - 2 286 = 49 134
    const resultat = simulerSASU({ chiffreAffaires: 100_000, chargesDeductibles: 10_000, remunerationNetteVisee: 30_000 })
    expect(resultat.netDansLaPoche).toBe(49_134)
  })

  it("applique le taux normal d'IS au-delà de 42 500 € de bénéfice", () => {
    // IS : 42 500 x 15 % + 157 500 x 25 % = 6 375 + 39 375 = 45 750
    // Dividendes bruts : 154 250 -> PFU : 107 975 (le barème ne laisse que 105 546)
    const resultat = simulerSASU({ chiffreAffaires: 200_000 })
    expect(resultat.netDansLaPoche).toBe(107_975)
  })

  it("applique le taux réduit d'IS jusqu'au plafond inclus", () => {
    // IS : 42 500 x 15 % = 6 375 -> dividendes bruts 36 125 -> PFU : 25 287,50
    // Barème : PS 6 213,50 + IR sur 21 675 € (1 141,91 -> 1 142) -> 28 769,50
    const resultat = simulerSASU({ chiffreAffaires: 42_500 })
    expect(resultat.netDansLaPoche).toBe(28_770)
  })

  it("retient l'option barème quand elle est plus favorable que le PFU", () => {
    // IS : 20 000 x 15 % = 3 000 -> dividendes bruts 17 000
    //   PFU    : 17 000 x 70 % = 11 900
    //   Barème : base imposable 10 200 € (non imposable), PS 2 924 -> 14 076
    const resultat = simulerSASU({ chiffreAffaires: 20_000 })
    expect(resultat.netDansLaPoche).toBe(14_076)
  })

  it("ne distribue aucun dividende quand la rémunération absorbe tout le bénéfice", () => {
    // 30 000 x 1,8 = 54 000 = CA -> bénéfice nul, net = rémunération - IR (2 286)
    const resultat = simulerSASU({ chiffreAffaires: 54_000, remunerationNetteVisee: 30_000 })
    expect(resultat.netDansLaPoche).toBe(27_714)
  })

  it("ne calcule ni IS ni dividendes sur un bénéfice négatif", () => {
    // Coût de la rémunération : 36 000 > CA de 10 000. Net = 20 000 - IR (958)
    const resultat = simulerSASU({ chiffreAffaires: 10_000, remunerationNetteVisee: 20_000 })
    expect(resultat.netDansLaPoche).toBe(19_042)
  })

  it("ne compte que le surcoût d'IR lié à l'activité quand le foyer a d'autres revenus", () => {
    // IR sur 50 000 € : 8 286 ; IR sur les 20 000 € d'autres revenus : 958 -> surcoût 7 328
    const resultat = simulerSASU({ chiffreAffaires: 54_000, remunerationNetteVisee: 30_000, autresRevenusImposablesFoyer: 20_000 })
    expect(resultat.netDansLaPoche).toBe(22_672)
  })

  it("tient compte du nombre de parts fiscales", () => {
    // 15 000 € par part -> 407,66 par part, soit 815 € d'IR
    const resultat = simulerSASU({ chiffreAffaires: 54_000, remunerationNetteVisee: 30_000, partsFiscales: 2 })
    expect(resultat.netDansLaPoche).toBe(29_185)
  })

  it("déduit les charges du bénéfice", () => {
    // Bénéfice : 30 000 - 10 000 = 20 000 -> même résultat qu'un CA de 20 000 € sans charges
    const resultat = simulerSASU({ chiffreAffaires: 30_000, chargesDeductibles: 10_000 })
    expect(resultat.netDansLaPoche).toBe(14_076)
  })

  it.todo("signale une rémunération supérieure à ce que la société peut financer (bénéfice négatif accepté sans avertissement)")
})
