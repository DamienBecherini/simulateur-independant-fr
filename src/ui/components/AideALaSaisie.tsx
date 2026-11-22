// src/ui/components/AideALaSaisie.tsx
// Le mode d'emploi de la fenêtre des flux d'un mois, replié sous « Aide à la saisie » : une consigne par ligne, qui
// commence par le geste en gras et l'icône du bouton dont elle parle, dans l'ordre où l'on en a besoin (ajouter,
// modifier, recopier, retirer, réordonner). Elle suit la fenêtre : « Aussi en » seulement s'il y a d'autres années,
// « Recopier » seulement là où le bouton existe (pas en décembre), « Salaire » seulement pour une personne.

import type { ReactNode } from "react"
import { CopyPlus, Euro, GripVertical, Pencil, Repeat, Trash2 } from "lucide-react"
import { Depliable } from "./Depliable"

interface Consigne {
  icone: ReactNode
  geste: string
  texte: string
}

interface AideALaSaisieProps {
  /** D'autres années sont proposées sous « Aussi en ». */
  autresAnnees: boolean
  /** Le bouton de recopie existe (pas en décembre). */
  recopie: boolean
  /** Une personne : la consigne sur le salaire, avec l'année de ses cotisations salariales. */
  anneeDesCotisations?: number
}

function consignes({ autresAnnees, recopie, anneeDesCotisations }: AideALaSaisieProps): Consigne[] {
  const liste: (Consigne | null)[] = [
    {
      icone: <Repeat />,
      geste: "Chaque mois ?",
      texte: `Choisissez « Ajouter à » avant d'ajouter : le flux est recopié sur les autres mois${autresAnnees ? ", et aux mêmes mois des années cochées sous « Aussi en »" : ""}.`
    },
    { icone: <Pencil />, geste: "Modifier, retirer", texte: "ne vaut que pour ce mois ; si le même flux (même type, même libellé) existe dans d'autres mois, une barre propose ensuite de faire de même." },
    recopie ? { icone: <CopyPlus />, geste: "Recopier", texte: "un flux jusqu'en décembre de l'année affichée." } : null,
    { icone: <Trash2 />, geste: "Retirer", texte: ": la corbeille, ou un montant ramené à 0." },
    { icone: <GripVertical />, geste: "Réordonner", texte: ": glissez la poignée." },
    anneeDesCotisations === undefined ? null : { icone: <Euro />, geste: "Salaire", texte: `: sans brut saisi, il est calculé avec les cotisations salariales de ${anneeDesCotisations} ; videz-le pour n'en compter aucune.` }
  ]
  return liste.filter(consigne => consigne !== null)
}

export function AideALaSaisie(props: AideALaSaisieProps) {
  return (
    <Depliable titre="Aide à la saisie" className="text-left text-sm text-slate-600 dark:text-slate-300">
      <ul className="mt-2 space-y-1.5">
        {consignes(props).map(({ icone, geste, texte }) => (
          <li key={geste} className="grid grid-cols-[1.75rem_1fr] items-start gap-2">
            <span aria-hidden="true" className="grid h-6 w-7 place-items-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 [&>svg]:size-3.5">
              {icone}
            </span>
            <span>
              <strong className="font-semibold text-slate-800 dark:text-slate-100">{geste}</strong> {texte}
            </span>
          </li>
        ))}
      </ul>
    </Depliable>
  )
}
