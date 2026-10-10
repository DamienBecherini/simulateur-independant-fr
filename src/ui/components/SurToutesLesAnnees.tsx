// src/ui/components/SurToutesLesAnnees.tsx
// « Sur toutes les années » : stratégies de distribution du bénéfice de l'activité comparée, en SASU et en EURL,
// comparées sur le net cumulé de toutes les années de la session (voir l'ADR 014).

import { useEffect, useId, useState } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { ResultatDUneStrategie, SessionState, StrategiesDeDistribution, StrategiesDUnStatut } from "@/types"
import { ChampNumerique } from "./ChampNumerique"
import { ZoneDefilante } from "./ZoneDefilante"
import { euros } from "@/backend/logic/format"


/** Recalcule les stratégies peu après chaque modification de la session (grille, acteurs, réglages du comparateur). */
function useStrategies(session: SessionState, activityId: string, actif: boolean) {
  const [resultat, setResultat] = useState<StrategiesDeDistribution | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => {
    if (!actif) return
    let annule = false
    const minuterie = setTimeout(async () => {
      try {
        const strategies = await window.api.comparerStrategies(session, activityId)
        if (annule) return
        setResultat(strategies)
        setErreur(null)
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : "La comparaison sur toutes les années a échoué.")
      }
    }, 300)
    return () => {
      annule = true
      clearTimeout(minuterie)
    }
  }, [session, activityId, actif])
  return { resultat, erreur }
}

/** Dividendes de chaque année d'une stratégie : « 2025 : 24 625 € ; 2026 : 24 625 € ». */
function dividendesParAnnee(strategie: ResultatDUneStrategie): string {
  return strategie.annees.map(a => `${a.annee} : ${euros(a.dividendes)}`).join(" ; ")
}

/** Ce que rapporte la meilleure stratégie de plus que « Tout distribuer chaque année », en une phrase. */
function Verdict({ statut }: { statut: StrategiesDUnStatut }) {
  const meilleure = statut.strategies.find(s => s.strategie === statut.meilleure)
  const reference = statut.strategies.find(s => s.strategie === "toutDistribuer")
  if (!meilleure || !reference) return <p className="text-sm text-slate-700 dark:text-slate-200">En {statut.statut}, les stratégies se valent à l'euro près.</p>
  const ecart = meilleure.netCumule - reference.netCumule
  return (
    <p className="text-sm text-slate-700 dark:text-slate-200">
      En {statut.statut}, la meilleure : <span className="font-semibold">« {meilleure.libelle} »</span>
      {meilleure !== reference && ecart >= 1 ? <>, {euros(ecart)} de plus que de tout distribuer chaque année</> : null}.
    </p>
  )
}

function TableauDuStatut({ statut }: { statut: StrategiesDUnStatut }) {
  return (
    <div className="space-y-2">
      <h4 className="text-base font-medium text-slate-800 dark:text-slate-100">En {statut.statut}</h4>
      <Verdict statut={statut} />
      <ZoneDefilante libelle={`Stratégies de distribution en ${statut.statut}`}>
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Stratégies de distribution en {statut.statut}, sur toutes les années</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-700">
              <th scope="col" className="py-2 pr-4 font-medium">
                Stratégie
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Net cumulé
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Prélèvements cumulés
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Réserves restantes
              </th>
            </tr>
          </thead>
          <tbody>
            {statut.strategies.map(s => {
              const meilleure = s.strategie === statut.meilleure
              return (
                <tr key={s.strategie} className={cn("border-b border-slate-100 align-top dark:border-slate-800", meilleure && "bg-emerald-50 dark:bg-emerald-950/40")}>
                  <th scope="row" className="py-2 pr-4 text-left font-medium">
                    {s.libelle}
                    {meilleure ? <span className="ml-2 inline-block rounded bg-emerald-700 px-1.5 py-0.5 text-xs font-semibold text-white dark:bg-emerald-300 dark:text-emerald-950">Meilleur net</span> : null}
                    <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">Dividendes {dividendesParAnnee(s)}</span>
                    {s.warnings.map(w => (
                      <span key={w} className="block text-xs font-normal text-amber-800 dark:text-amber-200">
                        {w}
                      </span>
                    ))}
                  </th>
                  <td className={cn("py-2 pr-4 text-right tabular-nums", meilleure && "font-semibold text-emerald-700 dark:text-emerald-400")}>{euros(s.netCumule)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{euros(s.prelevementsCumules)}</td>
                  <td className="py-2 text-right tabular-nums">{euros(s.reservesALaFin)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ZoneDefilante>
    </div>
  )
}

interface SurToutesLesAnneesProps {
  session: SessionState
  activityId: string
  activityName: string
  /** Part gardée chaque année dans « Garder puis distribuer », entre 0 et 1. */
  partMiseEnReserve: number
  onPartMiseEnReserve: (part: number) => void
}

/** Rien tant que la session ne compte qu'une année. */
export function SurToutesLesAnnees({ session, activityId, activityName, partMiseEnReserve, onPartMiseEnReserve }: SurToutesLesAnneesProps) {
  const plusieursAnnees = session.annees.length >= 2
  const { resultat, erreur } = useStrategies(session, activityId, plusieursAnnees)
  const idPart = useId()
  if (!plusieursAnnees) return null
  const annees = resultat?.annees ?? []
  const periode = annees.length > 0 ? `de ${annees[0]} à ${annees[annees.length - 1]}` : "sur les années de la session"

  return (
    <section aria-labelledby="toutes-les-annees-titre" className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div>
        <h3 id="toutes-les-annees-titre" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Sur toutes les années
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Distribuer le bénéfice de « {activityName} » chaque année, ou en garder une part en réserve pour la distribuer plus tard ? Trois façons de faire, en SASU et en EURL, comparées sur le net de tous les foyers cumulé {periode}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={idPart}>Part gardée chaque année (%)</Label>
        <ChampNumerique id={idPart} className="w-28" min="0" max="100" step="5" quoi="la part gardée chaque année" value={Math.round(partMiseEnReserve * 100)} onChange={e => onPartMiseEnReserve(Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0)) / 100)} />
      </div>
      {erreur ? <p className="text-sm text-red-800 dark:text-red-200">{erreur}</p> : null}
      {resultat ? resultat.statuts.map(statut => <TableauDuStatut key={statut.statut} statut={statut} />) : <p className="text-sm text-slate-600 dark:text-slate-300">Calcul en cours…</p>}
      <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Hypothèses : l'avenir est celui que décrivent les années de la session, avec leurs grilles ; une année au-delà des dernières règles connues reprend celles-ci, sans revalorisation. Chaque année garde la rémunération saisie dans le comparateur pour elle (sinon celle de sa grille) et les frais de fonctionnement du comparateur. « Garder puis distribuer » et « Lisser » distribuent aussi les réserves du début de la simulation.
        </p>
        <p>Les réserves restantes ne comptent pas dans le net : l'impôt sur les sociétés est payé, mais l'impôt du foyer le sera quand elles seront distribuées.</p>
        {resultat?.notes.map(note => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  )
}
