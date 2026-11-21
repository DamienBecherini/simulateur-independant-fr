// src/ui/components/ExtensionDeLaModification.tsx
// Après une modification ou un retrait dans la fenêtre d'un mois, sous la ligne : la proposition de faire de même dans
// les autres mois et les autres années où le même flux existe (même type, même libellé). C'est la question que posent
// les agendas pour un événement répété, posée après coup : on modifie d'abord, on choisit ensuite où cela vaut.

import { useEffect, useRef, useState } from "react"
import type { FinancialFlow } from "@/types"
import { euros } from "@/backend/logic/format"
import { deMois } from "@/lib/grille-mensuelle"
import { listerAnnees, type ChangementsDeFlux, type PorteeRecurrence, type SerieAilleurs } from "@/lib/flux-recurrents"

/** La dernière modification ou le dernier retrait d'un flux du mois, que la barre propose d'étendre. */
export interface DerniereOperation {
  /** Le flux avant la première modification : la série se repère d'après lui. */
  avant: FinancialFlow
  /** Les changements, cumulés depuis `avant` ; `null` pour un retrait. */
  changements: ChangementsDeFlux | null
  /** Le flux tel qu'il était juste avant le retrait, que « Annuler » remet ; pour une modification, le flux modifié. */
  flux: FinancialFlow
  /** Rang du flux parmi ceux du mois : la barre d'un retrait s'affiche à sa place, et « Annuler » l'y remet. */
  rang: number
}

interface ExtensionDeLaModificationProps {
  operation: DerniereOperation
  /** Le mois ouvert, en minuscules (« juillet »). */
  mois: string
  /** Où le flux existe hors de ce mois : seules ces portées et ces années sont proposées. */
  serie: SerieAilleurs
  onEtendre: (portee: PorteeRecurrence, aussiEn: number[]) => void
  /** « non, juillet seulement » : la barre disparaît, la modification reste au seul mois ouvert. */
  onFermer: () => void
  /** « Annuler » après un retrait : le flux revient dans le mois. */
  onAnnulerLeRetrait: () => void
}

const BOUTON = "inline-flex min-h-8 cursor-pointer items-center rounded-md border border-amber-400 bg-white px-2.5 font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-700 pointer-coarse:min-h-11 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-50 dark:hover:bg-amber-900"
const LIEN = "inline-flex min-h-8 cursor-pointer items-center rounded-md px-1 text-amber-900 underline underline-offset-2 hover:text-amber-950 pointer-coarse:min-h-11 dark:text-amber-200 dark:hover:text-amber-50"

/** Ce que la barre rappelle de l'opération : le nouveau montant, le retrait, ou la modification. */
function quoi(operation: DerniereOperation, mois: string): string {
  const { avant, changements } = operation
  if (!changements) return `Retiré ${deMois(mois)}.`
  if (changements.amount !== undefined) return `${euros(changements.amount)} en ${mois}.`
  if (changements.label !== undefined && changements.label !== avant.label) return `« ${changements.label} » en ${mois}.`
  return `Modifié en ${mois}.`
}

/** Les portées proposées, selon les mois où le flux existe : « juillet à décembre », « toute l'année », ou les deux. */
function portees(serie: SerieAilleurs, mois: string): { portee: PorteeRecurrence; libelle: string }[] {
  const suivants = { portee: "suivants" as const, libelle: `${mois} à décembre` }
  const annee = { portee: "annee" as const, libelle: "toute l'année" }
  if (serie.precedents > 0 && serie.suivants > 0) return [suivants, annee]
  if (serie.suivants > 0) return [suivants]
  if (serie.precedents > 0) return [annee]
  return []
}

/**
 * La barre, sous la ligne modifiée ou à la place du flux retiré ; rien si le flux n'existe dans aucun autre mois ni
 * aucune autre année. Les autres années où il existe sont des cases à cocher, appliquées avec la portée choisie (aux
 * mêmes mois de chaque année cochée) ; une fois une année cochée, un bouton vise le seul même mois de ces années
 * (« mars 2025 et 2027 »). Elle disparaît une fois le choix fait, à la modification suivante ou à la fermeture de la
 * fenêtre.
 */
export function ExtensionDeLaModification({ operation, mois, serie, onEtendre, onFermer, onAnnulerLeRetrait }: ExtensionDeLaModificationProps) {
  const [aussiEn, setAussiEn] = useState<number[]>([])
  const zone = useRef<HTMLDivElement>(null)
  // Dans la liste qui défile (téléphone, longue liste), la barre est amenée à l'écran à son apparition. Entre accolades :
  // le navigateur peut renvoyer une promesse, que React prendrait pour la fonction de nettoyage de l'effet.
  useEffect(() => {
    zone.current?.scrollIntoView?.({ block: "nearest" })
  }, [])
  const choix = portees(serie, mois)
  if (choix.length === 0 && serie.autresAnnees.length === 0) return null
  const retrait = operation.changements === null
  const basculer = (annee: number, cochee: boolean) => setAussiEn(cochee ? [...aussiEn, annee] : aussiEn.filter(a => a !== annee))
  return (
    <div ref={zone} role="group" aria-label={retrait ? "Retirer aussi d'autres mois" : "Modifier aussi d'autres mois"} data-extension={retrait ? "retrait" : "modification"} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-50">
      <span role="status" className="font-medium">
        {quoi(operation, mois)}
      </span>
      <span>{retrait ? "Retirer aussi :" : "Aussi :"}</span>
      {choix.map(({ portee, libelle }) => (
        <button key={portee} type="button" className={BOUTON} onClick={() => onEtendre(portee, aussiEn)}>
          {libelle}
        </button>
      ))}
      {serie.autresAnnees.length > 0 ? (
        <span className="flex flex-wrap items-center gap-x-3">
          <span>{choix.length > 0 ? "et en" : "en"}</span>
          {serie.autresAnnees.map(annee => (
            <label key={annee} className="flex min-h-8 cursor-pointer items-center gap-1.5 pointer-coarse:min-h-11">
              <input type="checkbox" className="size-4 cursor-pointer accent-amber-600" checked={aussiEn.includes(annee)} onChange={e => basculer(annee, e.target.checked)} />
              {annee}
            </label>
          ))}
          {/* Le même mois des années cochées, seul. */}
          {aussiEn.length > 0 ? (
            <button type="button" className={BOUTON} onClick={() => onEtendre("mois", aussiEn)}>
              {mois} {listerAnnees([...aussiEn].sort((a, b) => a - b))}
            </button>
          ) : null}
        </span>
      ) : null}
      {retrait ? (
        <button type="button" className={LIEN} onClick={onAnnulerLeRetrait}>
          Annuler
        </button>
      ) : (
        <button type="button" className={LIEN} onClick={onFermer}>
          non, {mois} seulement
        </button>
      )}
    </div>
  )
}
