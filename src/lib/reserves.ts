// src/lib/reserves.ts
// Lecture des réserves d'une société à l'IS sur une année (voir l'ADR 012), pour la carte de l'activité, la synthèse
// des années et les exports : ce qui s'y ajoute, ce qui en sort, et ce qu'il en reste au 31 décembre.

import type { ActivityResult, SimulationReport } from "@/types"

export interface LectureDesReserves {
  /** Bénéfice de l'année gardé dans la société (réserve légale comprise). */
  ajoutees: number
  /** Part de la dotation de l'année qui va à la réserve légale, non distribuable. */
  reserveLegaleDotee: number
  /** Dividendes de l'année pris sur les réserves des années précédentes. */
  prisesSurLesReserves: number
  /** Déficit de l'année : il entame les réserves et s'imputera sur les bénéfices suivants avant l'IS. */
  deficit: number
  /** Déficit des années précédentes déduit du bénéfice imposable de l'année. */
  deficitImpute: number
  /** Réserves distribuables au 31 décembre (négatives : des pertes à combler). */
  aLaFin: number
  /** Réserve légale au 31 décembre. */
  reserveLegale: number
  /** Quelque chose à dire : des réserves, un mouvement ou un déficit. */
  aSignaler: boolean
}

/** Les réserves de l'activité sur l'année ; `null` hors société à l'IS. */
export function lectureDesReserves(activite: ActivityResult): LectureDesReserves | null {
  const r = activite.reserves
  if (!r) return null
  const deficit = Math.max(0, r.aLaFin.deficitReportable - r.auDebut.deficitReportable + r.deficitImpute)
  const lecture = {
    ajoutees: Math.max(0, activite.resultatConserve),
    reserveLegaleDotee: r.dotationReserveLegale,
    prisesSurLesReserves: r.dividendesPrisSurLesReserves,
    deficit,
    deficitImpute: r.deficitImpute,
    aLaFin: r.aLaFin.reserves,
    reserveLegale: r.aLaFin.reserveLegale
  }
  const aSignaler = [lecture.ajoutees, lecture.prisesSurLesReserves, deficit, r.deficitImpute, r.auDebut.reserves, lecture.aLaFin].some(montant => Math.abs(montant) >= 0.5)
  return { ...lecture, aSignaler }
}

/** Réserves distribuables de toutes les sociétés à l'IS au 31 décembre ; `null` s'il n'y a rien à en dire. */
export function reservesDesSocietes(report: SimulationReport): number | null {
  const lectures = report.activities.flatMap(a => {
    const lecture = lectureDesReserves(a)
    return lecture ? [lecture] : []
  })
  if (!lectures.some(l => l.aSignaler)) return null
  return lectures.reduce((somme, l) => somme + l.aLaFin, 0)
}
