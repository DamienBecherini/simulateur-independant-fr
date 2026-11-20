// src/lib/limite-de-remuneration.test.ts

import { describe, expect, it } from "vitest"
import type { FinancialFlow } from "@/types"
import { enTexteBrut } from "@/backend/logic/format"
import { rappelDeLaLimite, remunerationSaisie } from "./limite-de-remuneration"

const flux = (type: FinancialFlow["type"], amount: number): FinancialFlow => ({ id: `${type}-${amount}`, entityId: "s1", type, label: "", amount })

describe("remunerationSaisie", () => {
  it("additionne les rémunérations du dirigeant de l'année, et elles seules", () => {
    expect(remunerationSaisie([flux("director_remuneration", 2000), flux("ca_services", 9000), flux("director_remuneration", 2500), flux("dividends_payment", 1000)])).toBe(4500)
    expect(remunerationSaisie([])).toBe(0)
  })
})

describe("rappelDeLaLimite", () => {
  const rappel = (saisie: number, limite: number) => {
    const { texte, depassee } = rappelDeLaLimite(saisie, limite)
    return { texte: enTexteBrut(texte), depassee }
  }

  it("donne la limite avant toute saisie", () => {
    expect(rappel(0, 44900)).toEqual({ texte: "Cette année, la société peut verser au plus 44 900 € nets sans déficit.", depassee: false })
  })

  it("situe la saisie sous la limite", () => {
    expect(rappel(24000, 44900)).toEqual({ texte: "24 000 € nets saisis sur l'année, pour 44 900 € au plus sans déficit de la société.", depassee: false })
  })

  it("met en garde quand la saisie dépasse la limite", () => {
    expect(rappel(60000, 44900)).toEqual({ texte: "60 000 € nets saisis sur l'année : c'est plus que les 44 900 € que la société peut verser sans déficit.", depassee: true })
  })

  it("ne dit pas dépassée une saisie dans la centaine de la limite, arrondie à la centaine inférieure", () => {
    expect(rappel(44950, 44900).depassee).toBe(false)
    expect(rappel(45000, 44900).depassee).toBe(true)
  })

  it("dit qu'aucune rémunération n'est possible quand l'activité est déjà déficitaire", () => {
    expect(rappel(0, 0)).toEqual({ texte: "Sans rémunération, l'activité est déjà déficitaire cette année : la société ne peut en verser aucune sans creuser son déficit.", depassee: false })
    expect(rappel(12000, 0).depassee).toBe(true)
  })
})
