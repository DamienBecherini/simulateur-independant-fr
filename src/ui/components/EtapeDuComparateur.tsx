// src/ui/components/EtapeDuComparateur.tsx
// Une étape de l'onglet « Comparer et optimiser » : 1. ce qui est comparé, 2. le résultat, 3. les réglages de la
// société. Les zones de réglage sont teintées, au trait pointillé, et portent la mention « Réglage » ; la zone de
// résultat est la seule carte blanche, avec une ombre : on distingue d'un coup d'œil ce qui se règle de ce qui se lit.

import type { ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

interface EtapeProps {
  numero: number
  titre: ReactNode
  /** Identifiant du titre ; le titre peut recevoir le focus quand un lien y mène. */
  id: string
  /** Réglage : zone teintée ; résultat : carte blanche, mise en avant. */
  genre: "reglage" | "resultat"
  /** Ce qui suit le titre sur sa ligne : la liste des activités, une puce. */
  aCote?: ReactNode
  children: ReactNode
}

export function EtapeDuComparateur({ numero, titre, id, genre, aCote, children }: EtapeProps) {
  const reglage = genre === "reglage"
  return (
    <section
      aria-labelledby={id}
      data-etape={numero}
      className={cn(
        "min-w-0 space-y-3 rounded-xl p-3 sm:p-4 print:border-0 print:bg-transparent print:p-0 print:shadow-none",
        reglage ? "border border-dashed border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/50" : "border border-slate-200 bg-background shadow-md sm:p-5 dark:border-slate-600 dark:shadow-[0_0_32px_-2px_rgb(255_255_255/0.24)]"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={id} tabIndex={-1} className="flex items-center gap-2.5 text-xl font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-100">
          <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-full text-base font-bold", reglage ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-emerald-950")}>
            {numero}
          </span>
          <span>
            <span className="sr-only">{`Étape ${numero} : `}</span>
            {titre}
          </span>
        </h3>
        {aCote}
        {reglage ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 print:hidden">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            Réglage
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/** Puce qui dit quelles colonnes du tableau un réglage change : « toutes les colonnes », « SASU, EURL », « Portage ». */
export function ColonnesTouchees({ children, societe = false }: { children: ReactNode; societe?: boolean }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal", societe ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200")}>{children}</span>
}
