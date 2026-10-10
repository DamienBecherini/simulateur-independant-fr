// src/ui/components/MonthlyFlowsModal.tsx

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import type { Entity, FinancialFlow } from "@/types"
import { flowTypeLabels, getFlowTypesForEntity, type FlowType } from "@/lib/flow-constants"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FlowItem, type FlowChanges } from "./FlowItem"
import { NewFlowItem, type NewFlowValues } from "./NewFlowItem"
import { useTriAccessible } from "../hooks/useTriAccessible"
import { anneesDuRaccourci, LIBELLES_PORTEE, LIBELLES_RACCOURCIS_ANNEES, listerAnnees, SEUIL_RACCOURCIS_ANNEES, type PorteeRecurrence, type RaccourciAnnees } from "@/lib/flux-recurrents"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
import { cn } from "@/lib/utils"

/**
 * Interface pour les props du composant MonthlyFlowsModal.
 * Cette fenêtre liste les flux d'une entité pour un mois : chaque ligne s'édite sur place
 * et une dernière ligne vide permet d'en ajouter. Elle est montée à l'ouverture et démontée
 * à la fermeture, son état local repart donc de zéro à chaque ouverture.
 */
interface MonthlyFlowsModalProps {
  onClose: () => void
  flows: FinancialFlow[]
  entity: Entity
  monthName: string
  /**
   * Année affichée, pour les raccourcis « Années précédentes » et « Années suivantes », et dont les cotisations
   * salariales donnent le brut ou le net d'un salaire saisi sans pourcentage.
   */
  annee: number
  /** Autres années de la session, proposées en cases à cocher ; aucune case sans autre année. */
  autresAnnees?: number[]
  /** Crée le flux dans ce mois et, selon la portée choisie, le recopie sur d'autres mois et dans les années cochées. */
  onCreate: (values: NewFlowValues, portee: PorteeRecurrence, aussiEn: number[]) => void
  /** Recopie un flux sur les mois suivants de l'année affichée ; absent en décembre, où il n'y a pas de mois suivant. */
  onRecopier?: (flowId: string) => void
  /** Modifie le flux et, selon la portée choisie, sa série dans les autres mois et les années cochées. */
  onUpdate: (flowId: string, changes: FlowChanges, portee: PorteeRecurrence, aussiEn: number[]) => void
  /** Supprime le flux et, selon la portée choisie, sa série dans les autres mois et les années cochées. */
  onDelete: (flowId: string, portee: PorteeRecurrence, aussiEn: number[]) => void
  onReorder: (reorderedFlows: FinancialFlow[]) => void
}

/** Texte d'avertissement quand une opération touchera plus que le mois ouvert ; `null` sinon. */
function avertissement(portee: PorteeRecurrence, aussiEn: number[]): string | null {
  const debut = "Les ajouts, modifications et suppressions s'appliquent aussi"
  if (aussiEn.length === 0) return portee === "mois" ? null : `${debut} aux autres mois choisis.`
  const annees = listerAnnees(aussiEn)
  return portee === "mois" ? `${debut} au même mois en ${annees}.` : `${debut} aux autres mois choisis, et aux mêmes mois en ${annees}.`
}

/** Mise en évidence d'un réglage qui étend les opérations au-delà du mois ouvert. */
const EN_EVIDENCE = "border-amber-500 bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-950 dark:ring-amber-700"

/** Ordre d'affichage des raccourcis. */
const RACCOURCIS: RaccourciAnnees[] = ["toutes", "aucune", "precedentes", "suivantes"]

interface CasesDesAnneesProps {
  annee: number
  autresAnnees: number[]
  aussiEn: number[]
  setAussiEn: (annees: number[]) => void
}

/**
 * Les autres années de la session, en cases à cocher, mises en évidence dès qu'une est cochée. Au-delà de
 * SEUIL_RACCOURCIS_ANNEES, des raccourcis cochent toutes les années, aucune, les précédentes ou les suivantes ;
 * la liste passe alors sur sa propre ligne et va à la ligne autant que nécessaire.
 */
function CasesDesAnnees({ annee, autresAnnees, aussiEn, setAussiEn }: CasesDesAnneesProps) {
  const avecRaccourcis = autresAnnees.length > SEUIL_RACCOURCIS_ANNEES
  const basculerAnnee = (a: number, cochee: boolean) => setAussiEn(cochee ? [...aussiEn, a] : aussiEn.filter(x => x !== a))

  return (
    <fieldset className={cn("rounded-md border border-transparent px-2", avecRaccourcis && "w-full", aussiEn.length > 0 && EN_EVIDENCE)}>
      {/* Sur un écran étroit, avec les raccourcis, la légende prend toute la ligne : les raccourcis vont dessous. */}
      <legend className={cn("float-left mr-2 flex min-h-9 items-center pointer-coarse:min-h-11", avecRaccourcis && "max-sm:w-full")}>Aussi en :</legend>
      {avecRaccourcis ? (
        <div className="flex flex-wrap items-center gap-1 py-0.5 max-sm:clear-left">
          {RACCOURCIS.map(raccourci => {
            const annees = anneesDuRaccourci(raccourci, annee, autresAnnees)
            // Pas d'année avant (ou après) l'année affichée : le raccourci est désactivé. Il ne l'est jamais à la suite
            // d'un clic (sélection déjà identique), pour que le focus ne se perde pas.
            return (
              <Button
                key={raccourci}
                type="button"
                size="sm"
                variant="outline"
                className="text-sm"
                aria-label={LIBELLES_RACCOURCIS_ANNEES[raccourci].nom}
                disabled={raccourci !== "aucune" && annees.length === 0}
                onClick={() => setAussiEn(annees)}
              >
                {LIBELLES_RACCOURCIS_ANNEES[raccourci].texte}
              </Button>
            )
          })}
        </div>
      ) : null}
      <div className={cn("flex flex-wrap items-center gap-x-4", avecRaccourcis && "clear-left")}>
        {autresAnnees.map(a => (
          <label key={a} className="flex min-h-9 cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
            <input type="checkbox" className="size-4 cursor-pointer accent-amber-600" checked={aussiEn.includes(a)} onChange={e => basculerAnnee(a, e.target.checked)} />
            {a}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function MonthlyFlowsModal({ onClose, flows, entity, monthName, annee, autresAnnees = [], onCreate, onRecopier, onUpdate, onDelete, onReorder }: MonthlyFlowsModalProps) {
  const flowIds = useMemo(() => flows.map(f => f.id), [flows])
  const tri = useTriAccessible(useMemo(() => flows.map(f => ({ id: f.id, nom: f.label || flowTypeLabels[f.type] })), [flows]))
  const allowedTypes = getFlowTypesForEntity(entity)
  const regles = reglesDeLAnneeAffichee(annee)

  // Type prérempli de la ligne d'ajout : le dernier type utilisé dans cette fenêtre, sinon le premier autorisé.
  const [newFlowType, setNewFlowType] = useState<FlowType>(allowedTypes[0])
  // Portée des ajouts, modifications et suppressions : gardée tant que la fenêtre est ouverte.
  const [portee, setPortee] = useState<PorteeRecurrence>("mois")
  // Autres années où appliquer aussi ces opérations : aucune cochée à chaque ouverture.
  const [aussiEn, setAussiEn] = useState<number[]>([])
  const texteAvertissement = avertissement(portee, aussiEn)

  const listRef = useRef<HTMLDivElement>(null)
  const newFlowLabelRef = useRef<HTMLInputElement>(null)

  // Quand un flux est ajouté, la liste défile pour le montrer.
  const previousFlowCount = useRef(flows.length)
  useEffect(() => {
    if (flows.length > previousFlowCount.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
    previousFlowCount.current = flows.length
  }, [flows.length])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = flowIds.indexOf(active.id as string)
      const newIndex = flowIds.indexOf(over.id as string)
      onReorder(arrayMove(flows, oldIndex, newIndex))
    }
  }

  const handleClose = () => {
    // Retirer le focus valide la saisie en cours avant que la fenêtre ne soit démontée.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => !open && handleClose()}>
      <DialogContent
        // Sur un téléphone, la fenêtre peut dépasser la hauteur de l'écran : elle défile plutôt que d'être coupée.
        // `min-w-0` : son contenu (la longue liste « Appliquer à ») se resserre au lieu de la faire défiler en largeur.
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0"
        // À l'ouverture, le focus va sur la ligne d'ajout pour saisir sans clic supplémentaire.
        onOpenAutoFocus={event => {
          event.preventDefault()
          newFlowLabelRef.current?.focus()
        }}
        // Échap annule d'abord la saisie en cours du champ ; la fenêtre ne se ferme que s'il n'y en a pas.
        onEscapeKeyDown={event => {
          if (event.target instanceof HTMLElement && event.target.dataset.editing === "true") event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            <span>Opérations de {monthName}</span>
            <span className="text-base font-normal text-slate-600 dark:text-slate-400">/ {entity.name}</span>
          </DialogTitle>
          <DialogDescription>Modifiez les flux directement dans la liste, réorganisez-les par glisser-déposer. La dernière ligne sert à en ajouter un : Entrée sur le montant valide et enchaîne sur le suivant. Pour une charge ou un revenu qui revient chaque mois, choisissez « Appliquer à » en dessous : l'ajout, la modification ou la suppression vaut alors aussi pour les autres mois (même type et même libellé).{autresAnnees.length > 0 ? " Cochez d'autres années sous « Aussi en » : les mêmes mois y sont visés (en juillet, « ce mois et les suivants » vise juillet à décembre de chaque année cochée)." : ""} Le bouton de recopie d'un flux le recopie jusqu'en décembre de l'année affichée. Pour un salaire, le brut est calculé avec les cotisations salariales de {regles.annee} si vous ne le saisissez pas ; videz-le pour ne compter aucune cotisation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {flows.length > 0 && (
            <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div ref={listRef} className="max-h-[50vh] space-y-2 overflow-y-auto">
                <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
                  {flows.map(flow => (
                    <FlowItem key={flow.id} flow={flow} allowedTypes={allowedTypes} onUpdate={(flowId, changes) => onUpdate(flowId, changes, portee, aussiEn)} onDelete={flowId => onDelete(flowId, portee, aussiEn)} onRecopier={onRecopier} onTypeUsed={setNewFlowType} typeActeur={entity.type} regles={regles} />
                  ))}
                </SortableContext>
              </div>
            </DndContext>
          )}

          <NewFlowItem type={newFlowType} allowedTypes={allowedTypes} onTypeChange={setNewFlowType} onCreate={values => onCreate(values, portee, aussiEn)} labelInputRef={newFlowLabelRef} typeActeur={entity.type} regles={regles} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm text-slate-700 dark:text-slate-300">
            {/* `min-w-0 max-w-full` : avec une police large, la liste se resserre à la largeur de la fenêtre au lieu de la déborder. */}
            <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              Appliquer à :
              {/* Hors « ce mois seulement », la liste est mise en évidence : modifier ou supprimer touchera aussi d'autres mois. */}
              <select className={cn("h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm pointer-coarse:h-11", portee !== "mois" && cn(EN_EVIDENCE, "font-medium"))} value={portee} onChange={e => setPortee(e.target.value as PorteeRecurrence)}>
                {(Object.keys(LIBELLES_PORTEE) as PorteeRecurrence[]).map(cle => (
                  <option key={cle} value={cle}>
                    {LIBELLES_PORTEE[cle]}
                  </option>
                ))}
              </select>
            </label>
            {/* Les autres années de la session, seulement s'il y en a ; mises en évidence dès qu'une est cochée. */}
            {autresAnnees.length > 0 ? <CasesDesAnnees annee={annee} autresAnnees={autresAnnees} aussiEn={aussiEn} setAussiEn={setAussiEn} /> : null}
          </div>
          {texteAvertissement ? <p className="px-1 text-sm text-amber-900 dark:text-amber-100">{texteAvertissement}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Terminé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
