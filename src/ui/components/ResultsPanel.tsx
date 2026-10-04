// src/ui/components/ResultsPanel.tsx

import { Button } from "@/components/ui/button"
import type { Entity, EntityResult, SimulationReport } from "@/types"
import { Loader2, PlayCircle } from "lucide-react"

type ResultsPanelProps = {
  entities: Entity[]
  report: SimulationReport | null
  loading: boolean
  error: string | null
  onRunSimulation: () => void
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

/**
 * Part du net dans la poche par rapport au chiffre d'affaires (ex. « 62 % du CA »).
 * Sans objet pour une personne physique ou quand le CA est nul.
 */
function netShareOfRevenue(er: EntityResult): string | null {
  if (er.type === "person" || er.chiffreAffaires <= 0) return null
  const share = er.netDansLaPoche / er.chiffreAffaires
  return `${share.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 })} du CA`
}

function entityLabel(entities: Entity[], id: string): string {
  return entities.find(e => e.id === id)?.name ?? id
}

function entityTypeLabel(type: Entity["type"]): string {
  switch (type) {
    case "person":
      return "Personne"
    case "company":
      return "Société"
    case "micro-entreprise":
      return "Micro-entreprise"
    default:
      return type
  }
}

export function ResultsPanel({ entities, report, loading, error, onRunSimulation }: ResultsPanelProps) {
  return (
    <section className="mt-12 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Résultats de simulation</h2>
        <Button type="button" onClick={onRunSimulation} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          Lancer la simulation
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>
      ) : null}

      {!report && !loading && !error ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cliquez sur « Lancer la simulation » pour agréger la grille mensuelle et calculer les estimations (sociétés, micro, foyers).</p>
      ) : null}

      {report ? (
        <div className="space-y-8">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Net global (sociétés + micro-entreprises)</p>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatMoney(report.globalNet)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Somme des « net dans la poche » des entités d'activité ; les personnes physiques ne sont pas incluses pour éviter le double comptage avec les rémunérations.</p>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-100">Par entité</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {report.entities.map(er => (
                <article
                  key={er.entityId}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
                >
                  <header className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{er.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{entityTypeLabel(er.type)}</p>
                  </header>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Chiffre d'affaires</dt>
                      <dd className="tabular-nums font-medium">{formatMoney(er.chiffreAffaires)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Net dans la poche</dt>
                      <dd className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                        {formatMoney(er.netDansLaPoche)}
                        {netShareOfRevenue(er) ? <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{netShareOfRevenue(er)}</span> : null}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Impôts et cotisations (approx.)</dt>
                      <dd className="tabular-nums">{formatMoney(er.impotsEtCotisations)}</dd>
                    </div>
                  </dl>
                  {er.warnings.length > 0 ? (
                    <ul className="mt-3 list-inside list-disc text-xs text-amber-800 dark:text-amber-200/90">
                      {er.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          {report.foyers.length > 0 ? (
            <div>
              <h3 className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-100">Foyers fiscaux (synthèse)</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800/80">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Membres</th>
                      <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Parts</th>
                      <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">Revenu imposable (agrégé)</th>
                      <th className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">IR (barème)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.foyers.map((f, idx) => (
                      <tr key={idx} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                          {f.personIds.map(id => entityLabel(entities, id)).join(", ")}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{f.totalParts}</td>
                        <td className="px-3 py-2 tabular-nums">{formatMoney(f.revenuImposableGlobal)}</td>
                        <td className="px-3 py-2 tabular-nums font-medium">{formatMoney(f.impotSurLeRevenu)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                L'IR au niveau foyer est indicatif (revenus directs personnes + rémunérations routées + base micro hors VFL). Les modules société/micro intègrent déjà une part d'IR dans leurs nets ; en cas de foyer multi-activités, écarts possibles jusqu'à refactor du moteur.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
