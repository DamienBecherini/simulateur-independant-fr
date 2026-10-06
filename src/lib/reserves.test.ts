// src/lib/reserves.test.ts

import { describe, expect, it } from "vitest"
import type { ActivityResult, ReservesDeLaSociete } from "@/types"
import { emptyReport } from "@/ui/testing/fixtures"
import { lectureDesReserves, reservesDesSocietes } from "./reserves"

const etat = (reserves: number, deficitReportable = 0) => ({ reserves, reserveLegale: 100, deficitReportable })
const reserves = (changements: Partial<ReservesDeLaSociete> = {}): ReservesDeLaSociete => ({ auDebut: etat(0), aLaFin: etat(0), deficitImpute: 0, dotationReserveLegale: 0, beneficeDistribuableDeLAnnee: 0, distribuable: 0, dividendesPrisSurLesReserves: 0, ...changements })
const activite = (resultatConserve: number, r?: ReservesDeLaSociete): ActivityResult => ({ entityId: "s1", name: "S", type: "company", statut: "SASU", chiffreAffaires: 0, charges: 0, cotisationsSociales: 0, impotSocietes: 0, revenuVerse: 0, resultatConserve, beneficiaireIds: [], warnings: [], ...(r ? { reserves: r } : {}) })

describe("lectureDesReserves", () => {
  it("rien hors société à l'IS", () => {
    expect(lectureDesReserves(activite(0))).toBeNull()
  })

  it("rien à signaler sans réserves ni mouvement", () => {
    expect(lectureDesReserves(activite(0, reserves()))?.aSignaler).toBe(false)
  })

  it("lit le bénéfice gardé, la réserve légale dotée et les réserves au 31 décembre", () => {
    expect(lectureDesReserves(activite(5000, reserves({ dotationReserveLegale: 250, aLaFin: { reserves: 4750, reserveLegale: 350, deficitReportable: 0 } })))).toEqual({ ajoutees: 5000, reserveLegaleDotee: 250, prisesSurLesReserves: 0, deficit: 0, deficitImpute: 0, aLaFin: 4750, reserveLegale: 350, aSignaler: true })
  })

  it("lit le déficit de l'année d'après le déficit reportable", () => {
    // 1 000 € de déficit reportable au départ, 400 € imputés, 2 000 € à la fin : 1 400 € de déficit cette année.
    const r = reserves({ auDebut: etat(0, 1000), aLaFin: etat(-1400, 2000), deficitImpute: 400 })
    expect(lectureDesReserves(activite(-1400, r))).toMatchObject({ deficit: 1400, deficitImpute: 400, ajoutees: 0, aLaFin: -1400 })
  })
})

describe("reservesDesSocietes", () => {
  it("additionne les réserves des sociétés, ou rien s'il n'y a rien à dire", () => {
    const rapport = { ...emptyReport(), activities: [activite(3000, reserves({ aLaFin: etat(3000) })), activite(1000, reserves({ aLaFin: etat(1000) })), activite(0)] }
    expect(reservesDesSocietes(rapport)).toBe(4000)
    expect(reservesDesSocietes({ ...emptyReport(), activities: [activite(0, reserves())] })).toBeNull()
  })
})
