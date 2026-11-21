// src/ui/components/NatureDuChiffreDAffaires.tsx

import type { ReglesFiscales } from "@/backend/logic/regles"
import { flowTypeLabels, type FlowType } from "@/lib/flow-constants"
import { descriptionsDesNatures, estNatureMicro, introductionDesNatures, noteSurLesAchats } from "@/lib/nature-de-l-activite"
import type { MicroEntreprise } from "@/types"
import { Depliable } from "./Depliable"

interface NatureDuChiffreDAffairesProps {
  activite: MicroEntreprise
  /** Règles de l'année affichée, dont les taux sont cités. */
  regles: ReglesFiscales
  /** Type de la ligne d'ajout : sa nature est signalée dans la liste, aucune pour une charge. */
  valeur: FlowType
  /** Une vente est saisie ou choisie : la note sur les achats non déductibles s'affiche. */
  avecLaVente: boolean
  /**
   * L'activité a déjà un chiffre d'affaires dans l'année : sa nature est connue, l'aide s'ouvre repliée (la liste des
   * types de la ligne d'ajout suffit pour en changer). Sinon, elle s'ouvre dépliée, à lire avant la première saisie.
   */
  natureDejaSaisie: boolean
}

/**
 * L'aide sur la nature du chiffre d'affaires d'une micro-entreprise, sous la ligne d'ajout de la fenêtre des flux :
 * chaque nature avec ses taux de l'année et des exemples de métiers, en liste, à lire. On ne choisit rien ici : la
 * nature se choisit dans la liste des types de la ligne d'ajout, et chaque montant garde la sienne ; un libéral qui ne
 * connaît pas le sigle BNC s'y reconnaît. La nature de la ligne d'ajout est signalée dans la liste et rappelée dans le
 * titre de la section repliée.
 */
export function NatureDuChiffreDAffaires({ activite, regles, valeur, avecLaVente, natureDejaSaisie }: NatureDuChiffreDAffairesProps) {
  const titre = (
    <span>
      Nature du chiffre d'affaires{estNatureMicro(valeur) ? <span className="font-normal"> : {flowTypeLabels[valeur]}</span> : null}
    </span>
  )
  return (
    <Depliable titre={titre} ouverteParDefaut={!natureDejaSaisie} className="rounded-md border px-3 py-1 text-sm text-slate-700 dark:text-slate-300">
      <div className="pb-1">
        <p className="mb-1 text-slate-600 dark:text-slate-400">{introductionDesNatures(activite, regles)}</p>
        <ul aria-label="Natures du chiffre d'affaires" className="list-disc space-y-0.5 pl-5">
          {descriptionsDesNatures(activite, regles).map(nature => (
            <li key={nature.type} aria-current={valeur === nature.type ? "true" : undefined}>
              <span className="font-medium">{nature.libelle}</span>
              {valeur === nature.type ? " " : null}
              {valeur === nature.type ? <span className="rounded bg-slate-200 px-1 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100">ligne d'ajout</span> : null} : {nature.taux}. <span className="text-slate-600 dark:text-slate-400">Par exemple : {nature.exemples}.</span>
            </li>
          ))}
        </ul>
      </div>
      {avecLaVente ? <p className="mt-1 mb-1 rounded-md bg-amber-50 p-2 text-amber-950 dark:bg-amber-950 dark:text-amber-100">{noteSurLesAchats(regles)}</p> : null}
    </Depliable>
  )
}
