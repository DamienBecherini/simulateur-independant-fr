// src/ui/components/SyntheseDesAnnees.tsx
// Synthèse des années de la session, une ligne par année : ce que les foyers gardent et ce qui part en prélèvements.

import type { SimulationPluriannuelle } from "@/types"
import { reservesDesSocietes } from "@/lib/reserves"
import { cn } from "@/lib/utils"
import { ZoneDefilante } from "./ZoneDefilante"
import { COLONNE_FIXE } from "../colonne-fixe"

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`

/** Sur un écran étroit, le tableau défile en largeur et la colonne des années reste visible, sur une ligne. */
const COLONNE_DES_ANNEES = cn(COLONNE_FIXE, "whitespace-nowrap")

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
  // Réserves des sociétés à l'IS au 31 décembre, cumulées d'une année à l'autre : une colonne dès qu'une année en a.
  const reserves = simulation.annees.map(({ report }) => (report ? reservesDesSocietes(report) : null))
  const avecReserves = reserves.some(montant => montant !== null)

  return (
    <section className="mt-8 space-y-3" aria-labelledby="synthese-annees-titre">
      <h3 id="synthese-annees-titre" className="text-lg font-medium text-slate-800 dark:text-slate-100">
        Toutes les années
      </h3>
      <ZoneDefilante libelle="Synthèse des années">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">Net après impôts et prélèvements de chaque année de la session{avecReserves ? ", et réserves des sociétés à la fin de l'année" : ""}</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left dark:border-slate-700">
              <th scope="col" className={cn(COLONNE_DES_ANNEES, "bg-background py-2 pr-4 font-medium")}>
                Année
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Net après impôts
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                Total des prélèvements
              </th>
              <th scope="col" className={cn("py-2 text-right font-medium", avecReserves && "pr-4")}>
                Revenus avant prélèvements
              </th>
              {avecReserves ? (
                <th scope="col" className="py-2 text-right font-medium">
                  Réserves des sociétés au 31 décembre
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {simulation.annees.map(({ annee: a, report, erreur }, i) => (
              <tr key={a} className={cn("border-b border-slate-100 dark:border-slate-800", a === annee && "bg-blue-50 font-semibold dark:bg-blue-950/40")} aria-current={a === annee ? "true" : undefined}>
                <th scope="row" className={cn(COLONNE_DES_ANNEES, "py-2 pr-4 text-left font-medium", a === annee ? FOND_ANNEE_AFFICHEE : "bg-background")}>
                  {a}
                  {report && report.anneeDesRegles !== a ? <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">règles {report.anneeDesRegles}</span> : null}
                </th>
                {report ? (
                  <>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{euros(report.totalNetApresImpots)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{euros(report.bilan.totalPrelevements)}</td>
                    <td className={cn("py-2 text-right tabular-nums", avecReserves && "pr-4")}>{euros(report.bilan.revenusAvantPrelevements)}</td>
                    {avecReserves ? <td className="py-2 text-right tabular-nums">{euros(reserves[i] ?? 0)}</td> : null}
                  </>
                ) : (
                  <td colSpan={avecReserves ? 4 : 3} className="py-2 text-slate-600 dark:text-slate-400">
                    {erreur ?? "Non calculée"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </ZoneDefilante>
      <DispositifsDesAnnees simulation={simulation} />
    </section>
  )
}

/**
 * Dispositifs limités dans le temps, année par année : sortie du régime micro et son annonce, retour au régime, ACRE,
 * plafonds au prorata l'année de création. Rien quand aucun ne joue.
 */
function DispositifsDesAnnees({ simulation }: { simulation: SimulationPluriannuelle }) {
  const notes = simulation.annees.flatMap(({ annee, report }) => (report?.activities ?? []).flatMap(activite => (activite.dispositifs ?? []).map(note => ({ annee, activite: activite.name, note }))))
  if (notes.length === 0) return null
  return (
    <div className="space-y-1">
      <h4 id="synthese-dispositifs-titre" className="text-sm font-medium text-slate-800 dark:text-slate-100">
        Dispositifs dans le temps
      </h4>
      <ul aria-labelledby="synthese-dispositifs-titre" className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
        {notes.map(({ annee, activite, note }) => (
          <li key={`${annee}-${activite}-${note}`}>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {annee} · {activite} :
            </span>{" "}
            {note}
          </li>
        ))}
      </ul>
    </div>
  )
}
