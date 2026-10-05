// src/ui/components/VuesDeLaPage.tsx
// Affichage « Trois vues » (proposition B de l'étude d'allègement de l'écran) : les onglets, sous la barre de résumé,
// et les trois vues de la page. Motif « onglets » des WAI-ARIA : flèches gauche et droite, Début et Fin, un seul
// onglet dans l'ordre de tabulation. Les vues masquées restent dans la page : le comparateur continue de transmettre
// son meilleur statut à la barre de résumé, et l'impression montre les trois vues à la suite.

import type { KeyboardEvent, ReactNode } from "react"
import { VUES, libelleDeLaVue, vueVoisine, type Vue } from "@/lib/vues"
import { cn } from "@/lib/utils"
import { idDeLaVue, idDeLOnglet, idDuTitreDeLaVue, useVuesDeLaPage, type Vues } from "../hooks/useVues"

export function OngletsDesVues({ vue, choisir }: Vues) {
  const auClavier = (e: KeyboardEvent<HTMLButtonElement>) => {
    const suivante = vueVoisine(vue, e.key)
    if (!suivante) return
    e.preventDefault()
    choisir(suivante, true)
    document.getElementById(idDeLOnglet(suivante))?.focus()
  }

  return (
    <div role="tablist" aria-label="Vues de la page" className="flex gap-1 border-x border-b border-blue-200 bg-background/95 px-2 py-1.5 backdrop-blur-sm max-sm:border-x-0 sm:rounded-b-md dark:border-blue-900">
      {VUES.map(({ valeur, libelle, libelleCourt }) => {
        const choisie = valeur === vue
        return (
          <button
            key={valeur}
            type="button"
            role="tab"
            id={idDeLOnglet(valeur)}
            aria-selected={choisie}
            aria-controls={idDeLaVue(valeur)}
            tabIndex={choisie ? 0 : -1}
            onClick={() => choisir(valeur)}
            onKeyDown={auClavier}
            className={cn(
              "min-h-8 rounded-md px-3 text-sm font-medium max-sm:flex-1 pointer-coarse:min-h-11",
              choisie ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span className="max-sm:hidden">{libelle}</span>
            <span className="sm:hidden">{libelleCourt}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Une vue de la page : affichée si c'est la vue choisie, masquée sinon, sauf à l'impression, qui montre les trois vues
 * dans l'ordre. Son titre, lu par les lecteurs d'écran, reçoit le focus au changement de vue. Hors de l'affichage
 * « Trois vues », le contenu est rendu tel quel. À l'écran, le premier bloc de la vue perd la marge qui le séparait du
 * bloc précédent dans la page d'un seul tenant ; sur papier, les vues se suivent avec leurs marges habituelles.
 */
export function VueDeLaPage({ vue, children }: { vue: Vue; children: ReactNode }) {
  const vues = useVuesDeLaPage()
  if (!vues) return <>{children}</>
  return (
    <section role="tabpanel" id={idDeLaVue(vue)} aria-labelledby={idDeLOnglet(vue)} data-vue={vue} className={cn("not-print:[&>h2+*]:mt-0", vues.vue !== vue && "hidden print:block")}>
      <h2 id={idDuTitreDeLaVue(vue)} tabIndex={-1} className="sr-only">
        {libelleDeLaVue(vue)}
      </h2>
      {children}
    </section>
  )
}
