// src/ui/components/NatureDuChiffreDAffaires.tsx

import { useId } from "react"
import type { ReglesFiscales } from "@/backend/logic/regles"
import type { FlowType } from "@/lib/flow-constants"
import { descriptionsDesNatures, introductionDesNatures, noteSurLesAchats, type NatureMicro } from "@/lib/nature-de-l-activite"
import type { MicroEntreprise } from "@/types"

interface NatureDuChiffreDAffairesProps {
  activite: MicroEntreprise
  /** Règles de l'année affichée, dont les taux sont cités. */
  regles: ReglesFiscales
  /** Type de la ligne d'ajout : la nature cochée, aucune pour une charge. */
  valeur: FlowType
  onChange: (nature: NatureMicro) => void
  /** Une vente est saisie ou choisie : la note sur les achats non déductibles s'affiche. */
  avecLaVente: boolean
}

/**
 * Le choix de la nature du chiffre d'affaires d'une micro-entreprise, sous la ligne d'ajout de la fenêtre des flux :
 * chaque nature avec ses taux de l'année et des exemples de métiers. Cocher une nature change le type de la ligne
 * d'ajout, comme sa liste ; un libéral qui ne connaît pas le sigle BNC s'y reconnaît sans ouvrir la liste.
 */
export function NatureDuChiffreDAffaires({ activite, regles, valeur, onChange, avecLaVente }: NatureDuChiffreDAffairesProps) {
  const id = useId()
  return (
    <fieldset className="rounded-md border px-3 pt-1 pb-2 text-sm text-slate-700 dark:text-slate-300">
      <legend className="px-1 font-medium text-slate-800 dark:text-slate-100">Nature du chiffre d'affaires à ajouter</legend>
      <p className="mb-1 text-slate-600 dark:text-slate-400">{introductionDesNatures(activite, regles)}</p>
      {descriptionsDesNatures(activite, regles).map(nature => (
        <div key={nature.type} className="flex items-start gap-2 py-0.5">
          <input id={`${id}-${nature.type}`} type="radio" name={`${id}-nature`} className="mt-0.5 size-4 shrink-0 cursor-pointer pointer-coarse:size-5" checked={valeur === nature.type} onChange={() => onChange(nature.type)} aria-describedby={`${id}-${nature.type}-detail`} />
          <p>
            <label htmlFor={`${id}-${nature.type}`} className="cursor-pointer font-medium">
              {nature.libelle}
            </label>
            <span id={`${id}-${nature.type}-detail`}>
              {" "}
              : {nature.taux}. <span className="text-slate-600 dark:text-slate-400">Par exemple : {nature.exemples}.</span>
            </span>
          </p>
        </div>
      ))}
      {avecLaVente ? <p className="mt-1 rounded-md bg-amber-50 p-2 text-amber-950 dark:bg-amber-950 dark:text-amber-100">{noteSurLesAchats(regles)}</p> : null}
    </fieldset>
  )
}
