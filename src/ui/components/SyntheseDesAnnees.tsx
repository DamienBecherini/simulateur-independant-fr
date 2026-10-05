// src/ui/components/SyntheseDesAnnees.tsx
// Synthèse des années de la session, une ligne par année : ce que les foyers gardent et ce qui part en prélèvements.

import type { SimulationPluriannuelle } from "@/types"
import { cn } from "@/lib/utils"
import { ZoneDefilante } from "./ZoneDefilante"

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

/**
 * Sur un écran étroit, le tableau défile en largeur et la colonne des années reste visible. Une cellule fixe
 * recouvre celles qui défilent dessous : elle a donc un fond opaque, celui de la page ou de l'année affichée,
 * et un trait à droite (une ombre : en `border-collapse`, une bordure ne suivrait pas la cellule).
 */
const COLONNE_FIXE = "sticky left-0 z-10 whitespace-nowrap shadow-[inset_-1px_0_0_var(--border)] print:static print:shadow-none"

/** Fond de l'année affichée : le bleu translucide de la ligne, rendu opaque sur le fond de la page en thème sombre. */
const FOND_ANNEE_AFFICHEE = "bg-blue-50 dark:bg-[color-mix(in_oklab,var(--color-blue-950)_40%,var(--background))]"

interface SyntheseDesAnneesProps {
  simulation: SimulationPluriannuelle | null
  /** Année affichée, mise en évidence. */
  annee: number
}

/** Rien à synthétiser tant que la session ne compte qu'une année. */
export function SyntheseDesAnnees({ simulation, annee }: SyntheseDesAnneesProps) {
  if (!simulation || simulation.annees.length < 2) return null

  return (
    <section className="mt-8 space-y-3" aria-labelledby="synthese-annees-titre">
      <h3 id="synthese-annees-titre" className="text-lg font-medium text-slate-800 dark:text-slate-100">
        Toutes les années
      </h3>
      <ZoneDefilante libelle="Synthèse des années">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">Net après impôts et prélèvements de chaque année de la session</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-700">
              <th scope="col" className={cn(COLONNE_FIXE, "bg-background py-2 pr-4 font-medium")}>
                Année
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Net après impôts
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Total des prélèvements
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Revenus avant prélèvements
              </th>
            </tr>
          </thead>
          <tbody>
            {simulation.annees.map(({ annee: a, report, erreur }) => (
              <tr key={a} className={cn("border-b border-slate-100 dark:border-slate-800", a === annee && "bg-blue-50 font-semibold dark:bg-blue-950/40")} aria-current={a === annee ? "true" : undefined}>
                <th scope="row" className={cn(COLONNE_FIXE, "py-2 pr-4 text-left font-medium", a === annee ? FOND_ANNEE_AFFICHEE : "bg-background")}>
                  {a}
                  {report && report.anneeDesRegles !== a ? <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">règles {report.anneeDesRegles}</span> : null}
                </th>
                {report ? (
                  <>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{euros(report.totalNetApresImpots)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{euros(report.bilan.totalPrelevements)}</td>
                    <td className="py-2 text-right tabular-nums">{euros(report.bilan.revenusAvantPrelevements)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="py-2 text-slate-600 dark:text-slate-400">
                    {erreur ?? "Non calculée"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ZoneDefilante>
    </section>
  )
}
